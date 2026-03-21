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
