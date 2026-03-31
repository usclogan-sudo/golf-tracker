-- ══════════════════════════════════════════════════════════════════════════════
-- Security Hardening Migration
-- Addresses: C1 (admin escalation), C2 (settlement dupes), C3 (atomic delete),
--            C4 (event score tampering), C5 (unauth RPC access),
--            H4 (BBB dupes), H7 (invite brute-force), H8 (settlements RLS),
--            H9 (reset scope), H10 (scorekeeper group scoping),
--            M3 (stacking policies), M7 (profile upsert race)
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── C1: Block is_admin self-escalation ──────────────────────────────────────
-- Users must not be able to set is_admin or admin_only on their own profile.
-- Only SECURITY DEFINER admin functions (which skip triggers via session var) can.

CREATE OR REPLACE FUNCTION prevent_admin_self_promote()
RETURNS trigger AS $$
BEGIN
  -- Allow changes from SECURITY DEFINER admin functions
  IF current_setting('app.admin_bypass', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Block changes to admin fields
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Cannot modify admin status';
  END IF;
  IF NEW.admin_only IS DISTINCT FROM OLD.admin_only THEN
    RAISE EXCEPTION 'Cannot modify admin_only status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_admin_escalation ON user_profiles;
CREATE TRIGGER block_admin_escalation
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_admin_self_promote();

-- Update admin_set_user_admin to set the bypass flag
CREATE OR REPLACE FUNCTION admin_set_user_admin(target_user_id uuid, make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF target_user_id = auth.uid() AND make_admin = false THEN
    RAISE EXCEPTION 'Cannot remove your own admin access';
  END IF;

  -- Set bypass flag so trigger allows this change
  PERFORM set_config('app.admin_bypass', 'true', true);
  UPDATE user_profiles SET is_admin = make_admin WHERE user_id = target_user_id;
  PERFORM set_config('app.admin_bypass', 'false', true);
END;
$$;


-- ── C2: Settlement unique constraint (idempotent) ───────────────────────────
DO $$ BEGIN
  ALTER TABLE settlements
    ADD CONSTRAINT settlements_unique_per_round
    UNIQUE (round_id, from_player_id, to_player_id, source);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;


-- ── C3: Transactional delete_round for regular users ────────────────────────
CREATE OR REPLACE FUNCTION delete_own_round(p_round_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller owns the round
  IF NOT EXISTS (SELECT 1 FROM rounds WHERE id = p_round_id AND user_id = v_caller) THEN
    RAISE EXCEPTION 'Not authorized to delete this round';
  END IF;

  -- All in one transaction (SECURITY DEFINER = already in one)
  DELETE FROM hole_scores WHERE round_id = p_round_id;
  DELETE FROM round_players WHERE round_id = p_round_id;
  DELETE FROM buy_ins WHERE round_id = p_round_id;
  DELETE FROM bbb_points WHERE round_id = p_round_id;
  DELETE FROM settlements WHERE round_id = p_round_id;
  DELETE FROM side_bets WHERE round_id = p_round_id;
  DELETE FROM round_participants WHERE round_id = p_round_id;
  DELETE FROM notifications WHERE round_id = p_round_id;

  -- Delete junk_records if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'junk_records') THEN
    EXECUTE 'DELETE FROM junk_records WHERE round_id = $1' USING p_round_id;
  END IF;

  -- Delete event participants + event if this round has one
  DECLARE
    v_event_id text;
  BEGIN
    SELECT event_id INTO v_event_id FROM rounds WHERE id = p_round_id;
    IF v_event_id IS NOT NULL THEN
      DELETE FROM event_participants WHERE event_id = v_event_id;
      DELETE FROM events WHERE id = v_event_id;
    END IF;
  END;

  DELETE FROM rounds WHERE id = p_round_id;
END;
$$;


-- ── C4: Fix submit_event_score — reject null role + verify player ownership ─
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
BEGIN
  -- C5: Auth check
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- M7: Score range validation
  IF p_gross_score < 1 OR p_gross_score > 20 THEN
    RAISE EXCEPTION 'Score must be between 1 and 20';
  END IF;

  -- Get the event_id from the round
  SELECT event_id, user_id INTO v_event_id, v_round_owner
  FROM rounds WHERE id = p_round_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Round is not part of an event';
  END IF;

  -- Determine the user's role in the event
  SELECT role INTO v_role
  FROM event_participants
  WHERE event_id = v_event_id AND user_id = v_caller;

  -- C4: Reject if caller is not a participant at all
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a participant in this event';
  END IF;

  -- C4: Players can only submit their own scores
  IF v_role = 'player' THEN
    IF NOT EXISTS (
      SELECT 1 FROM event_participants
      WHERE event_id = v_event_id AND user_id = v_caller AND player_id = p_player_id
    ) THEN
      RAISE EXCEPTION 'Players can only submit their own scores';
    END IF;
  END IF;

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


-- ── C5: Add auth checks to all SECURITY DEFINER functions ───────────────────

-- Fix get_round_by_invite
CREATE OR REPLACE FUNCTION get_round_by_invite(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_round record;
  v_participants jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

-- Fix get_event_by_invite
CREATE OR REPLACE FUNCTION get_event_by_invite(p_invite_code text) RETURNS jsonb AS $$
DECLARE
  v_event record;
  v_round jsonb;
  v_participants jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_event FROM events
  WHERE invite_code = upper(trim(p_invite_code)) AND status != 'complete';

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found or no longer active';
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'course_snapshot', r.course_snapshot,
    'game', r.game,
    'players', r.players,
    'current_hole', r.current_hole,
    'groups', r.groups
  ) INTO v_round
  FROM rounds r WHERE r.id = v_event.round_id;

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

-- Fix join_round
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
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_round FROM rounds WHERE invite_code = p_invite_code AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found or no longer active';
  END IF;

  v_players := v_round.players;
  SELECT EXISTS(
    SELECT 1 FROM jsonb_array_elements(v_players) elem
    WHERE elem->>'id' = p_player_id
  ) INTO v_player_exists;
  IF NOT v_player_exists THEN
    RAISE EXCEPTION 'Player not found in this round';
  END IF;

  SELECT * INTO v_already_claimed FROM round_participants
  WHERE round_id = v_round.id AND player_id = p_player_id AND user_id != v_caller;
  IF FOUND THEN
    RAISE EXCEPTION 'This player is already claimed by another user';
  END IF;

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

-- Fix join_event
CREATE OR REPLACE FUNCTION join_event(p_invite_code text, p_player_id text) RETURNS jsonb AS $$
DECLARE
  v_event record;
  v_round record;
  v_existing record;
  v_group_number int;
  v_participant_id text;
  v_caller uuid := auth.uid();
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

  v_participant_id := gen_random_uuid()::text;
  INSERT INTO event_participants (id, event_id, user_id, player_id, role, group_number)
  VALUES (v_participant_id, v_event.id, v_caller, p_player_id, 'player', v_group_number);

  INSERT INTO round_participants (id, user_id, round_id, player_id)
  VALUES (gen_random_uuid()::text, v_caller, v_event.round_id, p_player_id)
  ON CONFLICT (round_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('event_id', v_event.id, 'round_id', v_event.round_id, 'participant_id', v_participant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix submit_participant_score
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
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_gross_score < 1 OR p_gross_score > 20 THEN
    RAISE EXCEPTION 'Score must be between 1 and 20';
  END IF;

  SELECT * INTO v_participant FROM round_participants
  WHERE round_id = p_round_id AND user_id = v_caller AND player_id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a participant for this player';
  END IF;

  SELECT * INTO v_round FROM rounds WHERE id = p_round_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  SELECT * INTO v_existing FROM hole_scores
  WHERE round_id = p_round_id AND player_id = p_player_id AND hole_number = p_hole_number;

  IF FOUND THEN
    UPDATE hole_scores SET gross_score = p_gross_score
    WHERE id = v_existing.id;
    v_score_id := v_existing.id;
  ELSE
    v_score_id := gen_random_uuid()::text;
    INSERT INTO hole_scores (id, user_id, round_id, player_id, hole_number, gross_score)
    VALUES (v_score_id, v_round.user_id, p_round_id, p_player_id, p_hole_number, p_gross_score);
  END IF;

  RETURN jsonb_build_object('score_id', v_score_id);
END;
$$;

-- Fix approve_score with group scoping (H10)
CREATE OR REPLACE FUNCTION approve_score(p_score_id text) RETURNS void AS $$
DECLARE
  v_round_id text;
  v_event_id text;
  v_role text;
  v_caller uuid := auth.uid();
  v_score_player_id text;
  v_score_group int;
  v_caller_group int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT round_id, player_id INTO v_round_id, v_score_player_id
  FROM hole_scores WHERE id = p_score_id;

  SELECT event_id INTO v_event_id FROM rounds WHERE id = v_round_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Round is not part of an event';
  END IF;

  SELECT role, group_number INTO v_role, v_caller_group
  FROM event_participants
  WHERE event_id = v_event_id AND user_id = v_caller;

  IF v_role NOT IN ('manager', 'scorekeeper') THEN
    RAISE EXCEPTION 'Only managers and scorekeepers can approve scores';
  END IF;

  -- Scorekeepers can only approve scores in their group
  IF v_role = 'scorekeeper' THEN
    SELECT group_number INTO v_score_group
    FROM event_participants
    WHERE event_id = v_event_id AND player_id = v_score_player_id;

    IF v_score_group IS DISTINCT FROM v_caller_group THEN
      RAISE EXCEPTION 'Scorekeepers can only approve scores in their group';
    END IF;
  END IF;

  UPDATE hole_scores SET score_status = 'approved' WHERE id = p_score_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix reject_score with group scoping (H10)
CREATE OR REPLACE FUNCTION reject_score(p_score_id text) RETURNS void AS $$
DECLARE
  v_round_id text;
  v_event_id text;
  v_role text;
  v_caller uuid := auth.uid();
  v_score_player_id text;
  v_score_group int;
  v_caller_group int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT round_id, player_id INTO v_round_id, v_score_player_id
  FROM hole_scores WHERE id = p_score_id;

  SELECT event_id INTO v_event_id FROM rounds WHERE id = v_round_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Round is not part of an event';
  END IF;

  SELECT role, group_number INTO v_role, v_caller_group
  FROM event_participants
  WHERE event_id = v_event_id AND user_id = v_caller;

  IF v_role NOT IN ('manager', 'scorekeeper') THEN
    RAISE EXCEPTION 'Only managers and scorekeepers can reject scores';
  END IF;

  IF v_role = 'scorekeeper' THEN
    SELECT group_number INTO v_score_group
    FROM event_participants
    WHERE event_id = v_event_id AND player_id = v_score_player_id;

    IF v_score_group IS DISTINCT FROM v_caller_group THEN
      RAISE EXCEPTION 'Scorekeepers can only reject scores in their group';
    END IF;
  END IF;

  UPDATE hole_scores SET score_status = 'rejected' WHERE id = p_score_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix player_report_buyin auth check
CREATE OR REPLACE FUNCTION player_report_buyin(p_round_id uuid, p_player_id text, p_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM round_participants
    WHERE round_id = p_round_id AND player_id = p_player_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized — you are not this player in this round';
  END IF;

  UPDATE buy_ins
  SET method = p_method,
      player_reported_at = now()
  WHERE round_id = p_round_id AND player_id = p_player_id;
END;
$$;


-- ── H4: Unique constraint on bbb_points ─────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bbb_points') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS unique_bbb_per_hole ON bbb_points(round_id, hole_number)';
  END IF;
END $$;


-- ── H8: Settlements participant-aware SELECT policy ─────────────────────────
DROP POLICY IF EXISTS "own data" ON settlements;

CREATE POLICY "own or participant read" ON settlements
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
  );

-- Owner can insert/update/delete
CREATE POLICY "own insert settlements" ON settlements FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update settlements" ON settlements FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own delete settlements" ON settlements FOR DELETE USING (user_id = auth.uid());


-- ── M3: Drop stacking Phase 6 policies ──────────────────────────────────────
DROP POLICY IF EXISTS "player can read round" ON rounds;
DROP POLICY IF EXISTS "player can read scores" ON hole_scores;
DROP POLICY IF EXISTS "player can read round_players" ON round_players;
DROP POLICY IF EXISTS "player can read buy_ins" ON buy_ins;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bbb_points') THEN
    EXECUTE 'DROP POLICY IF EXISTS "player can read bbb" ON bbb_points';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'junk_records') THEN
    EXECUTE 'DROP POLICY IF EXISTS "player can read junks" ON junk_records';
  END IF;
END $$;


-- ── M3 addendum: Missing indexes ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_settlements_user_status ON settlements(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_events_invite_code ON events(invite_code);
CREATE INDEX IF NOT EXISTS idx_side_bets_round ON side_bets(round_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'junk_records') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_junk_records_round_hole ON junk_records(round_id, hole_number)';
  END IF;
END $$;
