-- Admin broadcast: send an in-app notification to all users or a targeted list.
-- Today this writes to the existing notifications table (consumed by the in-app
-- toast + badge). When native push (N4) lands, the same RPC can fan out push
-- payloads from a single send.

CREATE OR REPLACE FUNCTION public.admin_send_broadcast(
  p_title         TEXT,
  p_body          TEXT DEFAULT NULL,
  p_target_user_ids UUID[] DEFAULT NULL  -- NULL = all onboarded users
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin   BOOLEAN;
  v_audience   UUID[];
  v_inserted   INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'admin_send_broadcast: not authenticated';
  END IF;

  SELECT is_admin INTO v_is_admin
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'admin_send_broadcast: caller is not an admin';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'admin_send_broadcast: title is required';
  END IF;

  -- Resolve audience. NULL/empty -> everyone who finished onboarding.
  IF p_target_user_ids IS NULL OR array_length(p_target_user_ids, 1) IS NULL THEN
    SELECT array_agg(user_id) INTO v_audience
    FROM public.user_profiles
    WHERE onboarding_complete = true;
  ELSE
    v_audience := p_target_user_ids;
  END IF;

  IF v_audience IS NULL OR array_length(v_audience, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (id, user_id, type, title, body, read)
  SELECT gen_random_uuid(), uid, 'broadcast', p_title, p_body, false
  FROM unnest(v_audience) AS uid;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Audit log entry
  INSERT INTO public.admin_audit_log (
    admin_user_id, action, target_type, target_label, metadata
  )
  VALUES (
    auth.uid(),
    'send_broadcast',
    'broadcast',
    p_title,
    jsonb_build_object(
      'recipient_count', v_inserted,
      'targeted',        p_target_user_ids IS NOT NULL,
      'body_length',     COALESCE(length(p_body), 0)
    )
  );

  RETURN v_inserted;
END
$$;

REVOKE ALL ON FUNCTION public.admin_send_broadcast(TEXT, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast(TEXT, TEXT, UUID[]) TO authenticated;
