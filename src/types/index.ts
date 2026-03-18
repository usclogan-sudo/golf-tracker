// ─── Course ───────────────────────────────────────────────────────────────────

export interface Course {
  id: string
  name: string
  tees: Tee[]
  holes: Hole[]
  createdAt: Date
}

export interface Tee {
  name: string
  rating: number  // e.g. 72.1
  slope: number   // e.g. 128
}

export interface Hole {
  number: number                    // 1–18
  par: number                       // 3, 4, or 5
  strokeIndex: number               // 1–18 (handicap allocation; 1 = hardest)
  yardages: Record<string, number>  // keyed by tee name
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string
  name: string
  ghinNumber: string
  handicapIndex: number   // e.g. 12.4
  tee: string             // default tee color
  isPublic?: boolean
  venmoUsername?: string
  zelleIdentifier?: string
  cashAppUsername?: string
  paypalEmail?: string
  createdAt?: Date
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string
  isAdmin: boolean
  onboardingComplete: boolean
  displayName?: string
  handicapIndex?: number
  tee: string
  venmoUsername?: string
  zelleIdentifier?: string
  cashAppUsername?: string
  paypalEmail?: string
  preferredPayment?: string
  avatarUrl?: string
  avatarPreset?: string
  createdAt?: Date
}

// ─── Game Preset ──────────────────────────────────────────────────────────────

export interface GamePreset {
  id: string
  createdBy: string
  name: string
  gameType: GameType
  buyInCents: number
  stakesMode: StakesMode
  config: SkinsConfig | BestBallConfig | NassauConfig | WolfConfig | BBBConfig
  description?: string
  sortOrder: number
  createdAt?: Date
}

// ─── Course Snapshot (freezes course data at time of round) ──────────────────

export interface CourseSnapshot {
  courseId: string
  courseName: string
  tees: Tee[]
  holes: Hole[]
}

// ─── Games ────────────────────────────────────────────────────────────────────

export type GameType = 'skins' | 'best_ball' | 'nassau' | 'wolf' | 'bingo_bango_bongo'

export type SkinsMode = 'gross' | 'net'
export interface Press {
  holeNumber: number
  playerId: string
}

export interface SkinsConfig {
  mode: SkinsMode
  carryovers: boolean
  presses?: Press[]
}

export type BestBallMode = 'gross' | 'net'
export type BestBallScoring = 'match' | 'total'
export interface BestBallConfig {
  scoring: BestBallScoring
  mode: BestBallMode
  /** playerId → 'A' | 'B' */
  teams: Record<string, 'A' | 'B'>
}

export interface NassauConfig {
  mode: 'gross' | 'net'
  presses?: Press[]
}

export interface WolfConfig {
  mode: 'gross' | 'net'
  wolfOrder: string[]
  holeDecisions?: Record<number, { partnerId: string | null }>
}

export interface BBBConfig {
  mode: 'gross' | 'net'
}

// ─── Junks (side bets) ─────────────────────────────────────────────────────

export type JunkType = 'sandy' | 'greenie' | 'snake' | 'barkie' | 'ctp'

export interface JunkConfig {
  valueCents: number  // value per junk (e.g. 100 = $1 per junk per player)
  types: JunkType[]   // which junks are active this round
}

export interface JunkRecord {
  id: string
  roundId: string
  holeNumber: number
  playerId: string
  junkType: JunkType
}

export interface BBBPoint {
  id: string
  roundId: string
  holeNumber: number
  bingo: string | null
  bango: string | null
  bongo: string | null
}

export type StakesMode = 'standard' | 'high_roller'

export interface Game {
  id: string
  type: GameType
  buyInCents: number
  stakesMode?: StakesMode
  config: SkinsConfig | BestBallConfig | NassauConfig | WolfConfig | BBBConfig
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export type PaymentMethod = 'venmo' | 'cash' | 'zelle' | 'paypal' | 'other'
export type PaymentStatus = 'unpaid' | 'marked_paid'

export interface BuyIn {
  id: string
  roundId: string
  playerId: string
  amountCents: number
  method?: PaymentMethod
  status: PaymentStatus
  paidAt?: Date
}

// ─── Round ────────────────────────────────────────────────────────────────────

export interface Round {
  id: string
  courseId: string
  date: Date
  status: 'setup' | 'active' | 'complete'
  currentHole: number

  // Frozen snapshot so old rounds don't break when course is edited
  courseSnapshot?: CourseSnapshot

  // One game per round
  game?: Game

  // Optional junk side bets (independent of main game)
  junkConfig?: JunkConfig

  // Explicitly assigned treasurer
  treasurerPlayerId?: string

  // Players embedded for convenience (source of truth for new rounds)
  players?: Player[]

  // Group assignments: playerId → group number (1-based)
  groups?: Record<string, number>

  // Round creator's user ID (for scoremaster vs viewer distinction)
  createdBy?: string

  // Game master (scorekeeper) — can edit scores alongside round creator
  gameMasterId?: string

  // Invite code for shared scoring
  inviteCode?: string
}

// ─── Round Participant ──────────────────────────────────────────────────────

export interface RoundParticipant {
  id: string
  roundId: string
  userId: string
  playerId: string
  joinedAt?: Date
}

// ─── Pinned Friends ─────────────────────────────────────────────────────────

export interface PinnedFriend {
  userId: string
  friendUserId: string
}

// ─── Join / score tables ──────────────────────────────────────────────────────

export interface RoundPlayer {
  id: string
  roundId: string
  playerId: string
  teePlayed: string
  courseHandicap?: number
  playingHandicap?: number
}

export interface HoleScore {
  id: string
  roundId: string
  playerId: string
  holeNumber: number
  grossScore: number
}

// ─── Settlements ─────────────────────────────────────────────────────────────

export type SettlementStatus = 'owed' | 'paid'

export interface SettlementRecord {
  id: string
  roundId: string
  fromPlayerId: string
  toPlayerId: string
  amountCents: number
  reason?: string
  source: 'game' | 'junk'
  status: SettlementStatus
  paidAt?: Date
}

// ─── Legacy score (kept for migration safety) ─────────────────────────────────

export interface Score {
  playerId: string
  holeNumber: number
  grossScore: number
  netScore: number
  strokesReceived: number
}
