# Gimme — Native App Requirements

**For the team building the iOS & Android apps**

_Last updated: 2026-06-10_

> This is the product + engineering brief. Read it alongside the brand-team brief at `docs/brand/Gimme-Native-App-Developer-Brief.md` — that covers brand identity, voice, and store-positioning constraints; this covers concept, audience, tech, scope, and the capability inventory. They don't repeat each other; you need both.

---

## 1. About this document

You're being asked to design and build native iOS and Android applications for **Gimme**, a working web product (PWA) with ~12,000 lines of tested production code, a real user base on beta, and a defined v1 native scope. This document gives you everything you need to scope, propose, and execute — concept, audience, tech stack, architecture, the full capability inventory, what's in v1 vs. roadmap, native-specific requirements, non-negotiable constraints, and the open questions we need you to answer in your proposal.

The web app lives at `gimme.vercel.app` (production). Source is in this repo. You'll want to play with it before reading further — five minutes on the PWA explains more than any spec.

---

## 2. The concept

**Gimme tracks the side games golfers play, keeps every score, and shows the group exactly who owes who at the end of the round.** It replaces the paper card *and* the half-hour of post-round math at the 19th hole.

It is a **settlement tracker, not a money-mover.** The app calculates the result — it does not process, hold, escrow, or transfer money. This is both a product principle and a compliance decision (see §11). Treat "no money movement" as a hard boundary for v1.

### The problem we're solving

Every golf group has the same five frictions:
1. Tracking 1–4 side games at once on a paper card.
2. Calculating skins carryovers, Nassau presses, and Wolf points without a calculator.
3. Reconciling "who owes who" across 4–8 players with mixed bets.
4. Remembering to settle up — half the time, somebody walks off without paying.
5. Coordinating the math when multiple foursomes are playing the same outing.

### The solution

Phone-first, offline-tolerant scorecard with **eleven side games**, live multi-device sync, automatic net-out settlement, and one-tap deep links to Venmo / Zelle / Cash App / PayPal — and a premium, shareable post-round result card that doubles as the brand's growth engine.

### The "Gimme" thesis (positioning)

The category leader currently ships as an 18+ "Contains Gambling" app, which caps mainstream distribution. Gimme deliberately positions as a **premium social-club scorekeeping utility** — same use case, different category, mainstream-rated, designed-not-coded feel. This positioning is enforced in copy, store listing, and (critically) by keeping money movement out of the product entirely. See §11.

---

## 3. Target audience

Three archetypes, validated through beta personas (full persona walkthroughs in `src/FLOW-TESTING-PLAN.md`).

### Archetypes

| # | Archetype | Behavior | Why they install first |
|---|---|---|---|
| 1 | **The Group Treasurer** | Always ends up keeping score on paper or a Notes app. | They're the bottleneck; they install Gimme first and pull the rest of the group in. **Primary acquisition persona.** |
| 2 | **The Casual Foursome** | 3–8 friends playing weekly or monthly for $5–$50 stakes. | Currently use paper, spreadsheets, or arguing. Friction-tolerant if the win is obvious. |
| 3 | **The Outing Organizer** | Runs corporate or charity events with 16–32 players across multiple groups. | Needs scoring + settlement + a live leaderboard the whole field can follow. |

### Persona summary (eight real personas; full detail in flow-testing plan)

| Persona | Role in the round | What they stress about the product |
|---|---|---|
| **Dave** | Organizer (creates a 16-player event) | Event-creation friction at scale |
| **Jess** | Brand new, tech-savvy, impatient | Cold-start UX — no contextual help, "gross vs. net" ambiguity |
| **Rick** | Group scorekeeper | Score-entry confidence (no undo, approval-panel discoverability) |
| **Maya** | Self-entry player | "PENDING" approval status confusion |
| **Connor** | Stats-focused player; runs side bets | Side-bet flexibility + settlement detail visibility |
| **Tomoko** | UX designer, golf newbie | Terminology + spectator-mode gaps |
| **Pat** | Treasurer of a 20-player event | Scale problems in settlement, no bulk actions |
| **Stan** | Occasional / returning after months away | Identity continuity (guest ↔ account) |

