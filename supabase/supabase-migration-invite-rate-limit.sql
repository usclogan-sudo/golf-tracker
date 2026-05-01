-- Invite rate-limit (audit item 0.7)
-- Per-auth.uid() throttle to slow down invite-code brute-force from a single
-- account. Soft cap: 10 lookups/min, 30/hr. No captcha — relies on Supabase's
-- built-in anonymous signup limits to prevent unbounded UID churn.
--
-- Idempotent: table uses IF NOT EXISTS, function uses CREATE OR REPLACE.

CREATE TABLE IF NOT EXISTS invite_attempts (
  user_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, attempted_at)
);

CREATE INDEX IF NOT EXISTS idx_invite_attempts_user_time
  ON invite_attempts(user_id, attempted_at DESC);

-- Lock down the table — only the helper (SECURITY DEFINER) writes to it.
ALTER TABLE invite_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invite_attempts_no_direct_access ON invite_attempts;
CREATE POLICY invite_attempts_no_direct_access ON invite_attempts FOR ALL TO authenticated USING (false);

CREATE OR REPLACE FUNCTION check_invite_rate_limit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_minute_count int;
  v_hour_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT count(*) INTO v_minute_count
  FROM invite_attempts
  WHERE user_id = v_caller AND attempted_at > now() - interval '1 minute';

  IF v_minute_count >= 10 THEN
    RAISE EXCEPTION 'rate_limit_minute' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_hour_count
  FROM invite_attempts
  WHERE user_id = v_caller AND attempted_at > now() - interval '1 hour';

  IF v_hour_count >= 30 THEN
    RAISE EXCEPTION 'rate_limit_hour' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO invite_attempts (user_id) VALUES (v_caller);

  -- Opportunistic cleanup: 5% of calls prune rows older than 1 hour.
  IF random() < 0.05 THEN
    DELETE FROM invite_attempts WHERE attempted_at < now() - interval '1 hour';
  END IF;
END;
$$;

-- Wrap get_round_by_invite with rate-limit check.
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

  PERFORM check_invite_rate_limit();

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

CREATE OR REPLACE FUNCTION get_event_by_invite(p_invite_code text) RETURNS jsonb AS $$
DECLARE
  v_event record;
  v_round jsonb;
  v_participants jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM check_invite_rate_limit();

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
