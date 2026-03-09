# Fore Skins Golf Tracker — Functional Requirements

**Last Updated:** March 9, 2026
**Version:** 1.4

---

## 1. App Purpose

A mobile-first app for groups of friends who play golf together to track side games, scores, handicaps, and settle money — all from the course in real time.

---

## 2. User Accounts & Access

### 2.1 Sign In / Sign Up
- [x] Passwordless sign-in via email magic link
- [x] Password-based sign-in as primary method (inline on splash page)
- [x] Splash page with branding + direct sign-in form + Create Account + Guest login
- [x] Anonymous guest sign-in (no account required, uses Supabase anonymous auth)
- [x] Guest upgrade flow — convert anonymous account to full account, preserving all data
- [x] Guest nudge banner on Home screen (loss-aversion messaging, per-session dismissible)
- [ ] "Remember me" / stay signed in across sessions
- [ ] Social login (Google, Apple)

### 2.2 User Profile
- [ ] Display name and avatar
- [ ] Email management
- [x] Delete account option (deletes all user data from all tables)
- [x] Settings screen with account info, password change, danger zone
- [x] Conditional UI: anonymous users see "Create Account" instead of "Change Password"
- [ ] Payment info on profile (Venmo ID, Zelle email/phone, Cash App, PayPal — linked or displayed)

### 2.3 Privacy & Security
- [x] Each user can only see their own data
- [x] Row-level security on all database tables

---

## 3. Player Management

### 3.1 Add Player
- [x] Name
- [x] Handicap index (-10 to 54)
- [x] Default tee preference (White, Blue, Gold, Red, etc.)
- [x] GHIN number (optional — casual golfers can skip, still available for handicap verification)
- [x] Payment info: Venmo ID, Zelle email/phone, Cash App, PayPal — at least one required
- [x] Quick-add player inline during round setup

### 3.2 Find & Connect with Players
- [ ] Search for registered players in the app by name
- [ ] "Find Players Near Me" — GPS-based discovery of other registered users
- [ ] Drop-down/autocomplete list of registered players when adding to a group
- [ ] Send connection request to another player
- [ ] Connected players appear in your roster for easy round setup

### 3.3 Edit Player
- [x] Edit existing player details from home screen
- [x] Update handicap index
- [x] Delete player from edit form with confirmation dialog

### 3.4 Remove Player
- [ ] Players **cannot** be deleted from the app by other users (accounts are self-managed)
- [ ] Game master/scorekeeper **can** remove a player from a group or an active game
- [ ] Confirm before removing from a game (warn if scores already entered)

### 3.5 Handicap
- [x] Manual handicap index entry
- [x] USGA course handicap calculation (index x slope/113 + rating - par)
- [x] Stroke allocation per hole based on stroke index
- [ ] Auto-sync handicap from GHIN API (required GHIN number enables this)
- [ ] Track handicap changes over time
- [ ] Expand course handicap support for all courses in the system (not just saved courses)

---

## 4. Course Management

### 4.1 Course Catalog
- [x] Pre-loaded Ventura County courses (~15+)
- [x] Search catalog by name or city
- [x] Add catalog course to user's saved courses
- [ ] Expanded catalog (nationwide or API-powered)

### 4.2 Course Data API Integration
- [ ] Integrate with a golf course data API (e.g., GolfCourseAPI, Golf Genius, or similar) for full nationwide/international coverage
- [ ] Auto-populate course data: name, address, tee sets, ratings, slopes, pars, yardages, stroke index
- [ ] Search courses by name, city, state, or zip code
- [ ] Keep course data up to date (sync periodically or on-demand)
- [ ] Fallback to manual entry if course not found in API

### 4.3 Handicap API Integration
- [ ] Integrate with USGA GHIN API to auto-pull player handicap index
- [ ] Auto-update handicap before each round (or on-demand refresh)
- [ ] Show handicap revision history from GHIN
- [ ] Support international handicap systems (WHS — World Handicap System)

