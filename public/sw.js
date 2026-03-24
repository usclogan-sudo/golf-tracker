const CACHE_NAME = '__BUILD_HASH__'
const SHELL_URLS = [
  '/golf-tracker/',
  '/golf-tracker/index.html',
  '/golf-tracker/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  // Skip non-GET and Supabase API calls
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('supabase')) return

  const url = new URL(event.request.url)

  // Vite hashed assets (contain a hash in filename) — cache-first since they're immutable
  const isHashedAsset = /\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpg|svg)$/.test(url.pathname)

  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Everything else — network-first with offline fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached
          // For navigation requests, show offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/golf-tracker/offline.html')
          }
          return new Response('', { status: 503 })
        })
      )
  )
})
