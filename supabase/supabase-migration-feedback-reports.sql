-- In-app feedback / bug reports. Replaces the mailto: link with a structured
-- form so reports come in with user_id, app version, platform, and runtime
-- context attached.

CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,                          -- self-reported, for follow-up
  category TEXT NOT NULL,                   -- 'bug' | 'idea' | 'praise' | 'other'
  message TEXT NOT NULL,
  app_version TEXT,
  app_platform TEXT,                        -- 'web' | 'ios' | 'android'
  user_agent TEXT,
  route TEXT,                               -- current screen / hash at report time
  context JSONB DEFAULT '{}'::jsonb,        -- breadcrumbs, last error, anything else useful
  status TEXT NOT NULL DEFAULT 'new',       -- 'new' | 'triaged' | 'resolved' | 'spam'
  triaged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  triaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feedback_reports IS
  'In-app feedback / bug reports. Each row carries the runtime context (version, platform, route) that the user did not have to type.';

CREATE INDEX IF NOT EXISTS feedback_reports_created_idx ON public.feedback_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_reports_status_idx  ON public.feedback_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_reports_user_idx    ON public.feedback_reports (user_id, created_at DESC);

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated (including anonymous/guest sessions) can submit, but only
-- with their own user_id stamped. user_id NULL is allowed for fully anonymous
-- pre-auth reports (rare — the form is gated, but the schema permits it).
DROP POLICY IF EXISTS feedback_reports_insert_self ON public.feedback_reports;
CREATE POLICY feedback_reports_insert_self ON public.feedback_reports
  FOR INSERT
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Admins read everything. Users can read their own reports.
DROP POLICY IF EXISTS feedback_reports_read ON public.feedback_reports;
CREATE POLICY feedback_reports_read ON public.feedback_reports
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.is_admin = true
    )
  );

-- Admins triage / update status; users cannot edit their own reports after submission.
DROP POLICY IF EXISTS feedback_reports_admin_update ON public.feedback_reports;
CREATE POLICY feedback_reports_admin_update ON public.feedback_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.is_admin = true
    )
  );
