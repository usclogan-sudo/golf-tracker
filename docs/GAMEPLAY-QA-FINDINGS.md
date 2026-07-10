# Gameplay QA Sweep — Findings (Launch 5)

Systematic audit of the launch game lineup (Skins, Best Ball, Nassau, Wolf, BBB)
against the Gimme design principles (points-only / zero-$, correct & fair math,
net-zero settlement, legibility, flexible player counts, graceful edge cases).

> **Date:** 2026-07-09 · **Method:** 5 parallel per-game code audits + spot
> verification of the highest-severity findings directly against the code.
> **Verification key:** ✅ = confirmed in code by hand · 🔍 = agent-reported with
> specific line refs (high confidence, not independently re-traced).
>
> **✅ STATUS (2026-07-09):** All 10 games swept. **Launch hardening SHIPPED to main**
> (PR #10, `b822f4a`): extra games hidden (`SHOW_EXTRA_GAMES`), presses gated
> (`SHOW_PRESSES`), Best Ball → Match Play only (`SHOW_BEST_BALL_STROKE_PLAY`), Wolf
> roster-sync fixed, and a net-zero invariant test suite added (234 tests pass).
> **Remaining = post-launch:** the deep settlement-engine rework (netCents-based),
> then re-enable the extra games + presses. NOTE: the "refund drops remainder cents"
> finding was a **false positive** — pot is always `buyIn × N`, so refund divides evenly.

---

## ✅ What's solid (don't lose sight of this)
- **Zero-$ holds up.** No `$` leaks found in ANY of the 5 games — every amount
  routes through `fmtAmount` → `"N pts"`. The recent zero-$ refactor is clean
  across gameplay. `$` appears only in outbound payment-link URLs.
- **Base scoring math is correct** for the simple path: Skins hole-by-hole
  carry/tie logic, Best Ball net + team best-ball, Wolf rotation, BBB tally.
- **Wolf rotation** is correct for 3/4/5/6 players; net *units* sum to zero every hole.
- **No-press settlements net to zero** correctly (the common case).
- **Incomplete rounds / missing scores** generally don't crash — holes are skipped.

---

## 🔴 High severity — settlement fairness & scoring correctness

### 1. Presses over-distribute; the treasurer eats the shortfall ✅ (Skins + Nassau)
The settlement model is flat: every player owes the treasurer one buy-in, and the
treasurer pays each winner their payout (`buildUnifiedSettlements`, gameLogic.ts:1476).
But **presses add a full extra pot of winnings with no extra buy-in collected**:
- Skins: `totalPot = basePot * (1 + presses.length)` (gameLogic.ts:1254)
- Nassau: each press adds `pressPot = buyIn*N/3` to winners (gameLogic.ts:397-427)

So `sum(payouts) > collected pot` → the treasurer pays out money nobody put in and
is personally short. **Presses are NOT behind a feature flag, so this is live in two
launch games.** Losers also underpay (they only owe a flat buy-in, not their real
press losses).

### 2. Best Ball "Stroke Play" winner is invisible / contradicted 🔍
`calculateBestBall` decides the Stroke-Play winner by total strokes (gameLogic.ts:269),
but **every** display (`BestBallStatus`, LeaderboardTab, SettleUp) shows only
holes-won. So the scoreboard can read "Team A +3" while Team B collects the money.
The Match/Stroke toggle (NewRound.tsx:1420) is cosmetic for the scoreboard.

### 3. Nassau is scored by total strokes, not match play ✅ (design decision)
`nassauSegment` sums each player's strokes over a segment and awards it to the lowest
*total* (gameLogic.ts:305-327) — that's stroke play, not match play (most holes won
head-to-head). Defensible as a multiplayer variant, but it deviates from how Nassau is
traditionally played and can flip winners (one blow-up hole swings stroke-sum but not
match play). **Confirm intent**; if kept, document it in the how-it-works copy.

