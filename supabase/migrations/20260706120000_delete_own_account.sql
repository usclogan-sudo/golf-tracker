-- Self-service account deletion (Apple Guideline 5.1.1(v) / Google Play Data safety).
--
-- The client-side "Delete Account" flow wiped *data* but could not delete the
-- auth.users row (clients lack that privilege), so the login/account survived —
-- which fails Apple review. This SECURITY DEFINER RPC deletes the caller's data
-- AND their auth account, atomically, scoped strictly to auth.uid().
--
-- Security properties:
--   * takes NO parameters and only ever touches auth.uid()'s rows — a caller can
--     never delete another user's account.
--   * SECURITY DEFINER so it can remove rows across RLS-protected tables and the
--     auth.users row; search_path pinned to '' with everything schema-qualified.
--   * EXECUTE granted to authenticated only (not anon/public).
--
-- Deletion order follows the FK graph (baseline_remote_schema):
--   - Most round children FK rounds ON DELETE CASCADE, so deleting the caller's
--     rounds cleans them — but the caller's OWN child rows in *other* users'
--     rounds have user_id -> auth.users (RESTRICT) and must be removed first,
--     or they'd block the auth.users delete.
--   - user_profiles cascades on auth.users delete; admin_audit_log / app_versions
--     / feedback_reports are ON DELETE SET NULL (auto-nulled).

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- 1) Caller's rows in child tables (user_id -> auth.users RESTRICT). Covers the
  --    caller's participation in other users' rounds/events/tournaments too.
  delete from public.prop_wagers         where user_id = uid;
  delete from public.prop_bets           where user_id = uid;  -- cascades its prop_wagers
  delete from public.settlements         where user_id = uid;
  delete from public.side_bets           where user_id = uid;
  delete from public.junk_records        where user_id = uid;  -- no cascading round FK
  delete from public.bbb_points          where user_id = uid;
  delete from public.buy_ins             where user_id = uid;
  delete from public.hole_scores         where user_id = uid;
  delete from public.round_players       where user_id = uid;
  delete from public.round_participants  where user_id = uid;
  delete from public.notifications       where user_id = uid;
  delete from public.tournament_matchups where user_id = uid;
  delete from public.tournament_rounds   where user_id = uid;
  delete from public.event_participants  where user_id = uid;

  -- 2) Parent rows the caller owns — cascades any remaining children (including
  --    other players' rows) inside the caller's rounds/tournaments/events.
  delete from public.rounds      where user_id = uid;
  delete from public.tournaments where user_id = uid;
  delete from public.events      where user_id = uid;

  -- 3) Defensive: clear prop bets/wagers in other users' rounds that reference the
  --    caller's guest players (players back-refs are RESTRICT). Prop bets are
  --    disabled at launch, so this is belt-and-suspenders.
  delete from public.prop_wagers where player_id in (select id from public.players where user_id = uid);
  delete from public.prop_bets   where target_player_id in (select id from public.players where user_id = uid)
                                    or creator_id      in (select id from public.players where user_id = uid);

  -- 4) Standalone data the caller owns.
  delete from public.courses        where user_id = uid;
  delete from public.players        where user_id = uid;
  delete from public.pinned_friends where user_id = uid;
  delete from public.user_profiles  where user_id = uid;  -- also cascades on auth delete

  -- 5) The account itself. SET NULL FKs (admin_audit_log, app_versions,
  --    feedback_reports) are nulled automatically.
  delete from auth.users where id = uid;
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling user''s data and auth account (self-service). No params; scoped to auth.uid(). For App Store / Play account-deletion compliance.';

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
