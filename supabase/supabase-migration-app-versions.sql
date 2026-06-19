-- App-version manifest: lets the server tell clients which app versions are still
-- supported, which to recommend an upgrade for, and which to hard-block.
--
-- Web is always-latest (PWA reload pulls the new build) so this is mostly inert
-- on web today; native clients will respect it from day one.

CREATE TABLE IF NOT EXISTS public.app_versions (
  platform TEXT PRIMARY KEY,
  -- Versions are compared as plain strings. Use zero-padded semver (e.g. "00001.00002.00003")
  -- or stick to a strictly-ordered scheme. Keep this consistent across rows.
  min_supported_version TEXT NOT NULL,
  recommended_version TEXT NOT NULL,
  -- Optional: a one-off hard block. If a client's version is <= this, force-upgrade.
  -- Use when a critical bug ships and rollback isn't viable.
  force_upgrade_below TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.app_versions IS
  'Per-platform compatibility window. Clients query their row on launch and either no-op, prompt-upgrade, or hard-block based on their own version vs. the row.';

-- Seed each platform with the current build. Adjust as builds ship.
INSERT INTO public.app_versions (platform, min_supported_version, recommended_version, notes)
VALUES
  ('web',     '0.1.0', '0.1.0', 'Web is always-latest via PWA reload; this row is informational.'),
  ('ios',     '0.1.0', '0.1.0', 'Native iOS — pending v1 launch.'),
  ('android', '0.1.0', '0.1.0', 'Native Android — pending v1 launch.')
ON CONFLICT (platform) DO NOTHING;

-- RLS: anyone (including anonymous) can read; only admins can write.
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_versions_read_any ON public.app_versions;
CREATE POLICY app_versions_read_any ON public.app_versions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS app_versions_admin_write ON public.app_versions;
CREATE POLICY app_versions_admin_write ON public.app_versions
  FOR ALL
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
