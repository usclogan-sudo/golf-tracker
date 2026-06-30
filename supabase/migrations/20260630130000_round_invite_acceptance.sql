-- Round invite acceptance: pending -> accepted membership lifecycle.
--
-- Today round membership is pull-based and binary: a round_participants row only
-- exists after a user redeems an invite code (join_round). This migration adds an
-- organizer-initiated invite that creates a *pending* participant the invitee must
-- accept. Self-joins via code stay instant.
--
-- Design mirrors the existing score_status (pending/approved/rejected) +
-- approve_score/reject_score SECURITY DEFINER pattern. Because the new writes go
-- through SECURITY DEFINER RPCs, and the existing "read participants" SELECT policy
-- already lets a user read rows where user_id = auth.uid(), no RLS policy changes
-- are required: invitees can see their own pending rows, owners can read via
-- is_round_owner(), and privileged writes-for-others happen inside the RPCs.

begin;

-- 1. Membership status on round_participants. Default 'accepted' so every existing
--    self-join path (join_round / join_event) keeps producing full members untouched;
--    only invite_to_round writes 'pending'.
alter table public.round_participants
  add column status text not null default 'accepted',
  add column invited_by uuid,
  add column invited_at timestamptz;

alter table public.round_participants
  add constraint round_participants_status_check
  check (status in ('pending', 'accepted', 'declined'));

-- Fast lookup of a user's pending invites.
create index idx_round_participants_user_status
  on public.round_participants (user_id, status);

