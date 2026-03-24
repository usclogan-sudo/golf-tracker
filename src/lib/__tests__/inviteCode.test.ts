import { generateInviteCode } from '../inviteCode'

describe('generateInviteCode', () => {
  it('returns a 6-character string', () => {
    expect(generateInviteCode()).toHaveLength(6)
  })

  it('only contains allowed characters (ABCDEFGHJKLMNPQRSTUVWXYZ23456789)', () => {
    const allowed = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode()
      for (const ch of code) {
        expect(allowed.has(ch)).toBe(true)
      }
    }
  })

  it('never contains ambiguous characters: 0, O, 1, I', () => {
    const forbidden = new Set(['0', 'O', '1', 'I'])
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode()
      for (const ch of code) {
        expect(forbidden.has(ch)).toBe(false)
      }
    }
  })

  it('produces different codes across 100 calls', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode())
    }
    // With 30^6 (~729M) possible codes, 100 calls should virtually never collide
    expect(codes.size).toBeGreaterThan(90)
  })

  it('returns uppercase only', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode()
      expect(code).toBe(code.toUpperCase())
    }
  })
})
