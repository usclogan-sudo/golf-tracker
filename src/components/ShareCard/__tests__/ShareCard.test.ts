import { describe, it, expect } from 'vitest'
import { fmt, hashStr, pickSubline, SUBLINES } from '../ShareCard'

describe('fmt', () => {
  it('formats positive cents as currency without sign by default', () => {
    expect(fmt(2500)).toBe('$25.00')
  })

  it('formats large amounts with thousands separators', () => {
    expect(fmt(123456789)).toBe('$1,234,567.89')
  })

  it('formats zero', () => {
    expect(fmt(0)).toBe('$0.00')
  })

  it('omits sign for negative cents when withSign is false', () => {
    // Absolute value, no sign — used in settlement rows where context provides direction.
    expect(fmt(-2500)).toBe('$25.00')
  })

  it('adds + prefix for positive cents when withSign is true', () => {
    expect(fmt(2500, true)).toBe('+$25.00')
  })

  it('adds − (minus, U+2212) prefix for negative cents when withSign is true', () => {
    // Note: U+2212 minus, not a hyphen — matches typography in the card.
    expect(fmt(-2500, true)).toBe('−$25.00')
    expect(fmt(-2500, true).charCodeAt(0)).toBe(0x2212)
  })

  it('omits sign for zero even when withSign is true', () => {
    expect(fmt(0, true)).toBe('$0.00')
  })

  it('handles fractional cents (rounding)', () => {
    // Intl rounds to 2 decimals by default
    expect(fmt(1)).toBe('$0.01')
  })
})

describe('hashStr', () => {
  it('returns the same hash for the same input', () => {
    expect(hashStr('hello')).toBe(hashStr('hello'))
  })

  it('returns different hashes for different inputs', () => {
    expect(hashStr('hello')).not.toBe(hashStr('helloo'))
  })

  it('returns a non-negative number', () => {
    // Math.abs guard
    expect(hashStr('any string')).toBeGreaterThanOrEqual(0)
    expect(hashStr('aaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 for empty string', () => {
    expect(hashStr('')).toBe(0)
  })

  it('survives long strings (32-bit overflow path)', () => {
    const longString = 'a'.repeat(10000)
    const result = hashStr(longString)
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

describe('pickSubline', () => {
  it('returns the same line for the same (winner, lastPlace, salt) triple', () => {
    const a = pickSubline('Maya', 'Stan', 'PelicanHillJun 15, 2026')
    const b = pickSubline('Maya', 'Stan', 'PelicanHillJun 15, 2026')
    expect(a).toBe(b)
  })

  it('substitutes {winner} when present in the chosen template', () => {
    // Force-pick a winner-templated line by iterating
    const winnerLines = SUBLINES.filter(l => l.includes('{winner}'))
    expect(winnerLines.length).toBeGreaterThan(0)
    // Try a range of salts; at least one will land on a winner-templated line
    const hits: string[] = []
    for (let i = 0; i < 100; i++) {
      hits.push(pickSubline('Connor', 'Stan', `salt-${i}`))
    }
    const containsWinner = hits.some(h => h.includes('Connor'))
    expect(containsWinner).toBe(true)
  })

  it('substitutes {lastPlace} when provided', () => {
    const hits: string[] = []
    for (let i = 0; i < 100; i++) {
      hits.push(pickSubline('Connor', 'Pat', `salt-${i}`))
    }
    const containsLastPlace = hits.some(h => h.includes('Pat'))
    expect(containsLastPlace).toBe(true)
  })

  it('never produces a line that mentions {lastPlace} when lastPlace is null', () => {
    // This is the 2-player-round case
    const hits: string[] = []
    for (let i = 0; i < 200; i++) {
      hits.push(pickSubline('Connor', null, `salt-${i}`))
    }
    const orphanedTemplate = hits.find(h => h.includes('{lastPlace}'))
    expect(orphanedTemplate).toBeUndefined()
    // And no empty 'Lunch is on .' artifacts either
    const emptyArtifact = hits.find(h => h === 'Lunch is on .')
    expect(emptyArtifact).toBeUndefined()
  })

  it('returns a non-empty string for any valid input', () => {
    expect(pickSubline('Maya', 'Stan', 'x')).toBeTruthy()
    expect(pickSubline('Maya', null, 'x')).toBeTruthy()
    expect(pickSubline('', null, '')).toBeTruthy() // still picks a static line
  })
})

describe('SUBLINES library', () => {
  it('has at least 5 entries', () => {
    expect(SUBLINES.length).toBeGreaterThanOrEqual(5)
  })

  it('has at least 3 generic (no-template) lines so 2-player rounds have variety', () => {
    const generic = SUBLINES.filter(l => !l.includes('{winner}') && !l.includes('{lastPlace}'))
    expect(generic.length).toBeGreaterThanOrEqual(3)
  })
})
