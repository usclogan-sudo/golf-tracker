// Supabase Edge Function: send-push
//
// Delivers a native push notification to all of a user's registered devices via
// Firebase Cloud Messaging (FCM v1). One path covers BOTH platforms: Android
// natively, and iOS if the Firebase project has an APNs key uploaded.
//
// ⚠️ NOT yet validated end-to-end — needs a Firebase project + a real device.
// Setup (see docs/NATIVE-BUILD.md):
//   1. Create a Firebase project; add iOS + Android apps; upload an APNs auth key
//      to Firebase for iOS delivery.
//   2. Create a service account, download its JSON key.
//   3. `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"`
//      `supabase secrets set FCM_PROJECT_ID=<your-firebase-project-id>`
//   4. `supabase functions deploy send-push`
//
// Auth: this function reads device_tokens for an ARBITRARY user (service role), so
// it must only be callable by the backend. It requires the caller to present the
// service-role key as `Authorization: Bearer <SERVICE_ROLE_KEY>` — i.e. it's meant
// to be invoked by a DB trigger (pg_net) or another trusted server context, never
// directly by a client. Deploy with --no-verify-jwt and rely on this check.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_SERVICE_ACCOUNT = Deno.env.get('FCM_SERVICE_ACCOUNT')
const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID')

interface Body {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
const b64urlJson = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))

/** Import a PEM PKCS#8 private key for RS256 signing. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** Mint a short-lived OAuth2 access token for the FCM scope from the service account. */
async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${b64urlJson({ alg: 'RS256', typ: 'JWT' })}.${b64urlJson(claim)}`
  const key = await importPrivateKey(sa.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) throw new Error(`oauth token exchange failed: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token as string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // Only the backend (service role) may call this.
  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${SERVICE_ROLE}`) return json({ error: 'forbidden' }, 403)

  if (!FCM_SERVICE_ACCOUNT || !FCM_PROJECT_ID) {
    // Not configured yet — no-op so callers don't error before Firebase is set up.
    return json({ skipped: 'FCM not configured' }, 200)
  }

  let payload: Body
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  if (!payload.userId || !payload.title || !payload.body) {
    return json({ error: 'userId, title, body required' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: tokens, error } = await admin
    .from('device_tokens')
    .select('token')
    .eq('user_id', payload.userId)
  if (error) return json({ error: error.message }, 500)
  if (!tokens || tokens.length === 0) return json({ sent: 0, reason: 'no devices' }, 200)

  const sa = JSON.parse(FCM_SERVICE_ACCOUNT)
  const accessToken = await getAccessToken(sa)
  const endpoint = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`

  let sent = 0
  const stale: string[] = []
  for (const { token } of tokens as { token: string }[]) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {},
        },
      }),
    })
    if (res.ok) sent++
    else if (res.status === 404 || res.status === 400) stale.push(token) // unregistered token
  }

  // Prune tokens FCM rejected as unregistered.
  if (stale.length) {
    await admin.from('device_tokens').delete().in('token', stale)
  }

  return json({ sent, pruned: stale.length })
})
