import type {
  Player,
  CourseSnapshot,
  HoleScore,
  SkinsConfig,
  BestBallConfig,
  NassauConfig,
  WolfConfig,
  BBBPoint,
  JunkRecord,
  JunkConfig,
  JunkType,
  Game,
  RoundPlayer,
  Press,
  SideBet,
  HammerConfig,
  HammerHoleState,
} from '../types'

// ─── Handicap math ────────────────────────────────────────────────────────────

/** USGA course handicap formula */
export function calcCourseHandicap(
  handicapIndex: number,
  slope: number,
  rating: number,
  par: number,
): number {
  return Math.round(handicapIndex * (slope / 113) + (rating - par))
}

/** How many strokes a player receives on a specific hole */
export function strokesOnHole(courseHcp: number, strokeIndex: number, totalHoles: number = 18): number {
  let s = 0
  if (courseHcp >= strokeIndex) s++
  if (courseHcp >= totalHoles + strokeIndex) s++
  return s
}

/** Build playerId → courseHandicap map for all players in a round */
export function buildCourseHandicaps(
  players: Player[],
  roundPlayers: RoundPlayer[],
  snapshot: CourseSnapshot,
): Record<string, number> {
  const par = snapshot.holes.reduce((s, h) => s + h.par, 0)
  const map: Record<string, number> = {}
  for (const p of players) {
    const rp = roundPlayers.find(x => x.playerId === p.id)
    const teeName = rp?.teePlayed ?? p.tee
    const tee = snapshot.tees.find(t => t.name === teeName)
    map[p.id] = tee
      ? calcCourseHandicap(p.handicapIndex, tee.slope, tee.rating, par)
      : Math.round(p.handicapIndex)
  }
  return map
}

// ─── Skins ────────────────────────────────────────────────────────────────────

export interface HoleSkinsResult {
  holeNumber: number
  winnerId: string | null  // null = tied (carry or push)
  carry: number            // skins carried INTO this hole
  skinsInPlay: number      // total skins on the line this hole
}

export interface SkinsResult {
  skinsWon: Record<string, number>
  holeResults: HoleSkinsResult[]
  totalSkins: number
  /** skins still unresolved (carryover on hole 18) */
  pendingCarry: number
}

export function calculateSkins(
  players: Player[],
  holeScores: HoleScore[],
  snapshot: CourseSnapshot,
  config: SkinsConfig,
  courseHcps: Record<string, number>,
): SkinsResult {
  const skinsWon: Record<string, number> = {}
  const holeResults: HoleSkinsResult[] = []
  players.forEach(p => (skinsWon[p.id] = 0))

  let carry = 0

  const totalHoles = snapshot.holes.length

  for (let holeNum = 1; holeNum <= totalHoles; holeNum++) {
    const hole = snapshot.holes.find(h => h.number === holeNum)
    if (!hole) continue

    const skinsInPlay = 1 + carry

    const scores = players.map(p => {
      const hs = holeScores.find(s => s.playerId === p.id && s.holeNumber === holeNum)
      if (!hs) return { playerId: p.id, score: null as number | null }
      const gross = hs.grossScore
      const net =
        config.mode === 'net'
          ? gross - strokesOnHole(courseHcps[p.id] ?? 0, hole.strokeIndex, totalHoles)
          : gross
      return { playerId: p.id, score: net }
    })

    const allScored = scores.every(s => s.score !== null)
    if (!allScored) {
      holeResults.push({ holeNumber: holeNum, winnerId: null, carry, skinsInPlay })
      continue
    }

    const valid = scores as Array<{ playerId: string; score: number }>
    const minScore = Math.min(...valid.map(s => s.score))
    const winners = valid.filter(s => s.score === minScore)

    if (winners.length === 1) {
      const winnerId = winners[0].playerId
      skinsWon[winnerId] = (skinsWon[winnerId] ?? 0) + skinsInPlay
      holeResults.push({ holeNumber: holeNum, winnerId, carry, skinsInPlay })
      carry = 0
    } else {
      if (config.carryovers) {
        holeResults.push({ holeNumber: holeNum, winnerId: null, carry, skinsInPlay })
        carry++
      } else {
        holeResults.push({ holeNumber: holeNum, winnerId: null, carry: 0, skinsInPlay: 1 })
        carry = 0
      }
    }
  }

  let pendingCarry = 0
  if (carry > 0 && config.carryovers) {
    const lastHoleNum = totalHoles
    const lastHole = snapshot.holes.find(h => h.number === lastHoleNum)
    const scoresLast = players.map(p => {
      const hs = holeScores.find(s => s.playerId === p.id && s.holeNumber === lastHoleNum)
      if (!hs || !lastHole) return { playerId: p.id, score: null as number | null }
      const gross = hs.grossScore
      const net =
        config.mode === 'net'
          ? gross - strokesOnHole(courseHcps[p.id] ?? 0, lastHole.strokeIndex, totalHoles)
          : gross
      return { playerId: p.id, score: net }
    })
    const valid18 = scoresLast.filter(s => s.score !== null) as Array<{
      playerId: string
      score: number
    }>
    if (valid18.length > 0) {
      const min18 = Math.min(...valid18.map(s => s.score))
      const tied18 = valid18.filter(s => s.score === min18)
      const perPlayer = Math.floor(carry / tied18.length)
      let rem = carry - perPlayer * tied18.length
      for (const t of tied18) {
        const extra = rem > 0 ? 1 : 0
        rem = Math.max(0, rem - 1)
        skinsWon[t.playerId] = (skinsWon[t.playerId] ?? 0) + perPlayer + extra
      }
    } else {
      pendingCarry = carry
    }
    carry = 0
  }

  const totalSkins = Object.values(skinsWon).reduce((s, n) => s + n, 0)
  return { skinsWon, holeResults, totalSkins, pendingCarry }
}

