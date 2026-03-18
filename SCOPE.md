# Fore Skins Golf Tracker — Scope Document

**Date:** March 4, 2026
**Repo:** https://github.com/usclogan-sudo/golf-tracker
**Live Site:** https://usclogan-sudo.github.io/golf-tracker/

---

## 1. Project Overview

Fore Skins is a mobile-first web app for tracking golf side games, scores, handicaps, and money between friends. Players sign in, set up courses and player profiles, start a round with a chosen game type and buy-in, score hole-by-hole on the course, and settle up payouts at the end.

---

## 2. Tech Stack

| Layer        | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18 + TypeScript + Vite      |
| Styling     | Tailwind CSS v3                   |
| Database    | Supabase (PostgreSQL)             |
| Auth        | Supabase magic link (email OTP)   |
| Hosting     | GitHub Pages                      |
| CI/CD       | GitHub Actions (auto-deploy on push to main) |

---

## 3. Current Features (What's Built)

### Authentication
- Magic link email sign-in (passwordless)
- Session persistence via Supabase auth
- Sign out functionality
- Row-level security — each user only sees their own data

### Course Management
- Pre-loaded Ventura County course catalog (~15+ courses with full data)
- Custom course creation (name, multiple tees with rating/slope, 18 holes with par/stroke index/yardages)
- Geolocation-based "Courses Near You" discovery via OpenStreetMap

### Player Management
- Add players with: name, handicap index, default tee, optional GHIN number, optional Venmo username
- Player list on home screen

### Round Creation (3-step wizard)
1. **Pick a course** — from saved courses or catalog
2. **Pick players** (up to 8) — assign tees, quick-add new players inline
3. **Configure game** — choose game type, buy-in amount, game-specific options

### Supported Game Types (all 5 fully implemented)

| Game | Description | Options |
|------|-------------|---------|
| **Skins** | Lowest score wins the hole's pot | Gross/Net, Carryovers ON/OFF |
| **Best Ball** | 2v2 team format, best score per team | Match/Stroke play, Gross/Net, Team assignment |
| **Nassau** | 3 simultaneous bets (Front 9, Back 9, Total 18) | Gross/Net |
| **Wolf** | 4-player rotation, pick a partner or go Lone Wolf | Gross/Net, Customizable wolf order |
| **Bingo Bango Bongo** | 3 points per hole (first on green, closest to pin, first to hole out) | Gross/Net |

### Stakes Modes
- **Standard:** Buy-in presets $5–$50
- **High Roller:** Buy-in presets $100–$1,000 with premium gold UI theme

### Live Scorecard
- Hole-by-hole score entry with +/- stepper per player
- Hole navigator showing completion status (1–18)
- Score badges (Eagle, Birdie, Par, Bogey, Double+)
- USGA handicap stroke calculations displayed per player per hole
- Game-specific panels:
  - Skins: carryover count & pot value
  - Best Ball: team scores & holes won
  - Nassau: front/back/18 segment leaders
  - Wolf: wolf player ID + partner selection UI
  - BBB: bingo/bango/bongo assignment buttons
- Real-time persistence to Supabase

### Settle Up / Payouts
- Post-round settlement screen
- Game-specific result calculations (skins won, team winners, units, points)
- Treasurer-based payout model (one player collects, then distributes)
- Venmo deep-link integration ("Pay via Venmo" button)
- Copy payment text fallback
- High Roller premium styling

### Other
- Resume active rounds from home screen
- Home dashboard with stats (rounds, players, courses)
- Mobile-first responsive design

---

## 4. Data Model

### Database Tables (Supabase PostgreSQL)

All tables have `user_id` with row-level security (`auth.uid() = user_id`).

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `courses` | Saved golf courses | name, tees (JSONB), holes (JSONB) |
| `players` | Player profiles | name, handicap_index, tee, ghin_number, venmo_username |
| `rounds` | Round metadata | course_id, status, current_hole, game (JSONB), course_snapshot (JSONB) |
| `round_players` | Players in a round | round_id, player_id, tee_played, course_handicap |
| `hole_scores` | Score per player per hole | round_id, player_id, hole_number, gross_score |
| `buy_ins` | Payment tracking | round_id, player_id, amount_cents, status, method |
| `bbb_points` | BBB game points | round_id, hole_number, bingo, bango, bongo |

### Key Types (TypeScript)

- `Course` — name, tees[], holes[]
- `Player` — name, handicapIndex, tee, venmoUsername?, ghinNumber?
- `Round` — courseId, status (setup/active/complete), currentHole, game, courseSnapshot
- `Game` — type, buyInCents, stakesMode, config (varies by game type)
- `HoleScore` — roundId, playerId, holeNumber, grossScore
- `BuyIn` — roundId, playerId, amountCents, status (unpaid/marked_paid), method

---

## 5. Architecture Notes

