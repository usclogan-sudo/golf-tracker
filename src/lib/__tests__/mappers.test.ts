vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }))

import {
  rowToRoundParticipant,
  rowToEvent,
  eventToRow,
  rowToEventParticipant,
  rowToTournament,
  tournamentToRow,
  rowToTournamentMatchup,
  tournamentMatchupToRow,
  rowToTournamentRound,
  tournamentRoundToRow,
  rowToRound,
  roundToRow,
  rowToHoleScore,
  holeScoreToRow,
  rowToSideBet,
  sideBetToRow,
  rowToNotification,
  notificationToRow,
  rowToSettlementRecord,
  settlementRecordToRow,
} from '../supabase'

// ─── rowToRoundParticipant ──────────────────────────────────────────────────

describe('rowToRoundParticipant', () => {
  it('maps snake_case to camelCase with Date conversion', () => {
    const row = { id: 'rp-1', round_id: 'r-1', user_id: 'u-1', player_id: 'p-1', joined_at: '2025-06-01T12:00:00Z' }
    const result = rowToRoundParticipant(row)
    expect(result.id).toBe('rp-1')
    expect(result.roundId).toBe('r-1')
    expect(result.userId).toBe('u-1')
    expect(result.playerId).toBe('p-1')
    expect(result.joinedAt).toEqual(new Date('2025-06-01T12:00:00Z'))
  })

  it('handles null joinedAt', () => {
    const row = { id: 'rp-1', round_id: 'r-1', user_id: 'u-1', player_id: 'p-1', joined_at: null }
    const result = rowToRoundParticipant(row)
    expect(result.joinedAt).toBeUndefined()
  })
})

// ─── rowToEvent / eventToRow ────────────────────────────────────────────────

describe('rowToEvent', () => {
  it('maps all fields correctly', () => {
    const row = {
      id: 'e-1', name: 'Club Champ', status: 'active', round_id: 'r-1',
      invite_code: 'ABC123', group_scorekeepers: { 1: 'p-1' },
      user_id: 'u-1', created_at: '2025-06-01T12:00:00Z',
    }
    const result = rowToEvent(row)
    expect(result.id).toBe('e-1')
    expect(result.name).toBe('Club Champ')
    expect(result.status).toBe('active')
    expect(result.roundId).toBe('r-1')
    expect(result.inviteCode).toBe('ABC123')
    expect(result.groupScorekeepers).toEqual({ 1: 'p-1' })
    expect(result.createdBy).toBe('u-1')
    expect(result.createdAt).toEqual(new Date('2025-06-01T12:00:00Z'))
  })

  it('defaults groupScorekeepers to empty object', () => {
    const row = {
      id: 'e-1', name: 'Test', status: 'setup', round_id: null,
      invite_code: null, group_scorekeepers: null,
      user_id: 'u-1', created_at: '2025-06-01T12:00:00Z',
    }
    const result = rowToEvent(row)
    expect(result.groupScorekeepers).toEqual({})
  })
})

describe('eventToRow', () => {
  it('maps camelCase to snake_case, nullifies undefined optionals', () => {
    const event = {
      id: 'e-1', name: 'Club Champ', status: 'active' as const,
      groupScorekeepers: { 1: 'p-1' } as Record<number, string>,
      createdBy: 'u-1', createdAt: new Date('2025-06-01T12:00:00Z'),
    }
    const row = eventToRow(event, 'u-1')
    expect(row.id).toBe('e-1')
    expect(row.name).toBe('Club Champ')
    expect(row.status).toBe('active')
    expect(row.round_id).toBeNull()
    expect(row.invite_code).toBeNull()
    expect(row.group_scorekeepers).toEqual({ 1: 'p-1' })
    expect(row.user_id).toBe('u-1')
  })
})

// ─── rowToEventParticipant ──────────────────────────────────────────────────

describe('rowToEventParticipant', () => {
  it('maps role casting and optional groupNumber', () => {
    const row = { id: 'ep-1', event_id: 'e-1', user_id: 'u-1', player_id: 'p-1', role: 'scorekeeper', group_number: 2, joined_at: '2025-06-01T12:00:00Z' }
    const result = rowToEventParticipant(row)
    expect(result.role).toBe('scorekeeper')
    expect(result.groupNumber).toBe(2)
    expect(result.joinedAt).toEqual(new Date('2025-06-01T12:00:00Z'))
  })

  it('handles missing groupNumber', () => {
    const row = { id: 'ep-1', event_id: 'e-1', user_id: 'u-1', player_id: 'p-1', role: 'player', group_number: null, joined_at: null }
    const result = rowToEventParticipant(row)
    expect(result.groupNumber).toBeUndefined()
    expect(result.joinedAt).toBeUndefined()
  })
})

// ─── rowToTournament / tournamentToRow ───────────────────────────────────────

describe('rowToTournament', () => {
  it('maps playerIds array and optional courseSnapshot', () => {
    const row = {
      id: 't-1', name: 'Match Play', format: 'match_play_single', status: 'active',
      course_id: 'c-1', course_snapshot: { name: 'Test Course', holes: [] },
      player_ids: ['p1', 'p2', 'p3'], config: { handicapMode: 'gross' },
      created_at: '2025-06-01T12:00:00Z',
    }
    const result = rowToTournament(row)
    expect(result.playerIds).toEqual(['p1', 'p2', 'p3'])
    expect(result.courseSnapshot).toEqual({ name: 'Test Course', holes: [] })
    expect(result.format).toBe('match_play_single')
  })

  it('handles missing optional fields', () => {
    const row = {
      id: 't-1', name: 'Test', format: 'stroke_play', status: 'setup',
      course_id: null, course_snapshot: null, player_ids: [],
      config: null, created_at: '2025-06-01T12:00:00Z',
    }
    const result = rowToTournament(row)
    expect(result.courseId).toBeUndefined()
    expect(result.courseSnapshot).toBeUndefined()
    expect(result.config).toBeUndefined()
  })
})

