# Gimme Golf Tracker — Functional Requirements

**Last Updated:** March 22, 2026
**Version:** 2.0

---

## 1. App Purpose

A mobile-first web app for groups of friends who play golf together to track side games, scores, handicaps, and settle money — all from the course in real time.

**Live Site:** https://usclogan-sudo.github.io/golf-tracker/
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS v3 + Supabase

---

## 2. User Accounts & Access

### 2.1 Authentication
- [x] Password-based sign-in (primary, inline on splash page)
- [x] Anonymous guest sign-in (Supabase anonymous auth, no account required)
- [x] Guest upgrade flow — convert anonymous account to full account, preserving all data
- [x] Guest nudge banner on Home screen (loss-aversion messaging, per-session dismissible)
- [x] Password reset flow
- [ ] "Remember me" / stay signed in across sessions
- [ ] Social login (Google, Apple)

### 2.2 User Profile & Onboarding
- [x] 2-step onboarding wizard (profile setup + payment methods)
- [x] Display name
- [x] Avatar picker (presets + custom URL)
- [x] Handicap index
- [x] Default tee preference
- [x] Payment methods: Venmo, Zelle, Cash App, PayPal (with preferred method)
- [x] Password change
- [x] Delete account (removes all user data from all tables)
- [x] Dark mode toggle (persisted to localStorage)
- [x] Settings screen with account info, payment methods, danger zone

### 2.3 Privacy & Security
- [x] Row-level security on all database tables
- [x] Each user can only see their own data
- [x] Conditional UI: anonymous users see "Create Account" instead of "Change Password"

---

## 3. Player Management

### 3.1 Add / Edit / Delete Players
- [x] Name, handicap index (-10 to 54), default tee
- [x] GHIN number (optional)
- [x] Payment info: Venmo, Zelle, Cash App, PayPal
- [x] Quick-add player inline during round setup
- [x] Edit existing player details
- [x] Delete player with confirmation dialog

### 3.2 Player Directory
- [x] Browse all players (own guests + all registered users)
- [x] View player stats and registration status
- [x] Pin favorite friends for quick access
- [x] Public player profiles (registered users visible to all)
- [ ] Send connection request to another player
- [ ] "Find Players Near Me" — GPS-based discovery

### 3.3 Handicap
- [x] Manual handicap index entry
- [x] USGA course handicap calculation (index x slope/113 + rating - par)
- [x] Stroke allocation per hole based on stroke index
- [x] WHS handicap calculation from round history (20 most recent differentials)
- [x] Handicap differential history with visual chart
- [ ] Auto-sync handicap from GHIN API

---

## 4. Course Management

### 4.1 Course Sources
- [x] Pre-loaded Ventura County catalog (~15+ courses)
- [x] Course search API integration (nationwide, search by name/city/state/zip)
- [x] One-tap import from API with full data (tees, ratings, slopes, pars, yardages)
- [x] GPS-based nearby courses (OpenStreetMap, up to 8 within 25 miles)
- [x] One-tap add from nearby list (pre-fills course name)
- [x] Shared admin course templates

### 4.2 Custom Courses
- [x] Course name
- [x] Multiple tee sets (name, USGA rating, slope)
- [x] 18 holes with par, stroke index, yardages per tee
- [x] Stroke index validation (1-18 used exactly once)
- [x] Par templates (72/71/70) for one-tap configuration
- [x] Standard stroke index auto-allocation

### 4.3 Course Operations
- [x] Edit saved course details (tees, holes, ratings)
- [x] Delete a saved course with confirmation
- [x] Course statistics (times played, best scores, averages)
- [ ] Show course details (rating, slope, par) in nearby search results

### 4.4 Handicap API Integration
- [ ] Integrate with USGA GHIN API to auto-pull player handicap index
- [ ] Auto-update handicap before each round
- [ ] Show handicap revision history from GHIN

---

## 5. Round Setup (5-Step Wizard)

### Step 1 — Pick a Course
- [x] Select from any available course (catalog + API + custom + shared)
- [x] Browse catalog to add a new course
- [x] Course details shown (par, tees, holes)

