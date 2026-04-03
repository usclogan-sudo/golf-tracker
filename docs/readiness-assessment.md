# Readiness Assessment: 100 Users Across All Formats

What it would take to have 100 people actively using Gimme Golf through web, iOS PWA, and Android PWA.

---

## Current State

**What's working today:**
- Full scoring for 10+ game types (Skins, Nassau, Wolf, BBB, Hammer, etc.)
- Course setup with handicap/slope/rating
- Supabase auth (email/password + guest accounts)
- PWA installable on iOS and Android
- Offline support via service worker
- Tournaments (match play brackets, stroke play)
- Multi-group events with scorekeeper roles
- Settlement tracking with Venmo/Zelle/Cash App/PayPal links
- Round invite codes + spectator mode
- Notifications, dark mode, share cards

**What that means:** The core product is feature-complete for a golf group to score rounds, run side games, and settle up. The gaps below are about reliability, trust, and removing friction at scale.

---

## 1. Infrastructure & Reliability

### Email Delivery (Done)
- **Current:** Brevo (formerly Sendinblue) configured as custom SMTP in Supabase. Password resets and confirmations deliver today.
- **Limits:** 300 emails/day (Brevo free tier), 60-second per-user cooldown. At 100 users this is a non-issue.
- **Action:** None needed. Already solved.

### Database Limits & Monitoring
- **Current:** Supabase free tier (500MB DB, 2GB bandwidth, 50K monthly active users)
- **Needed for 100 users:** Free tier is plenty. ~100 rounds/month = negligible storage.
- **Action:** Set up Supabase dashboard alerts for approaching limits. Consider upgrading to Pro ($25/mo) only if bandwidth spikes from image loading or heavy API use.
- **Effort:** 30 minutes

### Error Tracking
- **Current:** Errors only visible in browser console
- **Needed:** Know when things break before users tell you
- **Action:** Add Sentry free tier (5K errors/mo). Wrap the React app in an ErrorBoundary that reports to Sentry.
- **Effort:** 1-2 hours

### Service Worker Versioning (Done)
- **Current:** Build hash auto-stamped into sw.js CACHE_NAME on each deploy. New SW activates immediately, old caches are purged, and the page auto-reloads. App checks for updates every 5 minutes.
- **Action:** None needed. Already solved.

---

## 2. Onboarding & First-Run Experience

