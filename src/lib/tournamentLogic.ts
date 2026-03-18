import type { TournamentMatchup, TournamentFormat } from '../types'
import { v4 as uuidv4 } from 'uuid'

/**
 * Generate bracket matchups for match play tournament.
 * Handles byes for non-power-of-2 player counts.
 */
export function generateBracket(
  playerIds: string[],
  tournamentId: string,
  format: TournamentFormat,
): TournamentMatchup[] {
  const n = playerIds.length
  if (n < 2) return []

  // Next power of 2
  const size = Math.pow(2, Math.ceil(Math.log2(n)))
  const byes = size - n

  // Seed players (top seeds get byes)
  const seeded = [...playerIds]
  const matchups: TournamentMatchup[] = []
  const firstRoundMatches = size / 2

  let matchNumber = 1
  let seedIdx = 0

  for (let i = 0; i < firstRoundMatches; i++) {
    const playerA = seeded[seedIdx++] ?? undefined
    const playerB = seedIdx < n ? seeded[seedIdx++] : undefined

    // If playerB is undefined, it's a bye — playerA auto-advances
    const isBye = !playerB
    matchups.push({
      id: uuidv4(),
      tournamentId,
      bracketRound: 1,
      matchNumber: matchNumber++,
      playerAId: playerA,
      playerBId: playerB,
      winnerId: isBye ? playerA : undefined,
      loserBracket: false,
      status: isBye ? 'complete' : 'pending',
      createdAt: new Date(),
    })
  }

  // Generate placeholder matchups for subsequent rounds
  let prevRoundMatches = firstRoundMatches
  let round = 2
  while (prevRoundMatches > 1) {
    const roundMatches = prevRoundMatches / 2
    for (let i = 0; i < roundMatches; i++) {
      matchups.push({
        id: uuidv4(),
        tournamentId,
        bracketRound: round,
        matchNumber: matchNumber++,
        loserBracket: false,
        status: 'pending',
        createdAt: new Date(),
      })
    }
    prevRoundMatches = roundMatches
    round++
  }

  // Double elimination: add losers bracket rounds
  if (format === 'match_play_double') {
    const totalWinnersRounds = round - 1
    let loserMatchNumber = matchNumber
    // Losers bracket has roughly 2*(totalWinnersRounds-1) rounds
    const losersRounds = (totalWinnersRounds - 1) * 2
    let losersInRound = firstRoundMatches / 2

    for (let lr = 1; lr <= losersRounds; lr++) {
      const matches = Math.max(1, Math.ceil(losersInRound))
      for (let i = 0; i < matches; i++) {
        matchups.push({
          id: uuidv4(),
          tournamentId,
          bracketRound: lr,
          matchNumber: loserMatchNumber++,
          loserBracket: true,
          status: 'pending',
          createdAt: new Date(),
        })
      }
      // Every other round halves the count
      if (lr % 2 === 0) losersInRound /= 2
    }

    // Grand finals
    matchups.push({
      id: uuidv4(),
      tournamentId,
      bracketRound: totalWinnersRounds + 1,
      matchNumber: loserMatchNumber++,
      loserBracket: false,
      status: 'pending',
      createdAt: new Date(),
    })
  }

  return matchups
}

/**
 * After a match is won, advance the winner to the next winners bracket round.
 * Returns updated matchups array.
 */
export function advanceBracket(
  matchups: TournamentMatchup[],
  matchupId: string,
  winnerId: string,
): TournamentMatchup[] {
  const updated = matchups.map(m => m.id === matchupId ? { ...m, winnerId, status: 'complete' as const } : m)

  const match = updated.find(m => m.id === matchupId)
  if (!match || match.loserBracket) return updated

  // Find next winners bracket round
  const winnersMatches = updated.filter(m => !m.loserBracket && m.bracketRound === match.bracketRound)
  const matchIdx = winnersMatches.findIndex(m => m.id === matchupId)
  const nextRoundMatches = updated.filter(m => !m.loserBracket && m.bracketRound === match.bracketRound + 1)

  if (nextRoundMatches.length > 0) {
    const nextMatchIdx = Math.floor(matchIdx / 2)
    const nextMatch = nextRoundMatches[nextMatchIdx]
    if (nextMatch) {
      const slot = matchIdx % 2 === 0 ? 'playerAId' : 'playerBId'
      return updated.map(m => m.id === nextMatch.id ? { ...m, [slot]: winnerId } : m)
    }
  }

  return updated
}

/**
 * Calculate stroke play standings across multiple rounds.
 */
export function calculateStrokePlayStandings(
  playerIds: string[],
  roundScores: { roundNumber: number; playerId: string; totalGross: number }[],
): { playerId: string; totalGross: number; roundsPlayed: number }[] {
  return playerIds.map(pid => {
    const scores = roundScores.filter(s => s.playerId === pid)
    return {
      playerId: pid,
      totalGross: scores.reduce((sum, s) => sum + s.totalGross, 0),
      roundsPlayed: scores.length,
    }
  }).sort((a, b) => {
    if (a.roundsPlayed !== b.roundsPlayed) return b.roundsPlayed - a.roundsPlayed
    return a.totalGross - b.totalGross
  })
}

/** Count total bracket rounds for display */
export function countBracketRounds(matchups: TournamentMatchup[]): number {
  const winners = matchups.filter(m => !m.loserBracket)
  return winners.reduce((max, m) => Math.max(max, m.bracketRound), 0)
}