// ─── Best Ball ────────────────────────────────────────────────────────────────

export interface HoleBestBallResult {
  holeNumber: number
  bestA: number | null
  bestB: number | null
  winner: 'A' | 'B' | 'tie' | 'incomplete'
}

export interface BestBallResult {
  holesWon: { A: number; B: number; tied: number }
  totalScore: { A: number; B: number }
  winner: 'A' | 'B' | 'tie'
  holeResults: HoleBestBallResult[]
}

export function calculateBestBall(
  players: Player[],
  holeScores: HoleScore[],
  snapshot: CourseSnapshot,
  config: BestBallConfig,
  courseHcps: Record<string, number>,
): BestBallResult {
  const holesWon = { A: 0, B: 0, tied: 0 }
  const totalScore = { A: 0, B: 0 }
  const holeResults: HoleBestBallResult[] = []

  const totalHoles = snapshot.holes.length

  for (let holeNum = 1; holeNum <= totalHoles; holeNum++) {
    const hole = snapshot.holes.find(h => h.number === holeNum)
    if (!hole) continue

    let bestA: number | null = null
    let bestB: number | null = null

    for (const p of players) {
      const team = config.teams[p.id]
      if (!team) continue
      const hs = holeScores.find(s => s.playerId === p.id && s.holeNumber === holeNum)
      if (!hs) continue
      const gross = hs.grossScore
      const score =
        config.mode === 'net'
          ? gross - strokesOnHole(courseHcps[p.id] ?? 0, hole.strokeIndex, totalHoles)
          : gross
      if (team === 'A') {
        if (bestA === null || score < bestA) bestA = score
      } else {
        if (bestB === null || score < bestB) bestB = score
      }
    }

    if (bestA === null || bestB === null) {
      holeResults.push({ holeNumber: holeNum, bestA, bestB, winner: 'incomplete' })
      continue
    }

    if (config.scoring === 'total') {
      totalScore.A += bestA
      totalScore.B += bestB
    }

    let holeWinner: 'A' | 'B' | 'tie'
    if (bestA < bestB) {
      holesWon.A++
      holeWinner = 'A'
    } else if (bestB < bestA) {
      holesWon.B++
      holeWinner = 'B'
    } else {
      holesWon.tied++
      holeWinner = 'tie'
    }
    holeResults.push({ holeNumber: holeNum, bestA, bestB, winner: holeWinner })
  }

  let winner: 'A' | 'B' | 'tie'
  if (config.scoring === 'match') {
    winner = holesWon.A > holesWon.B ? 'A' : holesWon.B > holesWon.A ? 'B' : 'tie'
  } else {
    winner = totalScore.A < totalScore.B ? 'A' : totalScore.B < totalScore.A ? 'B' : 'tie'
  }

  return { holesWon, totalScore, winner, holeResults }
}

// ─── Nassau ───────────────────────────────────────────────────────────────────

export interface NassauSegmentResult {
  holeRange: string
  scores: Record<string, number>   // playerId → total strokes for segment
  winner: string | null            // playerId, or null if tied/incomplete
  tiedPlayers: string[]            // players tied for the lead
  incomplete: boolean
}

export interface NassauResult {
  front: NassauSegmentResult
  back: NassauSegmentResult
  total: NassauSegmentResult
}

function nassauSegment(
  players: Player[],
  holeScores: HoleScore[],
  snapshot: CourseSnapshot,
  config: NassauConfig,
  courseHcps: Record<string, number>,
  holeNums: number[],
  holeRange: string,
): NassauSegmentResult {
  const scores: Record<string, number> = {}
  let incomplete = false
  const totalHoles = snapshot.holes.length

  for (const p of players) {
    let total = 0
    for (const holeNum of holeNums) {
      const hole = snapshot.holes.find(h => h.number === holeNum)
      const hs = holeScores.find(s => s.playerId === p.id && s.holeNumber === holeNum)
      if (!hs || !hole) { incomplete = true; break }
      const gross = hs.grossScore
      total +=
        config.mode === 'net'
          ? gross - strokesOnHole(courseHcps[p.id] ?? 0, hole.strokeIndex, totalHoles)
          : gross
    }
    scores[p.id] = total
  }

  if (incomplete) {
    return { holeRange, scores, winner: null, tiedPlayers: [], incomplete: true }
  }

  const min = Math.min(...Object.values(scores))
  const tiedPlayers = Object.entries(scores)
    .filter(([, s]) => s === min)
    .map(([id]) => id)

  return {
    holeRange,
    scores,
    winner: tiedPlayers.length === 1 ? tiedPlayers[0] : null,
    tiedPlayers,
    incomplete: false,
  }
}