### 4.4 Nearby Courses
- [x] Detect user location via GPS
- [x] Show up to 8 courses within 25 miles (OpenStreetMap)
- [x] One-tap add from nearby list (pre-fills course name in CourseSetup)
- [ ] Show course details (rating, slope, par) in nearby results via API

> **Jeff:** Unsure if GPS detection is working today — needs testing/verification.

### 4.5 Custom Course
- [x] Course name
- [x] Multiple tee sets (name, USGA rating, slope)
- [x] 18 holes with par, stroke index, yardages per tee
- [x] Stroke index validation (1–18 used exactly once)
- [x] Par templates (72/71/70) for one-tap par configuration
- [x] Standard stroke index auto-allocation on new courses

### 4.6 Edit Course
- [x] Edit saved course details (tees, holes, ratings)

### 4.7 Delete Course
- [x] Delete a saved course
- [x] Confirm before deleting

---

## 5. Groups & Scorekeeper

### 5.1 Groups
- [ ] A group is a set of up to **5 players** playing together on the course
- [ ] Each round consists of one or more groups
- [ ] Multiple groups can be **linked into the same game/event** (e.g., 20 players across 4 groups all playing the same skins game at the same course)
- [ ] All linked groups share the same game type, stakes, and buy-in
- [ ] Each group plays independently but results are combined across all linked groups

### 5.2 Scorekeeper Role
- [ ] Each group has one designated **scorekeeper**
- [ ] Any player in the group can enter scores from their own device
- [ ] Scores entered by non-scorekeepers are **pending** until the scorekeeper approves
- [ ] Scorekeeper can **approve or reject** submitted scores
- [ ] Scorekeeper can **overwrite** any score in their group at any time
- [ ] Scorekeeper approval is shown visually (e.g., checkmark vs pending indicator)
- [ ] If scorekeeper enters a score directly, it's automatically approved

### 5.3 Group Management
- [ ] Create a group and invite players (by email or from roster)
- [ ] Assign scorekeeper during round setup
- [ ] Change scorekeeper mid-round if needed
- [ ] Save recurring groups for reuse (e.g., "Saturday Crew", "Work League")
- [ ] Group name and optional icon/color

### 5.4 Linking Groups
- [ ] When starting a round, option to "Create New Event" or "Join Existing Event"
- [ ] Event creator sets the game type, stakes, and course
- [ ] Additional groups join via **invite link** or **event code** (short alphanumeric, e.g., "FORE-7X3K")
- [ ] Share invite link via text, email, or copy-to-clipboard
- [ ] Each group's scorekeeper manages their own group's scores
- [ ] All groups feed into the same leaderboard and payout pool

### 5.5 Discover Nearby Games (GPS)
- [ ] "Find Games Near Me" feature on home screen
- [ ] Uses GPS to detect nearby courses with active events
- [ ] Shows list of open/joinable events at courses within range
- [ ] Display: course name, game type, stakes, number of players/groups, tee time
- [ ] One-tap request to join (event creator or scorekeeper approves)
- [ ] Privacy controls: event creator can set event as **Public** (discoverable) or **Private** (invite-only)
- [ ] Distance and direction shown for each nearby game
- [ ] Filter by game type, stakes level, or tee time

---

## 6. Round Setup

### 6.1 Start a Round (3-step wizard)

**Step 1 — Pick a Course**
- [x] Select from any available course in the app (catalog + API, not just user-saved courses)
- [x] Browse catalog to add a new course
- [x] Course details shown (par, tees, holes)

**Step 2 — Pick Players & Groups**
- [x] Select from saved players
- [x] Assign tee per player (override default)
- [x] Quick-add a new player inline
- [x] Auto-calculate course handicap per player/tee
- [ ] Assign players to groups (max 5 per group)
- [ ] Designate a scorekeeper per group
- [ ] Option to link to an existing event or create a new one

