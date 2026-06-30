-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 9: Per-Round Invite Links & Shared Scoring
-- Run this in the Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1a. Add invite_code to rounds ────────────────────────────────────────────
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_rounds_invite_code ON rounds(invite_code) WHERE invite_code IS NOT NULL;

-- ── 1b. New round_participants table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS round_participants (
  id text PRIMARY KEY,
  round_id text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  player_id text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (round_id, user_id)
);

ALTER TABLE round_participants ENABLE ROW LEVEL SECURITY;

-- Participants can insert their own rows
CREATE POLICY "insert own participation" ON round_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Can read participants for rounds you own or participate in
CREATE POLICY "read participants" ON round_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT id FROM rounds WHERE user_id = auth.uid())
    OR round_id IN (SELECT rp.round_id FROM round_participants rp WHERE rp.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_round_participants_round ON round_participants(round_id);
CREATE INDEX IF NOT EXISTS idx_round_participants_user ON round_participants(user_id);

-- ── 1c. Unique constraint on hole_scores ─────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS unique_score_per_hole ON hole_scores(round_id, player_id, hole_number);

-- ── 1d. Updated RLS policies ─────────────────────────────────────────────────
-- Expand SELECT on rounds: owner OR participant
DROP POLICY IF EXISTS "own data" ON rounds;
CREATE POLICY "own or participant read" ON rounds
  FOR SELECT USING (
    user_id = auth.uid()
    OR id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
  );

-- Rounds: only owner can insert/update/delete
CREATE POLICY "own insert" ON rounds FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON rounds FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own delete" ON rounds FOR DELETE USING (user_id = auth.uid());

-- Expand SELECT on hole_scores: owner OR participant in that round
DROP POLICY IF EXISTS "own data" ON hole_scores;
CREATE POLICY "read scores" ON hole_scores
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
  );

-- hole_scores: owner can insert/update/delete
CREATE POLICY "own insert scores" ON hole_scores FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update scores" ON hole_scores FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own delete scores" ON hole_scores FOR DELETE USING (user_id = auth.uid());

-- Expand SELECT on round_players: owner OR participant
DROP POLICY IF EXISTS "own data" ON round_players;
CREATE POLICY "read round_players" ON round_players
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
  );
CREATE POLICY "own insert round_players" ON round_players FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update round_players" ON round_players FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own delete round_players" ON round_players FOR DELETE USING (user_id = auth.uid());

-- Expand SELECT on buy_ins: owner OR participant
DROP POLICY IF EXISTS "own data" ON buy_ins;
CREATE POLICY "read buy_ins" ON buy_ins
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
  );
CREATE POLICY "own insert buy_ins" ON buy_ins FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update buy_ins" ON buy_ins FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own delete buy_ins" ON buy_ins FOR DELETE USING (user_id = auth.uid());

-- Expand SELECT on bbb_points: owner OR participant
DROP POLICY IF EXISTS "own data" ON bbb_points;
CREATE POLICY "read bbb_points" ON bbb_points
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
  );
CREATE POLICY "own insert bbb_points" ON bbb_points FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update bbb_points" ON bbb_points FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own delete bbb_points" ON bbb_points FOR DELETE USING (user_id = auth.uid());

-- Expand SELECT on junk_records (if exists): owner OR participant
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'junk_records') THEN
    EXECUTE 'DROP POLICY IF EXISTS "own data" ON junk_records';
    EXECUTE 'CREATE POLICY "read junk_records" ON junk_records FOR SELECT USING (
      user_id = auth.uid()
      OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
    )';
    EXECUTE 'CREATE POLICY "own insert junk_records" ON junk_records FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "own update junk_records" ON junk_records FOR UPDATE USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "own delete junk_records" ON junk_records FOR DELETE USING (user_id = auth.uid())';
  END IF;
END $$;

-- ── 1e. RPC: get_round_by_invite ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_round_by_invite(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_round record;
  v_participants jsonb;
BEGIN
  SELECT * INTO v_round FROM rounds WHERE invite_code = p_invite_code AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found or no longer active';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', rp.id,
    'round_id', rp.round_id,
    'user_id', rp.user_id,
    'player_id', rp.player_id,
    'joined_at', rp.joined_at
  )), '[]'::jsonb) INTO v_participants
  FROM round_participants rp WHERE rp.round_id = v_round.id;

  RETURN jsonb_build_object(
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
END;
$$;

-- ── 1f. RPC: join_round ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION join_round(p_invite_code text, p_player_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_round record;
  v_caller uuid := auth.uid();
  v_players jsonb;
  v_player_exists boolean;
  v_already_claimed record;
  v_participant_id text;
BEGIN
  -- Look up round
  SELECT * INTO v_round FROM rounds WHERE invite_code = p_invite_code AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found or no longer active';
  END IF;

  -- Validate player_id exists in round's players JSONB
  v_players := v_round.players;
  SELECT EXISTS(
    SELECT 1 FROM jsonb_array_elements(v_players) elem
    WHERE elem->>'id' = p_player_id
  ) INTO v_player_exists;
  IF NOT v_player_exists THEN
    RAISE EXCEPTION 'Player not found in this round';
  END IF;

  -- Check player not already claimed by another user
  SELECT * INTO v_already_claimed FROM round_participants
  WHERE round_id = v_round.id AND player_id = p_player_id AND user_id != v_caller;
  IF FOUND THEN
    RAISE EXCEPTION 'This player is already claimed by another user';
  END IF;

  -- Upsert round_participants
  v_participant_id := gen_random_uuid()::text;
  INSERT INTO round_participants (id, round_id, user_id, player_id)
  VALUES (v_participant_id, v_round.id, v_caller, p_player_id)
  ON CONFLICT (round_id, user_id) DO UPDATE SET player_id = EXCLUDED.player_id;

  RETURN jsonb_build_object(
    'round_id', v_round.id,
    'participant_id', v_participant_id,
    'player_id', p_player_id
  );
END;
$$;

-- ── 1g. RPC: submit_participant_score ────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_participant_score(
  p_round_id text,
  p_player_id text,
  p_hole_number int,
  p_gross_score int
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_participant record;
  v_round record;
  v_score_id text;
  v_existing record;
BEGIN
  -- Verify caller is participant for that player
  SELECT * INTO v_participant FROM round_participants
  WHERE round_id = p_round_id AND user_id = v_caller AND player_id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a participant for this player';
  END IF;

  -- Get round to find creator's user_id
  SELECT * INTO v_round FROM rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  -- Check for existing score
  SELECT * INTO v_existing FROM hole_scores
  WHERE round_id = p_round_id AND player_id = p_player_id AND hole_number = p_hole_number;

  IF FOUND THEN
    -- Update existing score
    UPDATE hole_scores SET gross_score = p_gross_score
    WHERE id = v_existing.id;
    v_score_id := v_existing.id;
  ELSE
    -- Insert new score with round creator's user_id
    v_score_id := gen_random_uuid()::text;
    INSERT INTO hole_scores (id, user_id, round_id, player_id, hole_number, gross_score)
    VALUES (v_score_id, v_round.user_id, p_round_id, p_player_id, p_hole_number, p_gross_score);
  END IF;

  RETURN jsonb_build_object('score_id', v_score_id);
END;
$$;