### Step 2 — Pick Players
- [x] Select from registered users and guest players
- [x] Assign tee per player (override default)
- [x] Quick-add a new player inline
- [x] Auto-calculate course handicap per player/tee
- [x] Up to 20 players per round

### Step 3 — Groups
- [x] Assign players to groups (for multi-group play)

### Step 4 — Configure Game
- [x] Choose game type (11 types — see Section 7)
- [x] Configure game-specific options
- [x] Optional junk/side bets alongside any game
- [x] Game presets — save and reuse favorite configurations
- [x] Game rules modal with how-to-play for each type

### Step 5 — Stakes & Start
- [x] Choose stakes mode (Standard $5-$50 or High Roller $100-$1000)
- [x] Set buy-in amount (presets or custom)
- [x] Designate treasurer (collects buy-ins)
- [x] Designate game master/scorekeeper
- [x] Mark buy-ins as paid/unpaid before starting
- [x] Generate invite code for shared scoring
- [x] Send real-time invite notifications to registered players

### Resume Round
- [x] Active rounds shown on home screen
- [x] Tap to resume where you left off
- [x] End round from Home screen (marks complete, goes to Settle Up)
- [x] Play again from round history (reuses template)

---

## 6. Live Scorecard

### 6.1 Score Entry
- [x] Hole-by-hole scoring for each player
- [x] Touch-optimized number pad input
- [x] Hole navigator (1-18) with visual distinction between scored and unscored holes
- [x] Current hole info (par, stroke index, course name)
- [x] Navigate forward/back between holes

### 6.2 Score Display
- [x] Score badges per player (Eagle, Birdie, Par, Bogey, Double+)
- [x] Handicap strokes received shown per player per hole
- [x] Net score calculation
- [x] Running total per player (gross + vs-par through N holes played)
- [x] Celebrations: hole-in-one, eagle, birdie (toast + fullscreen animation)

### 6.3 Game Panels (shown during play)
- [x] Skins: carryover count, pot value
- [x] Best Ball: team scores, holes won
- [x] Nassau: front/back/18 leaders
- [x] Wolf: current wolf, partner selection
- [x] BBB: bingo/bango/bongo assignment
- [x] Hammer: hammer state, value, decline tracking
- [x] All other game types: appropriate live tracking panels

### 6.4 Junk & Side Bet Tracking
- [x] Junk tracking during play (sandy, greenie, snake, barkie, CTP)
- [x] Custom side bets per hole (description, amount, participants)
- [x] Side bet resolution (pick winner, cancel)

### 6.5 Score Validation & Error Handling
- [x] Flag unlikely scores (hole-in-one on par 4+, +5 over par) with warning
- [x] Undo button for last score change
- [x] Confirmation dialog before navigating away from active scoring
- [x] Network error banner when score save fails
- [x] Offline queue — scores saved locally, synced when connection restores

### 6.6 Shared Scoring
- [x] Invite code for collaborative scoring (share with other players)
- [x] Join active round via invite code
- [x] Real-time score sync via Supabase Realtime
- [x] Round creator and game master can both edit scores
- [x] In-app notification with Join button when invited to a round

---

## 7. Game Types (11 Fully Implemented)

### 7.1 Skins
- [x] Lowest score on a hole wins the skin
- [x] Gross or Net scoring mode
- [x] Carryovers ON/OFF (tied holes carry pot to next)
- [x] Display carryover count and accumulated pot value
- [ ] Press option (double-or-nothing on a hole)

### 7.2 Best Ball
- [x] 2v2 team format (best score per team counts)
- [x] Team assignment during setup (Team A vs Team B)
- [x] Match Play mode (count holes won)
- [x] Stroke Play mode (lowest total team strokes)
- [x] Gross or Net scoring mode

### 7.3 Nassau
- [x] Three simultaneous bets: Front 9, Back 9, Total 18
- [x] Lowest total strokes per segment wins that bet
- [x] Gross or Net scoring mode
- [x] Display segment leaders during play
- [ ] Auto-press option (when down by 2)
- [ ] Manual press mid-round

### 7.4 Wolf
- [x] 4-player rotation — each player takes turn as Wolf
- [x] Wolf picks a partner or goes Lone Wolf (2x multiplier)
- [x] Customizable wolf order (drag to reorder)
- [x] Gross or Net scoring mode
- [ ] "Pig" variant (wolf picks before tee shots)