**Step 3 — Configure Game**
- [x] Choose game type (Skins, Best Ball, Nassau, Wolf, BBB)
- [x] Choose stakes mode (Standard or High Roller)
- [x] Set buy-in amount (presets or custom)
- [x] Configure game-specific options (see Section 7)
- [x] Designate treasurer (collects buy-ins)

### 6.2 Resume Round
- [x] Active rounds shown on home screen
- [x] Tap to resume where you left off
- [x] End round directly from Home screen (marks complete, goes to Settle Up)
- [x] Confirmation before ending with option to view results

---

## 7. Game Types & Rules

### 7.1 Skins
- [x] Lowest score on a hole wins the skin
- [x] Gross or Net scoring mode
- [x] Carryovers ON/OFF (tied holes carry pot to next)
- [x] Display carryover count and accumulated pot value
- [x] Calculate skins won per player at end
- [ ] Press option on a hole (double or nothing — player can press to double the skin value)

### 7.2 Best Ball
- [x] 2v2 team format (best score per team counts)
- [x] Team assignment during setup (Team A vs Team B)
- [x] Match Play mode (count holes won, first to 10)
- [x] Stroke Play mode (lowest total team strokes)
- [x] Gross or Net scoring mode
- [x] Track holes won per team

### 7.3 Nassau
- [x] Three simultaneous bets: Front 9, Back 9, Total 18
- [x] Lowest total strokes per segment wins that bet
- [x] Gross or Net scoring mode
- [x] Display segment leaders during play
- [ ] Auto-press option (double the bet when down by 2)
- [ ] Manual press on any hole (player initiates a double-or-nothing press mid-round)

> **Jeff:** Pressing is a big part of Nassau and Skins. A player who's losing can "press" which starts a new side bet from that hole forward. It's essentially double or nothing. This is a core feature for competitive groups.

### 7.4 Wolf
- [x] 4-player rotation — each player takes turn as Wolf
- [x] Wolf picks a partner after tee shots or goes Lone Wolf (2x multiplier)
- [x] Customizable wolf order (drag to reorder)
- [x] Gross or Net scoring mode
- [x] Track net units won/lost per player
- [ ] "Pig" variant (wolf picks before anyone tees off)

### 7.5 Bingo Bango Bongo (BBB)
- [x] Three points awarded per hole:
  - Bingo: First player on the green
  - Bango: Closest to the pin once all are on
  - Bongo: First player to hole out
- [x] Manual point assignment via buttons per hole
- [x] Gross or Net scoring mode
- [x] Track total points per player

### 7.6 Junk / Dot Games
- [ ] Side bets that run alongside any main game type
- [ ] Configurable per round (toggle which junks are active)
- [ ] Common junks:
  - **Sandy Par** — par or better from a bunker
  - **Closest to the Pin** (CTP) — on designated par 3s
  - **Poley** — make a putt longer than the flagstick length
  - **Greenie** — hit the green in regulation on par 3s
  - **Barkie** — par or better after hitting a tree
  - **Ferret** — par or better from off the green
  - **Snake** — three-putt (penalty dot)
- [ ] Each junk has a configurable dollar value or point value
- [ ] Track junks per player per hole
- [ ] Junk totals included in settle up and payout

### 7.7 Future Game Types
- [ ] Stableford (points-based scoring: 0 for double+, 1 bogey, 2 par, 3 birdie, 4 eagle)
- [ ] Vegas (team scores combined as 2-digit numbers)
- [ ] Hammer (escalating bet that can be "hammered" back)
- [ ] Quota (target based on handicap, earn points for under-par holes)

---

## 8. Live Scorecard

### 8.1 Score Entry
- [x] Hole-by-hole scoring for each player
- [x] +/- stepper buttons (range 1–15)
- [x] Hole navigator (1–18) with clear visual distinction between scored and unscored holes
- [x] Current hole info (par, stroke index, course name)
- [x] Navigate forward/back between holes

### 8.2 Score Display
- [x] Score badges per player (Eagle, Birdie, Par, Bogey, Double+)
- [x] Handicap strokes received shown per player per hole
- [x] Net score calculation
- [x] Running total per player (gross + vs-par through N holes played)

