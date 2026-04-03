# Prop Bets — Product Requirements

## Vision

Turn the natural trash talk and side action that already happens in every golf group into a lightweight, fun betting layer inside Gimme. Think Polymarket meets your Saturday foursome.

The system handles everything from quick in-the-moment bets ("$3 Stan hits this OB") to structured pre-round props ("Mike breaks 80, over/under") to long-running season bets ("Best handicap improvement by June"). All settlements flow into the existing money infrastructure.

---

## Prop Types

### 1. Quick Props (in-the-moment, during play)

The most common type. Created mid-round, resolve within seconds to minutes. This is the stuff that already happens verbally — now it's tracked and settled.

**Examples:**
- "$3 Stan hits this ball out of bounds"
- "$5 Jeff three-putts this green"
- "$2 nobody pars this hole"
- "$5 Jeff will say 'that's my shot' after his next good drive"
- "$5 first person to hit a tree on this hole"
- "$10 whoever loses this hole buys the beers"
- "$5 Dave skulls his next chip"
- "$3 Mike's ball doesn't clear the water"
- "$5 Jeff blames his putter within the next 2 holes"

**Characteristics:**
- Created in 2-3 taps (speed matters — the moment passes)
- Usually 2 outcomes (yes/no, makes it/doesn't)
- Small stakes ($1-$10)
- Resolve manually (creator or group confirms)
- Often directed AT a specific person
- The fun is in the creation and the moment, not the money

### 2. Skill Props (score-based, auto-resolvable)

Structured bets tied to measurable outcomes. Can auto-resolve from score data.

**Examples:**
- "Jeff won't birdie a single hole today" — yes/no
- "Mike shoots under 80" — over/under
- "Dave beats Sarah net score" — head to head
- "Someone eagles #5" — hole-specific event
- "Total group birdies: over/under 8.5"
- "Who has the lowest front 9?" — multi-outcome (pick a player)
- "Most pars on the back 9?" — multi-outcome
- "Jeff goes bogey-free for 3 consecutive holes" — streak

**Characteristics:**
- Created pre-round or early in round
- Lock before relevant holes are played
- Auto-resolve from hole_scores data where possible
- Can have 2 outcomes (yes/no) or multi-outcome (pick a player)
- Stakes vary ($2-$25)

### 3. Head-to-Head Props

Direct matchup bets between two players or two groups.

**Examples:**
- "Dave vs Sarah, straight up gross score"
- "Mike + Jeff vs Dave + Sarah, best ball"
- "Who has more birdies today: Jeff or Stan?"
- "Dave's front 9 vs Sarah's back 9"

**Characteristics:**
- Always 2 outcomes
- Auto-resolvable from scores
- Natural extension of existing H2H leaderboard feature

### 4. Season / Long-Running Props

Props that span multiple rounds or a time period. Keep the group engaged between rounds.

**Examples:**
- "Best handicap improvement by end of May"
- "First person to break 75 this year"
- "Jeff plays more rounds than Dave in April" — over/under
- "Who wins the most skins across the next 5 rounds?"
- "Will our group average drop below 85 by summer?"
- "Stan will switch to a new driver before June"

**Characteristics:**
- Created anytime, resolve on a specific date or condition
- Mix of auto-resolvable (scores) and manual (behavioral)
- Higher stakes acceptable ($10-$50)
- Need reminders/notifications as resolution approaches
- Visible on Home screen between rounds

---

## Wagering Models

### Model A: "I Bet You" (Direct Challenge)

One person challenges another (or the group). Specific counterparty.

> **Dave:** "$5 says Jeff three-putts this green"
> **Jeff:** "You're on"

- Creator names the prop and the stake
- One or more people accept ("take the bet")
- If Jeff three-putts: Jeff pays Dave $5. If not: Dave pays Jeff $5.
- Each acceptor is a separate $5 bet against the creator

**Best for:** Quick props, trash talk bets, behavioral props

### Model B: "Pool" (Polymarket-style)

Everyone picks an outcome and wagers. Winners split the losers' money proportionally.

> **Prop:** "Will Mike break 80?"
> - Dave bets $10 on Yes
> - Sarah bets $5 on No
> - Jeff bets $10 on No
> - Stan bets $5 on Yes
>
> Yes pool: $15 | No pool: $15 | Implied odds: 50/50
>
> Mike shoots 78 (Yes wins).
> Dave wagered $10 of the $15 Yes pool (67%) — gets 67% of the $15 No pool = $10
> Stan wagered $5 of the $15 Yes pool (33%) — gets 33% of the $15 No pool = $5

- Creator posts the prop
- Anyone in the group picks a side and wagers any amount
- Odds shift as money comes in (displayed as probability bar)
- Winners split losers' pool proportional to their wager size

**Best for:** Pre-round props, skill props, season props, anything with genuine uncertainty

### Model C: "Fixed Bet" (Everyone In)

Fixed amount per person, winner take all or split.

> **Prop:** "Longest drive on #14 — $5 each"
> All 4 players are in for $5. Winner takes $20 (or top 2 split).

- Creator sets the amount per person
- All participants are in for the same amount
- Single winner (or split if tied)

**Best for:** Multi-outcome props, "who will..." questions, tournament-style

### Default Recommendation

**Quick Props default to Model A** (direct challenge — fastest, most natural)
**Skill/Season Props default to Model B** (pool — most engaging, odds are fun)
**Multi-outcome Props default to Model C** (fixed per person)

Users can switch models when creating if they want.

---

## Scenarios

### Scenario 1: The Quick Trash Talk Bet

**Context:** Walking up to the 7th tee, Stan is lining up his drive over water.

1. Dave opens Scorecard → Game tab → taps "Quick Prop"
2. Types: "Stan hits the water" (or picks from recent/suggested props)
3. Sets stake: $3
4. Prop appears as a card in the group feed: **"$3 — Stan hits the water" by Dave**
5. Jeff taps "I'll take that" (accepts — he's betting Stan clears it)
6. Stan hits it in the water
7. Dave taps "Resolve → Yes" on the prop card
8. Jeff owes Dave $3 — appears in settlements

**Time from idea to created prop: ~5 seconds**

### Scenario 2: Pre-Round Over/Under

**Context:** Group chat before Saturday's round. Mike has been playing well.

1. Sarah opens app → Props tab → "New Prop"
2. Picks template: "Over/Under on player's score"
3. Selects Mike, sets line at 82.5
4. Prop goes live: **"Mike's gross score: Over/Under 82.5"**
5. Dave puts $10 on Under (he thinks Mike will shoot well)
6. Jeff puts $15 on Over
7. Stan puts $5 on Under
8. Odds bar shows: Under 60% ($15) | Over 40% ($15) — wait, that's even. Under 50% | Over 50%.
   Actually: Under pool = $15, Over pool = $15. Even money.
9. **Locks at first tee time** (no more bets)
10. Mike shoots 79 → Under wins → auto-resolved
11. Dave gets $10 of $15 Over pool = $10. Stan gets $5 of $15 = $5.
12. Settlements added to SettleUp

### Scenario 3: The Behavioral Bet

**Context:** Jeff always says something dramatic after birdies.

1. Stan creates: "$5 — Jeff says 'Let's go!' on his next birdie"
2. Dave and Mike both take the bet (betting Jeff WON'T say it)
3. Hole 11: Jeff drains a 15-footer for birdie, screams "LET'S GOOO!"
4. Stan resolves: Yes
5. Dave owes Stan $5, Mike owes Stan $5
6. Jeff (the subject) isn't even in the bet — he's just the entertainment

**Edge case:** What if Jeff never birdies? Prop voided (no birdie = no resolution event). Or the group can set a deadline: "by end of round."

### Scenario 4: Season Long Shot

**Context:** Start of April, Dave claims he'll improve his handicap dramatically.

1. Mike creates: "Dave's handicap drops below 12 by May 31" (currently 14.2)
2. Pool style: anyone can bet Yes or No
3. Jeff: $20 on No (skeptic)
4. Dave: $25 on Yes (believes in himself — has skin in the game)
5. Stan: $10 on Yes (supportive)
6. Sarah: $10 on No
7. Over the weeks, the prop shows on everyone's Home screen with current odds
8. As Dave plays well, more people might want to bet Yes — but the pool is closed after 1 week (or stays open, configurable)
9. May 31: app checks Dave's handicap → resolves automatically

### Scenario 5: The Disputed Resolution

**Context:** Dave created "$5 Jeff blames his putter within 3 holes." Jeff mutters something that MIGHT have been about his putter.

1. Dave taps "Resolve → Yes"
2. Jeff gets a notification: "Dave resolved 'Jeff blames his putter' as Yes. Agree?"
3. Jeff disputes: "I said 'nice putt' not 'bad putter'"
4. Prop goes to group vote: all participants see the dispute
5. Majority rules (or creator wins ties — house rules configurable)

### Scenario 6: The Parlay / Multi-Prop

**Context:** Dave is feeling bold.

1. Dave browses active props and sees 3 he likes:
   - Mike breaks 80 (Yes)
   - Jeff birdies at least 2 holes (Yes)
   - Stan beats Dave H2H (No — Dave backing himself)
2. Dave creates a "Parlay" linking all 3 at $5
3. If all 3 hit: Dave wins (payout is multiplied — details TBD)
4. If any miss: Dave loses $5

**Note:** Parlays are a v2 feature. Include in the model but don't build first.

### Scenario 7: Quick Props Flying During a Round

**Context:** Active round, group is loose and having fun on the back 9.

- Hole 10: "$2 Dave hits the fairway" (Jeff creates, Stan takes it)
- Hole 11: "$5 longest drive — everyone in for $5" (4-way, fixed bet)
- Hole 12: "$3 Jeff makes this 8-footer" (Dave creates, auto-resolves from score if birdie putt)
- Hole 13: "$5 nobody bogeys" (group prop, auto-resolve)
- Hole 14: "$10 Stan uses his 3-wood instead of driver" (behavioral, Stan resolves)
- Hole 15: nothing — group is focused
- Hole 16: "$5 Jeff mentions his back hurting" (personality prop)
- Hole 17: "$20 closest to the pin — everyone in" (already a junk, but as a fixed bet)
- Hole 18: "$10 best net score on 18 — pick a player" (multi-outcome)

By end of round: 8 quick props, ~$50 in action, all settled in SettleUp alongside the main game.

---

## Resolution Rules

### Auto-Resolution (from score data)
| Condition | Data Source |
|-----------|------------|
| Player's gross/net score vs threshold | Sum of `hole_scores` |
| Player A beats Player B | Compare gross/net totals |
| Birdie/eagle/par on specific hole | `hole_scores.gross_score` vs `holes.par` |
| Number of birdies/bogeys in round | Count across all `hole_scores` |
| Front 9 vs Back 9 comparison | Sum by hole range |
| Handicap change | `players.handicap_index` delta |
| Rounds played in period | Count of `rounds` by date |

### Manual Resolution
- **Creator resolves** — default for quick/behavioral props
- **Subject confirms** — optional for "will [person] do X" props
- **Dispute flow** — if the subject disagrees, goes to group vote
- **Group vote** — majority of participants decides (ties go to creator)
- **Time limit** — unresolved props auto-void after 24 hours (configurable)

### Lock Timing
| Prop Type | Locks When |
|-----------|-----------|
| Quick prop (in-round) | Immediately upon creation (no lock delay — the moment IS the bet) |
| Pre-round skill prop | First tee time / round start |
| Season prop | Configurable (1 day, 1 week, or stays open until resolution) |
| Head-to-head | Round start |

---

## Settlement Integration

Props settle into the existing infrastructure:

```
settlements table:
  source: 'game' | 'junk' | 'side_bet' | 'prop'  ← new source type
```

- All prop settlements tagged with `source: 'prop'`
- Appear in SettleUp grouped under "Props" section
- Flow into Ledger for lifetime tracking
- Net against other settlements between same player pairs

---

## Feed / Social Layer

Props are inherently social. The app should lean into this:

- **Prop feed** — chronological list of all group props (created, accepted, resolved)
- **Notifications** — "Dave just bet $10 you won't break 80" / "Jeff accepted your prop"
- **Reactions** — other group members can react to props (fire emoji, laugh, etc.) without wagering
- **Streak tracking** — "Dave is 5-2 on props this month" / "Jeff has lost 4 in a row"
- **Leaderboard** — prop betting P&L alongside game P&L

---

## Templates / Quick Create

To make creation fast (especially for quick props mid-round), offer templates:

**Pre-built templates:**
- "[Player] hits the water/sand/OB"
- "[Player] three-putts"
- "[Player] birdies this hole"
- "[Player] says [phrase]"
- "Nobody bogeys this hole"
- "[Player] makes this putt"
- "Longest drive — everyone in"
- "Closest to pin — everyone in"
- "[Player A] beats [Player B] on this hole"
- "[Player] breaks [score]"
- "Over/under [player] shoots [number]"

**Smart suggestions** based on context:
- On a par 3: suggest "Closest to pin" and "Anyone hit the green?"
- Player just bogeyed: suggest "[Player] bogeys again"
- On water hole: suggest "[Player] hits the water"
- Back 9 start: suggest "Back 9 leader different from front 9?"

---

## UI Placement

| Location | What Shows |
|----------|-----------|
| **Home screen** | "Props" card — active count, next to resolve, your P&L |
| **Scorecard → Game tab** | Quick prop button + active props for current hole |
| **Dedicated Props screen** | Full feed, create, browse, season props, stats |
| **SettleUp** | Prop settlements alongside game/junk/side_bet |
| **Ledger** | Lifetime prop P&L |
| **Notifications** | Prop created, accepted, resolved, disputed |

---

## Data Model

### `prop_bets` table
| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUID |
| round_id | text nullable FK | Null for season/standalone props |
| creator_id | text FK → players | Who created the prop |
| user_id | uuid FK → auth.users | RLS owner |
| title | text | "Stan hits the water" |
| description | text nullable | Extra details/rules |
| category | text | `quick` / `skill` / `h2h` / `season` |
| wager_model | text | `challenge` / `pool` / `fixed` |
| stake_cents | int | For challenge/fixed: amount per person |
| outcomes | jsonb | `[{ id, label }]` — e.g. `[{id:'y', label:'Yes'}, {id:'n', label:'No'}]` |
| resolve_type | text | `auto` / `manual` |
| auto_resolve_config | jsonb nullable | `{ type, playerId, threshold, metric, holeNumber }` |
| target_player_id | text nullable FK | The person the prop is "about" (Jeff in "Jeff hits OB") |
| status | text | `open` / `locked` / `resolved` / `voided` / `disputed` |
| winning_outcome_id | text nullable | Which outcome won |
| locks_at | timestamptz nullable | When betting closes |
| resolved_at | timestamptz nullable | |
| created_at | timestamptz | |
| hole_number | int nullable | Relevant hole for quick props |

### `prop_wagers` table
| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUID |
| prop_bet_id | text FK → prop_bets | |
| player_id | text FK → players | Who placed the wager |
| user_id | uuid FK → auth.users | RLS owner |
| outcome_id | text | Which outcome they're betting on |
| amount_cents | int | How much they wagered |
| created_at | timestamptz | |

### `prop_reactions` table (v2)
| Column | Type | Description |
|--------|------|-------------|
| id | text PK | |
| prop_bet_id | text FK | |
| player_id | text FK | |
| emoji | text | fire / laugh / skull / etc. |

---

## Payout Calculations

### Challenge Model ("I bet you")
```
Creator bets $5 on outcome A.
Each acceptor bets $5 on outcome B (against creator).

If A wins: each acceptor pays creator $5
If B wins: creator pays each acceptor $5

Creator risk = $5 × number of acceptors
```

### Pool Model
```
Total Yes pool = sum of Yes wagers
Total No pool = sum of No wagers

Yes wins:
  Each Yes bettor gets: (their_wager / total_yes_pool) × total_no_pool

No wins:
  Each No bettor gets: (their_wager / total_no_pool) × total_yes_pool
```

### Fixed Model ("everyone in for $X")
```
N players each put in $X.
Winner takes N × $X.
If tied: split among tied winners.
```

### Multi-Outcome Pool
```
Same as pool but with 3+ outcomes.
All non-winning outcome pools go to the winning outcome bettors.
```

---

## Edge Cases

| Case | Resolution |
|------|-----------|
| Prop about a player who isn't in the round | Void or manual-only |
| Round abandoned / not completed | Props tied to round are voided; refund all wagers |
| Player leaves mid-round | Their active props stay; score-based props use partial data or void |
| Nobody accepts a challenge prop | Auto-void after round ends |
| Tie on H2H / over-under hits exact number | Push — all wagers returned |
| Creator tries to resolve in their own favor (disputed) | Goes to group vote |
| All bettors on the same side (pool) | No action — prop effectively voided (no losers to pay) |
| Season prop — player leaves the group | Prop stays active; if they're the subject, group votes to void or continue |
| Duplicate props | Allow — different people can create overlapping props |
| Negative pool payout (rounding) | Round to nearest cent; remainder goes to largest winner |

---

## v1 Scope (MVP)

Build the core loop first:

1. **Quick props only** (challenge model, manual resolve)
2. **Pre-round skill props** (pool model, auto-resolve for over/under and H2H)
3. **Props feed** in Scorecard Game tab + dedicated Props screen
4. **Settlement integration** (source: 'prop' in settlements)
5. **Templates** for fast creation (5-6 most common)
6. **Notifications** for created/accepted/resolved

### v1 NOT included:
- Season props (needs date-based resolution engine)
- Parlays
- Reactions / social layer
- Smart suggestions based on hole context
- Prop P&L leaderboard
- Dispute resolution (creator's call is final in v1)

---

## Open Questions

1. **Can the person a prop is "about" bet on themselves?** (Dave creates "Stan hits OB" — can Stan bet No?) Probably yes — it's fun and they have the most info.

2. **Minimum/maximum stakes?** $1 min makes sense. Max could be group-configurable or uncapped for v1.

3. **Can props be edited after creation?** Probably not — creates trust issues. Void and recreate instead.

4. **Private props?** (Only visible to participants vs. whole group) Start with everything visible — the social element is the point.

5. **Should the main game buy-in be a "prop" under the hood?** Probably not — keep them separate. But props should feel as native as the main game.

6. **How does this interact with existing side bets?** Props replace side bets over time. During transition, both coexist. Side bets are essentially "quick props with challenge model" — could migrate the UI.
