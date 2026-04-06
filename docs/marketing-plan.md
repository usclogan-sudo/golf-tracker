# Marketing Plan: Gimme Golf Tracker

Getting to 100 active users through grassroots, golf-community tactics. No ad budget required.

> **Last updated:** April 2026

---

## Current App Capabilities (what's actually built)

- **11 game types:** Skins, Best Ball, Nassau, Wolf, BBB, Hammer, Vegas, Stableford, Dots, Banker, Quota
- **Auth:** Email/password signup + password reset via email
- **Guest/demo mode:** "Try it first" flow — no signup required to explore
- **Join via invite:** Invite codes + shareable links for joining rounds/events
- **Multi-group events:** Event creation with group assignment, per-group scorekeepers, live event leaderboard
- **Live leaderboard:** Real-time spectator view via link
- **Settlement:** Automatic payout calculation with deep links to Venmo, Zelle, Cash App
- **Share cards:** Shareable round result images (via html2canvas)
- **Offline support:** Offline queue for score entry, online status detection
- **PWA:** Install banner, add-to-homescreen prompt
- **Onboarding:** Guided first-run flow for new users
- **Course catalog:** Pre-loaded Ventura-area courses + shared course library + "near me" search
- **Player directory:** Public player profiles with handicap, tee preference
- **Round history & stats:** Personal dashboard, per-course stats
- **Ledger:** Running payment ledger across rounds
- **No landing page yet** — non-logged-in visitors go straight to auth screen

---

## Target Audience

**Primary:** Casual golf groups (4-12 people) who already play side games for money and currently track scores on paper, notes apps, or spreadsheets.

**Secondary:** Golf outing organizers who run 20-40 person events and need scoring + settlement across multiple groups.

**Persona sweet spot:** The person in every golf group who always ends up being the scorekeeper/treasurer. They're the ones who will install the app first and pull everyone else in.

---

## Core Message

**One-liner:** "Score your skins, settle up, skip the math."

**Elevator pitch:** Gimme Golf tracks every side game your group plays — Skins, Nassau, Wolf, Hammer, all of it — calculates payouts automatically, and sends everyone a Venmo link. No more napkin math at the 19th hole.

**Key differentiators vs. competitors (18Birdies, Golf GameBook, etc.):**
- 11 side game formats with automatic payout calculation
- Built-in settlement with Venmo/Zelle/Cash App deep links
- Works offline on the course
- Free, no subscription
- Lightweight PWA — no App Store download needed
- Multi-group event mode with live leaderboard and invite codes

---

## Phase 1: Your Own Network (Weeks 1-4, Target: 20 users)

### Personal Outreach
- **Your golf group first.** Use the app for 3-4 real rounds. Work out the kinks. This is your case study.
- **Text 10 golfer friends individually.** Not a group blast — personal message: "Hey, I built this app for our group. Can you try it next round and tell me what sucks?" People help people, not products.
- **Demo in person.** At the course, before a round, pull it up and walk through creating a round in 30 seconds. Seeing is believing.

### Make It Easy to Say Yes
- Use **guest/demo mode** as the entry point. "You don't even need to sign up — just tap 'Try it first.'" (Already built.)
- Local Ventura-area courses are pre-loaded, plus shared course library and "near me" search. No blank course list.
- Other players can join via **invite code** or **shareable link**, or follow along via the **live spectator leaderboard**.

---

## Phase 2: Local Golf Community (Weeks 4-8, Target: 50 users)

### Golf Course Partnerships
- Talk to the **pro shop / starter** at 2-3 courses you play regularly. Ask if you can leave a small stack of cards or a QR code at the counter: "Free app for tracking your skins game."
- Offer to demo at a **men's/women's league night.** These groups already play organized side games weekly — they're the ideal users.
- Frame it as something that helps *their* course: "Players who can easily settle bets have more fun and come back more."

### Local Facebook/Reddit Groups
- Find your area's golf Facebook groups (every metro has them). Post a genuine, non-spammy introduction:
  > "My group plays skins and nassau every weekend and we were tired of the napkin math. I built a free app that handles the scoring and payouts. Looking for a few groups to try it out and give feedback. [link]"
- Same approach on r/golf or your city's subreddit. Lead with the problem, not the product.

### Golf Outing Angle
- Charity tournaments and corporate outings need scoring solutions. Reach out to 2-3 outing organizers:
  > "I have a free scoring app that handles multi-group events with a live leaderboard. Want to try it at your next outing?"
- One successful 30-person outing = 30 users who've experienced the app.

---

## Phase 3: Word of Mouth Engine (Weeks 8-12, Target: 100 users)

### Make Sharing Built-In (all already implemented)
- **Share cards after rounds** — the app generates shareable result images via html2canvas. TODO: verify they include a "Scored with Gimme Golf" watermark and URL.
- **Invite codes** — every event generates a code + shareable link. Share text includes the join URL.
- **Spectator/live leaderboard** — real-time spectator view exists. Friends/spouses who follow along become future users.

### Retention Hooks
- **Unsettled debts:** Settlement screen + ledger show outstanding balances. (Push notifications not yet implemented.)
- **Round history & stats:** Already built — personal dashboard, per-course stats, round history. "What's my record at this course?" keeps them opening the app.
- **Group habit:** Once a group uses it for 3 rounds, it becomes "the way we do it." The switching cost is social, not technical.

### Content (Low Effort)
- Short **Instagram/TikTok clips** from the course showing the app in action. Not polished — phone in one hand, beer in the other, "look how easy this is." Golf social media is huge and authenticity wins.
- **Landing page** — NOT YET BUILT. Currently non-logged-in visitors see the auth screen. A simple landing page with screenshots and a "Start scoring" button would help conversion from shared links. (Could be a single static page on the same GitHub Pages site.)

---

## Messaging by Channel

| Channel | Message Angle |
|---------|--------------|
| In-person at course | "No more napkin math. This handles all the payouts." |
| Text to friends | "Built this for our group — try it Saturday?" |
| Facebook golf groups | "Free app for skins/nassau/wolf. Looking for feedback." |
| Pro shop/league | "Free scoring tool for your members' side games." |
| Outing organizers | "Free live leaderboard for your event. Multi-group scoring." |
| Instagram/TikTok | Show the settlement screen. "Who owes who, done." |

---

## What NOT to Do

- **Don't launch on Product Hunt / Hacker News yet.** Get to 100 happy users first. Premature exposure to tech audiences who don't play golf wastes the launch.
- **Don't pay for ads.** At this stage, every user should come from a conversation or a recommendation. Ads attract tire-kickers; conversations attract users who stick.
- **Don't build features to attract users.** The feature set is already rich. The gap is distribution, not product.
- **Don't spam.** One post per community, then engage in comments. Respond to every question. Be a golfer who built a thing, not a marketer.

---

## Metrics to Track

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Registered accounts | 100 | Supabase auth dashboard |
| Weekly active users | 30+ | Rounds created per week |
| Rounds completed | 200+ total | Supabase `rounds` table (status = complete) |
| Retention (2+ rounds) | 50% of users | Query users with >1 completed round |
| Invite conversion | 25%+ | Invite codes generated vs. rounds joined |
| PWA installs | 40+ | InstallBanner dismiss vs. install tracking |

---

## Budget: $0-50/month

| Item | Cost |
|------|------|
| Supabase free tier | $0 |
| GitHub Pages hosting | $0 |
| Custom domain (optional) | $12/year |
| QR code cards for pro shops | $15 one-time |
| Supabase Pro (if needed) | $25/month |
