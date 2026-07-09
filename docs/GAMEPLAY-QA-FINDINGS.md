# Gameplay QA Sweep — Findings (Launch 5)

Systematic audit of the launch game lineup (Skins, Best Ball, Nassau, Wolf, BBB)
against the Gimme design principles (points-only / zero-$, correct & fair math,
net-zero settlement, legibility, flexible player counts, graceful edge cases).

> **Date:** 2026-07-09 · **Method:** 5 parallel per-game code audits + spot
> verification of the highest-severity findings directly against the code.
> **Verification key:** ✅ = confirmed in code by hand · 🔍 = agent-reported with
> specific line refs (high confidence, not independently re-traced).
>
> **Not yet swept:** Hammer, Stableford, Dots, Banker, Quota (the "More Games").

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

Then continue the sweep across Hammer, Stableford, Dots, Banker, Quota.
