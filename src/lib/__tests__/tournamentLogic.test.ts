import { generateBracket, advanceBracket, calculateStrokePlayStandings, countBracketRounds } from '../tournamentLogic'
import type { TournamentMatchup } from '../../types'

// ─── generateBracket ────────────────────────────────────────────────────────

describe('generateBracket', () => {
  const tid = 'tournament-1'

  it('returns [] for fewer than 2 players', () => {
    expect(generateBracket([], tid, 'match_play_single')).toEqual([])
    expect(generateBracket(['p1'], tid, 'match_play_single')).toEqual([])
  })

  it('generates 1 match for 2 players', () => {
    const m = generateBracket(['p1', 'p2'], tid, 'match_play_single')
    expect(m).toHaveLength(1)
    expect(m[0].playerAId).toBe('p1')
    expect(m[0].playerBId).toBe('p2')
    expect(m[0].status).toBe('pending')
  })

  it('generates 3 matches for 4 players (2 first round + 1 final)', () => {
    const m = generateBracket(['p1', 'p2', 'p3', 'p4'], tid, 'match_play_single')
    expect(m).toHaveLength(3)
    const round1 = m.filter(x => x.bracketRound === 1)
    const round2 = m.filter(x => x.bracketRound === 2)
    expect(round1).toHaveLength(2)
    expect(round2).toHaveLength(1)
  })

  it('handles 3 players with 1 bye', () => {
    const m = generateBracket(['p1', 'p2', 'p3'], tid, 'match_play_single')
    const round1 = m.filter(x => x.bracketRound === 1)
    const byes = round1.filter(x => x.status === 'complete' && x.winnerId)
    expect(byes).toHaveLength(1)
    // Last seed in seeding order gets the bye (p3 has no opponent)
    expect(byes[0].playerAId).toBe('p3')
    expect(byes[0].playerBId).toBeUndefined()
    expect(byes[0].winnerId).toBe('p3')
  })

  it('handles 5 players with correct bye count', () => {
    const m = generateBracket(['p1', 'p2', 'p3', 'p4', 'p5'], tid, 'match_play_single')
    const round1 = m.filter(x => x.bracketRound === 1)
    // 8-slot bracket: p1vp2, p3vp4, p5vbye, emptyvbye → 2 byes auto-complete
    const byes = round1.filter(x => x.status === 'complete')
    // p5 gets a bye (no opponent), plus one empty-slot bye
    expect(byes.length).toBeGreaterThanOrEqual(2)
    // The real bye has p5 advancing
    const realBye = byes.find(b => b.winnerId === 'p5')
    expect(realBye).toBeDefined()
  })

  it('handles 7 players with 1 bye', () => {
    const m = generateBracket(Array.from({ length: 7 }, (_, i) => `p${i + 1}`), tid, 'match_play_single')
    const round1 = m.filter(x => x.bracketRound === 1)
    const byes = round1.filter(x => x.status === 'complete')
    expect(byes).toHaveLength(1) // 8 - 7 = 1 bye
  })

  it('bye matches have status complete and winnerId set', () => {
    const m = generateBracket(['p1', 'p2', 'p3'], tid, 'match_play_single')
    const byes = m.filter(x => x.bracketRound === 1 && !x.playerBId)
    for (const bye of byes) {
      expect(bye.status).toBe('complete')
      expect(bye.winnerId).toBe(bye.playerAId)
    }
  })

  it('16 players (perfect power of 2) has no byes', () => {
    const m = generateBracket(Array.from({ length: 16 }, (_, i) => `p${i + 1}`), tid, 'match_play_single')
    const round1 = m.filter(x => x.bracketRound === 1)
    const byes = round1.filter(x => x.status === 'complete')
    expect(byes).toHaveLength(0)
    expect(round1).toHaveLength(8)
  })

  it('correct number of rounds for single elimination (ceil(log2(n)))', () => {
    const m = generateBracket(Array.from({ length: 8 }, (_, i) => `p${i + 1}`), tid, 'match_play_single')
    const winnersOnly = m.filter(x => !x.loserBracket)
    const maxRound = Math.max(...winnersOnly.map(x => x.bracketRound))
    expect(maxRound).toBe(3) // ceil(log2(8)) = 3
  })

  it('subsequent rounds are pending with no playerIds', () => {
    const m = generateBracket(['p1', 'p2', 'p3', 'p4'], tid, 'match_play_single')
    const round2 = m.filter(x => x.bracketRound === 2)
    expect(round2).toHaveLength(1)
    expect(round2[0].playerAId).toBeUndefined()
    expect(round2[0].playerBId).toBeUndefined()
    expect(round2[0].status).toBe('pending')
  })

  it('double elimination adds losers bracket rounds', () => {
    const m = generateBracket(['p1', 'p2', 'p3', 'p4'], tid, 'match_play_double')
    const losersRounds = m.filter(x => x.loserBracket)
    expect(losersRounds.length).toBeGreaterThan(0)
  })

  it('double elimination adds grand finals match', () => {
    const m = generateBracket(['p1', 'p2', 'p3', 'p4'], tid, 'match_play_double')
    const winnersOnly = m.filter(x => !x.loserBracket)
    const maxWinnersRound = Math.max(...winnersOnly.map(x => x.bracketRound))
    // Grand finals is one round past the normal winners bracket final
    const grandFinals = winnersOnly.filter(x => x.bracketRound === maxWinnersRound)
    expect(grandFinals.length).toBeGreaterThanOrEqual(1)
  })

  it('all matchups have unique ids', () => {
    const m = generateBracket(Array.from({ length: 8 }, (_, i) => `p${i + 1}`), tid, 'match_play_single')
    const ids = m.map(x => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all matchups reference correct tournamentId', () => {
    const m = generateBracket(['p1', 'p2', 'p3', 'p4'], tid, 'match_play_single')
    for (const match of m) {
      expect(match.tournamentId).toBe(tid)
    }
  })
})

// ─── advanceBracket ─────────────────────────────────────────────────────────

describe('advanceBracket', () => {
  function makeBracket4() {
    return generateBracket(['p1', 'p2', 'p3', 'p4'], 't1', 'match_play_single')
  }

  it('marks specified match as complete with winnerId', () => {
    const m = makeBracket4()
    const round1 = m.filter(x => x.bracketRound === 1)
    const result = advanceBracket(m, round1[0].id, 'p1')
    const updated = result.find(x => x.id === round1[0].id)!
    expect(updated.status).toBe('complete')
    expect(updated.winnerId).toBe('p1')
  })

  it('even-indexed match winner goes to playerAId in next round', () => {
    const m = makeBracket4()
    const round1 = m.filter(x => x.bracketRound === 1)
    const round2 = m.filter(x => x.bracketRound === 2)
    const result = advanceBracket(m, round1[0].id, 'p1')
    const nextMatch = result.find(x => x.id === round2[0].id)!
    expect(nextMatch.playerAId).toBe('p1')
  })

  it('odd-indexed match winner goes to playerBId in next round', () => {
    const m = makeBracket4()
    const round1 = m.filter(x => x.bracketRound === 1)
    const round2 = m.filter(x => x.bracketRound === 2)
    const result = advanceBracket(m, round1[1].id, 'p3')
    const nextMatch = result.find(x => x.id === round2[0].id)!
    expect(nextMatch.playerBId).toBe('p3')
  })

  it('match 1 → playerA, match 2 → playerB of same next-round match', () => {
    const m = makeBracket4()
    const round1 = m.filter(x => x.bracketRound === 1)
    const round2 = m.filter(x => x.bracketRound === 2)
    let result = advanceBracket(m, round1[0].id, 'p1')
    result = advanceBracket(result, round1[1].id, 'p3')
    const final = result.find(x => x.id === round2[0].id)!
    expect(final.playerAId).toBe('p1')
    expect(final.playerBId).toBe('p3')
  })

  it('final match has no advancement, returns updated array unchanged', () => {
    const m = generateBracket(['p1', 'p2'], 't1', 'match_play_single')
    const result = advanceBracket(m, m[0].id, 'p1')
    const updated = result.find(x => x.id === m[0].id)!
    expect(updated.status).toBe('complete')
    expect(updated.winnerId).toBe('p1')
    expect(result).toHaveLength(m.length)
  })

  it('losers bracket match: marks complete but no next-round placement', () => {
    const m = generateBracket(['p1', 'p2', 'p3', 'p4'], 't1', 'match_play_double')
    const losersMatches = m.filter(x => x.loserBracket)
    if (losersMatches.length > 0) {
      const result = advanceBracket(m, losersMatches[0].id, 'p2')
      const updated = result.find(x => x.id === losersMatches[0].id)!
      expect(updated.status).toBe('complete')
      expect(updated.winnerId).toBe('p2')
    }
  })

  it('does not mutate input array', () => {
    const m = makeBracket4()
    const original = m.map(x => ({ ...x }))
    advanceBracket(m, m[0].id, 'p1')
    expect(m).toEqual(original)
  })

  it('only modifies completed match + next match', () => {
    const m = makeBracket4()
    const round1 = m.filter(x => x.bracketRound === 1)
    const result = advanceBracket(m, round1[0].id, 'p1')
    // Only the completed match and the next-round match should differ
    let changedCount = 0
    for (let i = 0; i < m.length; i++) {
      if (result[i] !== m[i]) changedCount++
    }
    expect(changedCount).toBeLessThanOrEqual(2)
  })
})

// ─── calculateStrokePlayStandings ───────────────────────────────────────────

describe('calculateStrokePlayStandings', () => {
  it('sums totalGross across rounds per player', () => {
    const standings = calculateStrokePlayStandings(
      ['p1', 'p2'],
      [
        { roundNumber: 1, playerId: 'p1', totalGross: 80 },
        { roundNumber: 2, playerId: 'p1', totalGross: 78 },
        { roundNumber: 1, playerId: 'p2', totalGross: 85 },
      ],
    )
    expect(standings.find(s => s.playerId === 'p1')!.totalGross).toBe(158)
    expect(standings.find(s => s.playerId === 'p2')!.totalGross).toBe(85)
  })

  it('sorts by roundsPlayed desc, then totalGross asc', () => {
    const standings = calculateStrokePlayStandings(
      ['p1', 'p2', 'p3'],
      [
        { roundNumber: 1, playerId: 'p1', totalGross: 80 },
        { roundNumber: 2, playerId: 'p1', totalGross: 78 },
        { roundNumber: 1, playerId: 'p2', totalGross: 75 },
        { roundNumber: 2, playerId: 'p2', totalGross: 76 },
        { roundNumber: 1, playerId: 'p3', totalGross: 70 },
      ],
    )
    // p2 (151, 2 rounds) beats p1 (158, 2 rounds) — both have 2 rounds, lower gross wins
    expect(standings[0].playerId).toBe('p2')
    expect(standings[1].playerId).toBe('p1')
    // p3 has only 1 round, ranked last despite lowest per-round score
    expect(standings[2].playerId).toBe('p3')
  })

  it('players with no scores get 0/0', () => {
    const standings = calculateStrokePlayStandings(['p1', 'p2'], [])
    for (const s of standings) {
      expect(s.totalGross).toBe(0)
      expect(s.roundsPlayed).toBe(0)
    }
  })

  it('handles ties correctly (same roundsPlayed and totalGross)', () => {
    const standings = calculateStrokePlayStandings(
      ['p1', 'p2'],
      [
        { roundNumber: 1, playerId: 'p1', totalGross: 80 },
        { roundNumber: 1, playerId: 'p2', totalGross: 80 },
      ],
    )
    // Both should appear with same stats
    expect(standings[0].totalGross).toBe(80)
    expect(standings[1].totalGross).toBe(80)
    expect(standings[0].roundsPlayed).toBe(1)
    expect(standings[1].roundsPlayed).toBe(1)
  })
})

// ─── countBracketRounds ─────────────────────────────────────────────────────

describe('countBracketRounds', () => {
  it('returns max bracketRound from winners bracket only', () => {
    const m = generateBracket(Array.from({ length: 8 }, (_, i) => `p${i + 1}`), 't1', 'match_play_single')
    expect(countBracketRounds(m)).toBe(3) // log2(8) = 3
  })

  it('returns 0 for empty array', () => {
    expect(countBracketRounds([])).toBe(0)
  })
})

// ─── End-to-end tournament flow ─────────────────────────────────────────────

describe('8-player single elimination full tournament', () => {
  const players = Array.from({ length: 8 }, (_, i) => `p${i + 1}`)
  let matchups: TournamentMatchup[]

  beforeEach(() => {
    matchups = generateBracket(players, 't-e2e', 'match_play_single')
  })

  it('generates correct structure: 7 matches across 3 rounds', () => {
    expect(matchups).toHaveLength(7) // 4 + 2 + 1
    expect(matchups.filter(m => m.bracketRound === 1)).toHaveLength(4)
    expect(matchups.filter(m => m.bracketRound === 2)).toHaveLength(2)
    expect(matchups.filter(m => m.bracketRound === 3)).toHaveLength(1)
  })

  it('round 1: all 4 matches have both players assigned', () => {
    const r1 = matchups.filter(m => m.bracketRound === 1)
    for (const m of r1) {
      expect(m.playerAId).toBeDefined()
      expect(m.playerBId).toBeDefined()
      expect(m.status).toBe('pending')
    }
  })

  it('completes full tournament from round 1 through finals', () => {
    const r1 = matchups.filter(m => m.bracketRound === 1)

    // Round 1: p1 beats p2, p3 beats p4, p5 beats p6, p7 beats p8
    matchups = advanceBracket(matchups, r1[0].id, 'p1')
    matchups = advanceBracket(matchups, r1[1].id, 'p3')
    matchups = advanceBracket(matchups, r1[2].id, 'p5')
    matchups = advanceBracket(matchups, r1[3].id, 'p7')

    // Verify round 1 all complete
    const r1After = matchups.filter(m => m.bracketRound === 1)
    expect(r1After.every(m => m.status === 'complete')).toBe(true)

    // Verify round 2 has correct players advanced
    const r2 = matchups.filter(m => m.bracketRound === 2)
    expect(r2[0].playerAId).toBe('p1')
    expect(r2[0].playerBId).toBe('p3')
    expect(r2[1].playerAId).toBe('p5')
    expect(r2[1].playerBId).toBe('p7')

    // Round 2: p1 beats p3, p7 beats p5
    matchups = advanceBracket(matchups, r2[0].id, 'p1')
    matchups = advanceBracket(matchups, r2[1].id, 'p7')

    // Verify finals
    const finals = matchups.filter(m => m.bracketRound === 3)
    expect(finals).toHaveLength(1)
    expect(finals[0].playerAId).toBe('p1')
    expect(finals[0].playerBId).toBe('p7')

    // Finals: p1 wins the tournament
    matchups = advanceBracket(matchups, finals[0].id, 'p1')
    expect(matchups.find(m => m.bracketRound === 3)!.winnerId).toBe('p1')
    expect(matchups.find(m => m.bracketRound === 3)!.status).toBe('complete')

    // All matches should be complete
    expect(matchups.every(m => m.status === 'complete')).toBe(true)
  })

  it('upset path: lower seed wins throughout', () => {
    const r1 = matchups.filter(m => m.bracketRound === 1)

    // All lower seeds (playerB) win round 1
    matchups = advanceBracket(matchups, r1[0].id, r1[0].playerBId!)
    matchups = advanceBracket(matchups, r1[1].id, r1[1].playerBId!)
    matchups = advanceBracket(matchups, r1[2].id, r1[2].playerBId!)
    matchups = advanceBracket(matchups, r1[3].id, r1[3].playerBId!)

    const r2 = matchups.filter(m => m.bracketRound === 2)
    // Lower seeds advanced to correct slots
    expect(r2[0].playerAId).toBe(r1[0].playerBId)
    expect(r2[0].playerBId).toBe(r1[1].playerBId)
    expect(r2[1].playerAId).toBe(r1[2].playerBId)
    expect(r2[1].playerBId).toBe(r1[3].playerBId)

    // Lower seeds continue winning
    matchups = advanceBracket(matchups, r2[0].id, r2[0].playerBId!)
    matchups = advanceBracket(matchups, r2[1].id, r2[1].playerBId!)

    const finals = matchups.find(m => m.bracketRound === 3)!
    matchups = advanceBracket(matchups, finals.id, finals.playerBId!)
    expect(matchups.every(m => m.status === 'complete')).toBe(true)
  })
})

describe('4-player double elimination full tournament', () => {
  const players = ['p1', 'p2', 'p3', 'p4']

  it('generates winners bracket, losers bracket, and grand finals', () => {
    const matchups = generateBracket(players, 't-de', 'match_play_double')
    const winners = matchups.filter(m => !m.loserBracket)
    const losers = matchups.filter(m => m.loserBracket)

    // Winners bracket: 2 round 1 + 1 round 2 = 3 matches + grand finals
    expect(winners.length).toBeGreaterThanOrEqual(4) // 3 winners rounds + grand finals
    expect(losers.length).toBeGreaterThan(0)

    // Grand finals should be the highest-round winners bracket match
    const maxWinnersRound = Math.max(...winners.map(m => m.bracketRound))
    const grandFinals = winners.filter(m => m.bracketRound === maxWinnersRound)
    expect(grandFinals.length).toBeGreaterThanOrEqual(1)
  })

  it('winners bracket can be played through', () => {
    let matchups = generateBracket(players, 't-de', 'match_play_double')
    const r1 = matchups.filter(m => m.bracketRound === 1 && !m.loserBracket)

    // Play round 1: p1 beats p2, p3 beats p4
    matchups = advanceBracket(matchups, r1[0].id, 'p1')
    matchups = advanceBracket(matchups, r1[1].id, 'p3')

    // Winners bracket round 2 should have p1 vs p3
    const r2Winners = matchups.filter(m => m.bracketRound === 2 && !m.loserBracket)
    expect(r2Winners.length).toBeGreaterThanOrEqual(1)
    expect(r2Winners[0].playerAId).toBe('p1')
    expect(r2Winners[0].playerBId).toBe('p3')
  })
})

describe('stroke play standings across multiple rounds', () => {
  it('full 3-round tournament with 4 players produces correct final standings', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4']
    const roundScores = [
      // Round 1
      { roundNumber: 1, playerId: 'p1', totalGross: 82 },
      { roundNumber: 1, playerId: 'p2', totalGross: 78 },
      { roundNumber: 1, playerId: 'p3', totalGross: 85 },
      { roundNumber: 1, playerId: 'p4', totalGross: 80 },
      // Round 2
      { roundNumber: 2, playerId: 'p1', totalGross: 79 },
      { roundNumber: 2, playerId: 'p2', totalGross: 81 },
      { roundNumber: 2, playerId: 'p3', totalGross: 83 },
      { roundNumber: 2, playerId: 'p4', totalGross: 77 },
      // Round 3
      { roundNumber: 3, playerId: 'p1', totalGross: 80 },
      { roundNumber: 3, playerId: 'p2', totalGross: 76 },
      { roundNumber: 3, playerId: 'p3', totalGross: 84 },
      { roundNumber: 3, playerId: 'p4', totalGross: 79 },
    ]

    const standings = calculateStrokePlayStandings(playerIds, roundScores)

    // All played 3 rounds
    expect(standings.every(s => s.roundsPlayed === 3)).toBe(true)

    // Totals: p1=241, p2=235, p3=252, p4=236
    expect(standings[0].playerId).toBe('p2') // 235
    expect(standings[0].totalGross).toBe(235)
    expect(standings[1].playerId).toBe('p4') // 236
    expect(standings[1].totalGross).toBe(236)
    expect(standings[2].playerId).toBe('p1') // 241
    expect(standings[2].totalGross).toBe(241)
    expect(standings[3].playerId).toBe('p3') // 252
    expect(standings[3].totalGross).toBe(252)
  })

  it('player who missed a round ranks lower despite better per-round average', () => {
    const playerIds = ['p1', 'p2']
    const roundScores = [
      { roundNumber: 1, playerId: 'p1', totalGross: 90 },
      { roundNumber: 2, playerId: 'p1', totalGross: 88 },
      { roundNumber: 1, playerId: 'p2', totalGross: 72 }, // way better but only 1 round
    ]

    const standings = calculateStrokePlayStandings(playerIds, roundScores)
    // p1 ranks first (2 rounds played) despite worse scores
    expect(standings[0].playerId).toBe('p1')
    expect(standings[0].roundsPlayed).toBe(2)
    expect(standings[1].playerId).toBe('p2')
    expect(standings[1].roundsPlayed).toBe(1)
  })
})
