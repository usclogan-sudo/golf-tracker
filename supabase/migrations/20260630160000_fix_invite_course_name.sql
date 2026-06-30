-- Fix: invite_to_round notification said "invited you to play at a round" for real
-- rounds, because it read course_snapshot->>'name' but CourseSnapshot uses
-- `courseName`. Read courseName (fallback to name for legacy/seed data).
-- Append-only re-definition (the prior definition in 20260630150000 was already
-- applied to environments, so this supersedes it rather than editing it in place).

begin;

create or replace function public.invite_to_round(p_round_id text, p_user_id uuid, p_player_id text)
  returns jsonb
  language plpgsql security definer
  as $$
  declare
    v_caller uuid := auth.uid();
    v_round record;
    v_invitee record;
    v_player_exists boolean;
    v_slot_count int;
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
    if v_round.user_id != v_caller then
      raise exception 'Only the round owner can invite players';
    end if;

    select * into v_invitee from user_profiles where user_id = p_user_id;
    if not found then
      raise exception 'Invited user is not registered';
    end if;

    select exists(
      select 1 from jsonb_array_elements(v_round.players) elem where elem->>'id' = p_player_id
    ) into v_player_exists;

    if not v_player_exists then
      v_slot_count := coalesce(jsonb_array_length(v_round.players), 0);
      if v_slot_count >= 6 then
        raise exception 'This round is full (6 players max)';
      end if;
      update rounds
        set players = coalesce(players, '[]'::jsonb) || jsonb_build_object(
          'id', p_player_id,
          'name', coalesce(v_invitee.display_name, 'Player'),
          'handicapIndex', coalesce(v_invitee.handicap_index, 0),
          'tee', coalesce(v_invitee.tee, 'White')
        )
        where id = p_round_id;
      insert into round_players (id, user_id, round_id, player_id, tee_played)
      values (gen_random_uuid()::text, v_round.user_id, p_round_id, p_player_id, coalesce(v_invitee.tee, 'White'))
      on conflict do nothing;
    else
      if exists (
        select 1 from round_participants
        where round_id = p_round_id and player_id = p_player_id
          and user_id != p_user_id and status = 'accepted'
      ) then
        raise exception 'This player is already claimed by another user';
      end if;
    end if;

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

    select display_name into v_creator_name from user_profiles where user_id = v_caller;
    -- CourseSnapshot uses `courseName`; fall back to `name` for any legacy/seed data.
    v_course_name := coalesce(v_round.course_snapshot->>'courseName', v_round.course_snapshot->>'name', 'a round');

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

    return jsonb_build_object('participant_id', v_participant_id, 'status', 'pending', 'slot_added', not v_player_exists);
  end;
  $$;

commit;
