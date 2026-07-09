# Gimme — Product Overview

A slide-deck-shaped overview of the product. Each `---` is a slide break. Paste into PowerPoint, Google Slides, or Keynote — every section is sized to fit on one slide.

> **Last updated:** May 2026

---

## Slide 1 — Title

# **Gimme**
### Score your skins. Settle up. Skip the math.

A modern scorecard built for the way real golfers play.

May 2026

---

## Slide 2 — The Problem

### Every golf group has the same headache.

- 4 people on the tee, 11 different side games, 18 holes.
- Someone's keeping score on a napkin or a notes app.
- After the round: 30 minutes of math at the 19th hole, plus the inevitable "wait, who owes who?"
- Half the time someone forgets to settle up at all.

**Result:** A great day on the course ends in confusion, friction, and lost money.

---

## Slide 3 — The Solution

### One tap, every game, automatic settlement.

**Gimme** is a phone-first scorecard that:
- Tracks every popular side game (Skins, Nassau, Wolf, and 8 more).
- Calculates payouts down to the cent.
- Sends everyone a Venmo / Zelle / Cash App link the second the round ends.
- Works offline on the course and syncs when you reconnect.

> "We tracked 4 different games on one card and it just worked. Settled up before we left the parking lot."

---

## Slide 4 — Who It's For

### Three user archetypes:

**1. The Group Treasurer**
The friend who always ends up keeping score. Installs the app first, pulls the rest of the group in.

**2. The Casual 4-some**
3-8 friends playing weekly or monthly rounds for $5–$50 stakes. Currently using paper, notes apps, or spreadsheets.

**3. The Outing Organizer**
Runs corporate or charity events with 20–32 players across multiple groups. Needs scoring + settlement + a live leaderboard the whole event can watch.

---

## Slide 5 — What's Built

### A complete scorecard, settle-up, and event platform.

| Category | What's there |
|---|---|
| **Game formats** | 11 (Skins, Best Ball, Nassau, Wolf, BBB, Hammer, Vegas, Stableford, Dots, Banker, Quota) |
| **Scoring** | Live multi-device sync, offline-capable, gross or net |
| **Settlement** | Auto-calc + Venmo/Zelle/Cash App/PayPal deep links |
| **Events** | Multi-group tournaments with live leaderboard + spectator links |
| **Courses** | Pre-loaded local courses + crowdsourced library + custom builder |
| **Sharing** | QR codes, invite links, shareable result cards |
| **Stakes** | Standard ($5–$50) + High Roller ($100–$1,000) |

---

## Slide 6 — The Differentiators

### What sets Gimme apart vs. 18Birdies, Golf GameBook, and the rest.

- **More games, calculated correctly.** Most competitors do 1-3 games well. Gimme does 11, including weird-uncle favorites like Wolf and Hammer.
- **Settlement is built in.** Most apps tell you the score and stop. Gimme tells you who owes what and hands you a payment link.
- **Works offline** when you're between cell towers on the back nine.
- **Free, no subscription.** No paywalls behind the games people actually play.
- **Real-time multi-device sync** — multiple phones in the same round see the same scoreboard live.
- **Multi-group events** with role-based scoring (Score Master + Group Scorekeepers) for outings.

---

## Slide 7 — How It Works

### Four taps to the first tee.

1. **Sign in or play as guest** — no account required to start.
2. **Pick a course + add players** — courses prefilled, players reused from your roster.
3. **Pick your games + stakes** — Skins + Dots? Nassau with presses? Custom.
4. **Score every hole** — big buttons, animated celebrations, live leaderboard.

After the round: tap "Settle Up" → app calculates → everyone gets a payment link.

---

## Slide 8 — Live Demo Highlights

### What to show in a 90-second walkthrough.

1. **Home screen** — clean, friendly, dark mode optional.
2. **Create round** — 11 games, two stakes modes (Standard + High Roller).
3. **Live scorecard** — number pad, real-time sync between two phones side by side.
4. **Multi-group event** — leaderboard updating in real time across 3 groups.
5. **Settle Up** — net-out calculation, one-tap Venmo link.
6. **QR invite** — scan, sign in, join, all in 10 seconds.

---

## Slide 9 — The Tech (Light Touch)

### Built on modern, scalable foundations.

- **Front-end:** React + TypeScript (the same tech behind Facebook, Airbnb, Discord).
- **Back-end:** Supabase (managed Postgres database with built-in real-time and authentication).
- **Real-time sync:** WebSockets — every score change reaches every player's phone in <500ms.
- **Offline support:** Local cache + queue for unreliable cell coverage.
- **Hosting:** GitHub Pages (free, scales to millions of users).
- **Crash reporting:** Sentry — issues are caught and reported automatically.

> Auditable, well-tested codebase: 200+ automated tests, type-safe top to bottom.

---

## Slide 10 — Where We Are

### Current status: production-grade beta, ready for real users.

✅ All 11 games working with correct payouts.
✅ Multi-device real-time sync.
✅ Settlement with payment links.
✅ Multi-group event mode + spectator leaderboard.
✅ Offline support + auto-sync.
✅ Pre-launch hardening complete (May 2026): security audit, scaling fixes, crash protection, abuse prevention.
✅ ~12,000 lines of carefully tested production code.

🚧 Not yet in App Store (planned next; see `APP-STORE-PLAN.md`).
🚧 No paid tier yet (free for everyone right now).

---

## Slide 11 — Roadmap

### Next 90 days.

**June 2026 (next 30 days)**
- Apple App Store + Google Play submissions.
- Apple Watch companion (lap stats during play).
- Push notifications for round invites and settlement reminders.

**July 2026**
- Course imagery (hole maps, yardage details).
- Social: round comments, post-round stats sharing.
- Premium tier evaluation (subscription vs. one-time vs. ad-free).

**August 2026**
- Tournament features (multi-week leagues, season standings).
- API for golf clubs to integrate Gimme into their event nights.

---

## Slide 12 — Ask

### What we need.

Pick one based on the audience:

- **For investors:** ~$X to fund 6 months of development + App Store launch + initial growth experiments. Target 10K active users by end of 2026.
- **For partners:** Golf clubs / leagues willing to run their league night on Gimme — early adopters get free use forever and shape the product.
- **For users:** Try it next round. `gimme.gg` → "Try it first" → done. Then tell us what sucks.

---

## Slide 13 — Appendix: Numbers

### What the 1,000-user math looks like.

- **Hosting cost** at 1,000 users: ~$25/month (Supabase + GitHub Pages).
- **Cost per user**: ~$0.025/month.
- **Headroom**: current architecture handles 10K+ active users without re-architecture.
- **Game volume**: at 1K active users, ~3-5K rounds/month, ~50K hole-score writes/month.

> Built for scale from day one — even at 10x current capacity the unit economics are excellent.

---

## Slide 14 — Closing

# **Gimme**
### Score your skins. Settle up. Skip the math.

`gimme.gg`

Built by golfers, for golfers.

---

## Notes for the presenter

- **For non-technical audiences:** skip slides 9 and 13. Focus on slides 2-8 and 10-12.
- **For investors:** spend extra time on slides 4-6 and 10-12.
- **For golf partners (clubs, leagues):** open with slide 8 (live demo), then 4 (audience fit).
- **Demo flow:** have two phones in front of you for the multi-device sync moment. It's the most "wow" part of the product.
- **Closing question:** "What's one thing your group always argues about after a round?" — almost always the answer is settlement, which is exactly what Gimme fixes.