export function calculateNassau(
  players: Player[],
  holeScores: HoleScore[],
  snapshot: CourseSnapshot,
  config: NassauConfig,
  courseHcps: Record<string, number>,
): NassauResult {
  const totalHoles = snapshot.holes.length
  const half = Math.ceil(totalHoles / 2)
  const front = Array.from({ length: half }, (_, i) => i + 1)
  const back = Array.from({ length: totalHoles - half }, (_, i) => i + half + 1)
  const all = Array.from({ length: totalHoles }, (_, i) => i + 1)

  return {
    front: nassauSegment(players, holeScores, snapshot, config, courseHcps, front, `1–${half}`),
    back: nassauSegment(players, holeScores, snapshot, config, courseHcps, back, `${half + 1}–${totalHoles}`),
    total: nassauSegment(players, holeScores, snapshot, config, courseHcps, all, `1–${totalHoles}`),
  }
}

export function calculateNassauPayouts(
  result: NassauResult,
  game: Game,
  players: Player[],
  holeScores: HoleScore[],
  snapshot: CourseSnapshot,
  courseHcps: Record<string, number>,
): PlayerPayout[] {
  const presses: Press[] = (game.config as NassauConfig).presses ?? []
  // buyInCents = total per player; divide equally across 3 segments
  const totalPot = game.buyInCents * players.length
  const segPot = Math.floor(totalPot / 3)

  const map: Record<string, { amount: number; reasons: string[] }> = {}
  players.forEach(p => (map[p.id] = { amount: 0, reasons: [] }))

  const segs = [
    { seg: result.front, label: `Front (${result.front.holeRange})` },
    { seg: result.back, label: `Back (${result.back.holeRange})` },
    { seg: result.total, label: `Total (${result.total.holeRange})` },
  ]

  for (const { seg, label } of segs) {
    if (seg.incomplete) continue
    const winners = seg.winner ? [seg.winner] : seg.tiedPlayers
    if (winners.length === 0) continue
    const perWinner = Math.floor(segPot / winners.length)
    let rem = segPot - perWinner * winners.length
    for (const id of winners) {
      const extra = rem > 0 ? 1 : 0
      rem = Math.max(0, rem - extra)
      map[id].amount += perWinner + extra
      map[id].reasons.push(winners.length > 1 ? `${label} (split)` : label)
    }
  }

  // Press bets: each press creates a sub-segment from press hole to end of nine
  // Worth the same as one original segment bet per player
  const pressPot = Math.floor(game.buyInCents * players.length / 3)
  // Derive hole count from the result segments
  const frontHoles = result.front.holeRange.split('–').map(Number)
  const frontEnd = frontHoles[1] ?? 9
  const backHoles = result.back.holeRange.split('–').map(Number)
  const backEnd = backHoles[1] ?? 18

  for (const press of presses) {
    const inFront = press.holeNumber <= frontEnd
    const endHole = inFront ? frontEnd : backEnd
    const pressHoleNums = Array.from(
      { length: endHole - press.holeNumber + 1 },
      (_, i) => press.holeNumber + i
    )
    const holeRange = `${press.holeNumber}–${endHole}`
    const config = game.config as NassauConfig
    const seg = nassauSegment(players, holeScores, snapshot, config, courseHcps, pressHoleNums, holeRange)
    if (seg.incomplete) continue
    const winners = seg.winner ? [seg.winner] : seg.tiedPlayers
    if (winners.length === 0) continue
    const perWinner = Math.floor(pressPot / winners.length)
    let rem = pressPot - perWinner * winners.length
    for (const id of winners) {
      const extra = rem > 0 ? 1 : 0
      rem = Math.max(0, rem - extra)
      map[id].amount += perWinner + extra
      map[id].reasons.push(`Press ${holeRange}`)
    }
  }

  return Object.entries(map)
    .filter(([, { amount }]) => amount > 0)
    .map(([playerId, { amount, reasons }]) => ({
      playerId,
      amountCents: amount,
      reason: reasons.join(' + '),
    }))
}

// ─── Wolf ─────────────────────────────────────────────────────────────────────

/** Which player is wolf on a given hole (1-based) */
export function wolfForHole(wolfOrder: string[], holeNumber: number): string {
  return wolfOrder[(holeNumber - 1) % wolfOrder.length]
}

