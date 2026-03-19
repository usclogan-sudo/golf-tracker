-- ═══════════════════════════════════════════════════════════════════════════════
-- Events & Real-time Self-Scoring Schema
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Events table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'setup',  -- setup | active | complete
  round_id text,                          -- links to rounds table
  invite_code text UNIQUE,
  group_scorekeepers jsonb DEFAULT '{}',  -- { groupNumber: playerId }
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "events_owner" ON events
  FOR ALL USING (auth.uid() = user_id);

-- Participants can read
CREATE POLICY "events_participant_read" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = events.id AND ep.user_id = auth.uid()
    )
  );

-- ─── Event Participants table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_participants (
  id text PRIMARY KEY,
  event_id text REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users NOT NULL,
  player_id text NOT NULL,
  role text NOT NULL DEFAULT 'player',  -- manager | scorekeeper | player
  group_number int,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Participants can read all participants in their event
CREATE POLICY "event_participants_read" ON event_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_participants ep2
      WHERE ep2.event_id = event_participants.event_id AND ep2.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_participants.event_id AND e.user_id = auth.uid()
    )
  );

-- Event owner can insert/update/delete participants
CREATE POLICY "event_participants_owner" ON event_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_participants.event_id AND e.user_id = auth.uid()
    )
  );

-- Users can insert themselves (for join flow)
CREATE POLICY "event_participants_self_insert" ON event_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── Modify hole_scores: add approval columns ───────────────────────────────
ALTER TABLE hole_scores ADD COLUMN IF NOT EXISTS score_status text NOT NULL DEFAULT 'approved';
ALTER TABLE hole_scores ADD COLUMN IF NOT EXISTS submitted_by uuid;

-- ─── Add event_id to rounds ─────────────────────────────────────────────────
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS event_id text;

-- ─── Enable Realtime ─────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE event_participants;

-- ─── RPCs ────────────────────────────────────────────────────────────────────

