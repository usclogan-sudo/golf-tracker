# Gimme — Capability Inventory

A scannable, one-line-per-capability inventory of everything the web app does today. Built for two uses: (1) handing to a mobile-dev partner so they can scope an iOS/Android build, and (2) a triage worksheet — mark **K** (keep), **C** (cut), **I** (improve), or **+** (add) in the right-hand column.

> Last verified against the codebase: 2026-06-01

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Live — visible to users today |
| 🔒 | Code-complete but feature-flagged off (UI hidden, can be re-enabled) |
| 🚧 | In progress — partially built |
| 🧠 | Backend / infrastructure (no direct user-visible UI) |
| ❌ | Not built — planned add for native |

## Triage column

Blank = **K** (keep, no change). Other markings: **I** = improve / rework · **K (dormant)** = keep code, leave hidden · **+** = planned add.

---

## Native v1 scope

The list below is the full product inventory. For the first iOS/Android release, the scope is **everything in the table except** the items below — those are roadmap, not v1.

### In v1 (everything else, plus these explicit calls)

- **E9 Photo scorecard import** — push to ship in v1 (web M5 prompt tuning + native camera port + import cap decision; ~3–5 days remaining)
- **D6 / D7 / D10 / D11 (Hammer / Vegas / Banker / Quota)** — keep in the game catalog but **deprioritize in the picker UI** (collapse under a "More games" tray; not on the top row alongside Skins / Nassau / Best Ball / Wolf / BBB / Stableford / Dots / Props)
- **F6, J9, M7, N4** — all marked **+** in the inventory; v1 adds

### Roadmap (post-v1)

| Section | Capability | Why later |
|---|---|---|
| I1–I4 | Tournaments (stroke play, bracket, list, detail) | Heavy surface area, thin user slice. Backlog. |
| B3 | Crowdsourced shared course catalog | Curated (B1) + custom (B4) cover v1 |
| B8 | Public player directory | Privacy review before ship |
| P1–P3 | Admin dashboard | Stays on web for admin users |
| K3 / K4 / K5 | Stats depth (distribution chart, head-to-head, most-played) | K1 dashboard + K2 history + K6 per-course cover v1 |
| L3 | Handicap-over-time chart | Index (L1) ships; visualization later |
| C6 | High Roller stakes band | Dormant — pulled from Pass 1 |

Everything else in the table = **v1**.

---

## A. Identity & Onboarding

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| A1 | Email + password sign-up / sign-in | ✅ | `Auth/Auth.tsx`, Supabase Auth | |
| A2 | Forgot password + reset-email flow | ✅ | `Auth/ResetPassword.tsx` | |
| A3 | Guest mode (anonymous sign-in, no signup) | ✅ | `Auth/Auth.tsx`, Supabase anon | |
| A4 | Guest → real account upgrade (no data loss) | ✅ | `Auth/UpgradeAccount.tsx` | |
| A5 | Session-expired re-auth banner (preserves unsynced work) | ✅ | `App.tsx`, `Auth/Auth.tsx` | |
| A6 | First-run onboarding (name, handicap, payment handles) | ✅ | `Onboarding/Onboarding.tsx` | |
| A7 | Avatar picker (emoji + image upload presets) | ✅ | `AvatarPicker.tsx` | |
| A8 | "Add to Home Screen" install prompt (iOS + Android) | ✅ | `InstallBanner.tsx` | |
| A9 | Beta-feedback banner (links to feedback form) | ✅ | `App.tsx` | I — retire post-launch |

## B. Course & Player Setup

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| B1 | Pre-loaded course library (curated Ventura-area) | ✅ | `data/courses`, `CourseCatalog/` | |
| B2 | "Near me" GPS course search | ✅ | `NearMeCourses/`, `golfCourseApi.ts` | |
| B3 | Crowdsourced shared course catalog (user-built, shared) | ✅ | `CourseCatalog/`, Supabase RLS | |
| B4 | Custom course builder (holes, pars, SI, multiple tees, slope/rating) | ✅ | `CourseSetup/` | |
| B5 | 9-hole / 18-hole / front-9-only / back-9-only support | ✅ | `gameLogic.ts`, `Scorecard/` | |
| B6 | Shotgun start (per-group starting hole) | ✅ | `NewRound/`, `EventSetup/` | |
| B7 | Personal player roster (saved opponents) | ✅ | `PlayerSetup/`, `PlayerDirectory/` | |
| B8 | Public player directory (opt-in profiles) | ✅ | `PlayerDirectory/` | |
| B9 | Guest player quick-add (inline, not saved across rounds) | ✅ | `PlayerSetup/` | |
| B10 | Payment handles per player (Venmo / Zelle / Cash App / PayPal) | ✅ | `Settings/`, `Onboarding/` | |
| B11 | Handicap index per player (manual entry or auto-tracked) | ✅ | `handicap.ts`, `HandicapDetail/` | |
| B12 | Up to 8 players per round | ✅ | `gameLogic.ts` | |