- **Single-page app** — screen state managed via `useState<Screen>` in App.tsx
- **No router** — all navigation is state-driven
- **DB naming** — snake_case in Supabase, camelCase in TypeScript, mapped via functions in `src/lib/supabase.ts`
- **Handicap math** — USGA formula in `src/lib/gameLogic.ts`: `courseHcp = round(index * slope/113 + (rating - par))`
- **Home refresh** — `homeKey` state incremented on navigation back, forces component remount + data refetch
- **Env vars** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set as GitHub repo variables, stripped of whitespace in CI

---

## 6. Suggested New Features (Priority Order)

### P0 — Critical Fixes
1. **Fix auth redirect on GitHub Pages** — Magic link emails redirect correctly but need thorough testing across browsers/devices
2. **Buy-in payment marking** — BuyIn table/UI exists but there's no button to mark a buy-in as "paid." Add toggle in SettleUp
3. **Player editing** — Home screen has edit buttons but they just open a blank PlayerSetup. Load existing player data for editing

### P1 — High Value
4. **Round history / past rounds** — View completed rounds, scores, results, and payouts. Currently rounds are stored but there's no archive view
5. **Leaderboard / stats dashboard** — Lifetime stats: total winnings, skins won, rounds played, avg score, best round, head-to-head records
6. **Course editing** — Allow updating hole data, tees, ratings for saved courses
7. **Push notifications** — Notify players when it's their turn to enter a score or when a round is settled
8. **PWA / installable app** — Add manifest.json and service worker so users can "Add to Home Screen" on mobile (partially started — manifest link exists but file is missing)

### P2 — Nice to Have
9. **Multi-user shared rounds** — Currently each user has their own isolated data. Allow multiple authenticated users to join the same round and enter their own scores in real-time
10. **GHIN handicap auto-sync** — Pull latest handicap index from USGA GHIN API using player's GHIN number
11. **Photo/screenshot capture** — Take a photo of the scorecard or leaderboard to share via text/social
12. **Side bets per hole** — Ad-hoc prop bets ("closest to the pin on #7 for $10") separate from the main game
13. **Weather integration** — Show current weather/wind for the course location
14. **Expanded course catalog** — Add courses beyond Ventura County, or integrate with a golf course API for nationwide coverage
15. **Score validation** — Flag unlikely scores (e.g., score of 1 on a par 5) with a confirmation prompt
16. **Dark mode** — The app already uses a dark header; extend the dark theme to the full app

### P3 — Future Vision
17. **Tournaments / series** — Multi-round events with cumulative scoring and season-long leaderboards
18. **Handicap tracking over time** — Chart handicap index changes round-over-round
19. **AI caddie** — Course strategy suggestions based on handicap and hole layout
20. **Stripe/Venmo API integration** — Process payments directly in the app instead of deep-linking

---

## 7. File Structure

```
golf-tracker/
├── .github/workflows/deploy.yml    # GitHub Actions CI/CD
├── public/
│   └── 404.html                    # SPA redirect for GitHub Pages
├── src/
│   ├── App.tsx                     # Main app + Home screen + routing
│   ├── types/index.ts              # All TypeScript interfaces
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client + row mappers
│   │   └── gameLogic.ts            # Handicap & scoring calculations
│   ├── data/
│   │   └── venturaCourses.ts       # Pre-loaded course catalog
│   └── components/
│       ├── Auth/Auth.tsx            # Login screen
│       ├── CourseCatalog/           # Browse & add catalog courses
│       ├── CourseSetup/             # Custom course creation
│       ├── PlayerSetup/             # Add/edit players
│       ├── NewRound/                # 3-step round creation wizard
│       ├── Scorecard/               # Live hole-by-hole scoring
│       ├── SettleUp/                # Post-round payouts
│       └── NearMeCourses/           # Geolocation course discovery
├── supabase-schema.sql              # Database schema
├── .env.local                       # Local Supabase credentials
├── vite.config.ts                   # Vite config (base: /golf-tracker/)
├── tailwind.config.js               # Tailwind theme
└── package.json
```

---

## 8. Dev Setup

```bash
# Clone and install
git clone https://github.com/usclogan-sudo/golf-tracker.git
cd golf-tracker
npm install

# Set up environment
cp .env.local.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Run locally
npm run dev
# Opens at http://localhost:5173/golf-tracker/

# Build for production
npm run build
```

---

## 9. Supabase Setup

1. Create a Supabase project
2. Run `supabase-schema.sql` in the SQL Editor to create all tables with RLS
3. Enable Email auth in Authentication > Providers
4. Set Site URL to your deployed URL in Authentication > URL Configuration
5. Add your deployed URL to Redirect URLs
6. Copy Project URL and anon key to `.env.local` and GitHub repo variables

---

## 10. Known Issues

- Email rate limit on Supabase free tier (2 emails/hour) — consider upgrading or adding password auth as fallback
- No manifest.json file yet (link exists in index.html but file is missing) — needed for PWA
- Player edit from home screen doesn't pre-populate existing data
- No way to delete courses, players, or rounds from the UI
- SettleUp buy-in "mark as paid" button not implemented