export interface WolfHoleResult {
  holeNumber: number
  wolfId: string
  partnerId: string | null   // null = lone wolf
  loneWolf: boolean
  wolfTeamWon: boolean | null // null = tie or incomplete
  tied: boolean
}

export interface WolfResult {
  holeResults: WolfHoleResult[]
  netUnits: Record<string, number>  // playerId → net units (can be negative)
}

export function calculateWolf(
  players: Player[],
  holeScores: HoleScore[],
  snapshot: CourseSnapshot,
  config: WolfConfig,
  courseHcps: Record<string, number>,
): WolfResult {
  const holeResults: WolfHoleResult[] = []
  const netUnits: Record<string, number> = {}
  players.forEach(p => (netUnits[p.id] = 0))

  const totalHoles = snapshot.holes.length

  for (let holeNum = 1; holeNum <= totalHoles; holeNum++) {
    const wolfId = wolfForHole(config.wolfOrder, holeNum)
    const decision = config.holeDecisions?.[holeNum]

    if (!decision) {
      holeResults.push({ holeNumber: holeNum, wolfId, partnerId: null, loneWolf: false, wolfTeamWon: null, tied: false })
      continue
    }

    const { partnerId } = decision
    const loneWolf = partnerId === null
    const hole = snapshot.holes.find(h => h.number === holeNum)
    if (!hole) continue

    const getScore = (playerId: string): number | null => {
      const hs = holeScores.find(s => s.playerId === playerId && s.holeNumber === holeNum)
      if (!hs) return null
      return config.mode === 'net'
        ? hs.grossScore - strokesOnHole(courseHcps[playerId] ?? 0, hole.strokeIndex, totalHoles)
        : hs.grossScore
    }

    const wolfScore = getScore(wolfId)

    if (loneWolf) {
      const others = players.filter(p => p.id !== wolfId)
      const otherScores = others.map(p => getScore(p.id))
      if (wolfScore === null || otherScores.some(s => s === null)) {
        holeResults.push({ holeNumber: holeNum, wolfId, partnerId: null, loneWolf: true, wolfTeamWon: null, tied: false })
        continue
      }
      const othersMin = Math.min(...(otherScores as number[]))
      const wolfWon = wolfScore < othersMin
      const tied = wolfScore === othersMin
      holeResults.push({ holeNumber: holeNum, wolfId, partnerId: null, loneWolf: true, wolfTeamWon: tied ? null : wolfWon, tied })

      if (!tied) {
        const units = 2  // lone wolf = double value
        if (wolfWon) {
          netUnits[wolfId] += units * others.length
          others.forEach(p => (netUnits[p.id] -= units))
        } else {
          netUnits[wolfId] -= units * others.length
          others.forEach(p => (netUnits[p.id] += units))
        }
      }
    } else {
      const wolfTeam = [wolfId, partnerId]
      const otherTeam = players.filter(p => !wolfTeam.includes(p.id)).map(p => p.id)
      const wolfTeamScores = wolfTeam.map(getScore)
      const otherTeamScores = otherTeam.map(getScore)

      if (wolfTeamScores.some(s => s === null) || otherTeamScores.some(s => s === null)) {
        holeResults.push({ holeNumber: holeNum, wolfId, partnerId, loneWolf: false, wolfTeamWon: null, tied: false })
        continue
      }

      const wolfBest = Math.min(...(wolfTeamScores as number[]))
      const otherBest = Math.min(...(otherTeamScores as number[]))
      const wolfWon = wolfBest < otherBest
      const tied = wolfBest === otherBest

      holeResults.push({ holeNumber: holeNum, wolfId, partnerId, loneWolf: false, wolfTeamWon: tied ? null : wolfWon, tied })

      if (!tied) {
        const winners = wolfWon ? wolfTeam : otherTeam
        const losers = wolfWon ? otherTeam : wolfTeam
        winners.forEach(id => (netUnits[id] += losers.length))
        losers.forEach(id => (netUnits[id] -= winners.length))
      }
    }
  }

  return { holeResults, netUnits }
}

export function calculateWolfPayouts(
  result: WolfResult,
  game: Game,
  players: Player[],
): PlayerPayout[] {
  const totalPot = game.buyInCents * players.length
  const positiveUnits = Object.values(result.netUnits).filter(u => u > 0).reduce((s, u) => s + u, 0)

  if (positiveUnits === 0) {
    return players.map(p => ({
      playerId: p.id,
      amountCents: Math.floor(totalPot / players.length),
      reason: 'Wolf — all square, refund',
    }))
  }

  const centsPerUnit = Math.floor(totalPot / positiveUnits)
  let remainder = totalPot - centsPerUnit * positiveUnits

  return Object.entries(result.netUnits)
    .filter(([, u]) => u > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, u]) => {
      const extra = remainder > 0 ? Math.min(u, remainder) : 0
      remainder = Math.max(0, remainder - extra)
      return {
        playerId,
        amountCents: u * centsPerUnit + extra,
        reason: `Wolf +${u} unit${u !== 1 ? 's' : ''}`,
      }
    })
}