The native build needs to serve **all three archetypes**, but Dave and Pat are the most demanding — they stress event-mode + scale. Connor and Rick are the most habit-forming — they generate the recurring use. Jess and Tomoko are the acquisition risk — they bounce if onboarding is unclear.

---

## 4. Brand identity (summary)

**For the full brand system, read `docs/brand/Gimme-ClaudeCode-Brand-Update.md` (v1.0 brand brief) and `docs/brand/Gimme-Native-App-Developer-Brief.md` (brand-team handoff).** Hard-coded summary:

- **Wordmark:** "GIMME" (and "GIMME GOLF" when paired with category) in **Playfair Display** (interim — final display serif TBD), tracked wide.
- **Mark:** Oval signet "G" seal — navy tile, cream outer ring, brass inner ring, serif G. Seal SVG is being produced; spec in `docs/ICON-ASSETS-V1.md`.
- **Tagline:** `SIDE GAMES · SCORES · SETTLED` (uppercase, tracked, brass).
- **Voice slogan:** `THAT'S GOOD.` (sign-off, used in the result card footer and brand moments).
- **Palette:**

  | Token | Hex | Use |
  |---|---|---|
  | `--navy` | `#16263B` | Primary base, app background, theme-color |
  | `--cream` | `#F2ECDD` | Text on navy, wordmark |
  | `--brass` | `#C2A24C` | Metallic accent — taglines, winners, rules |
  | `--slate` | `#2E4257` | Secondary support, hairlines |
  | `--volt` | `#C6F24E` | **APPAREL-DROP ONLY** — never in app/icon |

- **Type system:** Playfair Display (serif, brand voice + headlines), Inter (UI + body).
- **Voice registers (three):**
  - **Warmth + clarity** for functional, newcomer, and money moments. Default register.
  - **Confident wit** *only* at the win/result/share moments.
  - **Premium reassurance** for returning users, errors, and edge cases.
  - **Never** jokey at confusing or money moments. **Never** "guys / buddies / boys." Inclusive, cross-gender — explicit brand requirement.

- **Tone examples (live in the web app today):**
  - Score saved: "Saved. You're good."
  - Awaiting approval: "Hang tight — the scorekeeper's confirming. You're in."
  - Settlement reveal: "That's good. Here's where everyone landed."
  - Session-expired: "Welcome back. Everything's right where you left it."

The brand is treated as a **premium social-club lifestyle brand that happens to launch as an app**. Pixel quality and polish matter more than feature density. Read this twice.

---

## 5. Tech stack — current web product

You'll be replacing the front-end. The backend stays.

### Front-end (web — for reference)

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Strict mode; ~12K LOC across `src/` |
| Build | Vite + Tailwind 3 | Static output deployed to GitHub Pages |
| State | React hooks + local component state | No Redux/Zustand; reducers in `src/lib/realtimeReducers.ts` |
| Routing | Screen-state via `App.tsx` (not React Router) | Simple state machine — port concept, not code |
| PWA | Service worker (`public/sw.js`), manifest, offline shell | Replaced by native shell |
| Camera | `<input type="file" capture>` | Replaced by native camera picker |
| Share | Web Share API + html2canvas | Replaced by native share sheet |
| Image rendering (result card) | html2canvas → PNG → share | Replaced by `UIGraphicsImageRenderer` / Android `Canvas` or RN equivalent |

### Backend (shared between web and native — keep using it)

