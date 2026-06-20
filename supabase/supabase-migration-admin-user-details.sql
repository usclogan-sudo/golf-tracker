-- Admin user details: read-only debugging view for customer-support workflows.
-- Returns a single user's profile + recent rounds + activity counts and
-- automatically appends a 'view_user_details' entry to admin_audit_log so
-- viewing a user's data is itself audited.

CREATE OR REPLACE FUNCTION public.admin_get_user_details(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'admin_get_user_details: not authenticated';
  END IF;

  SELECT is_admin INTO v_is_admin
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'admin_get_user_details: caller is not an admin';
  END IF;

  -- Audit the view itself. Bypasses the log_admin_action RPC because we're
  -- already inside a SECURITY DEFINER function and want to keep the audit
  -- atomic with the read.
  INSERT INTO public.admin_audit_log (
    admin_user_id, action, target_type, target_id, target_label
  )
  VALUES (
    auth.uid(),
    'view_user_details',
    'user',
    target_user_id::text,
    (SELECT display_name FROM public.user_profiles WHERE user_id = target_user_id)
  );

  SELECT jsonb_build_object(
    'profile', (
      SELECT to_jsonb(up.*)
      FROM public.user_profiles up
      WHERE up.user_id = target_user_id
    ),
    'recent_rounds', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           r.id,
          'date',         r.date,
          'status',       r.status,
          'course_name',  r.course_snapshot->>'courseName',
          'player_count', COALESCE(jsonb_array_length(r.players), 0),
          'game_type',    r.game->>'type'
        )
        ORDER BY r.date DESC
      )
      FROM (
        SELECT id, date, status, course_snapshot, players, game
        FROM public.rounds
        WHERE user_id = target_user_id
        ORDER BY date DESC
        LIMIT 10
      ) r
    ), '[]'::jsonb),
    'feedback_count', (
      SELECT COUNT(*)::int
      FROM public.feedback_reports
      WHERE user_id = target_user_id
    ),
    'recent_feedback', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',          f.id,
          'category',    f.category,
          'message',     f.message,
          'status',      f.status,
          'app_version', f.app_version,
          'created_at',  f.created_at
        )
        ORDER BY f.created_at DESC
      )
      FROM (
        SELECT id, category, message, status, app_version, created_at
        FROM public.feedback_reports
        WHERE user_id = target_user_id
        ORDER BY created_at DESC
        LIMIT 5
      ) f
    ), '[]'::jsonb),
    'admin_actions_on_user', (
      SELECT COUNT(*)::int
      FROM public.admin_audit_log
      WHERE target_type = 'user' AND target_id = target_user_id::text
    )
  ) INTO v_result;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_details(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_details(UUID) TO authenticated;
