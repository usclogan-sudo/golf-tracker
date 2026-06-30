-- Round invite acceptance, Phase 2 (SQL): exclude non-accepted participants from
-- active-member reads/permissions. Pending/declined invitees are locked out of round
-- data until they accept (product decision: default-deny).
--
-- Only invite_to_round creates 'pending' rows and it has no UI yet, so these filters
-- are inert for current users (all existing rows are 'accepted') — purely correctness
-- for when the invite UI ships.
--
-- Each function below is reproduced verbatim from the baseline with a single added
-- `status = 'accepted'` predicate; signatures are unchanged for CREATE OR REPLACE.

begin;

-- 1. LINCHPIN: is_round_participant gates SELECT on rounds, hole_scores, buy_ins,
--    bbb_points, junk_records, round_players. Pending members now read none of it.
create or replace function public.is_round_participant(rid text) returns boolean
    language sql stable security definer
    as $$
    select exists (
      select 1 from round_participants
      where round_id = rid and user_id = auth.uid() and status = 'accepted'
    );
  $$;

-- 2. get_round_by_invite: return only accepted members in the roster.
create or replace function public.get_round_by_invite(p_invite_code text) returns jsonb
    language plpgsql security definer
    as $$
  declare
    v_round record;
    v_participants jsonb;
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated';
    end if;

    perform check_invite_rate_limit();

    select * into v_round from rounds where invite_code = p_invite_code and status = 'active';
    if not found then
      raise exception 'Round not found or no longer active';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', rp.id,
      'round_id', rp.round_id,
      'user_id', rp.user_id,
      'player_id', rp.player_id,
      'joined_at', rp.joined_at
    )), '[]'::jsonb) into v_participants
    from round_participants rp where rp.round_id = v_round.id and rp.status = 'accepted';

    return jsonb_build_object(
      'id', v_round.id,
      'course_id', v_round.course_id,
      'date', v_round.date,
      'status', v_round.status,
      'current_hole', v_round.current_hole,
      'course_snapshot', v_round.course_snapshot,
      'game', v_round.game,
      'players', v_round.players,
      'game_master_id', v_round.game_master_id,
      'user_id', v_round.user_id,
      'participants', v_participants
    );
  end;
  $$;

-- 3. submit_participant_score: only accepted members may submit scores.
create or replace function public.submit_participant_score(p_round_id text, p_player_id text, p_hole_number integer, p_gross_score integer) returns jsonb
    language plpgsql security definer
    as $$
  declare
    v_caller uuid := auth.uid();
    v_participant record;
    v_round record;
    v_score_id text;
    v_existing record;
  begin
    if v_caller is null then
      raise exception 'Not authenticated';
    end if;
    if p_gross_score < 1 or p_gross_score > 20 then
      raise exception 'Score must be between 1 and 20';
    end if;
    select * into v_participant from round_participants
    where round_id = p_round_id and user_id = v_caller and player_id = p_player_id and status = 'accepted';
    if not found then
      raise exception 'You are not a participant for this player';
    end if;
    select * into v_round from rounds where id = p_round_id;
    if not found then
      raise exception 'Round not found';
    end if;
    select * into v_existing from hole_scores
    where round_id = p_round_id and player_id = p_player_id and hole_number = p_hole_number;
    if found then
      update hole_scores set gross_score = p_gross_score
      where id = v_existing.id;
      v_score_id := v_existing.id;
    else
      v_score_id := gen_random_uuid()::text;
      insert into hole_scores (id, user_id, round_id, player_id, hole_number, gross_score)
      values (v_score_id, v_round.user_id, p_round_id, p_player_id, p_hole_number, p_gross_score);
    end if;
    return jsonb_build_object('score_id', v_score_id);
  end;
  $$;

-- 4. player_report_buyin: only accepted members may report a buy-in payment.
create or replace function public.player_report_buyin(p_round_id uuid, p_player_id text, p_method text) returns void
    language plpgsql security definer
    as $$
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated';
    end if;
    if not exists (
      select 1 from round_participants
      where round_id = p_round_id and player_id = p_player_id and user_id = auth.uid() and status = 'accepted'
    ) then
      raise exception 'Not authorized — you are not this player in this round';
    end if;
    update buy_ins
    set method = p_method,
        player_reported_at = now()
    where round_id = p_round_id and player_id = p_player_id;
  end;
  $$;

-- 5. player_report_settlement: only accepted members may report a settlement payment.
create or replace function public.player_report_settlement(p_settlement_id text, p_method text) returns void
    language plpgsql security definer
    as $$
  declare
    v_round_id text;
    v_from_player_id text;
  begin
    select round_id, from_player_id
    into v_round_id, v_from_player_id
    from settlements
    where id = p_settlement_id;

    if not found then
      raise exception 'Settlement not found';
    end if;

    if not exists (
      select 1 from round_participants
      where round_id = v_round_id and player_id = v_from_player_id and user_id = auth.uid() and status = 'accepted'
    ) then
      raise exception 'Not authorized — you are not the payer in this settlement';
    end if;

    update settlements
    set reported_method = p_method,
        player_reported_at = now()
    where id = p_settlement_id;
  end;
  $$;

-- 6. settlements SELECT policy uses its OWN inline participant subquery (not the
--    helper), so it must be patched separately to exclude pending members.
drop policy "own or participant read" on public.settlements;
create policy "own or participant read" on public.settlements for select using (
  (user_id = auth.uid()) or (round_id in (
    select round_id from public.round_participants
    where user_id = auth.uid() and status = 'accepted'
  ))
);

commit;