// ─── Bingo Bango Bongo ────────────────────────────────────────────────────────

export interface BBBResult {
  pointsWon: Record<string, number>  // playerId → total points earned
  totalPoints: number
}

export function calculateBBB(
  players: Player[],
  bbbPoints: BBBPoint[],
): BBBResult {
  const pointsWon: Record<string, number> = {}
  players.forEach(p => (pointsWon[p.id] = 0))

  for (const pt of bbbPoints) {
    if (pt.bingo) { if (pointsWon[pt.bingo] !== undefined) pointsWon[pt.bingo]++; else console.warn(`BBB: unknown player ${pt.bingo}`) }
    if (pt.bango) { if (pointsWon[pt.bango] !== undefined) pointsWon[pt.bango]++; else console.warn(`BBB: unknown player ${pt.bango}`) }
    if (pt.bongo) { if (pointsWon[pt.bongo] !== undefined) pointsWon[pt.bongo]++; else console.warn(`BBB: unknown player ${pt.bongo}`) }
  }

  const totalPoints = Object.values(pointsWon).reduce((s, p) => s + p, 0)
  return { pointsWon, totalPoints }
}

export function calculateBBBPayouts(
  result: BBBResult,
  game: Game,
  players: Player[],
): PlayerPayout[] {
  const totalPot = game.buyInCents * players.length

  if (result.totalPoints === 0) {
    return players.map(p => ({
      playerId: p.id,
      amountCents: Math.floor(totalPot / players.length),
      reason: 'BBB — no points recorded, refund',
    }))
  }

  const entries = Object.entries(result.pointsWon)
    .filter(([, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1])

  const totalPoints = result.totalPoints
  let remainder = totalPot

  const payouts = entries.map(([playerId, pts]) => {
    const share = Math.floor((pts / totalPoints) * totalPot)
    remainder -= share
    return {
      playerId,
      amountCents: share,
      reason: `${pts} point${pts !== 1 ? 's' : ''} (Bingo/Bango/Bongo)`,
    }
  })

  // Distribute remainder cents to top earners
  for (let i = 0; i < payouts.length && remainder > 0; i++) {
    payouts[i].amountCents++
    remainder--
  }

  return payouts
}

// ─── Hammer ──────────────────────────────────────────────────────────────────

export interface HammerResult {
  /** Net cents per player (positive = won, negative = lost) */
  netCents: Record<string, number>
  /** Per-hole results */
  holeResults: HammerHoleResult[]
  totalHolesPlayed: number
}

export interface HammerHoleResult {
  holeNumber: number
  hammerState: HammerHoleState | null
  winnerId: string | null
  amountCents: number
}

/**
 * Calculate hammer results from hole scores and hammer states.
 * Hammer is a 2-player game. Each hole, the hammer holder can "throw" to double.
 * If declined, thrower wins the current value. If accepted, value doubles and play continues.
 * If no hammer thrown, the hole winner gets the base value.
 */
export function calculateHammer(
  players: Player[],
  holeScores: HoleScore[],
  snapshot: CourseSnapshot,
  config: HammerConfig,
  courseHcps: Record<string, number>,
): HammerResult {
  const netCents: Record<string, number> = {}
  const holeResults: HammerHoleResult[] = []
  players.forEach(p => (netCents[p.id] = 0))

  if (players.length !== 2) {
    return { netCents, holeResults, totalHolesPlayed: 0 }
  }

  const [p1, p2] = players
  const totalHoles = snapshot.holes.length

  for (let holeNum = 1; holeNum <= totalHoles; holeNum++) {
    const hole = snapshot.holes.find(h => h.number === holeNum)
    if (!hole) continue

    const hammerState = config.hammerStates?.[holeNum] ?? null

    // Get scores for both players
    const getNet = (playerId: string): number | null => {
      const hs = holeScores.find(s => s.playerId === playerId && s.holeNumber === holeNum)
      if (!hs) return null
      return hs.grossScore // Hammer is always gross
    }

    const s1 = getNet(p1.id)
    const s2 = getNet(p2.id)

    if (s1 === null || s2 === null) {
      holeResults.push({ holeNumber: holeNum, hammerState, winnerId: null, amountCents: 0 })
      continue
    }

    // If hammer was declined, the thrower wins the pre-throw value
    if (hammerState?.declined) {
      const thrower = hammerState.hammerHolder
      const decliner = hammerState.declinedBy ?? (thrower === p1.id ? p2.id : p1.id)
      // Value before the throw (half the current doubled value)
      const winAmount = Math.floor(hammerState.value / 2)
      netCents[thrower] += winAmount
      netCents[decliner] -= winAmount
      holeResults.push({ holeNumber: holeNum, hammerState, winnerId: thrower, amountCents: winAmount })
      continue
    }

    // Determine hole value
    const holeValue = hammerState?.value ?? config.baseValueCents

    // Determine winner by score
    if (s1 < s2) {
      netCents[p1.id] += holeValue
      netCents[p2.id] -= holeValue
      holeResults.push({ holeNumber: holeNum, hammerState, winnerId: p1.id, amountCents: holeValue })
    } else if (s2 < s1) {
      netCents[p2.id] += holeValue
      netCents[p1.id] -= holeValue
      holeResults.push({ holeNumber: holeNum, hammerState, winnerId: p2.id, amountCents: holeValue })
    } else {
      // Tie — push, no money exchanged
      holeResults.push({ holeNumber: holeNum, hammerState, winnerId: null, amountCents: 0 })
    }
  }

  return {
    netCents,
    holeResults,
    totalHolesPlayed: holeResults.filter(h => h.winnerId !== null).length,
  }
}

export function calculateHammerPayouts(
  result: HammerResult,
  game: Game,
  players: Player[],
): PlayerPayout[] {
  if (players.length !== 2) return []

  // In hammer, there's no traditional pot. Settlements are direct.
  // But we use the payout structure to show who won/lost net.
  const payouts: PlayerPayout[] = []
  for (const p of players) {
    const net = result.netCents[p.id] ?? 0
    if (net > 0) {
      payouts.push({
        playerId: p.id,
        amountCents: net,
        reason: `Hammer winner (${result.totalHolesPlayed} hole${result.totalHolesPlayed !== 1 ? 's' : ''} played)`,
      })
    }
  }
  return payouts
}

// ─── Payouts ──────────────────────────────────────────────────────────────────

export interface PlayerPayout {
  playerId: string
  amountCents: number
  reason: string
}

export function calculateSkinsPayouts(
  result: SkinsResult,
  game: Game,
  playerCount: number,
): PlayerPayout[] {
  const presses: Press[] = (game.config as SkinsConfig).presses ?? []
  const basePotCents = game.buyInCents * playerCount

  if (result.totalSkins === 0 && presses.length === 0) return []

  // Calculate weighted skins: each press doubles value from press hole onward
  const weightedWon: Record<string, number> = {}
  let totalWeighted = 0

  for (const hr of result.holeResults) {
    if (!hr.winnerId) continue
    // Multiplier = 2^(number of presses on or before this hole)
    const mult = Math.pow(2, presses.filter(p => p.holeNumber <= hr.holeNumber).length)
    const weighted = hr.skinsInPlay * mult
    weightedWon[hr.winnerId] = (weightedWon[hr.winnerId] ?? 0) + weighted
    totalWeighted += weighted
  }

  if (totalWeighted === 0) return []

  // Total pot increases with presses: each press adds the base pot
  const totalPot = basePotCents * (1 + presses.length)
  const centsPerUnit = Math.floor(totalPot / totalWeighted)
  let remainder = totalPot - centsPerUnit * totalWeighted

  return Object.entries(weightedWon)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, w]) => {
      const extra = remainder > 0 ? 1 : 0
      remainder = Math.max(0, remainder - extra)
      const skins = result.skinsWon[playerId] ?? 0
      return {
        playerId,
        amountCents: w * centsPerUnit + extra,
        reason: `${skins} skin${skins !== 1 ? 's' : ''}${presses.length > 0 ? ` (${presses.length} press${presses.length !== 1 ? 'es' : ''})` : ''}`,
      }
    })
}

