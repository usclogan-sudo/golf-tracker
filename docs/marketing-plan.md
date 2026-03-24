# Marketing Plan: Fore Skins Golf Tracker

Getting to 100 active users through grassroots, golf-community tactics. No ad budget required.

---

## Target Audience

**Primary:** Casual golf groups (4-12 people) who already play side games for money and currently track scores on paper, notes apps, or spreadsheets.

**Secondary:** Golf outing organizers who run 20-40 person events and need scoring + settlement across multiple groups.

**Persona sweet spot:** The person in every golf group who always ends up being the scorekeeper/treasurer. They're the ones who will install the app first and pull everyone else in.

---

## Core Message

**One-liner:** "Score your skins, settle up, skip the math."

**Elevator pitch:** Fore Skins Golf tracks every side game your group plays — Skins, Nassau, Wolf, Hammer, all of it — calculates payouts automatically, and sends everyone a Venmo link. No more napkin math at the 19th hole.

**Key differentiators vs. competitors (18Birdies, Golf GameBook, etc.):**
- 10+ side game formats with automatic payout calculation
- Built-in settlement with Venmo/Zelle/Cash App links
- Works offline on the course
- Free, no subscription
- Lightweight PWA — no App Store download needed

---

## Phase 1: Your Own Network (Weeks 1-4, Target: 20 users)

### Personal Outreach
- **Your golf group first.** Use the app for 3-4 real rounds. Work out the kinks. This is your case study.
- **Text 10 golfer friends individually.** Not a group blast — personal message: "Hey, I built this app for our group. Can you try it next round and tell me what sucks?" People help people, not products.
- **Demo in person.** At the course, before a round, pull it up and walk through creating a round in 30 seconds. Seeing is believing.

### Make It Easy to Say Yes
- Use **guest mode** as the entry point. "You don't even need to sign up — just tap 'Try it first.'"
- Pre-load your local courses so nobody hits a blank course list.
- The scorekeeper installs the app; other players just need to spectate via link at first.

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

### Make Sharing Built-In
- **Share cards after rounds** — the app already generates shareable result cards. Make sure they include a small "Scored with Fore Skins Golf" watermark and URL.
- **Invite codes** — every round generates a code. Make the share text compelling: "Join our round on Fore Skins Golf: [link]. See the live leaderboard and scores."
- **Spectator mode** — this is a sleeper feature. Friends/spouses who follow along become future users. Make sure the spectate link is dead simple.

### Retention Hooks
- **Unsettled debts notification:** "You have $15 unsettled from Saturday's round." This pulls people back.
- **Round history:** People check their stats. "What's my record at this course?" keeps them opening the app.
- **Group habit:** Once a group uses it for 3 rounds, it becomes "the way we do it." The switching cost is social, not technical.

### Content (Low Effort)
- Short **Instagram/TikTok clips** from the course showing the app in action. Not polished — phone in one hand, beer in the other, "look how easy this is." Golf social media is huge and authenticity wins.
- A simple **landing page** explaining what the app does, with screenshots and a "Start scoring" button. (Could be a single static page on the same GitHub Pages site.)

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
