import { calcScoreDifferential, calcHandicapIndex } from '../handicap'

// ─── calcScoreDifferential ──────────────────────────────────────────────────

describe('calcScoreDifferential', () => {
  it('computes WHS formula: (113 / slope) × (gross − rating), rounded to 1 decimal', () => {
    // (113 / 130) × (90 − 72.1) = 0.86923… × 17.9 = 15.5592… → 15.6
    expect(calcScoreDifferential(90, 72.1, 130)).toBe(15.6)
  })

  it('returns 0.0 when adjusted gross equals the course rating', () => {
    expect(calcScoreDifferential(72, 72, 113)).toBe(0)
  })

  it('returns a negative differential for a score below rating', () => {
    // (113 / 113) × (68 − 72) = -4.0
    expect(calcScoreDifferential(68, 72, 113)).toBe(-4.0)
  })

  it('handles steep slope correctly', () => {
    // (113 / 155) × (95 − 74.5) = 0.72903… × 20.5 = 14.9451… → 14.9
    expect(calcScoreDifferential(95, 74.5, 155)).toBe(14.9)
  })
})

// ─── calcHandicapIndex ──────────────────────────────────────────────────────

describe('calcHandicapIndex', () => {
  it('returns null with fewer than 3 rounds', () => {
    expect(calcHandicapIndex([])).toBeNull()
    expect(calcHandicapIndex([10.5])).toBeNull()
    expect(calcHandicapIndex([10.5, 12.3])).toBeNull()
  })

  it('with 3 rounds: uses 1 lowest, adjustment −2.0', () => {
    const diffs = [15.0, 10.0, 12.0]
    const result = calcHandicapIndex(diffs)!
    // Lowest = 10.0, avg = 10.0, adjustment = −2.0 → 8.0
    expect(result.index).toBe(8.0)
    expect(result.usedIndices).toEqual([1]) // index of 10.0 in original array
  })

  it('with 6 rounds: uses 2 lowest, adjustment −1.0', () => {
    const diffs = [18.0, 14.0, 20.0, 12.0, 16.0, 10.0]
    const result = calcHandicapIndex(diffs)!
    // Lowest 2: 10.0 (idx 5), 12.0 (idx 3) → avg = 11.0, −1.0 → 10.0
    expect(result.index).toBe(10.0)
    expect(result.usedIndices.sort((a, b) => a - b)).toEqual([3, 5])
  })

  it('with 12 rounds: uses 4 lowest, no adjustment', () => {
    const diffs = [20, 18, 16, 14, 12, 10, 22, 24, 26, 28, 30, 8]
    const result = calcHandicapIndex(diffs)!
    // 12 rounds → whsLookup: use 4 lowest (count <= 14), adjustment 0
    // Lowest 4: 8 (idx 11), 10 (idx 5), 12 (idx 4), 14 (idx 3) → avg = 11.0
    expect(result.index).toBe(11.0)
    expect(result.usedIndices.sort((a, b) => a - b)).toEqual([3, 4, 5, 11])
  })

  it('with 20 rounds: uses 8 lowest, no adjustment', () => {
    // 20 diffs: 1.0, 2.0, 3.0, …, 20.0
    const diffs = Array.from({ length: 20 }, (_, i) => i + 1)
    const result = calcHandicapIndex(diffs)!
    // Lowest 8: 1–8, avg = 4.5
    expect(result.index).toBe(4.5)
    expect(result.usedIndices.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('only uses most recent 20 even if more are provided', () => {
    // 25 diffs: first 5 are very low (0.0) but should be ignored beyond 20
    const diffs = [0.0, 0.0, 0.0, 0.0, 0.0, ...Array.from({ length: 20 }, (_, i) => 10 + i)]
    const result = calcHandicapIndex(diffs)!
    // slice(0,20) takes indices 0–19: [0,0,0,0,0,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]
    // Lowest 8: five 0s + 10, 11, 12 → avg = (0+0+0+0+0+10+11+12)/8 = 33/8 = 4.125 → 4.1
    expect(result.index).toBe(4.1)
  })

  it('rounds to 1 decimal place', () => {
    // 5 rounds: uses 1 lowest, no adjustment
    const diffs = [15.3, 12.7, 18.9, 11.2, 14.6]
    const result = calcHandicapIndex(diffs)!
    // Lowest = 11.2
    expect(result.index).toBe(11.2)
  })
})