### 8.3 Game Panels (shown during play)
- [x] Skins: carryover count, pot value
- [x] Best Ball: team scores, holes won
- [x] Nassau: front/back/18 leaders
- [x] Wolf: current wolf, partner selection
- [x] BBB: bingo/bango/bongo assignment
- [ ] Junk/Dot tracker panel (when junks are active)

### 8.4 Scorekeeper Workflow
- [ ] Any player in the group can submit a score from their device
- [ ] Submitted scores show as **pending** (visible but not finalized)
- [ ] Scorekeeper sees pending scores with approve/reject buttons
- [ ] Scorekeeper can overwrite any score in their group at any time
- [ ] Scorekeeper-entered scores are automatically approved
- [ ] Visual indicator: approved (checkmark) vs pending (clock/dot)
- [ ] Notification to scorekeeper when a score is submitted for approval

### 8.5 Score Validation
- [x] Flag unlikely scores (hole-in-one on par 4+, +5 over par) with warning
- [ ] Warn if a hole is skipped

### 8.6 Undo & Error Handling
- [x] Undo button for last score change (per hole, shown in bottom bar)
- [x] Confirmation dialog before navigating away from active scoring
- [x] Network error banner when score save fails
- [x] Error handling on hole navigation saves

### 8.7 Real-Time Sync
- [x] Scores persist to database after each entry
- [ ] Multi-device sync (multiple users scoring the same round)
- [ ] Real-time updates via Supabase Realtime (subscriptions)

---

## 9. Real-Time Leaderboard

### 9.1 Live Leaderboard
- [ ] Accessible to all players across all linked groups during a round
- [ ] Updates in real time as scores are approved
- [ ] Shows all players ranked by game-specific criteria:
  - Skins: skins won, carryover status
  - Best Ball: team scores, holes won
  - Nassau: front/back/18 standings
  - Wolf: net units
  - BBB: total points
- [ ] Gross and net score columns
- [ ] Thru indicator (how many holes each player has completed)
- [ ] Current hole indicator per group

### 9.2 Leaderboard Views
- [ ] **Overall** — all players across all groups ranked together
- [ ] **By Group** — filter to see one group's scores
- [ ] **Money** — who's winning/losing how much in real time

### 9.3 Access
- [ ] Any player in any linked group can view the leaderboard
- [ ] Non-players can view via a shareable spectator link
- [ ] Auto-refreshes without manual pull-to-refresh

---

## 10. Settle Up & Payouts

### 10.1 Results Display
- [x] Game-specific results (skins won, team winners, units, points)
- [x] Round summary (player count, buy-in, total pot)
- [ ] **Settle up overview page** — comprehensive summary of the round before payments
- [ ] Junk/dot game totals included in results

### 10.2 Payout Calculation
- [x] Treasurer-based model (treasurer collects, then distributes)
- [x] Automatic payout amounts per player based on game results
- [x] High Roller premium styling

### 10.3 Treasurer & Audit
- [ ] Treasurer has **audit responsibility** — can review all scores, payouts, and payment statuses
- [ ] Treasurer dashboard: who has paid, who owes, total collected vs total distributed
- [ ] Audit log of all payout changes and payment status updates
- [ ] Treasurer can flag disputes and adjust payouts manually

