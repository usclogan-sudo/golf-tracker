-- Event invite acceptance, Phase E2 (SQL): exclude non-accepted event_participants
-- from active-member reads/permissions. Mirrors the rounds filtering (20260630140000).
-- A pending invitee has an event_participants row (role 'player', status 'pending'),
-- so without these filters they could submit event scores and read the event/roster.

begin;

-- 1. submit_event_score: caller must be an ACCEPTED participant.
create or replace function public.submit_event_score(p_round_id text, p_player_id text, p_hole_number integer, p_gross_score integer) returns jsonb
    language plpgsql security definer as $$
  declare
    v_event_id text; v_role text; v_status text; v_round_owner uuid;
    v_score_id text; v_existing_id text; v_caller uuid := auth.uid();
    v_caller_group int; v_target_group int;
  begin
    if v_caller is null then raise exception 'Not authenticated'; end if;
    if p_gross_score < 1 or p_gross_score > 20 then raise exception 'Score must be between 1 and 20'; end if;

    select event_id, user_id into v_event_id, v_round_owner from rounds where id = p_round_id;
    if v_event_id is null then raise exception 'Round is not part of an event'; end if;

    select role, group_number into v_role, v_caller_group
    from event_participants
    where event_id = v_event_id and user_id = v_caller and status = 'accepted';
    if v_role is null then raise exception 'Not a participant in this event'; end if;

    if v_role = 'player' then
      if not exists (
        select 1 from event_participants
        where event_id = v_event_id and user_id = v_caller and player_id = p_player_id and status = 'accepted'
      ) then
        raise exception 'Players can only submit their own scores';
      end if;
    end if;

    if v_role = 'scorekeeper' then
      select group_number into v_target_group
      from event_participants
      where event_id = v_event_id and player_id = p_player_id and status = 'accepted';
      if v_target_group is distinct from v_caller_group then
        raise exception 'Scorekeepers can only submit scores for players in their group';
      end if;
    end if;

    if v_role in ('manager', 'scorekeeper') then v_status := 'approved'; else v_status := 'pending'; end if;

    select id into v_existing_id from hole_scores
    where round_id = p_round_id and player_id = p_player_id and hole_number = p_hole_number;
    if v_existing_id is not null then
      update hole_scores set gross_score = p_gross_score, score_status = v_status, submitted_by = v_caller
      where id = v_existing_id;
      v_score_id := v_existing_id;
    else
      v_score_id := gen_random_uuid()::text;
      insert into hole_scores (id, user_id, round_id, player_id, hole_number, gross_score, score_status, submitted_by)
      values (v_score_id, v_round_owner, p_round_id, p_player_id, p_hole_number, p_gross_score, v_status, v_caller);
    end if;
    return jsonb_build_object('id', v_score_id, 'status', v_status);
  end; $$;

-- 2. approve_score / reject_score: caller role lookup must be an ACCEPTED participant.
create or replace function public.approve_score(p_score_id text) returns void
    language plpgsql security definer as $$
  declare
    v_round_id text; v_event_id text; v_role text; v_caller uuid := auth.uid();
    v_score_player_id text; v_score_group int; v_caller_group int;
  begin
    if v_caller is null then raise exception 'Not authenticated'; end if;
    select round_id, player_id into v_round_id, v_score_player_id from hole_scores where id = p_score_id;
    select event_id into v_event_id from rounds where id = v_round_id;
    if v_event_id is null then raise exception 'Round is not part of an event'; end if;
    select role, group_number into v_role, v_caller_group
    from event_participants where event_id = v_event_id and user_id = v_caller and status = 'accepted';
    if v_role not in ('manager', 'scorekeeper') then raise exception 'Only managers and scorekeepers can approve scores'; end if;
    if v_role = 'scorekeeper' then
      select group_number into v_score_group from event_participants
      where event_id = v_event_id and player_id = v_score_player_id and status = 'accepted';
      if v_score_group is distinct from v_caller_group then
        raise exception 'Scorekeepers can only approve scores in their group';
      end if;
    end if;
    update hole_scores set score_status = 'approved' where id = p_score_id;
  end; $$;

create or replace function public.reject_score(p_score_id text) returns void
    language plpgsql security definer as $$
  declare
    v_round_id text; v_event_id text; v_role text; v_caller uuid := auth.uid();
    v_score_player_id text; v_score_group int; v_caller_group int;
  begin
    if v_caller is null then raise exception 'Not authenticated'; end if;
    select round_id, player_id into v_round_id, v_score_player_id from hole_scores where id = p_score_id;
    select event_id into v_event_id from rounds where id = v_round_id;
    if v_event_id is null then raise exception 'Round is not part of an event'; end if;
    select role, group_number into v_role, v_caller_group
    from event_participants where event_id = v_event_id and user_id = v_caller and status = 'accepted';
    if v_role not in ('manager', 'scorekeeper') then raise exception 'Only managers and scorekeepers can reject scores'; end if;
    if v_role = 'scorekeeper' then
      select group_number into v_score_group from event_participants
      where event_id = v_event_id and player_id = v_score_player_id and status = 'accepted';
      if v_score_group is distinct from v_caller_group then
        raise exception 'Scorekeepers can only reject scores in their group';
      end if;
    end if;
    update hole_scores set score_status = 'rejected' where id = p_score_id;
  end; $$;

-- 3. get_event_by_invite: roster returns only accepted participants.
create or replace function public.get_event_by_invite(p_invite_code text) returns jsonb
    language plpgsql security definer as $$
  declare v_event record; v_round jsonb; v_participants jsonb;
  begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;
    perform check_invite_rate_limit();
    select * into v_event from events where invite_code = upper(trim(p_invite_code)) and status != 'complete';
    if v_event is null then raise exception 'Event not found or no longer active'; end if;
    select jsonb_build_object('id', r.id, 'course_snapshot', r.course_snapshot, 'game', r.game,
      'players', r.players, 'current_hole', r.current_hole, 'groups', r.groups) into v_round
    from rounds r where r.id = v_event.round_id;
    select coalesce(jsonb_agg(jsonb_build_object('id', ep.id, 'user_id', ep.user_id,
      'player_id', ep.player_id, 'role', ep.role, 'group_number', ep.group_number)), '[]'::jsonb) into v_participants
    from event_participants ep where ep.event_id = v_event.id and ep.status = 'accepted';
    return jsonb_build_object('id', v_event.id, 'name', v_event.name, 'status', v_event.status,
      'round', v_round, 'participants', v_participants, 'group_scorekeepers', v_event.group_scorekeepers);
  end; $$;

-- 4. RLS: pending invitees may read their OWN row (for the pending-invite UI) but not
--    other participants or the event, until accepted.
drop policy event_participants_read on public.event_participants;
create policy event_participants_read on public.event_participants for select using (
  (user_id = auth.uid())
  or (exists (select 1 from public.event_participants ep2
        where ep2.event_id = event_participants.event_id and ep2.user_id = auth.uid() and ep2.status = 'accepted'))
  or (exists (select 1 from public.events e
        where e.id = event_participants.event_id and e.user_id = auth.uid()))
);

drop policy events_participant_read on public.events;
create policy events_participant_read on public.events for select using (
  exists (select 1 from public.event_participants ep
    where ep.event_id = events.id and ep.user_id = auth.uid() and ep.status = 'accepted')
);

commit;
