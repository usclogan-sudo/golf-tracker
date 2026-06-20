# Uptime & Health Monitoring

Operational doc for setting up external uptime monitoring for Gimme. The signups happen outside the repo (Better Uptime, UptimeRobot, or whatever you pick); this doc is the setup checklist.

> **Why external?** Sentry catches errors *inside* the app. Supabase shows internal database health. Neither tells you "the live URL is down" or "auth is broken from the user's perspective." An external pinger fills that gap.

---

## What to monitor

In rough priority — start with #1 and #2, add the rest as you grow.

| # | Target | URL | What it proves |
|---|---|---|---|
| 1 | **PWA loads** | `https://usclogan-sudo.github.io/golf-tracker/` | GitHub Pages is serving the app shell; the HTML, manifest, and main JS bundle are reachable |
| 2 | **Supabase REST is reachable** | `https://dbtphtdzblwphpuwodea.supabase.co/rest/v1/?apikey=<anon_key>` | Database fronting layer is alive (returns 200 with the anon key) |
| 3 | **Supabase Auth is reachable** | `https://dbtphtdzblwphpuwodea.supabase.co/auth/v1/health` | `gotrue` (auth service) is healthy |
| 4 | **A read-only app_versions check** | RPC via REST: `GET /rest/v1/app_versions?platform=eq.web&select=recommended_version` | End-to-end: HTTPS + Postgres + RLS-permitted read all work for an anon session |
| 5 | **Specific Edge Function** | `https://dbtphtdzblwphpuwodea.supabase.co/functions/v1/import-scorecard-photo` | The photo-import path is alive (HEAD request, expects 405 for HEAD or 200 for OPTIONS) |

## Recommended providers

Comparable free-tier options. Pick one — running two against the same surface mostly buys noise.

| Provider | Free tier | Best for |
|---|---|---|
| **Better Uptime** | 10 monitors, 3-min checks | Best UX, status-page bundled, on-call rotation |
| **UptimeRobot** | 50 monitors, 5-min checks | Most monitor headroom for free |
| **Sentry Cron Monitoring** | Included with existing Sentry | If you want everything in one tool |

If you don't know which to pick: **Better Uptime**. The 3-minute frequency catches incidents before users tell you.

---

## Setup checklist

### 1. Pick a provider and create an account

Use a shared team email (e.g. `ops@gimme.golf`) so on-call alerts don't get stuck in one inbox.

### 2. Add the monitors above

For each row in the "What to monitor" table:
- **Name**: short and memorable — "Gimme PWA", "Gimme Auth", etc.
- **URL**: from the table
- **Check interval**: 3 minutes for #1–#3, 10 minutes for #4 and #5
- **Expected status**: 200 (or 200/302 for the PWA URL since GitHub Pages may redirect)
- **Expected body** (optional, for #2): contains `"swagger"` or similar to confirm the OpenAPI doc is served (not just a CDN error page that happens to return 200)
- **Locations**: at least 2 geographic regions (US East + US West)

### 3. Configure alert routing

| Severity | Channel | Notes |
|---|---|---|
| **Down** (≥2 consecutive failures) | Email + SMS to on-call | The user-visible outage |
| **Degraded** (slow response, >5s p50) | Email only | Investigate but not paging-worthy |
| **Recovered** | Email only | Auto-close on the alerting side |

### 4. Add a status page (optional but recommended)

Better Uptime includes a free public status page at `status.<yourdomain>`. Worth doing once you have ≥10 active users — it cuts down the "is it just me?" support volume.

### 5. Add the on-call calendar

If you're solo today: skip. If/when you have a team: use the provider's rotation feature so off-hour alerts route to whoever's on call.

---

## What to alert on (and what NOT to)

**Alert on:**
- HTTP 5xx from any monitor
- Response time > 5s p50 for 10+ consecutive minutes
- TLS certificate expiring within 14 days

**Don't alert on (these are noise):**
- Individual slow responses (single-tail latency is normal on GitHub Pages CDN edges)
- Supabase realtime WebSocket health (it self-heals; the in-app reconnect logic handles transient drops)
- Any single failed check (always require ≥2 consecutive)

---

## What's NOT covered by external monitoring

External monitoring catches the "is the front door open" class of failure. It doesn't catch:

| Failure | Where it shows up | Where to look |
|---|---|---|
| Specific RPC silently returning wrong data | Sentry (if it throws) or user feedback | Sentry dashboard + `feedback_reports` table |
| RLS policy regressions (admin sees nothing) | Sentry breadcrumbs + admin reports | Sentry release-filtered errors |
| Slow queries under load | Supabase Performance Insights | Supabase dashboard → Database → Query Performance |
| Auth provider misconfiguration | Sentry + user reports | Supabase Auth logs |
| Edge function cold-start timeouts | Edge function logs | Supabase dashboard → Edge Functions |

Treat external uptime as one of three legs of the stool. The other two are **Sentry** (in-app errors with user context — already wired) and **Supabase's built-in observability** (queries, auth events, edge function logs).

---

## Future: a dedicated `/healthz` endpoint

When Gimme gets its own backend (whether for native v1 or for an API gateway), add a dedicated `/healthz` endpoint that touches Postgres + Auth + Storage in a single round-trip and returns 200/500 based on aggregate health. Then point the uptime monitor at that single endpoint instead of #2–#5 above. Today the app is a static PWA + Supabase, so there's no place to put it — and the monitors above cover the same ground.

---

## When you set this up, write the answer here

After picking a provider and configuring the monitors, record:

- **Provider**: _e.g. Better Uptime_
- **Status page URL**: _e.g. status.gimme.golf_
- **On-call rotation**: _e.g. usclogan@gmail.com (solo)_
- **Account login**: _e.g. ops@gimme.golf — credentials in 1Password_

Updating this doc when the setup is done makes future-you's life easier when an alert fires at 2am.
