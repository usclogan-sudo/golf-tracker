import { createClient } from '@supabase/supabase-js'
import type { Course, Player, Round, RoundPlayer, HoleScore, BuyIn, BBBPoint } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── DB row → TypeScript mappers ──────────────────────────────────────────────

export function rowToCourse(row: any): Course {
  return {
    id: row.id,
    name: row.name,
    tees: row.tees,
    holes: row.holes,
    createdAt: new Date(row.created_at),
  }
}

export function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    name: row.name,
    handicapIndex: row.handicap_index,
    tee: row.tee,
    ghinNumber: row.ghin_number ?? '',
    ...(row.venmo_username ? { venmoUsername: row.venmo_username } : {}),
    ...(row.zelle_identifier ? { zelleIdentifier: row.zelle_identifier } : {}),
    ...(row.cashapp_username ? { cashAppUsername: row.cashapp_username } : {}),
    ...(row.paypal_email ? { paypalEmail: row.paypal_email } : {}),
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
  }
}

export function rowToRound(row: any): Round {
  return {
    id: row.id,
    courseId: row.course_id,
    date: new Date(row.date),
    status: row.status,
    currentHole: row.current_hole,
    courseSnapshot: row.course_snapshot ?? undefined,
    game: row.game ?? undefined,
    treasurerPlayerId: row.treasurer_player_id ?? undefined,
    players: row.players ?? undefined,
  }
}

export function rowToRoundPlayer(row: any): RoundPlayer {
  return {
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    teePlayed: row.tee_played,
    courseHandicap: row.course_handicap ?? undefined,
    playingHandicap: row.playing_handicap ?? undefined,
  }
}

export function rowToHoleScore(row: any): HoleScore {
  return {
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    holeNumber: row.hole_number,
    grossScore: row.gross_score,
  }
}

export function rowToBuyIn(row: any): BuyIn {
  return {
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    amountCents: row.amount_cents,
    method: row.method ?? undefined,
    status: row.status,
    paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
  }
}

export function rowToBBBPoint(row: any): BBBPoint {
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: row.hole_number,
    bingo: row.bingo,
    bango: row.bango,
    bongo: row.bongo,
  }
}

// ─── TypeScript → DB row mappers ──────────────────────────────────────────────

export function courseToRow(c: Course, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    tees: c.tees,
    holes: c.holes,
    created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  }
}

export function playerToRow(p: Player, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    handicap_index: p.handicapIndex,
    tee: p.tee,
    ghin_number: p.ghinNumber || '',
    venmo_username: p.venmoUsername ?? null,
    zelle_identifier: p.zelleIdentifier ?? null,
    cashapp_username: p.cashAppUsername ?? null,
    paypal_email: p.paypalEmail ?? null,
    created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.createdAt ?? null),
  }
}

export function roundToRow(r: Round, userId: string) {
  return {
    id: r.id,
    user_id: userId,
    course_id: r.courseId,
    date: r.date instanceof Date ? r.date.toISOString() : r.date,
    status: r.status,
    current_hole: r.currentHole,
    course_snapshot: r.courseSnapshot ?? null,
    game: r.game ?? null,
    treasurer_player_id: r.treasurerPlayerId ?? null,
    players: r.players ?? null,
  }
}

export function roundPlayerToRow(rp: RoundPlayer, userId: string) {
  return {
    id: rp.id,
    user_id: userId,
    round_id: rp.roundId,
    player_id: rp.playerId,
    tee_played: rp.teePlayed,
    course_handicap: rp.courseHandicap ?? null,
    playing_handicap: rp.playingHandicap ?? null,
  }
}

export function holeScoreToRow(hs: HoleScore, userId: string) {
  return {
    id: hs.id,
    user_id: userId,
    round_id: hs.roundId,
    player_id: hs.playerId,
    hole_number: hs.holeNumber,
    gross_score: hs.grossScore,
  }
}

export function buyInToRow(b: BuyIn, userId: string) {
  return {
    id: b.id,
    user_id: userId,
    round_id: b.roundId,
    player_id: b.playerId,
    amount_cents: b.amountCents,
    method: b.method ?? null,
    status: b.status,
    paid_at: b.paidAt instanceof Date ? b.paidAt.toISOString() : (b.paidAt ?? null),
  }
}

export function bbbPointToRow(bp: BBBPoint, userId: string) {
  return {
    id: bp.id,
    user_id: userId,
    round_id: bp.roundId,
    hole_number: bp.holeNumber,
    bingo: bp.bingo,
    bango: bp.bango,
    bongo: bp.bongo,
  }
}
