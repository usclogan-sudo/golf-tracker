-- Event invite acceptance: pending -> accepted membership for events.
-- Mirrors the rounds feature (20260630130000). Organizer invites a registered user
-- into an event → pending event_participant the invitee must accept. Self-joins via
-- code stay instant. Pending members get no round_participants row (so they're locked
-- out of round data until they accept, consistent with the rounds decision).

begin;

-- 1. Membership status on event_participants (default 'accepted' so existing
--    self-joins via join_event are untouched; only invite_to_event writes 'pending').
alter table public.event_participants
  add column status text not null default 'accepted',
  add column invited_by uuid,
  add column invited_at timestamptz;

alter table public.event_participants
  add constraint event_participants_status_check
  check (status in ('pending', 'accepted', 'declined'));

create index idx_event_participants_user_status
  on public.event_participants (user_id, status);

-- 2. invite_to_event: event owner invites a registered user; creates a pending
--    event_participant + a round_invite notification (carrying the event's invite
--    code + round, so the existing "event first" join path routes correctly).
create or replace function public.invite_to_event(p_event_id text, p_user_id uuid, p_player_id text)
  returns jsonb
  language plpgsql security definer
  as $$
  declare
    v_caller uuid := auth.uid();
    v_event record;
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

    select * into v_event from events where id = p_event_id;
    if not found then
      raise exception 'Event not found';
    end if;
    if v_event.user_id != v_caller then
      raise exception 'Only the event owner can invite players';
    end if;

    if not exists (select 1 from user_profiles where user_id = p_user_id) then
      raise exception 'Invited user is not registered';
    end if;

    -- Player slot must exist in the event's round roster.
    select * into v_round from rounds where id = v_event.round_id;
    if not found then
      raise exception 'Event has no round yet';
    end if;
    select exists(
      select 1 from jsonb_array_elements(v_round.players) elem where elem->>'id' = p_player_id
    ) into v_player_exists;
    if not v_player_exists then
      raise exception 'Player not found in this event';
    end if;

    -- Slot not already claimed (accepted) by a different user.
    if exists (
      select 1 from event_participants
      where event_id = p_event_id and player_id = p_player_id
        and user_id != p_user_id and status = 'accepted'
    ) then
      raise exception 'This player is already claimed by another user';
    end if;

    select * into v_existing from event_participants
    where event_id = p_event_id and user_id = p_user_id;

    if found then
      if v_existing.status = 'accepted' then
        return jsonb_build_object('participant_id', v_existing.id, 'status', 'accepted', 'already', true);
      end if;
      update event_participants
        set status = 'pending', player_id = p_player_id, invited_by = v_caller, invited_at = now()
        where id = v_existing.id;
      v_participant_id := v_existing.id;
    else
      v_participant_id := gen_random_uuid()::text;
      insert into event_participants (id, event_id, user_id, player_id, role, status, invited_by, invited_at)
      values (v_participant_id, p_event_id, p_user_id, p_player_id, 'player', 'pending', v_caller, now());
    end if;

    select display_name into v_creator_name from user_profiles where user_id = v_caller;
    v_course_name := coalesce(v_round.course_snapshot->>'courseName', v_round.course_snapshot->>'name', v_event.name);

    insert into notifications (id, user_id, type, title, body, round_id, invite_code, read, created_at)
    values (
      gen_random_uuid()::text, p_user_id, 'round_invite',
      coalesce(v_creator_name, 'Someone') || ' invited you to ' || v_event.name,
      'Tap to accept or decline',
      v_event.round_id, v_event.invite_code, false, now()
    );

    return jsonb_build_object('participant_id', v_participant_id, 'status', 'pending');
  end;
  $$;

