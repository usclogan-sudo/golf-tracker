import type {
  Player,
  CourseSnapshot,
  HoleScore,
  SkinsConfig,
  BestBallConfig,
  NassauConfig,
  WolfConfig,
  BBBPoint,
  Game,
  RoundPlayer,
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
export function strokesOnHole(courseHcp: number, strokeIndex: number): number {
  let s = 0
  if (courseHcp >= strokeIndex) s++
  if (courseHcp >= 18 + strokeIndex) s++
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

  for (let holeNum = 1; holeNum <= 18; holeNum++) {
    const hole = snapshot.holes.find(h => h.number === holeNum)
    if (!hole) continue

    const skinsInPlay = 1 + carry

    const scores = players.map(p => {
      const hs = holeScores.find(s => s.playerId === p.id && s.holeNumber === holeNum)
      if (!hs) return { playerId: p.id, score: null as number | null }
      const gross = hs.grossScore
      const net =
        config.mode === 'net'
          ? gross - strokesOnHole(courseHcps[p.id] ?? 0, hole.strokeIndex)
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
    const hole18 = snapshot.holes.find(h => h.number === 18)
    const scores18 = players.map(p => {
      const hs = holeScores.find(s => s.playerId === p.id && s.holeNumber === 18)
      if (!hs || !hole18) return { playerId: p.id, score: null as number | null }
      const gross = hs.grossScore
      const net =
        config.mode === 'net'
          ? gross - strokesOnHole(courseHcps[p.id] ?? 0, hole18.strokeIndex)
          : gross
      return { playerId: p.id, score: net }
    })
    const valid18 = scores18.filter(s => s.score !== null) as Array<{
      playerId: string
      score: number
    }>
    if (valid18.length > 0) {
      const min18 = Math.min(...valid18.map(s => s.score))
      const tied18 = valid18.filter(s => s.score === min18)
      const perPlayer = Math.floor(carry / tied18.length)
      for (const t of tied18) {
        skinsWon[t.playerId] = (skinsWon[t.playerId] ?? 0) + perPlayer
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

  for (let holeNum = 1; holeNum <= 18; holeNum++) {
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
          ? gross - strokesOnHole(courseHcps[p.id] ?? 0, hole.strokeIndex)
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

  for (const p of players) {
    let total = 0
    for (const holeNum of holeNums) {
      const hole = snapshot.holes.find(h => h.number === holeNum)
      const hs = holeScores.find(s => s.playerId === p.id && s.holeNumber === holeNum)
      if (!hs || !hole) { incomplete = true; break }
      const gross = hs.grossScore
      total +=
        config.mode === 'net'
          ? gross - strokesOnHole(courseHcps[p.id] ?? 0, hole.strokeIndex)
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
  const front9 = Array.from({ length: 9 }, (_, i) => i + 1)
  const back9 = Array.from({ length: 9 }, (_, i) => i + 10)
  const all18 = Array.from({ length: 18 }, (_, i) => i + 1)

  return {
    front: nassauSegment(players, holeScores, snapshot, config, courseHcps, front9, '1–9'),
    back: nassauSegment(players, holeScores, snapshot, config, courseHcps, back9, '10–18'),
    total: nassauSegment(players, holeScores, snapshot, config, courseHcps, all18, '1–18'),
  }
}

export function calculateNassauPayouts(
  result: NassauResult,
  game: Game,
  players: Player[],
): PlayerPayout[] {
  // buyInCents = total per player; divide equally across 3 segments
  const totalPot = game.buyInCents * players.length
  const segPot = Math.floor(totalPot / 3)

  const map: Record<string, { amount: number; reasons: string[] }> = {}
  players.forEach(p => (map[p.id] = { amount: 0, reasons: [] }))

  const segs = [
    { seg: result.front, label: 'Front 9 (1–9)' },
    { seg: result.back, label: 'Back 9 (10–18)' },
    { seg: result.total, label: 'Total (1–18)' },
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

  for (let holeNum = 1; holeNum <= 18; holeNum++) {
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
        ? hs.grossScore - strokesOnHole(courseHcps[playerId] ?? 0, hole.strokeIndex)
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

  return Object.entries(result.netUnits)
    .filter(([, u]) => u > 0)
    .map(([playerId, u]) => ({
      playerId,
      amountCents: Math.floor((u / positiveUnits) * totalPot),
      reason: `Wolf +${u} unit${u !== 1 ? 's' : ''}`,
    }))
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
    if (pt.bingo && pointsWon[pt.bingo] !== undefined) pointsWon[pt.bingo]++
    if (pt.bango && pointsWon[pt.bango] !== undefined) pointsWon[pt.bango]++
    if (pt.bongo && pointsWon[pt.bongo] !== undefined) pointsWon[pt.bongo]++
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

  return Object.entries(result.pointsWon)
    .filter(([, pts]) => pts > 0)
    .map(([playerId, pts]) => {
      const share = Math.floor((pts / result.totalPoints) * totalPot)
      return {
        playerId,
        amountCents: share,
        reason: `${pts} point${pts !== 1 ? 's' : ''} (Bingo/Bango/Bongo)`,
      }
    })
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
  const potCents = game.buyInCents * playerCount
  if (result.totalSkins === 0) return []
  const centsPerSkin = Math.floor(potCents / result.totalSkins)
  let remainder = potCents - centsPerSkin * result.totalSkins

  return Object.entries(result.skinsWon)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, skins]) => {
      const extra = remainder > 0 ? 1 : 0
      remainder = Math.max(0, remainder - extra)
      return {
        playerId,
        amountCents: skins * centsPerSkin + extra,
        reason: `${skins} skin${skins !== 1 ? 's' : ''}`,
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

// ─── Formatting ───────────────────────────────────────────────────────────────

export function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  )
}
