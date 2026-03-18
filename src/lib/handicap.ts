/**
 * WHS (World Handicap System) handicap index calculation.
 * Pure math — no Supabase dependency.
 */

/** Score differential = (113 / slope) × (adjustedGross − courseRating), rounded to 1 decimal */
export function calcScoreDifferential(
  adjustedGross: number,
  courseRating: number,
  slopeRating: number,
): number {
  return Math.round(((113 / slopeRating) * (adjustedGross - courseRating)) * 10) / 10
}

/**
 * WHS lookup table: given total rounds available (3–20),
 * returns { use: number of lowest differentials to average, adjustment: number to subtract }
 */
function whsLookup(count: number): { use: number; adjustment: number } | null {
  if (count < 3) return null
  if (count === 3) return { use: 1, adjustment: -2.0 }
  if (count === 4) return { use: 1, adjustment: -1.0 }
  if (count === 5) return { use: 1, adjustment: 0 }
  if (count === 6) return { use: 2, adjustment: -1.0 }
  if (count <= 8) return { use: 2, adjustment: 0 }
  if (count <= 11) return { use: 3, adjustment: 0 }
  if (count <= 14) return { use: 4, adjustment: 0 }
  if (count <= 16) return { use: 5, adjustment: 0 }
  if (count <= 18) return { use: 6, adjustment: 0 }
  if (count === 19) return { use: 7, adjustment: 0 }
  // 20+
  return { use: 8, adjustment: 0 }
}

/**
 * Calculate WHS handicap index from an array of score differentials.
 * Uses most recent 20 differentials (caller should pass them in date-descending order).
 * Returns null if fewer than 3 rounds.
 *
 * Also returns which differential indices (within the recent-20 slice) were used.
 */
export function calcHandicapIndex(
  differentials: number[],
): { index: number; usedIndices: number[] } | null {
  // Use at most the 20 most recent
  const recent = differentials.slice(0, 20)
  const lookup = whsLookup(recent.length)
  if (!lookup) return null

  // Sort ascending to find lowest N
  const sorted = recent
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d - b.d)

  const lowest = sorted.slice(0, lookup.use)
  const avg = lowest.reduce((sum, x) => sum + x.d, 0) / lookup.use
  const index = Math.round((avg + lookup.adjustment) * 10) / 10

  return {
    index,
    usedIndices: lowest.map(x => x.i),
  }
}