### 7.5 Bingo Bango Bongo (BBB)
- [x] Three points per hole: Bingo (first on green), Bango (closest to pin), Bongo (first to hole out)
- [x] Manual point assignment via buttons per hole
- [x] Gross or Net scoring mode

### 7.6 Hammer
- [x] Escalating bet that can be "hammered" back
- [x] Base value configuration
- [x] Max presses option
- [x] Auto-hammer option
- [x] Hole-by-hole hammer state tracking (holder, value, presses, declined)

### 7.7 Vegas
- [x] Team scoring (2-digit combined numbers)
- [x] Team assignment (A vs B)
- [x] Gross or Net scoring mode

### 7.8 Stableford
- [x] Points-based scoring (0 for double+, 1 bogey, 2 par, 3 birdie, 4 eagle)
- [x] Gross or Net scoring mode

### 7.9 Dots
- [x] Configurable junk bets: sandy, greenie, snake, barkie, CTP, fairway hit, up & down, one putt, longest drive, par save
- [x] Configurable value per dot

### 7.10 Banker
- [x] Rotating banker per hole
- [x] Customizable banker order
- [x] Gross or Net scoring mode

### 7.11 Quota
- [x] Target based on handicap, earn points for under-par holes
- [x] Per-player quota configuration
- [x] Gross or Net scoring mode

---

## 8. Settle Up & Payouts

### 8.1 Results Display
- [x] Game-specific results (skins won, team winners, units, points)
- [x] Round summary (player count, buy-in, total pot)
- [x] Junk/side bet totals included in results
- [x] Unified settlements combining game + junk + side bet payouts

### 8.2 Payout Calculation
- [x] Treasurer-based model (treasurer collects, then distributes)
- [x] Automatic payout amounts per player based on game results
- [x] High Roller premium styling

### 8.3 Payment Integration
- [x] Venmo deep-link button (opens Venmo with pre-filled amount)
- [x] Zelle integration (mailto with payment details)
- [x] Cash App deep-link button
- [x] PayPal deep-link button
- [x] Mobile detection for native app deep links
- [x] Copy payment text fallback

### 8.4 Settlement Tracking
- [x] Settlement records per round (from/to player, amount, reason, status)
- [x] Mark settlements as paid
- [x] Payment status tracking (owed vs paid)

### 8.5 Ledger
- [x] Historical payment ledger by opponent
- [x] Date range filtering
- [x] Net balance per opponent
- [x] Mark individual payments as settled

### 8.6 Future
- [ ] Treasurer audit dashboard (review all scores, payouts, payment statuses)
- [ ] In-app payment processing (Stripe/Venmo API)
- [ ] Platform fees (configurable per round or per player)

---

## 9. Events (Multi-Group Play)

### 9.1 Event Setup
- [x] 6-step event creation wizard
- [x] Multi-group events (up to 5 players per group)
- [x] Group-specific scorekeepers
- [x] Event invite codes for additional groups to join
- [x] Event creator sets game type, stakes, and course

### 9.2 Score Approval Workflow
- [x] Non-scorekeepers submit scores as **pending**
- [x] Scorekeepers see pending scores with approve/reject buttons
- [x] Scorekeeper-entered scores are automatically approved
- [x] Visual indicator: approved (checkmark) vs pending (clock/dot)