export function calculateBestBallPayouts(
  result: BestBallResult,
  config: BestBallConfig,
  game: Game,
  players: Player[],
): PlayerPayout[] {
  const potCents = game.buyInCents * players.length

  if (result.winner === 'tie') {
    const perPlayer = Math.floor(potCents / players.length)
    return players.map(p => ({
      playerId: p.id,
      amountCents: perPlayer,
      reason: 'Tie — refund',
    }))
  }

  const winTeam = result.winner
  const winnerIds = players.filter(p => config.teams[p.id] === winTeam).map(p => p.id)
  const perWinner = Math.floor(potCents / winnerIds.length)
  let remainder = potCents - perWinner * winnerIds.length

  return winnerIds.map(pid => {
    const extra = remainder > 0 ? 1 : 0
    remainder = Math.max(0, remainder - extra)
    return {
      playerId: pid,
      amountCents: perWinner + extra,
      reason: `Best Ball winner (Team ${winTeam})`,
    }
  })
}

// ─── Settlement (treasurer-based) ─────────────────────────────────────────────

export interface Settlement {
  fromId: string
  toId: string
  amountCents: number
  note: string
}

/**
 * Treasurer collected all buy-ins. Winners receive payouts from the treasurer.
 * If treasurer is a winner, they keep their share and pay others from the pot.
 */