describe('tournamentToRow', () => {
  it('round-trip preserves data', () => {
    const tournament = {
      id: 't-1', name: 'Match Play', format: 'match_play_single' as const,
      status: 'active' as const, courseId: 'c-1',
      courseSnapshot: { name: 'Test', holes: [] } as any,
      playerIds: ['p1', 'p2'], config: { handicapMode: 'gross' as const },
      createdAt: new Date('2025-06-01T12:00:00Z'),
    }
    const row = tournamentToRow(tournament, 'u-1')
    const back = rowToTournament({ ...row, created_at: '2025-06-01T12:00:00Z' })
    expect(back.id).toBe(tournament.id)
    expect(back.name).toBe(tournament.name)
    expect(back.format).toBe(tournament.format)
    expect(back.playerIds).toEqual(tournament.playerIds)
    expect(back.courseId).toBe(tournament.courseId)
  })
})

// ─── rowToTournamentMatchup / tournamentMatchupToRow ────────────────────────

describe('rowToTournamentMatchup', () => {
  it('maps bracket fields and undefined player slots', () => {
    const row = {
      id: 'm-1', tournament_id: 't-1', tournament_round_id: null,
      bracket_round: 2, match_number: 3, player_a_id: null, player_b_id: null,
      winner_id: null, loser_bracket: false, status: 'pending',
      created_at: '2025-06-01T12:00:00Z',
    }
    const result = rowToTournamentMatchup(row)
    expect(result.bracketRound).toBe(2)
    expect(result.matchNumber).toBe(3)
    expect(result.playerAId).toBeUndefined()
    expect(result.playerBId).toBeUndefined()
    expect(result.winnerId).toBeUndefined()
    expect(result.loserBracket).toBe(false)
  })

  it('maps filled player slots', () => {
    const row = {
      id: 'm-1', tournament_id: 't-1', tournament_round_id: 'tr-1',
      bracket_round: 1, match_number: 1, player_a_id: 'p1', player_b_id: 'p2',
      winner_id: 'p1', loser_bracket: false, status: 'complete',
      created_at: '2025-06-01T12:00:00Z',
    }
    const result = rowToTournamentMatchup(row)
    expect(result.playerAId).toBe('p1')
    expect(result.playerBId).toBe('p2')
    expect(result.winnerId).toBe('p1')
    expect(result.tournamentRoundId).toBe('tr-1')
  })
})

describe('tournamentMatchupToRow', () => {
  it('preserves loserBracket boolean', () => {
    const matchup = {
      id: 'm-1', tournamentId: 't-1', bracketRound: 1, matchNumber: 1,
      playerAId: 'p1', playerBId: 'p2', loserBracket: true,
      status: 'pending' as const, createdAt: new Date(),
    }
    const row = tournamentMatchupToRow(matchup, 'u-1')
    expect(row.loser_bracket).toBe(true)
    expect(row.player_a_id).toBe('p1')
    expect(row.player_b_id).toBe('p2')
    expect(row.tournament_id).toBe('t-1')
  })

  it('nullifies undefined optional fields', () => {
    const matchup = {
      id: 'm-1', tournamentId: 't-1', bracketRound: 2, matchNumber: 3,
      loserBracket: false, status: 'pending' as const, createdAt: new Date(),
    }
    const row = tournamentMatchupToRow(matchup, 'u-1')
    expect(row.player_a_id).toBeNull()
    expect(row.player_b_id).toBeNull()
    expect(row.winner_id).toBeNull()
    expect(row.tournament_round_id).toBeNull()
  })
})

// ─── Round-trip tests for other multiplayer-adjacent mappers ────────────────

describe('rowToRound multiplayer fields', () => {
  it('maps gameMasterId, inviteCode, and eventId', () => {
    const row = {
      id: 'r-1', course_id: 'c-1', date: '2025-06-01', status: 'active',
      current_hole: 1, course_snapshot: null, game: null, junk_config: null,
      treasurer_player_id: null, players: null, groups: null,
      user_id: 'u-1', game_master_id: 'u-2', invite_code: 'XYZ789', event_id: 'e-1',
    }
    const result = rowToRound(row)
    expect(result.gameMasterId).toBe('u-2')
    expect(result.inviteCode).toBe('XYZ789')
    expect(result.eventId).toBe('e-1')
    expect(result.createdBy).toBe('u-1')
  })
})

describe('rowToHoleScore multiplayer fields', () => {
  it('maps scoreStatus, submittedBy, updatedAt', () => {
    const row = {
      id: 'hs-1', round_id: 'r-1', player_id: 'p-1', hole_number: 5,
      gross_score: 4, score_status: 'pending', submitted_by: 'u-2',
      updated_at: '2025-06-01T12:00:00Z',
    }
    const result = rowToHoleScore(row)
    expect(result.scoreStatus).toBe('pending')
    expect(result.submittedBy).toBe('u-2')
    expect(result.updatedAt).toBe('2025-06-01T12:00:00Z')
  })
})
