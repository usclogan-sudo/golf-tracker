import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry, Sentry } from './lib/sentry'
import { initNative, isNative } from './lib/native'
import './index.css'
import App from './App.tsx'

initSentry()
// Native shell (Capacitor) — no-op on web.
void initNative()

// Brand QA preview — bypasses auth and renders the result-card scenarios.
// Reachable at /golf-tracker/?preview=share-card. Removing the query param returns to the app.
const previewParam = new URLSearchParams(window.location.search).get('preview')
const ShareCardPreview = previewParam === 'share-card'
  ? lazy(() => import('./components/ShareCard/ShareCardPreview').then(m => ({ default: m.ShareCardPreview })))
  : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={({ error }) => (
      <div style={{ padding: 24, fontFamily: 'monospace' }}>
        <h1 style={{ color: 'red' }}>App Error</h1>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{(error as Error)?.message}</pre>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#666', marginTop: 8 }}>{(error as Error)?.stack}</pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 16px' }}>Reload</button>
      </div>
    )}>
      {ShareCardPreview ? (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#16263B' }} />}>
          <ShareCardPreview />
        </Suspense>
      ) : (
        <App />
      )}
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

// The service worker is a PWA/web concern only. In the native shell Capacitor
// serves assets locally, so registering an SW would just fight its cache.
if (!isNative() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for updates every 5 minutes
      setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000)

      // When a new SW is found and finishes installing, tell it to activate immediately
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW is ready — tell it to take over
            newWorker.postMessage('SKIP_WAITING')
          }
        })
      })
    }).catch(() => {})

    // When the new SW takes control, reload to get fresh assets
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}
