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

-- Get all players across all users (admin only)
CREATE OR REPLACE FUNCTION admin_get_all_players()
RETURNS TABLE (
  id text,
  user_id uuid,
  name text,
  handicap_index float,
  tee text,
  ghin_number text,
  is_public boolean,
  venmo_username text,
  zelle_identifier text,
  cashapp_username text,
  paypal_email text,
  created_at timestamptz,
  owner_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT p.id, p.user_id, p.name, p.handicap_index, p.tee,
      p.ghin_number, COALESCE(p.is_public, false), p.venmo_username,
      p.zelle_identifier, p.cashapp_username, p.paypal_email,
      p.created_at,
      COALESCE(up.display_name, 'Unknown') AS owner_name
    FROM players p
    LEFT JOIN user_profiles up ON p.user_id = up.user_id
    ORDER BY p.name;
END;
$$;

-- Update a player's details (admin only)
CREATE OR REPLACE FUNCTION admin_update_player(
  target_player_id text,
  new_name text DEFAULT NULL,
  new_handicap float DEFAULT NULL,
  new_tee text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE players SET
    name = COALESCE(new_name, name),
    handicap_index = COALESCE(new_handicap, handicap_index),
    tee = COALESCE(new_tee, tee)
  WHERE id = target_player_id;
END;
$$;

-- Update a user profile (admin only)
CREATE OR REPLACE FUNCTION admin_update_user_profile(
  target_user_id uuid,
  new_display_name text DEFAULT NULL,
  new_handicap float DEFAULT NULL,
  new_venmo text DEFAULT NULL,
  new_zelle text DEFAULT NULL,
  new_cashapp text DEFAULT NULL,
  new_paypal text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE user_profiles SET
    display_name = COALESCE(new_display_name, display_name),
    handicap_index = COALESCE(new_handicap, handicap_index),
    venmo_username = COALESCE(new_venmo, venmo_username),
    zelle_identifier = COALESCE(new_zelle, zelle_identifier),
    cashapp_username = COALESCE(new_cashapp, cashapp_username),
    paypal_email = COALESCE(new_paypal, paypal_email)
  WHERE user_id = target_user_id;
END;
$$;

-- Create a new user account (admin only)
CREATE OR REPLACE FUNCTION admin_create_user(
  user_email text,
  user_password text,
  user_display_name text DEFAULT NULL,
  user_handicap float DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(user_email)) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  -- Insert auth user
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    lower(user_email),
    crypt(user_password, gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false, now(), now()
  );

  -- Insert auth identity (required for login)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', lower(user_email)),
    'email',
    new_user_id::text,
    now(), now(), now()
  );

  -- Create user profile
  INSERT INTO public.user_profiles (
    user_id, is_admin, admin_only, onboarding_complete, display_name, handicap_index, tee
  ) VALUES (
    new_user_id, false, false, false, user_display_name, user_handicap, 'White'
  );

  RETURN new_user_id;
END;
$$;

-- Add invite_code column to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS invite_code text;

-- Send round invite notifications to registered players (bypasses RLS)
CREATE OR REPLACE FUNCTION send_round_invite_notifications(
  p_round_id uuid,
  p_invite_code text,
  p_course_name text,
  p_creator_name text,
  p_player_ids text[]
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pid text;
  pid_uuid uuid;
  sent int := 0;
BEGIN
  FOREACH pid IN ARRAY p_player_ids
  LOOP
    -- Try casting to uuid; skip if invalid
    BEGIN
      pid_uuid := pid::uuid;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    -- Skip the caller (round creator)
    IF pid_uuid = auth.uid() THEN
      CONTINUE;
    END IF;

    -- Only notify registered users (those with a user_profiles row)
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = pid_uuid) THEN
      CONTINUE;
    END IF;

    -- Idempotency: skip if notification already exists for this round+user
    IF EXISTS (
      SELECT 1 FROM notifications
      WHERE round_id = p_round_id AND user_id = pid_uuid AND type = 'round_invite'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO notifications (id, user_id, type, title, body, round_id, invite_code, read, created_at)
    VALUES (
      gen_random_uuid(),
      pid_uuid,
      'round_invite',
      p_creator_name || ' invited you to play at ' || p_course_name,
      'Tap Join to enter the round',
      p_round_id,
      p_invite_code,
      false,
      now()
    );
    sent := sent + 1;
  END LOOP;

  RETURN sent;
END;
$$;