-- 3. respond_to_event_invite: invitee accepts (→ derive role/group like join_event,
--    create the round_participants row) or declines.
create or replace function public.respond_to_event_invite(p_event_id text, p_accept boolean)
  returns jsonb
  language plpgsql security definer
  as $$
  declare
    v_caller uuid := auth.uid();
    v_participant record;
    v_event record;
    v_group_number int;
    v_role text := 'player';
    v_sk_player_id text;
  begin
    if v_caller is null then
      raise exception 'Not authenticated';
    end if;

    select * into v_participant from event_participants
    where event_id = p_event_id and user_id = v_caller;
    if not found then
      raise exception 'No invite found for this event';
    end if;
    if v_participant.status = 'accepted' then
      return jsonb_build_object('status', 'accepted', 'already', true);
    end if;

    if not p_accept then
      update event_participants set status = 'declined' where id = v_participant.id;
      return jsonb_build_object('status', 'declined');
    end if;

    -- accept: re-check slot not claimed while pending
    if exists (
      select 1 from event_participants
      where event_id = p_event_id and player_id = v_participant.player_id
        and user_id != v_caller and status = 'accepted'
    ) then
      raise exception 'This player slot has already been claimed';
    end if;

    select * into v_event from events where id = p_event_id;

    -- derive group_number + role (mirror join_event)
    select r.groups->v_participant.player_id into v_group_number
    from rounds r where r.id = v_event.round_id;
    if v_event.group_scorekeepers is not null and v_group_number is not null then
      v_sk_player_id := v_event.group_scorekeepers->>v_group_number::text;
      if v_sk_player_id = v_participant.player_id then
        v_role := 'scorekeeper';
      end if;
    end if;

    update event_participants
      set status = 'accepted', role = v_role, group_number = v_group_number, joined_at = now()
      where id = v_participant.id;

    -- create the round_participants row (accepted) for the event's round
    insert into round_participants (id, user_id, round_id, player_id, status)
    values (gen_random_uuid()::text, v_caller, v_event.round_id, v_participant.player_id, 'accepted')
    on conflict (round_id, user_id) do update set player_id = excluded.player_id, status = 'accepted';

    return jsonb_build_object('status', 'accepted', 'event_id', p_event_id, 'role', v_role);
  end;
  $$;

-- 4. join_event: keep code-redemption joins as full members (flip pending→accepted
--    on conflict). Body mirrors the baseline join_event with status additions.
create or replace function public.join_event(p_invite_code text, p_player_id text)
  returns jsonb
  language plpgsql security definer
  as $$
  declare
    v_event record;
    v_round record;
    v_existing record;
    v_group_number int;
    v_participant_id text;
    v_caller uuid := auth.uid();
    v_role text := 'player';
    v_sk_player_id text;
  begin
    if v_caller is null then
      raise exception 'Not authenticated';
    end if;

    select * into v_event from events
    where invite_code = upper(trim(p_invite_code)) and status != 'complete';
    if v_event is null then
      raise exception 'Event not found or no longer active';
    end if;

    select * into v_existing from event_participants
    where event_id = v_event.id and user_id = v_caller;

    if v_existing is not null then
      if v_existing.player_id != p_player_id or v_existing.status != 'accepted' then
        update event_participants set player_id = p_player_id, status = 'accepted' where id = v_existing.id;
      end if;
      insert into round_participants (id, user_id, round_id, player_id, status)
      values (gen_random_uuid()::text, v_caller, v_event.round_id, p_player_id, 'accepted')
      on conflict (round_id, user_id) do update set player_id = excluded.player_id, status = 'accepted';
      return jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_existing.id);
    end if;

    select * into v_existing from event_participants
    where event_id = v_event.id and player_id = p_player_id and user_id != v_caller and status = 'accepted';
    if v_existing is not null then
      raise exception 'Player already claimed by another user';
    end if;

    select r.groups->p_player_id into v_group_number
    from rounds r where r.id = v_event.round_id;

    if v_event.group_scorekeepers is not null and v_group_number is not null then
      v_sk_player_id := v_event.group_scorekeepers->>v_group_number::text;
      if v_sk_player_id = p_player_id then
        v_role := 'scorekeeper';
      end if;
    end if;

    v_participant_id := gen_random_uuid()::text;
    insert into event_participants (id, event_id, user_id, player_id, role, group_number, status)
    values (v_participant_id, v_event.id, v_caller, p_player_id, v_role, v_group_number, 'accepted');

    insert into round_participants (id, user_id, round_id, player_id, status)
    values (gen_random_uuid()::text, v_caller, v_event.round_id, p_player_id, 'accepted')
    on conflict (round_id, user_id) do update set status = 'accepted';

    return jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_participant_id, 'role', v_role);
  end;
  $$;

commit;