| Layer | Choice | Why it matters to you |
|---|---|---|
| Database | Supabase Postgres | Schema lives in `supabase/*.sql`; RLS enforces multi-tenant access |
| Auth | Supabase Auth (email/password + anonymous) | Anonymous = "guest mode" |
| Realtime | Supabase Realtime (Postgres CDC over WebSockets) | <500ms score sync across devices in a round |
| Storage | Supabase Storage (avatar uploads) | |
| Edge Functions | Deno-based, serverless | `import-scorecard-photo` calls Claude Vision |
| Crash reporting | Sentry | DSN in env; same DSN usable from native |
| AI Vision (photo import) | Anthropic Claude (Vision) | Single edge-function call; budget ~$0.01–0.02 / photo |

**Supabase has official SDKs for Swift and Kotlin.** Use them. The schema, RLS rules, and Edge Functions are designed to be client-agnostic — every consumer hits the same Postgres, sees the same realtime channel, and obeys the same RLS.

### Game logic — sacred and pure

**`src/lib/gameLogic.ts` (~1,800 lines) and `src/lib/tournamentLogic.ts` are pure functions with 201 passing unit tests.** They contain every payout calculation for every game, the handicap math, and the net-out settlement algorithm. **Do not reimplement them.** Two acceptable paths:

1. **React Native:** import these modules as-is. They're TypeScript, no DOM dependencies. The test suite ports over too.
2. **Native (Swift/Kotlin):** wrap them as a Supabase Edge Function and call from the client, or port verbatim and re-run the test suite against your port for parity validation. Don't translate by hand and skip the tests — the games are subtle (Wolf solo, Nassau presses, Skins carryovers, BBB ties) and the test suite catches edge cases you won't see in spec.

---

## 6. Tech stack — recommendations for native

Three credible paths. Pick one in your proposal and justify.

| Path | Speed to ship | Cost | Native feel | App-store risk | Code reuse |
|---|---|---|---|---|---|
| **Capacitor / WebView wrap** | Fastest (~weeks) | Lowest | Poor — feels like a webview | High — Apple's "Minimum Functionality" guideline can reject thin wrappers; brand brief explicitly calls "native-feeling" a requirement | Maximum (current PWA + thin shell) |
| **React Native + shared logic** | Medium (~2–3 months) | Medium | Good if done well | Low | High — game logic, lib/, types/ ports verbatim |
| **Native (SwiftUI + Kotlin)** | Slowest (~3–4+ months) | Highest | Best | Lowest | Backend + game logic via API; UI from scratch |

The brand brief (§4) says: _"native-quality. Cross-platform (React Native / Flutter) is acceptable... native (SwiftUI / Kotlin) is fine if the team prefers. Team's call — optimize for a fast, native-feeling, effortless experience."_

We have no preference among the three — pick the path that best meets the brand-quality bar (premium, native-feeling) and protects the game-logic investment (the ~1,800 lines of tested settlement code in `src/lib/`). Justify your choice in the proposal so we understand the trade-offs you're making for us.

---

## 7. Core user flows

The four flows that need to feel effortless on native. Each one is a happy-path summary — see the personas in `src/FLOW-TESTING-PLAN.md` for the friction points.

### Flow 1 — Start a Round (Casual Foursome)

1. Open app → home screen, "Start New Round" hero button.
2. Pick course (recent / GPS-nearby / search).
3. Pick players (recent friends → personal roster → guest add).
4. Pick game (Skins / Best Ball / Nassau / Wolf / BBB are the top row; Hammer / Vegas / Banker / Quota are under "More games").
5. Set stakes — dollars or points (unit toggle, same bands either way). Pick a treasurer.
6. Tap "Start." Land on the scorecard at hole 1.

**Target time:** under 60 seconds from app open to hole 1.

### Flow 2 — Score the Round

1. Hole-by-hole scoring with a large number pad.
2. Real-time leaderboard tab.
3. Optional: mid-round prop bets ("birdie on 7?", "longest drive on 12").
4. Optional: photo scorecard import (snap a card → AI reads it → confirm grid → save).
5. End round → tap "Settle Up."

**Target:** never more than 2 taps to enter a hole score.

### Flow 3 — Settle Up