-- 2. invite_to_round: round owner invites a registered user into a player slot,
--    creating a pending participant + an in-app round_invite notification.
create or replace function public.invite_to_round(p_round_id text, p_user_id uuid, p_player_id text)
  returns jsonb
  language plpgsql security definer
  as $$
  declare
    v_caller uuid := auth.uid();
    v_round record;
    v_player_exists boolean;
    v_existing record;
    v_participant_id text;
    v_creator_name text;
    v_course_name text;
  begin
    if v_caller is null then
      raise exception 'Not authenticated';
    end if;

    if p_user_id = v_caller then
      raise exception 'Cannot invite yourself';
    end if;

    select * into v_round from rounds where id = p_round_id;
    if not found then
      raise exception 'Round not found';
    end if;

    -- Only the round owner may invite.
    if v_round.user_id != v_caller then
      raise exception 'Only the round owner can invite players';
    end if;

    -- Target must be a registered user.
    if not exists (select 1 from user_profiles where user_id = p_user_id) then
      raise exception 'Invited user is not registered';
    end if;

    -- Player slot must exist in the round roster.
    select exists(
      select 1 from jsonb_array_elements(v_round.players) elem
      where elem->>'id' = p_player_id
    ) into v_player_exists;
    if not v_player_exists then
      raise exception 'Player not found in this round';
    end if;

    -- Player slot must not already be claimed (accepted) by a different user.
    if exists (
      select 1 from round_participants
      where round_id = p_round_id and player_id = p_player_id
        and user_id != p_user_id and status = 'accepted'
    ) then
      raise exception 'This player is already claimed by another user';
    end if;

    -- Upsert the invite. Re-inviting a previously declined user flips back to pending;
    -- never downgrade someone who already accepted.
    select * into v_existing from round_participants
    where round_id = p_round_id and user_id = p_user_id;

    if found then
      if v_existing.status = 'accepted' then
        return jsonb_build_object('participant_id', v_existing.id, 'status', 'accepted', 'already', true);
      end if;
      update round_participants
        set status = 'pending', player_id = p_player_id,
            invited_by = v_caller, invited_at = now()
        where id = v_existing.id;
      v_participant_id := v_existing.id;
    else
      v_participant_id := gen_random_uuid()::text;
      insert into round_participants (id, round_id, user_id, player_id, status, invited_by, invited_at)
      values (v_participant_id, p_round_id, p_user_id, p_player_id, 'pending', v_caller, now());
    end if;

    -- Notify the invitee (mirrors send_round_invite_notifications' round_invite shape).
    select display_name into v_creator_name from user_profiles where user_id = v_caller;
    v_course_name := coalesce(v_round.course_snapshot->>'name', 'a round');

    insert into notifications (id, user_id, type, title, body, round_id, invite_code, read, created_at)
    values (
      gen_random_uuid()::text,
      p_user_id,
      'round_invite',
      coalesce(v_creator_name, 'Someone') || ' invited you to play at ' || v_course_name,
      'Tap to accept or decline',
      p_round_id,
      v_round.invite_code,
      false,
      now()
    );

    return jsonb_build_object('participant_id', v_participant_id, 'status', 'pending');
  end;
  $$;

-- 3. respond_to_round_invite: the invitee accepts or declines their pending invite.
create or replace function public.respond_to_round_invite(p_round_id text, p_accept boolean)
  returns jsonb
  language plpgsql security definer
  as $$
  declare
    v_caller uuid := auth.uid();
    v_participant record;
    v_new_status text;
  begin
    if v_caller is null then
      raise exception 'Not authenticated';
    end if;

    select * into v_participant from round_participants
    where round_id = p_round_id and user_id = v_caller;
    if not found then
      raise exception 'No invite found for this round';
    end if;

    if v_participant.status = 'accepted' then
      return jsonb_build_object('status', 'accepted', 'already', true);
    end if;

    v_new_status := case when p_accept then 'accepted' else 'declined' end;

    -- On accept, re-check the slot wasn't claimed while the invite sat pending.
    if p_accept and exists (
      select 1 from round_participants
      where round_id = p_round_id and player_id = v_participant.player_id
        and user_id != v_caller and status = 'accepted'
    ) then
      raise exception 'This player slot has already been claimed';
    end if;

    update round_participants
      set status = v_new_status,
          joined_at = case when p_accept then now() else joined_at end
      where id = v_participant.id;

    return jsonb_build_object('status', v_new_status, 'round_id', p_round_id, 'player_id', v_participant.player_id);
  end;
  $$;

-- 4. Keep code-redemption joins as full members. join_round inserts without status
--    (defaults to 'accepted'), but its ON CONFLICT only set player_id, so an invited
--    (pending) user who later self-joins via code would stay pending. Redefine it to
--    flip status to 'accepted' on conflict. Body is otherwise identical to baseline.
create or replace function public.join_round(p_invite_code text, p_player_id text)
  returns jsonb
  language plpgsql security definer
  as $$
  declare
    v_round record;
    v_caller uuid := auth.uid();
    v_players jsonb;
    v_player_exists boolean;
    v_already_claimed record;
    v_participant_id text;
  begin
    if v_caller is null then
      raise exception 'Not authenticated';
    end if;
    select * into v_round from rounds where invite_code = p_invite_code and status = 'active';
    if not found then
      raise exception 'Round not found or no longer active';
    end if;
    v_players := v_round.players;
    select exists(
      select 1 from jsonb_array_elements(v_players) elem
      where elem->>'id' = p_player_id
    ) into v_player_exists;
    if not v_player_exists then
      raise exception 'Player not found in this round';
    end if;
    select * into v_already_claimed from round_participants
    where round_id = v_round.id and player_id = p_player_id and user_id != v_caller and status = 'accepted';
    if found then
      raise exception 'This player is already claimed by another user';
    end if;
    v_participant_id := gen_random_uuid()::text;
    insert into round_participants (id, round_id, user_id, player_id, status)
    values (v_participant_id, v_round.id, v_caller, p_player_id, 'accepted')
    on conflict (round_id, user_id) do update set player_id = excluded.player_id, status = 'accepted';
    return jsonb_build_object(
      'round_id', v_round.id,
      'participant_id', v_participant_id,
      'player_id', p_player_id
    );
  end;
  $$;

commit;
