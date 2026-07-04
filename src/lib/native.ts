// Native (Capacitor) integration for the Gimme app shell.
//
// The web app is unchanged; this module only runs extra behavior when the app
// is running inside the native iOS/Android shell (Capacitor.isNativePlatform()).
// On the web it is a no-op, so nothing here affects the PWA.

import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

export const isNative = () => Capacitor.isNativePlatform()

/** Background the app (Android) instead of quitting — used at the nav root. */
export async function minimizeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await CapApp.minimizeApp()
  } catch {
    /* not available on this platform */
  }
}

/**
 * Route a Gimme deep link (Universal/App Link) into the app's existing
 * join/spectate flow. The web app reads ?join= / ?spectate= from the URL on
 * mount; here we bridge a native appUrlOpen event to the same state via a
 * CustomEvent that App.tsx listens for.
 */
function routeDeepLink(url: string) {
  try {
    const u = new URL(url)
    const join = u.searchParams.get('join')
    const spectate = u.searchParams.get('spectate')
    if (join) sessionStorage.setItem('pendingJoinCode', join)
    if (join || spectate) {
      window.dispatchEvent(new CustomEvent('gimme:deeplink', { detail: { join, spectate } }))
    }
  } catch {
    /* ignore malformed URLs */
  }
}

let initialized = false

/** Initialize native-only behavior. Safe to call on web (no-ops). */
export async function initNative(): Promise<void> {
  if (initialized || !Capacitor.isNativePlatform()) return
  initialized = true

  // Status bar: light content to sit on the navy header. (Style.Dark = light text.)
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#16263B' })
    }
  } catch {
    /* status bar not critical */
  }

  // Deep links, whether the app is warm or cold-started.
  CapApp.addListener('appUrlOpen', ({ url }) => routeDeepLink(url))

  // Android hardware back button: let the app decide (go back vs. minimize)
  // instead of the default, which quits the app.
  CapApp.addListener('backButton', () => {
    window.dispatchEvent(new CustomEvent('gimme:back'))
  })

  // Reveal the app once the web layer has painted.
  try {
    await SplashScreen.hide()
  } catch {
    /* splash already hidden */
  }

  // Push registration (delivery wiring is a follow-up — see docs/NATIVE-BUILD.md).
  void initPush()
}

async function initPush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return
    await PushNotifications.register()
    PushNotifications.addListener('registration', () => {
      // TODO(native): persist token.value to a `device_tokens` table so the
      // backend can send invite / settlement-nudge / approval pushes via APNs/FCM.
      console.info('[push] device registered')
    })
    PushNotifications.addListener('registrationError', (e) =>
      console.warn('[push] registration error', e),
    )
  } catch (e) {
    console.warn('[push] init failed', e)
  }
}