1. Land on the SettleUp screen — animated reveal: "That's good. Here's where everyone landed."
2. Read standings: winner in brass, others muted cream.
3. Settlement graph (net-out): "Maya → Connor: $12", "Tom → Connor: $12", "Tom → Dave: $10."
4. Tap a payment link for each settlement (Venmo / Zelle / Cash App / PayPal opens pre-filled).
5. Mark settlements paid as confirmation comes in.
6. Tap "Share Results" → result card → native share sheet → IG story / group chat.

**Target:** every player in the round knows what they owe within 30 seconds of round end.

### Flow 4 — Join a Round (Event Mode)

1. Receive invite SMS with a code or a link.
2. Tap link → Universal Link / App Link opens the native app directly (this is a v1 add — see §10).
3. App resumes auth, drops user at "Pick your name from the player list."
4. Tap own name → "You're in! Group 2, scorekeeper is Rick."
5. Land on the scorecard.

**Target:** invite tap to scorecard in under 10 seconds (current web friction here is the personas' top complaint).

---

## 8. Capabilities — v1 scope

Full inventory in `docs/CAPABILITIES.md` (90+ rows with status, code references, and triage markings). The summary below is the v1 cut decided in product triage on 2026-06-10.

### In v1 (must ship to release)

**Identity & Onboarding**
- Email + password sign-up / sign-in, forgot-password reset, guest mode (anonymous), guest → real account upgrade, session-expired recovery, first-run onboarding (name, handicap, payment handles), avatar picker.

**Course & Player Setup**
- Pre-loaded curated course library, GPS "near me" search, custom course builder (holes, pars, stroke index, tees, slope, rating), 9 / 18 / front-9 / back-9 / shotgun starts, personal player roster, guest player quick-add, payment handles per player (Venmo / Zelle / Cash App / PayPal), handicap index per player, up to 8 players per round.

**Round Creation**
- Step wizard (course → players → groups → game → stakes), game picker with rules modals, saved game presets, "Play Again" one-tap clone of last round, unit-agnostic stakes (dollars OR points as a display toggle, not two separate modes), per-player buy-in overrides, treasurer designation, auto-grouping for events.

**The 11 Side Games**
- **Top row (prominent in picker):** Skins, Best Ball, Nassau, Wolf, Bingo Bango Bongo, Stableford, Dots/Junk, Prop bets.
- **Under "More games" (less prominent):** Hammer, Vegas, Banker, Quota.
- All games support gross or net scoring. Skins has a carryover toggle. Nassau has presses. Wolf has solo plays. BBB scores 3 categories. Stableford uses points. Dots are layered side bets.

**In-Round Scoring**
- Tap-and-go number pad, hole navigation with par/SI/yardage, auto-save with rapid-tap debounce, score celebrations (eagle / birdie / hole-in-one), live game-status panel, hole-level betting panel, mid-round prop bets, buy-in confirmation banner, **scorecard photo import** (Claude Vision via Edge Function → confirm grid → bulk save), unsaved-changes warning.

**Live Sync & Multi-Device**
- Real-time score sync across all devices in a round (<500ms via Supabase Realtime), score approval workflow, optimistic locking on hole edits, background-tab subscription pausing, presence indicators in the event leaderboard, **NEW: live presence on the in-round scorecard** ("Rick is entering scores now") — needed for native v1.

**Reliability**
- Offline score entry + auto-replay queue, error boundaries with "back to home" fallback, validation guards, invite-code rate limiting.

**Events / Outings (multi-group)**
- Event creation, auto-assign players to groups, per-group scorekeeper, event-wide "Score Master" override, per-group score isolation, live event leaderboard (overall + per-group), spectator mode (read-only link), QR code invites, 6-char invite codes, **Universal Links (iOS) / App Links (Android)** — open the invite link from SMS, land directly in the round (new for native v1).

**Settle Up & Payments**
- Automatic post-round payout, net-out smart settlement (minimum-payment graph), treasurer-routed payment model, deep-link payment buttons (Venmo / Zelle / Cash App / PayPal), Mark as Paid toggle, Nudge button (becomes a real push notification with N4), cross-round ledger, cents-precision integer math, **NEW: Apple Pay / Google Pay direct payment** (native-only add per product triage).

**Stats & History**
- Personal dashboard (rounds played, scoring trends), round history with full scorecards, per-course best and average. *Deeper stats — distribution charts, head-to-head, most-played — are roadmap.*

**Handicap**
- Auto-tracking (USGA-style differentials, last 20 rounds), handicap detail breakdown, manual override, gross-or-net toggle per game. *Handicap-over-time chart is roadmap.*

**Sharing**
- Invite codes + deep-link URLs, QR generation, native share sheet, spectator read links, **the result card** (already rebuilt in the web per brand brief §6; portrait 540×960, navy/cream/brass, seal placeholder, winner headline + amount, rotating witty sub-line library, standings, settlement pairs, "THAT'S GOOD." footer). On native, render to a `UIImage` (iOS) or Bitmap (Android) and pass directly to the share sheet — drop html2canvas.

**Notifications**
- In-app badges, in-app toasts, notification preferences, **NEW: push notifications** (native-only; replaces the in-app-only model on web). Use for round invites, settlement reminders, and scorekeeper approvals.

**Settings & Profile**
- Light / dark mode, profile editing, preferred payment method, avatar, sign out.

**Platform & Infrastructure**
- Supabase backend reuse, Sentry crash reporting (use the existing DSN), RLS-backed permission model.

### Roadmap (not in native v1 — fast-follow or later)

- **Tournaments** — entire feature (stroke play + bracket + list + detail). Heavy surface area, thin user slice. Events (multi-group) cover most of the "multi-group" need.
- **Public player directory** — privacy review pending.
- **Crowdsourced shared course catalog** — curated + custom cover v1.
- **Admin dashboard** — stays on web for the admin users.
- **Score distribution chart, head-to-head, most-played courses (stats depth)** — basic dashboard ships in v1, depth comes later.
- **Handicap-over-time chart** — index ships, chart later.
- **High Roller stakes band ($100–$1,000)** — code exists, currently feature-flagged off as a brand/compliance posture. Keep dormant.
- **Web Push notifications** — not built for web; native push covers the v1 case.
- **Apple Watch / Wear OS companion** — flagged but not specced.
- **Subscription / paid tier** — everything free today; pricing pass is a separate workstream.
- **GPS yardage per shot / hole flyovers / course imagery** — out of scope for the scorekeeping product.
- **Social feed / round comments** — not the product's direction.

---

## 9. Native-specific requirements

Things that exist only because we're going native — not present in the web. Build these.

| # | Capability | Why native-only | Notes |
|---|---|---|---|
| 1 | **Push notifications** (APNs + FCM) | Web push isn't built; native is the gateway | Used for round invites, settlement nudges, scorekeeper approval signals. Provider choice yours; recommend OneSignal or Supabase's built-in if it's ready. |
| 2 | **Universal Links (iOS) / App Links (Android)** | Web has URL deep-linking but it bounces through Safari/Chrome | Persona research flagged this as the top friction in the join flow. Required for invite SMS to land directly in the app. |
| 3 | **Native camera capture for photo import** | Web uses `<input type="file" capture>`, which is mediocre | Replace with `UIImagePickerController` / `CameraX`. Same Edge Function backend (`import-scorecard-photo`) — just feed it a higher-quality image. |
| 4 | **Native share sheet for the result card** | Web uses Web Share API + html2canvas | Render the card to a UIImage / Bitmap, pass to `UIActivityViewController` / `Intent.ACTION_SEND`. Drop html2canvas. |
| 5 | **Apple Pay / Google Pay direct payment** | Today the app only does deep links to Venmo / Zelle / Cash App / PayPal | Desired addition for native: settle a debt in-app with one tap instead of bouncing to a third-party app. Same payment-method handles, better UX. |
| 6 | **Live presence on the in-round scorecard** | Web has presence on the event leaderboard but not the per-group scorecard | Surface "Rick is entering scores now" on each player row. Uses existing Supabase Realtime presence channels. |
| 7 | **App Store / Play Store presence** | Web is install-from-browser | Submission packaging (icons, screenshots, marketing copy) is part of the deliverable. Pre-launch checklist in `docs/APP-STORE-PLAN.md`. |
| 8 | **Native dark mode following system preference** | Web has a manual toggle | Honor `UITraitCollection` / `Configuration.uiMode`. Manual override stays available. |

---

## 10. Non-negotiable constraints

These are hard rules. Violating any is grounds for a code review block.

### 10a. Settlement accuracy

- All money math uses **integer cents** (no floats). The `money.ts` module enforces this on web; carry that discipline forward.
- Net-out settlement is **zero-sum** — every penny owed equals every penny owed back. Settlements that don't balance are a bug.
- The settlement-graph algorithm minimizes the count of payments. Don't replace with a naive "everyone pays the treasurer" graph — it's worse UX.
- The game-logic test suite must pass on whatever language the games are ported into.

### 10b. Store positioning

- **Mainstream age rating.** Don't trigger the 18+ "Contains Gambling" category. The category leader is parked there; this app's positioning is the opposite. Copy in marketing, store listing, and the app itself minimizes "bet / wager / gamble / winnings / money" and leads with "side games / scores / settle up / the result."
- Real-money-gaming policies on both stores — confirm the app is outside their scope during review prep.

### 10c. Brand consistency

- Navy / cream / brass everywhere. **No exceptions** — no slate-gray dropdowns from a UI kit, no amber buttons left over from the prior palette, no system-default form styling. Volt is apparel-only and **must not appear in the app or icons**.
- Playfair Display for headlines / wordmark / brand-voice moments. Inter for everything else. No third font.
- Type, color, and voice are auditable — the brand team will review.

### 10d. Voice consistency

- Three registers from §4 above. Use them.
- Functional and money-adjacent strings get warmth + clarity. Wit lives at the win/result/share moments only.
- **Never** "guys," "buddies," "boys." Inclusive, cross-gender — a brand requirement, not a preference.
- Strings worth memorizing: "Saved. You're good." / "Hang tight — the scorekeeper's confirming. You're in." / "That's good. Here's where everyone landed." / "Welcome back. Everything's right where you left it." / "THAT'S GOOD." (sign-off).

### 10e. Backend reuse

- **Use the existing Supabase backend.** Don't fork the schema. Don't reimplement auth. Don't write a parallel REST API.
- RLS is the source of truth for who-can-see-what. Trust it. Don't bypass with a service key from the client.

### 10f. Offline tolerance

- Score entry must work offline. The web queues hole-score writes locally and replays on reconnect (`src/lib/offlineQueue.ts`). Port the pattern.
- Cellular dead zones on the back nine are normal — the app should never appear broken because of bad signal.

---

## 11. References

| Document | What's in it |
|---|---|
| `docs/CAPABILITIES.md` | One-line-per-capability inventory (~90 rows). The triage column shows K/C/I/+; the "Native v1 scope" section at the top gives v1 vs. roadmap explicitly. **Read this for the full feature surface.** |
| `docs/brand/Gimme-ClaudeCode-Brand-Update.md` | The brand v1.0 brief — design tokens, typography, voice, copy changes, the result-card spec. **Source of truth for brand.** |
| `docs/brand/Gimme-Native-App-Developer-Brief.md` | The brand team's handoff to you. Covers concept, MVP scope, compliance, brand summary, success criteria, and open items. **Read alongside this doc.** |
| `docs/ICON-ASSETS-V1.md` | Production spec for the seal SVG, icon-192 / icon-512 / maskable / apple-touch PNGs, splash screens. Delivery checklist included. **The seal SVG doesn't exist yet** — coming from the brand team. |
| `docs/PHOTO-IMPORT-PLAN.md` | Full build plan for the photo-scorecard import feature (web M1–M5). Native port = M5 prompt-tuning completion + native camera picker. |
| `docs/PRODUCT-OVERVIEW.md` | A slide-deck-style product overview. Useful for understanding the marketing pitch and the founder's framing. |
| `docs/FEATURES.md` | The prior plain-language feature tour (slightly stale post-brand-pivot; CAPABILITIES.md is the current source of truth). |
| `docs/APP-STORE-PLAN.md` | App Store / Play Store submission checklist — support email, screenshots, copy requirements. |
| `docs/marketing-plan.md` | Pre-launch + post-launch marketing plan. Persona sweet spot called out. |
| `src/FLOW-TESTING-PLAN.md` | Persona walkthroughs (Dave, Maya, Stan, Connor, Rick, Pat, Jess, Tomoko). Friction points and verdicts. Excellent context for UX decisions. |
| `REQUIREMENTS.md` (root) | The original (pre-brand-pivot) requirements document. Historical context. |
| `SCOPE.md` (root) | The historical scope ladder. |

---

## 12. Open questions — please answer in your proposal

1. **Technology recommendation.** Capacitor / React Native / Native (Swift + Kotlin)? Justify the trade-off given the brand-quality bar (premium, native-feeling) and the game-logic reuse opportunity (~1,800 lines of tested TS).
2. **Backend reuse.** Confirm: Supabase Swift + Kotlin SDKs, shared Postgres + RLS, no parallel API layer. Any concerns?
3. **Game-logic port strategy.** Verbatim import (React Native) or wrap-as-API (native)? If wrapping, where does the wrapper live — a new Supabase Edge Function?
4. **Timeline & milestones.** Best-case ship to TestFlight + Play Console internal? Public release? Show your phasing.
5. **Photo scorecard import (E9 in capabilities).** In v1 or fast-follow? Web M5 prompt tuning is ~70% done; native adds camera picker + share-flow. Roughly a 1-week add on top of v1 baseline.
6. **Apple Pay / Google Pay direct payment.** In-scope for v1 or fast-follow? Tell us your plan and what each option does to the timeline.
7. **Push notifications stack.** Provider choice (OneSignal, Firebase Cloud Messaging direct, Supabase's push, other)?
8. **Result-card rendering.** Native canvas (recommended) or hybrid (offscreen WebView rendering the existing React component)? Pros/cons.
9. **Universal Links / App Links setup.** Domain configuration plan (`apple-app-site-association`, `assetlinks.json`) and the deep-link routing layer.
10. **App Store / Play Store submission ownership.** Are you producing the screenshots, marketing copy, and descriptions, or is that on us?
11. **Pricing.** Per-platform fixed bid, T&M, milestone-based? Show the pricing model.
12. **Team composition.** Who's working on this? Designer involved? QA?

We expect a proposal that addresses all twelve. Anything vague will get followed up.

---

## 13. How we'll evaluate proposals

In rough priority:

1. **Demonstrated understanding of the brand-quality bar.** "Premium, designed-not-coded" is the differentiator. If your proposal reads like a generic native-rebuild scope, we're not aligned.
2. **Plan for game-logic reuse.** This is the highest-stakes part of the product. A proposal that says "we'll reimplement it" without a parity validation plan is a red flag.
3. **Compliance literacy.** Acknowledgement of the 18+ gambling category as the failure mode, and how the proposed build avoids it.
4. **Realistic timeline + phasing.** Proposals that claim 6 weeks to ship will be skeptically reviewed. Proposals that show milestones and demo-able states inside that timeline will be taken more seriously than ones promising a single big-bang ship.
5. **Communication and follow-up cadence.** Weekly demos, async updates, a Slack/Discord channel? Tell us.

---

## 14. Contact

Founder: usclogan@gmail.com.

Send proposals as PDF or a shared doc link. Reference this document by name. Ask questions early — the founder reads everything.

_Built by golfers, for golfers. We're looking for partners who'll treat it that way._
