import { useEffect, useState } from 'react'
import { supabase, rowToRound, rowToHoleScore, rowToRoundPlayer, rowToJunkRecord } from '../../lib/supabase'
import { buildCourseHandicaps, calculateSkinsPayouts, calculateSkins, calculateBestBallPayouts, calculateBestBall, calculateNassauPayouts, calculateNassau, calculateWolfPayouts, calculateWolf, calculateBBBPayouts, calculateBBB, calculateJunks } from '../../lib/gameLogic'
import type { Round, HoleScore, RoundPlayer, Player, CourseSnapshot, SkinsConfig, BestBallConfig, NassauConfig, WolfConfig, BBBPoint, JunkRecord } from '../../types'

interface Props {
  userId: string
  onBack: () => void
}

interface PlayerStats {
  id: string
  name: string
  roundsPlayed: number
  totalGross: number
  bestGross: number | null
  totalWinningsCents: number
  roundsWon: number
}

interface ScoreDistribution {
  eagles: number
  birdies: number
  pars: number
  bogeys: number
  doubles: number
  worse: number
}

export function Stats({ userId, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [totalRounds, setTotalRounds] = useState(0)
  const [scoreDist, setScoreDist] = useState<ScoreDistribution>({ eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, worse: 0 })
  const [mostPlayedCourse, setMostPlayedCourse] = useState('')

  useEffect(() => {
    loadStats()
  }, [userId])

  const loadStats = async () => {
    // Fetch all completed rounds
    const { data: roundRows, error: roundError } = await supabase
      .from('rounds')
      .select('*')
      .eq('status', 'complete')

    if (roundError) {
      setLoading(false)
      return
    }

    if (!roundRows || roundRows.length === 0) {
      setLoading(false)
      return
    }

    const rounds: Round[] = roundRows.map(rowToRound)
    setTotalRounds(rounds.length)

    const roundIds = rounds.map(r => r.id)

    // Fetch all scores and round_players for completed rounds
    const [scoresRes, rpRes, bbbRes, junkRes] = await Promise.all([
      supabase.from('hole_scores').select('*').in('round_id', roundIds),
      supabase.from('round_players').select('*').in('round_id', roundIds),
      supabase.from('bbb_points').select('*').in('round_id', roundIds),
      supabase.from('junk_records').select('*').in('round_id', roundIds),
    ])

    const allScores: HoleScore[] = (scoresRes.data ?? []).map(rowToHoleScore)
    const allRoundPlayers: RoundPlayer[] = (rpRes.data ?? []).map(rowToRoundPlayer)
    const allBbbPoints: BBBPoint[] = (bbbRes.data ?? []).map((r: any) => ({
      id: r.id, roundId: r.round_id, holeNumber: r.hole_number,
      bingo: r.bingo, bango: r.bango, bongo: r.bongo,
    }))
    const allJunkRecords: JunkRecord[] = (junkRes.data ?? []).map(rowToJunkRecord)

    // Build player map from round snapshots
    const playerMap = new Map<string, { name: string; roundsPlayed: number; grossTotals: number[]; winningsCents: number; roundsWon: number }>()
    const dist: ScoreDistribution = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, worse: 0 }
    const courseCounts = new Map<string, number>()

    for (const round of rounds) {
      const players: Player[] = round.players ?? []
      const snapshot: CourseSnapshot | undefined = round.courseSnapshot
      if (!players.length || !snapshot) continue

      const roundScores = allScores.filter(s => s.roundId === round.id)
      const roundPlayers = allRoundPlayers.filter(rp => rp.roundId === round.id)

      // Gross totals per player
      for (const player of players) {
        const pScores = roundScores.filter(s => s.playerId === player.id)
        const gross = pScores.reduce((s, sc) => s + sc.grossScore, 0)

        if (!playerMap.has(player.id)) {
          playerMap.set(player.id, { name: player.name, roundsPlayed: 0, grossTotals: [], winningsCents: 0, roundsWon: 0 })
        }
        const entry = playerMap.get(player.id)!
        entry.roundsPlayed++
        if (pScores.length >= snapshot.holes.length) {
          entry.grossTotals.push(gross)
        }

        // Scoring distribution (all players combined)
        for (const sc of pScores) {
          const hole = snapshot.holes.find(h => h.number === sc.holeNumber)
          if (!hole) continue
          const diff = sc.grossScore - hole.par
          if (sc.grossScore === 1 || diff <= -2) dist.eagles++
          else if (diff === -1) dist.birdies++
          else if (diff === 0) dist.pars++
          else if (diff === 1) dist.bogeys++
          else if (diff === 2) dist.doubles++
          else dist.worse++
        }
      }

      // Track course frequency
      if (snapshot.courseName) {
        courseCounts.set(snapshot.courseName, (courseCounts.get(snapshot.courseName) ?? 0) + 1)
      }

      // Calculate payouts for this round
      if (round.game && round.game.buyInCents > 0) {
        const chm = buildCourseHandicaps(players, roundPlayers, snapshot)
        let payouts: { playerId: string; amountCents: number }[] = []

        try {
          const game = round.game
          if (game.type === 'skins') {
            const result = calculateSkins(players, roundScores, snapshot, game.config as SkinsConfig, chm)
            payouts = calculateSkinsPayouts(result, game, players.length)
          } else if (game.type === 'best_ball') {
            const result = calculateBestBall(players, roundScores, snapshot, game.config as BestBallConfig, chm)
            payouts = calculateBestBallPayouts(result, game.config as BestBallConfig, game, players)
          } else if (game.type === 'nassau') {
            const result = calculateNassau(players, roundScores, snapshot, game.config as NassauConfig, chm)
            payouts = calculateNassauPayouts(result, game, players, roundScores, snapshot, chm)
          } else if (game.type === 'wolf') {
            const result = calculateWolf(players, roundScores, snapshot, game.config as WolfConfig, chm)
            payouts = calculateWolfPayouts(result, game, players)
          } else if (game.type === 'bingo_bango_bongo') {
            const roundBbb = allBbbPoints.filter(b => b.roundId === round.id)
            const result = calculateBBB(players, roundBbb)
            payouts = calculateBBBPayouts(result, game, players)
          }
        } catch {
          // Skip rounds with calculation errors
        }

        const buyIn = round.game.buyInCents
        for (const payout of payouts) {
          const entry = playerMap.get(payout.playerId)
          if (entry) {
            entry.winningsCents += (payout.amountCents - buyIn)
            if (payout.amountCents > buyIn) entry.roundsWon++
          }
        }
        // Players who didn't win lose their buy-in
        for (const player of players) {
          const hasPayout = payouts.some(p => p.playerId === player.id)
          if (!hasPayout) {
            const entry = playerMap.get(player.id)
            if (entry) entry.winningsCents -= buyIn
          }
        }
      }

      // Junk side bets (independent of main game)
      if (round.junkConfig) {
        const roundJunks = allJunkRecords.filter(jr => jr.roundId === round.id)
        if (roundJunks.length > 0) {
          const junkResult = calculateJunks(players, roundJunks, round.junkConfig)
          for (const player of players) {
            const entry = playerMap.get(player.id)
            if (entry) entry.winningsCents += (junkResult.netCents[player.id] ?? 0)
          }
        }
      }
    }

    setScoreDist(dist)
    // Most played course
    let maxCount = 0
    let topCourse = ''
    for (const [name, count] of courseCounts) {
      if (count > maxCount) { maxCount = count; topCourse = name }
    }
    setMostPlayedCourse(topCourse)

    // Convert to sorted array
    const statsArr: PlayerStats[] = Array.from(playerMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      roundsPlayed: data.roundsPlayed,
      totalGross: data.grossTotals.length > 0
        ? Math.round(data.grossTotals.reduce((a, b) => a + b, 0) / data.grossTotals.length)
        : 0,
      bestGross: data.grossTotals.length > 0
        ? Math.min(...data.grossTotals)
        : null,
      totalWinningsCents: data.winningsCents,
      roundsWon: data.roundsWon,
    }))

    statsArr.sort((a, b) => b.totalWinningsCents - a.totalWinningsCents)
    setStats(statsArr)
    setLoading(false)
  }

  const fmtMoney = (cents: number) => {
    const abs = Math.abs(cents)
    const str = `$${(abs / 100).toFixed(abs % 100 === 0 ? 0 : 2)}`
    return cents < 0 ? `-${str}` : `+${str}`
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button onClick={onBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-600 text-xl" aria-label="Back">←</button>
        <h1 className="text-xl font-bold">Leaderboard</h1>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-500 font-medium">No completed rounds yet</p>
            <p className="text-gray-400 text-sm mt-1">Stats will appear after your first round</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 flex gap-3">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-gray-900 font-display">{totalRounds}</p>
                <p className="text-xs text-gray-500">Rounds</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-gray-900 font-display">{stats.length}</p>
                <p className="text-xs text-gray-500">Players</p>
              </div>
              {mostPlayedCourse && (
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold text-gray-900 font-display truncate">{mostPlayedCourse}</p>
                  <p className="text-xs text-gray-500">Top Course</p>
                </div>
              )}
            </div>

            {/* Scoring Distribution */}
            {(scoreDist.eagles + scoreDist.birdies + scoreDist.pars + scoreDist.bogeys + scoreDist.doubles + scoreDist.worse) > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
                <h2 className="font-display font-semibold text-gray-800 text-base mb-3">Scoring Distribution</h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Eagles+', count: scoreDist.eagles, color: 'bg-yellow-50 text-yellow-700' },
                    { label: 'Birdies', count: scoreDist.birdies, color: 'bg-green-50 text-green-700' },
                    { label: 'Pars', count: scoreDist.pars, color: 'bg-gray-50 text-gray-700' },
                    { label: 'Bogeys', count: scoreDist.bogeys, color: 'bg-orange-50 text-orange-700' },
                    { label: 'Doubles', count: scoreDist.doubles, color: 'bg-red-50 text-red-600' },
                    { label: 'Worse', count: scoreDist.worse, color: 'bg-red-50 text-red-700' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className={`rounded-xl p-2 ${color}`}>
                      <p className="text-lg font-bold font-display">{count}</p>
                      <p className="text-xs">{label}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="font-display font-semibold text-gray-800 text-base mb-3">Lifetime Standings</h2>
              <div className="space-y-2">
                {stats.map((player, i) => (
                  <div key={player.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm font-display ${
                        i === 0 ? 'bg-yellow-400 text-yellow-900' :
                        i === 1 ? 'bg-gray-300 text-gray-700' :
                        i === 2 ? 'bg-amber-600 text-amber-100' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{player.name}</p>
                        <p className="text-sm text-gray-500">
                          {player.roundsPlayed} round{player.roundsPlayed !== 1 ? 's' : ''}
                          {player.totalGross > 0 && ` · Avg ${player.totalGross}`}
                          {player.bestGross && ` · Best ${player.bestGross}`}
                          {player.roundsPlayed > 0 && ` · ${Math.round((player.roundsWon / player.roundsPlayed) * 100)}% win`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold font-display text-lg ${
                          player.totalWinningsCents > 0 ? 'text-green-700' :
                          player.totalWinningsCents < 0 ? 'text-red-600' :
                          'text-gray-500'
                        }`}>
                          {player.totalWinningsCents === 0 ? '$0' : fmtMoney(player.totalWinningsCents)}
                        </p>
                        <p className="text-xs text-gray-400">net</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