### 10.4 Payment
- [x] Venmo deep-link button (opens Venmo with pre-filled amount)
- [x] Copy payment text fallback
- [ ] Mark buy-in as "paid" (toggle button — data model exists, UI missing)
- [ ] Payment status tracking (who has paid, who hasn't)
- [ ] Zelle / PayPal / Cash App deep links
- [ ] In-app payment processing (Stripe/Venmo API)
- [ ] Auto-processing of payments (long-term goal — initiate payments directly from the app)

### 10.5 Platform Fees (Future)
- [ ] Optional admin/platform fee collected per round or per player
- [ ] Configurable fee amount or percentage
- [ ] Fee shown transparently in settle up summary
- [ ] Not critical yet — revisit when user base grows

> **Jeff:** Auto-processing payments would be amazing but is probably a reach for now. We should discuss admin fees at some point but it's not super critical yet.

---

## 11. Round History & Stats

### 11.1 Past Rounds
- [ ] View list of completed rounds
- [ ] Round detail view (scores, results, payouts)
- [ ] Filter by date, course, game type
- [ ] Delete a completed round

### 11.2 Lifetime Stats
- [ ] Lifetime stats per player: rounds played, total winnings/losses
- [ ] Average score per player
- [ ] Best round per player
- [ ] Head-to-head records between players

### 11.3 Trends
- [ ] Handicap index over time chart
- [ ] Scoring average trend
- [ ] Win/loss streaks

---

## 12. Sharing & Social

### 12.1 Share Results
- [ ] Screenshot/image of scorecard to share via text or social
- [ ] Share round summary link

### 12.2 Multi-User Rounds
- [ ] Invite other app users to join a round
- [ ] Each player enters their own scores from their phone
- [ ] Real-time score sync across devices
- [ ] Shared round visible to all participants

---

## 13. Notifications

- [ ] Email notification when invited to a round
- [ ] Push notification when round is settled
- [ ] Reminder if buy-in is unpaid
- [ ] Weekly summary of stats

---

## 14. Installability & Offline

### 14.1 PWA (Progressive Web App)
- [ ] Add manifest.json for "Add to Home Screen"
- [ ] App icon and splash screen
- [ ] Service worker for offline caching

### 14.2 Offline Support
- [ ] Score entry works without internet
- [ ] Sync scores when connection restored

---

## 15. UI & Experience

### 15.1 Current
- [x] Mobile-first responsive design
- [x] Green theme (standard) / Gold theme (high roller)
- [x] Home dashboard with stats chips
- [x] Card-based layout for players and courses
- [x] Browser back button support (pushState/popstate history sync)
- [x] Course data scoped per user (user_id filter on queries)

### 15.2 Future
- [ ] Dark mode
- [ ] Customizable team/group name
- [ ] Animations and transitions between screens
- [ ] Haptic feedback on score entry (mobile)
- [ ] Landscape mode for scorecard (wider table view)

---

## 16. Admin & Data Management

- [ ] Export round data (CSV or PDF)
- [ ] Bulk delete old rounds
- [ ] Backup/restore data
- [ ] Delete account and all associated data

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-06 | 1.0 | Initial requirements document |
| 2026-03-06 | 1.1 | Added: Groups (max 5 players), Scorekeeper role with approve/overwrite, Linked groups across an event, Real-time leaderboard |
| 2026-03-06 | 1.2 | Added: Course Data API integration, GHIN/WHS handicap API, GPS game discovery ("Find Games Near Me"), invite link/event code joining, public vs private events |
| 2026-03-09 | 1.3 | Jeff's feedback: GHIN required (not optional), payment info expanded (Venmo/Zelle/CashApp/PayPal), player discovery & connect, players can't be deleted by others (only removed from games), pressing for Nassau/Skins, Junk/Dot games (sandy par, CTP, poley, greenie, barkie, ferret, snake), treasurer audit responsibility, settle up overview, platform fees placeholder, course selection from full catalog not just saved, notes on auth UX and GPS verification |
| 2026-03-09 | 1.4 | Splash page with inline sign-in, anonymous guest auth + upgrade flow, usability audit: browser back button support, scorecard leave confirmation, network error handling, delete player, course user_id security fix, GHIN made optional, par templates for course setup, Near Me pre-fills course name, score undo button, end round from Home |
| 2026-03-09 | 1.5 | Medium usability fixes: accurate guest banner copy, actionable onboarding steps, removed duplicate copy buttons in SettleUp, running total on scorecard (gross + vs-par through N holes), contextual End Round confirmation (shows holes scored/missing), improved hole navigator contrast (scored vs unscored), fixed course setup navigation when adding from new-round flow |
