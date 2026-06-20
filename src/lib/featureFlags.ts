/**
 * Feature flags for UI surfaces we want to ship dark but keep the code paths
 * intact. Flipping any of these to `true` re-surfaces the UI; the data model,
 * persistence, and downstream settlement logic remain wired either way.
 *
 * Pattern follows the High Roller / Points stakes-mode flag we shipped in
 * commit e853dbb (SHOW_ALT_STAKES_MODES inside NewRound.tsx).
 */

/**
 * Per-hole junks + side bets (sandy, greenie, snake, polecat, custom side bets).
 * When false:
 *   - NewRound game-setup step hides the "Junk Side Bets" section
 *   - Scorecard hides the in-round HoleBetsPanel
 *   - Existing rounds that already have junkConfig/junkRecords still settle
 *     correctly in SettleUp (only the in-round entry surface is hidden)
 */
export const SHOW_HOLE_BETS = false

/**
 * Prop bets (ad-hoc wagers — "anyone birdie 7?", "longest drive on 12").
 * When false:
 *   - Home screen hides the "Props" link on active-round cards
 *   - Scorecard hides the in-round PropBetsPanel + the standalone PropBetsScreen
 *     entry point on the home-screen active round
 *   - Existing prop bets in past rounds still resolve and settle in SettleUp
 */
export const SHOW_PROP_BETS = false
