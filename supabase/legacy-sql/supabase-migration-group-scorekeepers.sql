-- Group scorekeepers (delta migration)
-- Adds two changes on top of supabase-schema-security-hardening.sql:
--   H10  submit_event_score: scorekeepers may only submit scores for players
--        in their own group (event_participants.group_number).
--   join_event: when a player joins an event, auto-assigns the `scorekeeper`
--   role if they are listed in events.group_scorekeepers for their group;
--   otherwise the role stays `player`. Returned JSON now also includes the
--   resolved role so the client can update its UI immediately.
--
-- Idempotent: both functions are CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION submit_event_score(
  p_round_id text,
  p_player_id text,
  p_hole_number int,
  p_gross_score int
) RETURNS jsonb AS $$
DECLARE
  v_event_id text;
  v_role text;
  v_status text;
  v_round_owner uuid;
  v_score_id text;
  v_existing_id text;
  v_caller uuid := auth.uid();
  v_caller_group int;
  v_target_group int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_gross_score < 1 OR p_gross_score > 20 THEN
    RAISE EXCEPTION 'Score must be between 1 and 20';
  END IF;

  SELECT event_id, user_id INTO v_event_id, v_round_owner
  FROM rounds WHERE id = p_round_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Round is not part of an event';
  END IF;

  SELECT role, group_number INTO v_role, v_caller_group
  FROM event_participants
  WHERE event_id = v_event_id AND user_id = v_caller;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a participant in this event';
  END IF;

  IF v_role = 'player' THEN
    IF NOT EXISTS (
      SELECT 1 FROM event_participants
      WHERE event_id = v_event_id AND user_id = v_caller AND player_id = p_player_id
    ) THEN
      RAISE EXCEPTION 'Players can only submit their own scores';
    END IF;
  END IF;

  -- H10: scorekeepers limited to their own group.
  IF v_role = 'scorekeeper' THEN
    SELECT group_number INTO v_target_group
    FROM event_participants
    WHERE event_id = v_event_id AND player_id = p_player_id;

    IF v_target_group IS DISTINCT FROM v_caller_group THEN
      RAISE EXCEPTION 'Scorekeepers can only submit scores for players in their group';
    END IF;
  END IF;

  IF v_role IN ('manager', 'scorekeeper') THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  SELECT id INTO v_existing_id
  FROM hole_scores
  WHERE round_id = p_round_id AND player_id = p_player_id AND hole_number = p_hole_number;

  IF v_existing_id IS NOT NULL THEN
    UPDATE hole_scores SET
      gross_score = p_gross_score,
      score_status = v_status,
      submitted_by = v_caller
    WHERE id = v_existing_id;
    v_score_id := v_existing_id;
  ELSE
    v_score_id := gen_random_uuid()::text;
    INSERT INTO hole_scores (id, user_id, round_id, player_id, hole_number, gross_score, score_status, submitted_by)
    VALUES (v_score_id, v_round_owner, p_round_id, p_player_id, p_hole_number, p_gross_score, v_status, v_caller);
  END IF;

  RETURN jsonb_build_object('id', v_score_id, 'status', v_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION join_event(p_invite_code text, p_player_id text) RETURNS jsonb AS $$
DECLARE
  v_event record;
  v_round record;
  v_existing record;
  v_group_number int;
  v_participant_id text;
  v_caller uuid := auth.uid();
  v_role text := 'player';
  v_sk_player_id text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_event FROM events
  WHERE invite_code = upper(trim(p_invite_code)) AND status != 'complete';

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found or no longer active';
  END IF;

  SELECT * INTO v_existing FROM event_participants
  WHERE event_id = v_event.id AND user_id = v_caller;

  IF v_existing IS NOT NULL THEN
    IF v_existing.player_id != p_player_id THEN
      UPDATE event_participants SET player_id = p_player_id WHERE id = v_existing.id;
    END IF;
    RETURN jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_existing.id);
  END IF;

  SELECT * INTO v_existing FROM event_participants
  WHERE event_id = v_event.id AND player_id = p_player_id AND user_id != v_caller;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Player already claimed by another user';
  END IF;

  SELECT r.groups->p_player_id INTO v_group_number
  FROM rounds r WHERE r.id = v_event.round_id;

  -- Auto-assign scorekeeper role when this player is the designated scorekeeper for their group.
  IF v_event.group_scorekeepers IS NOT NULL AND v_group_number IS NOT NULL THEN
    v_sk_player_id := v_event.group_scorekeepers->>v_group_number::text;
    IF v_sk_player_id = p_player_id THEN
      v_role := 'scorekeeper';
    END IF;
  END IF;

  v_participant_id := gen_random_uuid()::text;
  INSERT INTO event_participants (id, event_id, user_id, player_id, role, group_number)
  VALUES (v_participant_id, v_event.id, v_caller, p_player_id, v_role, v_group_number);

  INSERT INTO round_participants (id, user_id, round_id, player_id)
  VALUES (gen_random_uuid()::text, v_caller, v_event.round_id, p_player_id)
  ON CONFLICT (round_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_participant_id, 'role', v_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