### Signup Friction
- **Current:** Email + password signup, or guest mode
- **Needed:** Under 60 seconds from "heard about app" to "entering scores"
- **Actions:**
  - Add a brief onboarding walkthrough (already exists as `onboarding` screen — verify it's polished and covers key flows)
  - Make guest mode prominent — let people score a round before committing to an account
  - Guest-to-registered upgrade path already exists; make sure the prompt is well-timed (after first completed round)
- **Effort:** 2-4 hours to polish

### Course Pre-Loading
- **Current:** Ventura County courses pre-loaded + "Near Me" via OpenStreetMap
- **Needed:** First-time users need to find their course instantly
- **Action:** Verify "Near Me" works reliably across browsers/platforms. Consider pre-loading courses for your target metro areas. Add a "Can't find your course?" fallback that's obvious.
- **Effort:** 1-2 hours

### Invite Flow
- **Current:** 6-character invite codes, manual sharing
- **Needed:** One tap to share a join link
- **Action:** Generate a shareable URL like `foreskinsgolf.com/?join=ABC123` that deep-links into the round. Use Web Share API (already available in PWA context) for native share sheets.
- **Effort:** 3-4 hours

---

## 3. Cross-Platform Polish

### iOS PWA
- **Working:** Splash screens (SE, standard, Pro Max), standalone mode, safe area insets
- **Gaps to test:**
  - iOS 17+ changed PWA push notification support — verify notifications work or degrade gracefully
  - Camera/photo access for custom avatars
  - "Add to Home Screen" discoverability (InstallBanner helps, but test the copy)
- **Effort:** 2-3 hours of testing + fixes

### Android PWA
- **Working:** Installable, standalone display
- **Gaps to test:**
  - Back button behavior (Android hardware back)
  - Install prompt timing (beforeinstallprompt event)
  - Notification permissions on Android 13+ (requires explicit grant)
- **Effort:** 2-3 hours of testing + fixes

### Desktop Web
- **Working:** Responsive layout with max-width container
- **Gaps:** Number pad UI designed for mobile may feel odd on desktop. Scorecard is the main use case — verify it's usable with mouse/keyboard.
- **Effort:** 1-2 hours

---

## 4. Data Integrity & Edge Cases

### Multi-Device / Multi-User Conflicts
- **Current:** No real-time sync — each user fetches on mount
- **Risk:** Two scorekeepers entering scores for the same round, or stale data after backgrounding the app
- **Action (minimum):** Add a `updated_at` check before writes. Show "scores have been updated by someone else" if conflict detected. Pull-to-refresh or auto-refresh on app foreground.
- **Action (ideal):** Supabase Realtime subscriptions for active rounds so all participants see live updates.
- **Effort:** Minimum 3-4 hours; Realtime 8-12 hours

### Handicap Accuracy
- **Current:** Manual handicap index entry, USGA formula for course handicap
- **Needed:** If money is on the line, handicaps need to be trusted
- **Action:** Add "last updated" date to handicap. Consider GHIN lookup integration (API exists). At minimum, make it clear the app uses user-entered indexes.
- **Effort:** 1 hour for transparency; 8+ hours for GHIN integration

### Settlement Disputes
- **Current:** Settlement records with paid/unpaid status
- **Needed:** A way for players to see the math — "why do I owe $12?"
- **Action:** The settlement detail/breakdown should be easily accessible from SettleUp. Verify it clearly traces back to specific game results.
- **Effort:** 2-3 hours

---

## 5. Performance & Loading

### Image Loading (New)
- **Current:** 12 stock course photos just added (~17-54KB each)
- **Action:** These are small and same-origin, so fine. The service worker will cache them after first load.

### Initial Load
- **Current:** ~218KB gzipped JS bundle
- **Needed:** Under 3 seconds on 4G for first meaningful paint
- **Action:** Test on throttled connections. Consider lazy-loading the tournament and event modules (they're not needed on first load). Code-split with dynamic imports.
- **Effort:** 2-3 hours

### Offline Resilience
- **Current:** Offline queue for mutations, service worker cache
- **Needed:** Verify the offline queue actually flushes correctly when connectivity returns. Test airplane mode mid-round.
- **Effort:** 2-3 hours of testing

---

## 6. Legal & Trust

### Privacy Policy / Terms
- **Needed for 100 users:** A simple privacy policy (you collect email, scores, payment method usernames — not actual payment info)
- **Action:** Add a `/privacy` page. Doesn't need to be lawyered — a plain-English page covers you for this stage.
- **Effort:** 1-2 hours

### Data Export
- **Needed:** Users should be able to get their data out
- **Action:** Add a "Download my data" button in Settings that exports rounds/scores as CSV or JSON
- **Effort:** 2-3 hours

---

## Summary: Priority Order

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **Done** | Email delivery (Brevo) | 0 hrs | Already configured |
| **Done** | Service worker auto-update | 0 hrs | Already implemented |
| **P1** | Error tracking (Sentry) | 1-2 hrs | Know when things break |
| **P1** | Shareable invite URLs | 3-4 hrs | Viral growth loop |
| **P1** | Conflict detection for scores | 3-4 hrs | Data trust |
| **P2** | Onboarding polish | 2-4 hrs | First impression |
| **P2** | Cross-platform testing pass | 4-6 hrs | Install confidence |
| **P2** | Privacy policy | 1-2 hrs | Trust |
| **P3** | Code splitting | 2-3 hrs | Load speed |
| **P3** | Realtime sync | 8-12 hrs | Live scoring UX |
| **P3** | Data export | 2-3 hrs | User trust |
| **P3** | GHIN integration | 8+ hrs | Handicap trust |

**Total estimated effort to be "100-user ready": ~25-35 hours of focused work**, with P0 items completable in a single weekend.