### 9.3 Event Leaderboard
- [x] Live event leaderboard with real-time updates
- [x] Group tabs for filtering by group
- [x] Online presence indicators (who's currently in the app)
- [x] All groups feed into the same leaderboard

---

## 10. Tournaments

### 10.1 Tournament Formats
- [x] Single elimination bracket
- [x] Double elimination bracket (winners + losers brackets)
- [x] Stroke play format

### 10.2 Tournament Features
- [x] Tournament creation and player selection
- [x] Bye handling for non-power-of-2 player counts
- [x] Visual bracket display
- [x] Match play head-to-head scoring
- [x] Tournament list (active/completed)

---

## 11. Notifications

### 11.1 In-App Notifications (Implemented)
- [x] Real-time notifications via Supabase Realtime
- [x] Notification types: round_invite, score_update, unsettled_round, round_complete
- [x] Toast popup with auto-dismiss
- [x] Round invite toast with "Join" action button (navigates to JoinRound)
- [x] Unread badge count on home screen
- [x] Mark read / mark all read

### 11.2 Future Notifications
- [ ] Email notifications (round invites, settlement reminders)
- [ ] Push notifications (via service worker)
- [ ] Reminder if buy-in is unpaid
- [ ] Weekly stats summary email

---

## 12. Sharing & Social

### 12.1 Implemented
- [x] Join round via invite code (URL param or manual entry)
- [x] Spectate mode — live leaderboard via spectator code (no account required)
- [x] In-app round invite notifications with Join button
- [x] Player directory with shared round history
- [x] Pinned friends for quick access

### 12.2 Future
- [ ] Share scorecard screenshot/image via text or social
- [ ] Share round summary link
- [ ] GPS-based "Find Games Near Me" (discover open events at nearby courses)

---

## 13. Analytics & Stats

### 13.1 Personal Dashboard
- [x] Net winnings/losses (all-time)
- [x] Scoring average
- [x] Head-to-head records vs opponents
- [x] Monthly scoring trends (chart)
- [x] Game type breakdown

### 13.2 Player Stats
- [x] Rounds played, wins, total payouts
- [x] Score distribution
- [x] Best rounds by course

### 13.3 Round History
- [x] View completed rounds with hole-by-hole scores
- [x] Delete completed rounds
- [x] Play again (template reuse)

### 13.4 Course Stats
- [x] Times played per course
- [x] Best scores and averages per course

### 13.5 Handicap Tracking
- [x] WHS handicap calculation from round differentials
- [x] Handicap progression chart over time
- [x] Differential history

---

## 14. PWA & Offline

- [x] Install banner/prompt ("Add to Home Screen")
- [x] Offline score entry queue (syncs when connection restores)
- [ ] Full service worker for offline caching
- [ ] App icon and splash screen

---

## 15. UI & Experience

### Implemented
- [x] Mobile-first responsive design
- [x] Green theme (standard) / Gold theme (High Roller)
- [x] Dark mode (full app)
- [x] Home dashboard with stat chips
- [x] Card-based layout
- [x] Browser back button support (pushState/popstate history sync)
- [x] Game rules modal with how-to-play for each game type

### Future
- [ ] Animations and transitions between screens
- [ ] Haptic feedback on score entry (mobile)
- [ ] Landscape mode for scorecard (wider table view)

---

## 16. Admin

- [x] Admin dashboard
- [x] View all users (names, emails, admin status)
- [x] Create user accounts
- [x] Set/revoke admin status
- [x] Delete users and all associated data
- [x] View all rounds with management options
- [x] Delete rounds
- [x] View all players with owner info
- [x] Edit player details (name, handicap, tee)
- [x] Edit user profiles (display name, handicap, payment methods)
- [x] Shared course template management
- [x] Game preset management with sorting
- [x] System stats (total users, rounds, courses, active/completed)
- [ ] Export data (CSV/PDF)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-06 | 1.0 | Initial requirements document |
| 2026-03-06 | 1.1 | Added: Groups, Scorekeeper role, Linked groups, Real-time leaderboard |
| 2026-03-06 | 1.2 | Added: Course API, GHIN/WHS API, GPS discovery, invite codes |
| 2026-03-09 | 1.3 | Jeff feedback: payment methods, player discovery, pressing, junk games, treasurer audit |
| 2026-03-09 | 1.4 | Splash page, guest auth, usability audit, browser back, score undo, end round from Home |
| 2026-03-09 | 1.5 | Guest banner copy, onboarding steps, scorecard running totals, hole navigator contrast |
| 2026-03-22 | 2.0 | **Full rewrite.** Reconciled requirements with actual implementation. Added: 6 new game types (Hammer, Vegas, Stableford, Dots, Banker, Quota), tournaments (single/double elim, stroke play), events (multi-group with score approval), personal dashboard, ledger, handicap tracking (WHS), player directory with pinned friends, spectate mode, round invite notifications with Join button, side bets, celebrations, offline queue, admin dashboard, game presets, course stats, and more. Removed outdated/duplicate items. Reorganized into 16 sections. |