## C. Round Creation (NewRound)

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| C1 | Step-by-step round wizard (course → players → groups → game → stakes) | ✅ | `NewRound/NewRound.tsx` | |
| C2 | Game picker with rules modal per game | ✅ | `GameRulesModal.tsx` | |
| C3 | Saved game presets (one-tap reuse) | ✅ | `NewRound/`, Supabase | |
| C4 | "Play Again" from last round (one-tap clone) | ✅ | `App.tsx` | |
| C5 | Stakes — unit-agnostic (dollars or points; same stake bands either way; points is a display toggle, not a separate mode) | ✅ | `NewRound/`, `money.ts` | I — unify dollars + points as one stakes concept with a unit toggle |
| C6 | High Roller stakes band ($100–$1,000, gold UI) | 🔒 | `NewRound/`, `index.css` `.hr-header` | K (dormant) — keep code, leave hidden |
| C8 | Per-player buy-in amount overrides | ✅ | `NewRound/` | |
| C9 | Treasurer designation | ✅ | `NewRound/`, `EventSetup/` | |
| C10 | Auto-grouping (foursomes/fivesomes from N players) | ✅ | `eventUtils.ts` | |

## D. Side Games

11 games, each supporting gross or net scoring.

| # | Game | Status | Notes | Triage |
|---|---|---|---|---|
| D1 | **Skins** — win hole = win pot; carryovers; press option | ✅ | Most-used | |
| D2 | **Best Ball** — two-team match, best score per hole | ✅ | Even player count | |
| D3 | **Nassau** — 3 bets in one round (front/back/total), presses | ✅ | | |
| D4 | **Wolf** — rotating "wolf" picks partner or goes solo | ✅ | 3+ players | |
| D5 | **Bingo Bango Bongo** — first-on, closest, first-in | ✅ | 3+ players | |
| D6 | **Hammer** — match-play with doubling hammer | ✅ | 2 players | |
| D7 | **Vegas** — team digits format | ✅ | 4 players | |
| D8 | **Stableford** — points-vs-par per hole | ✅ | | |
| D9 | **Dots / Junk** — sandies, greenies, snakes, polecat, custom | ✅ | Layered on any game | |
| D10 | **Banker** — one vs. everyone, hole by hole | ✅ | 3+ players | |
| D11 | **Quota** — target Stableford score per player | ✅ | | |
| D12 | **Prop bets** — ad-hoc wagers ("birdie on 7?" / "longest drive") | ✅ | `PropBets/`, both event-wide and per-hole | |
| D13 | Carryover toggle on skins | ✅ | | |

## E. In-Round Scoring

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| E1 | Tap-and-go score input (large number pad) | ✅ | `Scorecard/NumberPad.tsx` | |
| E2 | Hole-by-hole navigation with par/SI/yardage | ✅ | `Scorecard/Scorecard.tsx` | |
| E3 | Auto-save + rapid-tap debounce (final value wins) | ✅ | `Scorecard/`, `safeWrite.ts` | |
| E4 | Score celebrations (eagle / birdie / hole-in-one animations) | ✅ | `Celebrations.tsx` | |
| E5 | Live game-status panel (running totals, pot, presses) | ✅ | `Scorecard/LeaderboardTab.tsx` | |
| E6 | Hole-level betting panel (junk, dots, prop creation) | ✅ | `Scorecard/HoleBetsPanel.tsx` | |
| E7 | Mid-round game additions (prop bets, side bets) | ✅ | `Scorecard/CreateQuickPropForm.tsx` | |
| E8 | Buy-in confirmation banner (non-treasurer players) | ✅ | `Scorecard/BuyInBanner.tsx` | |
| E9 | Scorecard photo import (Claude Vision parse → confirm grid) | 🚧 | `Scorecard/PhotoImportButton.tsx`, edge fn `import-scorecard-photo`, `photoImport.ts` | |
| E10 | Unsaved-changes warning on tab close / back nav | ✅ | `Scorecard/` | |