export function buildSettlements(
  payouts: PlayerPayout[],
  treasurerId: string,
): Settlement[] {
  return payouts
    .filter(p => p.playerId !== treasurerId)
    .map(p => ({
      fromId: treasurerId,
      toId: p.playerId,
      amountCents: p.amountCents,
      note: p.reason,
    }))
}

// ─── Venmo deep link ──────────────────────────────────────────────────────────

export function venmoLink(username: string, amountCents: number, note: string): string {
  const amount = (amountCents / 100).toFixed(2)
  const encoded = encodeURIComponent(note)
  return `venmo://paycharge?txn=pay&recipients=${username.replace('@', '')}&amount=${amount}&note=${encoded}`
}

export function venmoRequestLink(username: string, amountCents: number, note: string): string {
  const amount = (amountCents / 100).toFixed(2)
  const encoded = encodeURIComponent(note)
  return `venmo://paycharge?txn=charge&recipients=${username.replace('@', '')}&amount=${amount}&note=${encoded}`
}

export function venmoWebLink(username: string, amountCents: number, note: string): string {
  const amount = (amountCents / 100).toFixed(2)
  const encoded = encodeURIComponent(note)
  return `https://venmo.com/${username.replace('@', '')}?txn=pay&amount=${amount}&note=${encoded}`
}

export function zelleLink(identifier: string): string {
  // Zelle has no universal deep link — just open the search page
  return `https://enroll.zellepay.com/qr-codes?data=${encodeURIComponent(identifier)}`
}

export function cashAppLink(username: string, amountCents: number, note: string): string {
  const amount = (amountCents / 100).toFixed(2)
  const tag = username.replace('$', '')
  return `https://cash.app/$${tag}/${amount}?note=${encodeURIComponent(note)}`
}

export function paypalLink(email: string, amountCents: number): string {
  const amount = (amountCents / 100).toFixed(2)
  return `https://www.paypal.com/paypalme/${encodeURIComponent(email)}/${amount}`
}

// ─── Profile links (no amount — for directory/roster views) ─────────────────

export function venmoProfileLink(username: string): string {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
  const clean = username.replace('@', '')
  return isMobile ? `venmo://users/${clean}` : `https://venmo.com/${clean}`
}

export function cashAppProfileLink(username: string): string {
  return `https://cash.app/$${username.replace('$', '')}`
}

// ─── Junks (side bets) ───────────────────────────────────────────────────────

export const JUNK_LABELS: Record<JunkType, { emoji: string; name: string; description: string }> = {
  sandy: { emoji: '🏖️', name: 'Sandy', description: 'Par or better from a bunker' },
  greenie: { emoji: '🟢', name: 'Greenie', description: 'On the green in regulation (par 3s)' },
  snake: { emoji: '🐍', name: 'Snake', description: '3-putt (pays others)' },
  barkie: { emoji: '🌳', name: 'Barkie', description: 'Hit a tree, still make par' },
  ctp: { emoji: '🎯', name: 'CTP', description: 'Closest to the pin' },
}

export interface JunkResult {
  /** playerId → net cents (positive = won, negative = lost) */
  netCents: Record<string, number>
  /** Individual junk tallies per player: playerId → count */
  tallies: Record<string, Record<JunkType, number>>
}

/**
 * Calculate junk side bet net amounts.
 * Positive junks: earner gets valueCents from each other player.
 * Snake (negative): player pays valueCents to each other player.
 */
export function calculateJunks(
  players: Player[],
  junkRecords: JunkRecord[],
  config: JunkConfig,
): JunkResult {
  const netCents: Record<string, number> = {}
  const tallies: Record<string, Record<JunkType, number>> = {}
  const others = players.length - 1

  for (const p of players) {
    netCents[p.id] = 0
    tallies[p.id] = { sandy: 0, greenie: 0, snake: 0, barkie: 0, ctp: 0 }
  }

  for (const jr of junkRecords) {
    if (!config.types.includes(jr.junkType)) continue
    if (!tallies[jr.playerId]) continue

    tallies[jr.playerId][jr.junkType]++

    if (jr.junkType === 'snake') {
      // Snake: player PAYS everyone else
      netCents[jr.playerId] -= config.valueCents * others
      for (const p of players) {
        if (p.id !== jr.playerId) netCents[p.id] += config.valueCents
      }
    } else {
      // Positive junk: player GETS from everyone else
      netCents[jr.playerId] += config.valueCents * others
      for (const p of players) {
        if (p.id !== jr.playerId) netCents[p.id] -= config.valueCents
      }
    }
  }

  return { netCents, tallies }
}

// ─── Unified Settlements (game + junk through treasurer) ────────────────────

export interface UnifiedSettlement {
  fromId: string
  toId: string
  amountCents: number
  reason: string
  source: 'game' | 'junk' | 'side_bet'
}

/**
 * Build unified settlements merging game payouts and junk side bets.
 * All flows go through the treasurer (hub-and-spoke model).
 * Bidirectional flows between the same pair are netted out.
 */
