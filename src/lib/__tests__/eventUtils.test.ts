import { autoAssignGroups, validateGroups, MAX_PER_GROUP } from '../eventUtils'

// ─── autoAssignGroups ───────────────────────────────────────────────────────

describe('autoAssignGroups', () => {
  it('assigns all players to group 1 when count <= MAX_PER_GROUP', () => {
    const ids = ['p1', 'p2', 'p3']
    const groups = autoAssignGroups(ids)
    expect(Object.values(groups).every(g => g === 1)).toBe(true)
  })

  it('single player goes to group 1', () => {
    const groups = autoAssignGroups(['p1'])
    expect(groups.p1).toBe(1)
  })

  it('empty array returns empty object', () => {
    expect(autoAssignGroups([])).toEqual({})
  })

  it('5 players (exactly MAX_PER_GROUP) all in group 1', () => {
    const ids = Array.from({ length: 5 }, (_, i) => `p${i + 1}`)
    const groups = autoAssignGroups(ids)
    expect(Object.values(groups).every(g => g === 1)).toBe(true)
  })

  it('6 players splits into 2 groups via round-robin', () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const groups = autoAssignGroups(ids)
    // 6 / 5 = ceil → 2 groups
    // p1→1, p2→2, p3→1, p4→2, p5→1, p6→2
    expect(groups.p1).toBe(1)
    expect(groups.p2).toBe(2)
    expect(groups.p3).toBe(1)
    expect(groups.p4).toBe(2)
    expect(groups.p5).toBe(1)
    expect(groups.p6).toBe(2)
  })

  it('10 players splits into 2 groups (5 each)', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i + 1}`)
    const groups = autoAssignGroups(ids)
    const g1 = Object.entries(groups).filter(([, g]) => g === 1)
    const g2 = Object.entries(groups).filter(([, g]) => g === 2)
    expect(g1).toHaveLength(5)
    expect(g2).toHaveLength(5)
  })

  it('11 players splits into 3 groups', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `p${i + 1}`)
    const groups = autoAssignGroups(ids)
    // ceil(11/5) = 3 groups, round-robin: 4+4+3
    const groupNums = new Set(Object.values(groups))
    expect(groupNums.size).toBe(3)
  })

  it('20 players in 4 groups of 5', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `p${i + 1}`)
    const groups = autoAssignGroups(ids)
    const groupNums = new Set(Object.values(groups))
    expect(groupNums.size).toBe(4)
    for (let g = 1; g <= 4; g++) {
      const count = Object.values(groups).filter(v => v === g).length
      expect(count).toBe(5)
    }
  })

  it('no group exceeds maxPerGroup', () => {
    for (let n = 1; n <= 25; n++) {
      const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`)
      const groups = autoAssignGroups(ids)
      const counts = new Map<number, number>()
      for (const g of Object.values(groups)) {
        counts.set(g, (counts.get(g) ?? 0) + 1)
      }
      for (const [, count] of counts) {
        expect(count).toBeLessThanOrEqual(MAX_PER_GROUP)
      }
    }
  })

  it('respects custom maxPerGroup', () => {
    const ids = ['p1', 'p2', 'p3', 'p4']
    const groups = autoAssignGroups(ids, 2)
    // 4/2 = 2 groups
    const groupNums = new Set(Object.values(groups))
    expect(groupNums.size).toBe(2)
  })

  it('every player is assigned exactly once', () => {
    const ids = Array.from({ length: 13 }, (_, i) => `p${i + 1}`)
    const groups = autoAssignGroups(ids)
    expect(Object.keys(groups).sort()).toEqual(ids.sort())
  })
})

// ─── validateGroups ─────────────────────────────────────────────────────────

describe('validateGroups', () => {
  it('valid when no group exceeds max', () => {
    const groups = { p1: 1, p2: 1, p3: 2, p4: 2 }
    const result = validateGroups(groups)
    expect(result.valid).toBe(true)
    expect(result.oversizedGroups).toEqual([])
  })

  it('invalid when a group exceeds max', () => {
    const groups: Record<string, number> = {}
    // 6 players in group 1
    for (let i = 1; i <= 6; i++) groups[`p${i}`] = 1
    const result = validateGroups(groups)
    expect(result.valid).toBe(false)
    expect(result.oversizedGroups).toContain(1)
  })

  it('identifies which groups are oversized', () => {
    const groups: Record<string, number> = {}
    for (let i = 1; i <= 6; i++) groups[`p${i}`] = 1
    for (let i = 7; i <= 12; i++) groups[`p${i}`] = 2
    groups.p13 = 3 // group 3 has 1 — fine
    const result = validateGroups(groups)
    expect(result.oversizedGroups.sort()).toEqual([1, 2])
  })

  it('empty groups is valid', () => {
    const result = validateGroups({})
    expect(result.valid).toBe(true)
  })

  it('respects custom maxPerGroup', () => {
    const groups = { p1: 1, p2: 1, p3: 1 }
    expect(validateGroups(groups, 2).valid).toBe(false)
    expect(validateGroups(groups, 3).valid).toBe(true)
  })

  it('autoAssignGroups output always passes validation', () => {
    for (let n = 1; n <= 25; n++) {
      const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`)
      const groups = autoAssignGroups(ids)
      const result = validateGroups(groups)
      expect(result.valid).toBe(true)
    }
  })
})
