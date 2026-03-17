import { createClient } from '@supabase/supabase-js'
import type { Course, Player, Round, RoundPlayer, HoleScore, BuyIn, BBBPoint, JunkRecord, JunkType, UserProfile, GamePreset, GameType, StakesMode, PinnedFriend } from '../types'

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
    isPublic: row.is_public ?? false,
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
    junkConfig: row.junk_config ?? undefined,
    treasurerPlayerId: row.treasurer_player_id ?? undefined,
    players: row.players ?? undefined,
    groups: row.groups ?? undefined,
    createdBy: row.user_id ?? undefined,
    gameMasterId: row.game_master_id ?? undefined,
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
    is_public: p.isPublic ?? false,
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
    junk_config: r.junkConfig ?? null,
    treasurer_player_id: r.treasurerPlayerId ?? null,
    players: r.players ?? null,
    groups: r.groups ?? null,
    game_master_id: r.gameMasterId ?? null,
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

// ─── Junk Record mappers ────────────────────────────────────────────────────

export function rowToJunkRecord(row: any): JunkRecord {
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: row.hole_number,
    playerId: row.player_id,
    junkType: row.junk_type as JunkType,
  }
}

export function junkRecordToRow(jr: JunkRecord, userId: string) {
  return {
    id: jr.id,
    user_id: userId,
    round_id: jr.roundId,
    hole_number: jr.holeNumber,
    player_id: jr.playerId,
    junk_type: jr.junkType,
  }
}

// ─── User Profile mappers ───────────────────────────────────────────────────

export function rowToUserProfile(row: any): UserProfile {
  return {
    userId: row.user_id,
    isAdmin: row.is_admin,
    onboardingComplete: row.onboarding_complete,
    displayName: row.display_name ?? undefined,
    handicapIndex: row.handicap_index ?? undefined,
    tee: row.tee ?? 'White',
    venmoUsername: row.venmo_username ?? undefined,
    zelleIdentifier: row.zelle_identifier ?? undefined,
    cashAppUsername: row.cashapp_username ?? undefined,
    paypalEmail: row.paypal_email ?? undefined,
    preferredPayment: row.preferred_payment ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    avatarPreset: row.avatar_preset ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
  }
}

export function userProfileToRow(p: UserProfile) {
  return {
    user_id: p.userId,
    is_admin: p.isAdmin,
    onboarding_complete: p.onboardingComplete,
    display_name: p.displayName ?? null,
    handicap_index: p.handicapIndex ?? null,
    tee: p.tee ?? 'White',
    venmo_username: p.venmoUsername ?? null,
    zelle_identifier: p.zelleIdentifier ?? null,
    cashapp_username: p.cashAppUsername ?? null,
    paypal_email: p.paypalEmail ?? null,
    preferred_payment: p.preferredPayment ?? null,
    avatar_url: p.avatarUrl ?? null,
    avatar_preset: p.avatarPreset ?? null,
  }
}

export async function fetchOrCreateProfile(userId: string): Promise<UserProfile> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (data) return rowToUserProfile(data)
  const newProfile: UserProfile = { userId, isAdmin: false, onboardingComplete: false, tee: 'White' }
  await supabase.from('user_profiles').insert(userProfileToRow(newProfile))
  return newProfile
}

// ─── Game Preset mappers ────────────────────────────────────────────────────

export function rowToGamePreset(row: any): GamePreset {
  return {
    id: row.id,
    createdBy: row.created_by,
    name: row.name,
    gameType: row.game_type as GameType,
    buyInCents: row.buy_in_cents,
    stakesMode: (row.stakes_mode ?? 'standard') as StakesMode,
    config: row.config,
    description: row.description ?? undefined,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
  }
}

export function gamePresetToRow(gp: GamePreset, userId: string) {
  return {
    id: gp.id,
    created_by: userId,
    name: gp.name,
    game_type: gp.gameType,
    buy_in_cents: gp.buyInCents,
    stakes_mode: gp.stakesMode,
    config: gp.config,
    description: gp.description ?? null,
    sort_order: gp.sortOrder,
  }
}

// ─── Shared Course mappers ──────────────────────────────────────────────────

export function rowToSharedCourse(row: any): Course {
  return {
    id: row.id,
    name: row.name,
    tees: row.tees,
    holes: row.holes,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  }
}

export function sharedCourseToRow(c: Course, userId: string) {
  return {
    id: c.id,
    created_by: userId,
    name: c.name,
    tees: c.tees,
    holes: c.holes,
  }
}

// ─── Pinned Friends mappers ──────────────────────────────────────────────────

export function rowToPinnedFriend(row: any): PinnedFriend {
  return {
    userId: row.user_id,
    friendUserId: row.friend_user_id,
  }
}