-- Submit a score in an event context (auto-sets status based on role)
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
BEGIN
  -- Get the event_id from the round
  SELECT event_id, user_id INTO v_event_id, v_round_owner
  FROM rounds WHERE id = p_round_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Round is not part of an event';
  END IF;

  -- Determine the user's role in the event
  SELECT role INTO v_role
  FROM event_participants
  WHERE event_id = v_event_id AND user_id = auth.uid();

  -- Auto-approve for managers and scorekeepers, pending for players
  IF v_role IN ('manager', 'scorekeeper') THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  -- Check for existing score
  SELECT id INTO v_existing_id
  FROM hole_scores
  WHERE round_id = p_round_id AND player_id = p_player_id AND hole_number = p_hole_number;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing score
    UPDATE hole_scores SET
      gross_score = p_gross_score,
      score_status = v_status,
      submitted_by = auth.uid()
    WHERE id = v_existing_id;
    v_score_id := v_existing_id;
  ELSE
    -- Insert new score (use round owner's user_id for RLS compatibility)
    v_score_id := gen_random_uuid()::text;
    INSERT INTO hole_scores (id, user_id, round_id, player_id, hole_number, gross_score, score_status, submitted_by)
    VALUES (v_score_id, v_round_owner, p_round_id, p_player_id, p_hole_number, p_gross_score, v_status, auth.uid());
  END IF;

  RETURN jsonb_build_object('id', v_score_id, 'status', v_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve a pending score
CREATE OR REPLACE FUNCTION approve_score(p_score_id text) RETURNS void AS $$
DECLARE
  v_round_id text;
  v_event_id text;
  v_role text;
BEGIN
  SELECT round_id INTO v_round_id FROM hole_scores WHERE id = p_score_id;
  SELECT event_id INTO v_event_id FROM rounds WHERE id = v_round_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Round is not part of an event';
  END IF;

  SELECT role INTO v_role FROM event_participants
  WHERE event_id = v_event_id AND user_id = auth.uid();

  IF v_role NOT IN ('manager', 'scorekeeper') THEN
    RAISE EXCEPTION 'Only managers and scorekeepers can approve scores';
  END IF;

  UPDATE hole_scores SET score_status = 'approved' WHERE id = p_score_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject a pending score
CREATE OR REPLACE FUNCTION reject_score(p_score_id text) RETURNS void AS $$
DECLARE
  v_round_id text;
  v_event_id text;
  v_role text;
BEGIN
  SELECT round_id INTO v_round_id FROM hole_scores WHERE id = p_score_id;
  SELECT event_id INTO v_event_id FROM rounds WHERE id = v_round_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Round is not part of an event';
  END IF;

  SELECT role INTO v_role FROM event_participants
  WHERE event_id = v_event_id AND user_id = auth.uid();

  IF v_role NOT IN ('manager', 'scorekeeper') THEN
    RAISE EXCEPTION 'Only managers and scorekeepers can reject scores';
  END IF;

  UPDATE hole_scores SET score_status = 'rejected' WHERE id = p_score_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Look up an event by invite code
CREATE OR REPLACE FUNCTION get_event_by_invite(p_invite_code text) RETURNS jsonb AS $$
DECLARE
  v_event record;
  v_round jsonb;
  v_participants jsonb;
BEGIN
  SELECT * INTO v_event FROM events
  WHERE invite_code = upper(trim(p_invite_code)) AND status != 'complete';

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found or no longer active';
  END IF;

  -- Get round data
  SELECT jsonb_build_object(
    'id', r.id,
    'course_snapshot', r.course_snapshot,
    'game', r.game,
    'players', r.players,
    'current_hole', r.current_hole,
    'groups', r.groups
  ) INTO v_round
  FROM rounds r WHERE r.id = v_event.round_id;

  -- Get participants
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ep.id,
    'user_id', ep.user_id,
    'player_id', ep.player_id,
    'role', ep.role,
    'group_number', ep.group_number
  )), '[]'::jsonb) INTO v_participants
  FROM event_participants ep WHERE ep.event_id = v_event.id;

  RETURN jsonb_build_object(
    'id', v_event.id,
    'name', v_event.name,
    'status', v_event.status,
    'round', v_round,
    'participants', v_participants,
    'group_scorekeepers', v_event.group_scorekeepers
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join an event via invite code
CREATE OR REPLACE FUNCTION join_event(p_invite_code text, p_player_id text) RETURNS jsonb AS $$
DECLARE
  v_event record;
  v_round record;
  v_existing record;
  v_group_number int;
  v_participant_id text;
BEGIN
  SELECT * INTO v_event FROM events
  WHERE invite_code = upper(trim(p_invite_code)) AND status != 'complete';

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found or no longer active';
  END IF;

  -- Check if user already joined
  SELECT * INTO v_existing FROM event_participants
  WHERE event_id = v_event.id AND user_id = auth.uid();

  IF v_existing IS NOT NULL THEN
    -- Update their player_id if different
    IF v_existing.player_id != p_player_id THEN
      UPDATE event_participants SET player_id = p_player_id WHERE id = v_existing.id;
    END IF;
    RETURN jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_existing.id);
  END IF;

  -- Check if player is already claimed by another user
  SELECT * INTO v_existing FROM event_participants
  WHERE event_id = v_event.id AND player_id = p_player_id AND user_id != auth.uid();

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Player already claimed by another user';
  END IF;

  -- Determine group number from round's groups
  SELECT r.groups->p_player_id INTO v_group_number
  FROM rounds r WHERE r.id = v_event.round_id;

  -- Insert event participant
  v_participant_id := gen_random_uuid()::text;
  INSERT INTO event_participants (id, event_id, user_id, player_id, role, group_number)
  VALUES (v_participant_id, v_event.id, auth.uid(), p_player_id, 'player', v_group_number);

  -- Also create round_participant for scorecard access
  INSERT INTO round_participants (id, user_id, round_id, player_id)
  VALUES (gen_random_uuid()::text, auth.uid(), v_event.round_id, p_player_id)
  ON CONFLICT (round_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_participant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