### 4. Near-zero test coverage is the root cause 🔍
**Nassau, Wolf, Best Ball, and BBB have ZERO unit tests.** Only Skins has some, and
even those don't assert the core invariant (`sum(settlements) === 0` and `=== collected
pot`). A single net-zero invariant test per game would have caught issues 1, 5, 6.

---

## 🟡 Medium — magnitude flattening & edge-case leaks

### 5. Variable stakes are flattened at settlement 🔍 (Wolf, Nassau)
The flat-pot model splits a fixed pot by winner share and debits each loser one flat
buy-in — ignoring *how much* they lost. Wolf: a −7 net pays the same as −1, and the
lone-wolf 2× never actually doubles anyone's wallet exposure (gameLogic.ts:549-579).
Net-zero holds, but the "higher stakes" the UI advertises never reaches the money, and
the in-round unit panel won't match the actual pt transfers.

### 6. Refund/tie branches drop remainder cents 🔍
- **BBB** no-points refund does `floor(pot/N)` with no remainder drip (gameLogic.ts:621-627)
  → orphaned cent(s), not net-zero (e.g. pot 1000 / 3 → 1 cent stuck with treasurer).
- **Best Ball** tie/refund similarly drops the remainder (gameLogic.ts:1281-1288); low
  severity since even player counts → even pots, but inconsistent with the winner path.

### 7. Skins "all-square / zero-skins" round doesn't refund 🔍 (verify)
When no skins are won (all holes tied, or incomplete), `calculateSkinsPayouts` returns
`[]`, so no settlement is generated — the UI says "Pot refunded" (Scorecard.tsx:1214)
but the treasurer keeps everyone's buy-in. **Verify** and add a real refund settlement.

### 8. Wolf roster desync 🔍
`wolfOrder` is seeded once from the initial roster (NewRound.tsx:917) with no reconcile.
Editing the roster after → stale order: a removed player becomes a ghost wolf (voids
their holes for everyone), a newly-added player never becomes wolf.

---

## 🔵 Low — UX / legibility polish
- **Skins "per hole" value shows the whole pot** (~18× overstatement) — `SkinsStatus`
  uses the full pot as the per-hole value (Scorecard.tsx:160, 1903).
- **BBB entry has no guardrails** — any category tappable anytime (Bango before all-on-green),
  no "2 of 3 recorded" per-hole indicator; error-prone for a fiddly 3-per-hole task.
- **Wolf in-round status** shows bare numbers ("Name +3") with no pts/units label.
- **Best Ball / Vegas team assignment in EventSetup** is auto index-alternation with no
  picker (NewRound has a tap-to-assign UI; EventSetup doesn't), and the EventSetup gate
  `% 2 !== 0` doesn't block a 0-player selection.

---

## Recommended path (proposed)

Settlement is Gimme's core promise, so correctness here matters most. Pragmatic launch
sequencing (mirrors the existing SHOW_HOLE_BETS / SHOW_PROP_BETS flag pattern):

1. **Launch-blockers to neutralize now (small, safe):**
   - **Gate presses behind a feature flag** (like hole/prop bets) until the funding fix
     lands — removes the worst bug from both Skins & Nassau. *Or* fix funding properly.
   - **Hide the Best Ball Stroke-Play toggle** (default to Match Play) until the display
     is fixed — avoids the scoreboard/money contradiction.
2. **Add a net-zero invariant test suite** across all games (the safety net).
3. **Fix the leaks:** BBB/Best Ball refund remainder drip; Skins zero-skins refund; Wolf
   roster resync.
4. **Post-launch (deeper):** rework settlement to model per-player variable exposure
   (proper presses, lone-wolf 2×, Nassau segments), then re-enable presses.
5. **Confirm Nassau stroke-sum vs match-play intent** and document.

---

# Part 2 — More Games (Hammer, Stableford, Dots, Banker, Quota)

## 🔴 High severity
- **Hammer — treasurer-wins debt vanishes** ✅ — `buildUnifiedSettlements` skips the payout when the winner IS the treasurer (line 1477). In 2-player Hammer that's a coin-flip, so half the time the loser is never debited → round under-settles (gameLogic.ts:754, 1476).
- **Dots — UNPLAYABLE at launch** ✅ — Dots is selectable in the picker with no gating, but the only dot-entry UI is behind `SHOW_HOLE_BETS = false` (Scorecard.tsx:2139). You can create a Dots round but can't award a single dot → always settles all-zero.
- **Dots — buy-in-less, losers never debited** — same treasurer-model flaw as Hammer (buyInCents:0, so no pot funds the winner payouts) (gameLogic.ts:1022, 1476).
- **Banker — asymmetric exposure collapsed to flat pot-share** ✅ — `calculateBankerPayouts` discards signed `netCents` and splits a flat pot among positive-net players only; losers aren't proportionally debited (gameLogic.ts:1110).
- **Banker — in-round leaderboard and SettleUp use DIFFERENT settlement models** — LeaderboardTab settles from correct zero-sum `netCents`; SettleUp uses the flat pot. Standings mid-round ≠ debts at settle-up (LeaderboardTab.tsx:104 vs SettleUp.tsx:410).
- **Quota — handicap double-applied** ✅ — quota = `36 − handicap` AND scoring runs net mode (strokes subtracted per hole), so handicap counts twice → unfair to higher handicaps (NewRound.tsx:1098 + gameLogic.ts:1156). Also uses raw index, not course handicap.

## 🟡 Medium
- **Refund-remainder leak (Stableford, Quota, + BBB, Best Ball from Part 1)** — every game's "no winner / all-tied" refund does `floor(pot/N)` with no remainder drip → cents vanish, group nets negative on uneven pots.
- **Stableford** — zero-point players silently forfeit their whole buy-in with no line item; incomplete rounds pay out pot-share on partial points with no completion gate.
- **Banker roster desync** — `bankerOrder` seeded once, not reconciled on roster edit (same as Wolf).
- **Quota** — clamps quota to [0,36], distorting plus/scratch and high handicaps.

## 🔵 Low
- Dots: two disconnected value configs; Stableford: no net/gross toggle in UI (hardcoded net); Quota: no in-round quota/points display; tooltip point tables inconsistent.

## ✅ Solid (Part 2)
- **No `$` leaks in any of the 10 games** — zero-$ refactor fully holds.
- Hammer core ledger, Banker head-to-head math, Dots dot math, Stableford points table + net handicap, Quota winner-branch payout — all internally correct & zero-sum at the `calculate*` level. The failures are almost entirely in the **settlement-translation layer**, not the scoring.

---

# ROOT CAUSE (all 10 games)

There are effectively **two settlement engines**, and the wrong one is used at payout time:
1. **Correct:** a signed zero-sum `netCents` ledger (used by `LeaderboardTab` for unit games, and by `calculateSideBetSettlements` via debtor→creditor pairing).
2. **Flat treasurer-pot model** (`calculateXPayouts` winner-only + `buildUnifiedSettlements` treasurer→winner) — used by **SettleUp**, the money that actually gets recorded.

The flat-pot model is correct ONLY for a simple equal-buy-in, winner-takes-pot game. It breaks for everything else:
- **Doubling stakes** (Skins/Nassau presses, Hammer throws) → over-distributes; treasurer covers the shortfall.
- **Buy-in-less games** (Hammer, Dots) → no pot funds the winners; losers never debited.
- **Treasurer wins head-to-head** (Hammer) → debt vanishes.
- **Asymmetric/variable exposure** (Banker, Wolf) → flattened & mis-attributed; `−7` pays the same as `−1`.
- **In-round vs final** → LeaderboardTab (correct) diverges from SettleUp (flat) for unit games.

**The real fix** is to settle unit/net-based games directly from their signed `netCents` (debtor→creditor, like side bets), reserving the pot model for true equal-buy-in pot games. That's an architectural change → post-launch.

Plus two universal, cheap fixes: (a) add a **remainder drip** to every refund branch; (b) add a **net-zero invariant test suite** (currently 9 of 10 games have zero tests).

---

# Launch recommendation
Ship a **smaller, correct lineup** rather than a big, broken one:
1. **Launch the marketed 5 only** (Skins, Best Ball, Nassau, Wolf, BBB); **hide the "More Games"** (Hammer, Stableford, Dots, Banker, Quota) behind a flag until the settlement rework + per-game fixes land. (Dots is unplayable anyway; Hammer/Banker/Quota have real math bugs.)
2. Make the 5 correct: **gate presses** behind a flag (fixes Skins+Nassau over-distribution), **default Best Ball to Match Play** (fixes the stroke-play display contradiction), **fix Wolf roster desync**, **fix BBB refund remainder**. Wolf magnitude-flattening → document as a known limitation or do the netCents fix.
3. Add the **net-zero test suite**.
4. **Post-launch:** the settlement-engine rework (netCents-based), then re-enable the extra games + presses.
