-- Admin RPCs for cross-user data access
-- These use SECURITY DEFINER to bypass RLS, but verify is_admin internally.

-- Get all user profiles (admin only)
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS SETOF user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY SELECT * FROM user_profiles ORDER BY display_name;
END;
$$;

-- Get all rounds with basic info (admin only)
CREATE OR REPLACE FUNCTION admin_get_all_rounds()
RETURNS TABLE (
  id uuid,
  course_id uuid,
  date timestamptz,
  status text,
  current_hole int,
  players jsonb,
  game jsonb,
  course_snapshot jsonb,
  created_by uuid,
  user_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY SELECT r.id, r.course_id, r.date, r.status, r.current_hole,
    r.players, r.game, r.course_snapshot, r.created_by, r.user_id, r.created_at
  FROM rounds r ORDER BY r.date DESC;
END;
$$;

-- Set admin status for a user (admin only)
CREATE OR REPLACE FUNCTION admin_set_user_admin(target_user_id uuid, make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Prevent removing your own admin access
  IF target_user_id = auth.uid() AND make_admin = false THEN
    RAISE EXCEPTION 'Cannot remove your own admin access';
  END IF;

  UPDATE user_profiles SET is_admin = make_admin WHERE user_id = target_user_id;
END;
$$;

-- Get system stats (admin only)
CREATE OR REPLACE FUNCTION admin_get_system_stats()
RETURNS TABLE (
  total_users bigint,
  total_rounds bigint,
  total_courses bigint,
  total_active_rounds bigint,
  total_completed_rounds bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY SELECT
    (SELECT count(*) FROM user_profiles) AS total_users,
    (SELECT count(*) FROM rounds) AS total_rounds,
    (SELECT count(*) FROM shared_courses) AS total_courses,
    (SELECT count(*) FROM rounds WHERE status = 'active') AS total_active_rounds,
    (SELECT count(*) FROM rounds WHERE status = 'complete') AS total_completed_rounds;
END;
$$;

-- Delete a user and all their data (admin only)
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  round_ids uuid[];
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Cannot delete yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account from admin panel';
  END IF;

  -- Collect round IDs owned by this user
  SELECT array_agg(id) INTO round_ids FROM rounds WHERE user_id = target_user_id;

  -- Delete round-related data
  IF round_ids IS NOT NULL THEN
    DELETE FROM hole_scores WHERE round_id = ANY(round_ids);
    DELETE FROM round_players WHERE round_id = ANY(round_ids);
    DELETE FROM buy_ins WHERE round_id = ANY(round_ids);
    DELETE FROM bbb_points WHERE round_id = ANY(round_ids);
    DELETE FROM settlements WHERE round_id = ANY(round_ids);
    DELETE FROM junk_records WHERE round_id = ANY(round_ids);
    DELETE FROM side_bets WHERE round_id = ANY(round_ids);
    DELETE FROM round_participants WHERE round_id = ANY(round_ids);
    DELETE FROM notifications WHERE round_id = ANY(round_ids);
    DELETE FROM rounds WHERE user_id = target_user_id;
  END IF;

  -- Delete user's own data
  DELETE FROM courses WHERE user_id = target_user_id;
  DELETE FROM players WHERE user_id = target_user_id;
  DELETE FROM notifications WHERE user_id = target_user_id;
  DELETE FROM user_profiles WHERE user_id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Delete a round and all associated data (admin only)
CREATE OR REPLACE FUNCTION admin_delete_round(target_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM hole_scores WHERE round_id = target_round_id;
  DELETE FROM round_players WHERE round_id = target_round_id;
  DELETE FROM buy_ins WHERE round_id = target_round_id;
  DELETE FROM bbb_points WHERE round_id = target_round_id;
  DELETE FROM settlements WHERE round_id = target_round_id;
  DELETE FROM junk_records WHERE round_id = target_round_id;
  DELETE FROM side_bets WHERE round_id = target_round_id;
  DELETE FROM round_participants WHERE round_id = target_round_id;
  DELETE FROM notifications WHERE round_id = target_round_id;
  DELETE FROM rounds WHERE id = target_round_id;
END;
$$;
