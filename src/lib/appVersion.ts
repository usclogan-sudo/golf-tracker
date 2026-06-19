import { supabase } from './supabase'
import { APP_VERSION, APP_PLATFORM, Sentry } from './sentry'

export type VersionCompatibility = 'ok' | 'upgrade-recommended' | 'force-upgrade' | 'unknown'

export interface VersionCheckResult {
  status: VersionCompatibility
  current: string
  platform: string
  minSupported?: string
  recommended?: string
  notes?: string | null
}

/** Plain-string compare. Callers must seed app_versions rows with a strictly-ordered scheme (semver or zero-padded). */
function cmp(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Checks the current client's version against the server-side `app_versions` row for its platform.
 * - Web no-ops in practice (always-latest), but the call still runs so Sentry breadcrumbs capture mismatches if rows ever drift.
 * - Native clients should gate the UI: 'upgrade-recommended' shows a soft prompt; 'force-upgrade' shows a blocking wall.
 */
export async function checkAppVersion(): Promise<VersionCheckResult> {
  const result: VersionCheckResult = {
    status: 'unknown',
    current: APP_VERSION,
    platform: APP_PLATFORM,
  }

  try {
    const { data, error } = await supabase
      .from('app_versions')
      .select('min_supported_version, recommended_version, force_upgrade_below, notes')
      .eq('platform', APP_PLATFORM)
      .maybeSingle()

    if (error || !data) return result

    result.minSupported = data.min_supported_version
    result.recommended = data.recommended_version
    result.notes = data.notes

    if (data.force_upgrade_below && cmp(APP_VERSION, data.force_upgrade_below) <= 0) {
      result.status = 'force-upgrade'
    } else if (cmp(APP_VERSION, data.min_supported_version) < 0) {
      result.status = 'force-upgrade'
    } else if (cmp(APP_VERSION, data.recommended_version) < 0) {
      result.status = 'upgrade-recommended'
    } else {
      result.status = 'ok'
    }

    if (result.status !== 'ok') {
      Sentry.addBreadcrumb({
        category: 'app-version',
        level: result.status === 'force-upgrade' ? 'warning' : 'info',
        message: `Client version ${APP_VERSION} on ${APP_PLATFORM} flagged as ${result.status}`,
        data: { minSupported: result.minSupported, recommended: result.recommended },
      })
    }
  } catch {
    // Network or RLS failure — treat as unknown, don't block the user
  }

  return result
}