## F. Live Sync & Multi-Device

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| F1 | Real-time score sync across all devices in round (<500ms) | ✅ | Supabase Realtime, `realtimeReducers.ts` | |
| F2 | Score approval workflow (group scorekeeper approves player entries) | ✅ | `Scorecard/`, `permissions.ts` | |
| F3 | Optimistic locking / conflict detection on hole edits | ✅ | `safeWrite.ts` | |
| F4 | Background-tab subscription pausing (saves battery/data) | ✅ | `realtimeReducers.ts` | |
| F5 | Presence indicators (who's online in event leaderboard) | ✅ | `EventLeaderboard/` | |
| F6 | Live presence on the in-round scorecard (see who's entering scores right now) | ❌ | new — extends `Scorecard/`, `realtimeReducers.ts` | + |

## G. Reliability

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| G1 | Offline score entry + auto-replay queue on reconnect | ✅ | `offlineQueue.ts` | |
| G2 | Offline page (`/offline.html`) when network gone | ✅ | `public/offline.html`, `sw.js` | |
| G3 | Per-route error boundary with "back to home" fallback | ✅ | `RouteErrorBoundary.tsx` | |
| G4 | Validation guards (no negative buy-ins, no par-99, etc.) | ✅ | `gameLogic.ts`, `money.ts` | |
| G5 | Invite-code rate limiting (10/min, 30/hr per user) | 🧠 | Supabase RLS / edge | |

## H. Events / Outings (Multi-Group)

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| H1 | Event creation (multi-group, named) | ✅ | `EventSetup/` | |
| H2 | Auto-assign players to groups, or manual override | ✅ | `EventSetup/`, `eventUtils.ts` | |
| H3 | Per-group scorekeeper designation | ✅ | `EventSetup/` | |
| H4 | Event-wide "Score Master" role (overrides any score) | ✅ | `permissions.ts` | |
| H5 | Per-group score isolation (scorekeepers only see their group) | ✅ | `permissions.ts` | |
| H6 | Live event leaderboard (overall + per-group views) | ✅ | `EventLeaderboard/` | |
| H7 | Spectator mode (read-only link, no signup) | ✅ | `EventLeaderboard/` | |
| H8 | QR code invite generation | ✅ | `InviteQR.tsx` | |
| H9 | 6-char invite code + URL deep-link (`?join=CODE`) | ✅ | `inviteCode.ts`, `JoinRound/` | |

## I. Tournaments (Multi-Round)

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| I1 | Stroke-play tournament (multi-round, accumulated) | ✅ | `TournamentSetup/`, `tournamentLogic.ts` | |
| I2 | Bracket-play tournament (head-to-head, auto-pairings) | ✅ | `TournamentBracket/` | |
| I3 | Tournament list / status (ongoing + past) | ✅ | `TournamentList/` | |
| I4 | Tournament detail with running standings | ✅ | `TournamentDetail/` | |

## J. Settle Up & Payments

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| J1 | Automatic post-round payout calculation (all games combined) | ✅ | `SettleUp/`, `gameLogic.ts` | |
| J2 | Net-out smart settlement (minimum-payment graph) | ✅ | `SettleUp/` | |
| J3 | Treasurer-routed payment model (all payouts flow through treasurer) | ✅ | `SettleUp/` | |
| J4 | Deep-link payment buttons (Venmo / Zelle / Cash App / PayPal, pre-filled) | ✅ | `PaymentButtons.tsx` | |
| J5 | "Mark as Paid" toggle (per counterparty) | ✅ | `SettleUp/`, `Ledger/` | |
| J6 | Nudge button (copies reminder text to clipboard) | ✅ | `SettleUp/` | I — becomes a real push notification once N4 lands |
| J7 | Cross-round ledger (running tally per opponent) | ✅ | `Ledger/Ledger.tsx` | |
| J8 | Cents-precision integer math (no floating-point drift) | ✅ | `money.ts` | |
| J9 | Apple Pay / Google Pay direct payment | ❌ | new — native only | + |

## K. Stats & History

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| K1 | Personal dashboard (rounds played, scoring trends, course performance) | ✅ | `PersonalDashboard/` | |
| K2 | Round history with full scorecards + filters | ✅ | `RoundHistory/` | |
| K3 | Score distribution chart (eagles/birdies/pars/bogeys) | ✅ | `ScoringDistribution.tsx`, `Stats/` | |
| K4 | Most-played courses + per-course stats | ✅ | `Stats/`, `App.tsx` (CourseCard) | |
| K5 | Head-to-head records vs. specific opponents | ✅ | `Stats/` | |
| K6 | Course-level best score + average gross | ✅ | `App.tsx`, course stats map | |

## L. Handicap

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| L1 | Auto handicap index (USGA-style differentials, last 20 rounds) | ✅ | `handicap.ts` | |
| L2 | Handicap detail screen with differential breakdown | ✅ | `HandicapDetail/` | |
| L3 | Handicap-over-time chart | ✅ | `HandicapChart.tsx` | |
| L4 | Manual handicap override | ✅ | `Settings/`, `Onboarding/` | |
| L5 | Gross-or-net toggle per game | ✅ | `gameLogic.ts` | |

## M. Sharing & Invites

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| M1 | 6-char invite codes (round + event) | ✅ | `inviteCode.ts` | |
| M2 | Deep-link URLs (`?join=CODE`, replayed across auth/onboarding) | ✅ | `JoinRound/`, sessionStorage | |
| M3 | QR code generation for invite codes | ✅ | `InviteQR.tsx` | |
| M4 | Native share-sheet integration (Web Share API) | ✅ | `Scorecard/`, `EventSetup/` | |
| M5 | Spectator-only read links | ✅ | `EventLeaderboard/` | |
| M6 | Shareable round-result image card | ✅ | `ShareCard/ShareCard.tsx` (html2canvas) | |
| M7 | Universal Links (iOS) / App Links (Android) — tap invite SMS, land directly in the round | ❌ | new — native only | + |

## N. Notifications

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| N1 | In-app notification badge (round invites, settlement) | ✅ | `NotificationBadge.tsx` | |
| N2 | In-app notification toasts | ✅ | `NotificationToast.tsx` | |
| N3 | Notification preferences (per-channel toggle) | ✅ | `Settings/` | |
| N4 | Push notifications (mobile) | ❌ | Not built — planned for native | + |

## O. Settings & Profile

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| O1 | Light / dark mode toggle (persisted) | ✅ | `useDarkMode.ts` | |
| O2 | Profile editing (name, handicap, payment handles, preferred tee) | ✅ | `Settings/` | |
| O3 | Preferred payment method selection | ✅ | `Onboarding/`, `Settings/` | |
| O4 | Avatar selection (emoji preset or upload) | ✅ | `AvatarPicker.tsx` | |
| O5 | Sign out | ✅ | `Settings/` | |

## P. Admin

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| P1 | Admin dashboard (gated by `isAdmin` flag) | ✅ | `Admin/AdminDashboard.tsx` | |
| P2 | Beta-tester roster view | ✅ | `Admin/` | |
| P3 | Global game-preset management | ✅ | `Admin/` | |

## Q. Platform & Infrastructure

| # | Capability | Status | Touches | Triage |
|---|---|---|---|---|
| Q1 | Progressive Web App (installable, offline shell, service worker) | ✅ | `public/manifest.json`, `public/sw.js` | |
| Q2 | Supabase backend (Postgres, Auth, Realtime, Storage, Edge Functions) | 🧠 | `supabase/` | |
| Q3 | Sentry crash reporting (auto-reports JS errors) | 🧠 | `sentry.ts` | |
| Q4 | Optimistic locking via `updated_at` conflict detection | 🧠 | `safeWrite.ts` | |
| Q5 | RLS-backed permission model | 🧠 | `permissions.ts`, Supabase RLS | |
| Q6 | Hosted on GitHub Pages (free static hosting) | 🧠 | CI / build | |
| Q7 | 200+ automated tests (Vitest unit + component tests) | 🧠 | `__tests__/` | |

---

## What's NOT built today

For the partner to know where the gaps are.

| Gap | Notes |
|---|---|
| Native iOS / Android apps | This list is the scope for that build |
| Apple Watch / Wear OS companion | Earliest "roadmap" item |
| Web Push (browser) | Not wired; native push tracked separately as N4 (planned add) |
| GPS yardage per shot during play | No on-shot yardage UI |
| Course imagery / hole flyovers | No hole maps |
| Social feed / round comments | No commentary or activity stream |
| Subscription / paid tier | Everything free; no billing in app |
| App Store / Play Store presence | Web/PWA only today |
| In-app push to debtors after Settle Up | Nudge is clipboard-copy only |
| Recurring leagues / season standings | Tournaments are one-off, not season-long |

---

## Notes for the mobile-dev partner

- The web app is **React + TypeScript + Vite** with **Tailwind**, served as a PWA from GitHub Pages. Mobile rebuild should expect to either (a) wrap the web app in Capacitor / WebView (fast path), or (b) reimplement in React Native or native (Swift/Kotlin) sharing the Supabase backend and porting the game-logic / settlement modules.
- All payout math lives in **`src/lib/gameLogic.ts`** (~1,800 lines) and **`src/lib/tournamentLogic.ts`**. These are pure functions with unit tests — high reuse value, port verbatim if going React Native, or expose as an API if going native-native.
- All Supabase schema + RLS rules live in **`supabase/`** — backend is shared between web and any future native client.
- Real-time uses Supabase Realtime (WebSockets); same client SDK ships for iOS/Android.
- **Stakes is one concept with two display units (dollars or points)**, not two separate modes. Implementation-wise both flow through the same `cents` integer with a different formatter — the partner should treat unit as a per-round display preference, not a separate game type. The legacy "Points-only mode" toggle has been folded into this.
- The **High Roller** band ($100–$1,000 presets, gold UI) is currently **feature-flagged off** at the UI level only — code and data paths still work. Keep dormant for now; defer to the brand/business call before resurfacing.
- Photo scorecard import (E9) is **in active development**. It calls a Claude (Anthropic) Vision edge function. Marked **v1** in scope above; remaining work is M5 prompt tuning + native camera port.
