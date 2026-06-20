import * as Sentry from '@sentry/react'

declare const __APP_VERSION__: string
declare const __APP_PLATFORM__: string

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'
export const APP_PLATFORM = typeof __APP_PLATFORM__ !== 'undefined' ? __APP_PLATFORM__ : 'web'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `gimme-${APP_PLATFORM}@${APP_VERSION}`,
    sampleRate: 1.0,
  })

  Sentry.setTag('app.platform', APP_PLATFORM)
  Sentry.setTag('app.version', APP_VERSION)
}

/** Attach the signed-in user to all subsequent Sentry events. Call on auth success. */
export function setSentryUser(userId: string, isAnonymous = false) {
  Sentry.setUser({ id: userId, segment: isAnonymous ? 'anonymous' : 'authenticated' })
}

/** Detach the user context. Call on sign-out. */
export function clearSentryUser() {
  Sentry.setUser(null)
}

/**
 * Report a Supabase `{ error }` return value to Sentry without disrupting the
 * caller's existing error-handling flow. Use at write sites where today an
 * error gets converted to a generic UI message and disappears — like the FK
 * race in startRound, where the Postgres-side detail
 * ("violates foreign key constraint fk_round_players_round") never made it
 * past the catch block.
 *
 * No-ops when error is null/undefined so it's safe to call unconditionally
 * after every `{ error } = await supabase...` destructure.
 */
export function reportSupabaseError(
  error: unknown,
  op: string,
  context?: Record<string, unknown>,
): void {
  if (!error) return
  Sentry.captureException(error, {
    tags: { area: 'supabase', op },
    extra: context,
  })
}

export { Sentry }
