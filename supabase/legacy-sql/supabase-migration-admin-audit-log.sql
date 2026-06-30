-- Admin audit log: every meaningful admin write should call log_admin_action()
-- so we can answer "who deleted X round on Y date" without a SQL session.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                  -- 'toggle_admin', 'delete_round', 'delete_shared_course', etc.
  target_type TEXT,                      -- 'user', 'round', 'shared_course', 'game_preset', 'player'
  target_id TEXT,                        -- the affected row's primary key, stringified
  target_label TEXT,                     -- human-readable label snapshot ('Las Posas — Jun 14')
  metadata JSONB DEFAULT '{}'::jsonb,    -- arbitrary extra context
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_audit_log IS
  'Append-only log of admin write actions. Written via log_admin_action() RPC; read directly by the admin UI.';

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx   ON public.admin_audit_log (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx  ON public.admin_audit_log (target_type, target_id);

-- RLS: only admins read; writes go through the SECURITY DEFINER RPC below,
-- so the table itself rejects direct INSERTs from clients.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_read_admins ON public.admin_audit_log;
CREATE POLICY admin_audit_log_read_admins ON public.admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.is_admin = true
    )
  );

-- Write helper: SECURITY DEFINER so we can guarantee admin_user_id matches
-- the calling user, and that non-admins can't pollute the log.
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action       TEXT,
  p_target_type  TEXT DEFAULT NULL,
  p_target_id    TEXT DEFAULT NULL,
  p_target_label TEXT DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'log_admin_action: not authenticated';
  END IF;

  SELECT is_admin INTO v_is_admin
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'log_admin_action: caller is not an admin';
  END IF;

  INSERT INTO public.admin_audit_log (
    admin_user_id, action, target_type, target_id, target_label, metadata
  )
  VALUES (
    auth.uid(), p_action, p_target_type, p_target_id, p_target_label,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