export function buildUnifiedSettlements(
  payouts: PlayerPayout[],
  treasurerId: string,
  junkResult: JunkResult | null,
  sideBetSettlements: SideBetSettlement[] = [],
): UnifiedSettlement[] {
  // Accumulate net flows: key = "fromId→toId", value = { amountCents, reasons }
  const flows: Record<string, { amountCents: number; reasons: { reason: string; source: 'game' | 'junk' | 'side_bet' }[] }> = {}

  const addFlow = (fromId: string, toId: string, amountCents: number, reason: string, source: 'game' | 'junk' | 'side_bet') => {
    if (amountCents <= 0 || fromId === toId) return
    const key = `${fromId}→${toId}`
    if (!flows[key]) flows[key] = { amountCents: 0, reasons: [] }
    flows[key].amountCents += amountCents
    flows[key].reasons.push({ reason, source })
  }

  // Game payouts: treasurer pays each winner (excluding self)
  for (const p of payouts) {
    if (p.playerId !== treasurerId) {
      addFlow(treasurerId, p.playerId, p.amountCents, p.reason, 'game')
    }
  }

  // Junk settlements through treasurer
  if (junkResult) {
    for (const [playerId, netCents] of Object.entries(junkResult.netCents)) {
      if (netCents > 0 && playerId !== treasurerId) {
        // Player won junk money → treasurer pays them
        addFlow(treasurerId, playerId, netCents, 'Junk winnings', 'junk')
      } else if (netCents < 0 && playerId !== treasurerId) {
        // Player lost junk money → they owe treasurer
        addFlow(playerId, treasurerId, Math.abs(netCents), 'Junk losses', 'junk')
      }
    }
    // Treasurer's own junk net is handled implicitly (kept from/added to pot)
  }

  // Side bet settlements: direct player-to-player (not through treasurer)
  for (const sbs of sideBetSettlements) {
    addFlow(sbs.fromId, sbs.toId, sbs.amountCents, `Side bet: ${sbs.description}`, 'side_bet')
  }

  // Net out bidirectional flows between same pair
  const settlements: UnifiedSettlement[] = []
  const processed = new Set<string>()

  for (const key of Object.keys(flows)) {
    if (processed.has(key)) continue
    const [fromId, toId] = key.split('→')
    const reverseKey = `${toId}→${fromId}`
    processed.add(key)
    processed.add(reverseKey)

    const forward = flows[key]?.amountCents ?? 0
    const reverse = flows[reverseKey]?.amountCents ?? 0
    const net = forward - reverse

    if (net === 0) continue

    const actualFromId = net > 0 ? fromId : toId
    const actualToId = net > 0 ? toId : fromId
    const sourceFlows = net > 0 ? flows[key] : flows[reverseKey]
    // Use the dominant direction's reasons; if netted, label accordingly
    const reasons = sourceFlows?.reasons ?? []
    const hasGame = reasons.some(r => r.source === 'game')
    const hasJunk = reasons.some(r => r.source === 'junk')
    const hasSideBet = reasons.some(r => r.source === 'side_bet')
    const source: 'game' | 'junk' | 'side_bet' = hasGame ? 'game' : hasJunk ? 'junk' : 'side_bet'

    // Build a combined reason string
    let reason: string
    const sourceCount = [hasGame, hasJunk, hasSideBet].filter(Boolean).length
    if (sourceCount > 1) {
      const gameReasons = reasons.filter(r => r.source === 'game').map(r => r.reason).join(', ')
      const parts = [gameReasons, hasJunk ? 'junk' : '', hasSideBet ? 'side bets' : ''].filter(Boolean)
      reason = `${parts.join(' + ')} (netted)`
    } else if (net !== forward && net !== -reverse) {
      // Partial netting happened
      reason = reasons.map(r => r.reason).join(', ') + ' (netted)'
    } else {
      reason = reasons.map(r => r.reason).join(', ')
    }

    settlements.push({
      fromId: actualFromId,
      toId: actualToId,
      amountCents: Math.abs(net),
      reason,
      source: sourceCount > 1 ? 'game' : source,
    })
  }

  return settlements
}

// ─── Side Bet Settlements ────────────────────────────────────────────────────

export interface SideBetSettlement {
  fromId: string
  toId: string
  amountCents: number
  description: string
}

/**
 * Calculate settlements from resolved side bets.
 * Each resolved side bet: every non-winner participant pays the winner amountCents.
 */
export function calculateSideBetSettlements(sideBets: SideBet[]): SideBetSettlement[] {
  const settlements: SideBetSettlement[] = []
  for (const bet of sideBets) {
    if (bet.status !== 'resolved' || !bet.winnerPlayerId) continue
    const losers = bet.participants.filter(id => id !== bet.winnerPlayerId)
    for (const loserId of losers) {
      settlements.push({
        fromId: loserId,
        toId: bet.winnerPlayerId,
        amountCents: bet.amountCents,
        description: bet.description,
      })
    }
  }
  return settlements
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  )
}
