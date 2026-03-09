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
  venmoUsername?: string
  zelleIdentifier?: string
  cashAppUsername?: string
  paypalEmail?: string
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
export interface SkinsConfig {
  mode: SkinsMode
  carryovers: boolean
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
}

export interface WolfConfig {
  mode: 'gross' | 'net'
  wolfOrder: string[]
  holeDecisions?: Record<number, { partnerId: string | null }>
}

export interface BBBConfig {
  mode: 'gross' | 'net'
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

  // Explicitly assigned treasurer
  treasurerPlayerId?: string

  // Players embedded for convenience (source of truth for new rounds)
  players?: Player[]
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

// ─── Legacy score (kept for migration safety) ─────────────────────────────────

export interface Score {
  playerId: string
  holeNumber: number
  grossScore: number
  netScore: number
  strokesReceived: number
}
