import { useEffect, useState } from 'react'
import { ConfirmModal } from '../ConfirmModal'
import { supabase, rowToRound, rowToHoleScore, rowToRoundPlayer, rowToJunkRecord } from '../../lib/supabase'
import { buildCourseHandicaps, calculateSkinsPayouts, calculateSkins, calculateBestBallPayouts, calculateBestBall, calculateNassauPayouts, calculateNassau, calculateWolfPayouts, calculateWolf, calculateBBBPayouts, calculateBBB, calculateJunks } from '../../lib/gameLogic'
import type { Round, HoleScore, RoundPlayer, Player, CourseSnapshot, SkinsConfig, BestBallConfig, NassauConfig, WolfConfig, BBBPoint, JunkRecord, GameType } from '../../types'

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

interface RoundResult {
  id: string
  date: Date
  courseName: string
  gameType: GameType | null
  buyInCents: number
  players: { name: string; gross: number; netWinningsCents: number }[]
}

const GAME_EMOJIS: Record<GameType, string> = {
  skins: '🎰',
  best_ball: '🤝',
  nassau: '🏳️',
  wolf: '🐺',
  bingo_bango_bongo: '⭐',
  hammer: '🔨',
}

export function Stats({ userId, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [totalRounds, setTotalRounds] = useState(0)
  const [scoreDist, setScoreDist] = useState<ScoreDistribution>({ eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, worse: 0 })
  const [mostPlayedCourse, setMostPlayedCourse] = useState('')
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])
  const [view, setView] = useState<'lifetime' | 'by-round'>('lifetime')

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
    const roundResultsArr: RoundResult[] = []

    for (const round of rounds) {
      const players: Player[] = round.players ?? []
      const snapshot: CourseSnapshot | undefined = round.courseSnapshot
      if (!players.length || !snapshot) continue

      const roundScores = allScores.filter(s => s.roundId === round.id)
      const roundPlayers = allRoundPlayers.filter(rp => rp.roundId === round.id)

      // Per-round result tracking
      const roundPlayerResults: { name: string; gross: number; netWinningsCents: number }[] = []
      const roundNetMap = new Map<string, number>()

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

        roundNetMap.set(player.id, 0)
        roundPlayerResults.push({ name: player.name, gross, netWinningsCents: 0 })

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
          roundNetMap.set(payout.playerId, (roundNetMap.get(payout.playerId) ?? 0) + (payout.amountCents - buyIn))
        }
        // Players who didn't win lose their buy-in
        for (const player of players) {
          const hasPayout = payouts.some(p => p.playerId === player.id)
          if (!hasPayout) {
            const entry = playerMap.get(player.id)
            if (entry) entry.winningsCents -= buyIn
            roundNetMap.set(player.id, (roundNetMap.get(player.id) ?? 0) - buyIn)
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
            const junkNet = junkResult.netCents[player.id] ?? 0
            if (entry) entry.winningsCents += junkNet
            roundNetMap.set(player.id, (roundNetMap.get(player.id) ?? 0) + junkNet)
          }
        }
      }

      // Update per-round player results with net winnings
      for (let i = 0; i < players.length; i++) {
        roundPlayerResults[i].netWinningsCents = roundNetMap.get(players[i].id) ?? 0
      }

      roundResultsArr.push({
        id: round.id,
        date: round.date,
        courseName: snapshot.courseName,
        gameType: round.game?.type ?? null,
        buyInCents: round.game?.buyInCents ?? 0,
        players: roundPlayerResults,
      })
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
    setRoundResults(roundResultsArr.sort((a, b) => b.date.getTime() - a.date.getTime()))
    setLoading(false)
  }

  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const handleResetStats = async () => {
    setResetting(true)
    try {
      // Get completed round IDs
      const { data: roundRows } = await supabase.from('rounds').select('id').eq('status', 'complete')
      const roundIds = (roundRows ?? []).map((r: any) => r.id)
      if (roundIds.length > 0) {
        await Promise.all([
          supabase.from('settlements').delete().in('round_id', roundIds),
          supabase.from('hole_scores').delete().in('round_id', roundIds),
          supabase.from('bbb_points').delete().in('round_id', roundIds),
          supabase.from('junk_records').delete().in('round_id', roundIds),
          supabase.from('round_players').delete().in('round_id', roundIds),
          supabase.from('buy_ins').delete().in('round_id', roundIds),
        ])
        await supabase.from('rounds').delete().in('id', roundIds)
      }
      setStats([])
      setRoundResults([])
      setTotalRounds(0)
      setScoreDist({ eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, worse: 0 })
      setMostPlayedCourse('')
    } catch (err) {
      console.error('Reset stats failed:', err)
    }
    setResetting(false)
    setShowResetConfirm(false)
  }

  const fmtMoney = (cents: number) => {
    const abs = Math.abs(cents)
    const str = `$${(abs / 100).toFixed(abs % 100 === 0 ? 0 : 2)}`
    return cents < 0 ? `-${str}` : `+${str}`
  }

  const fmtDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
            {/* View Toggle */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <button
                onClick={() => setView('lifetime')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  view === 'lifetime' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500'
                }`}
              >
                Lifetime
              </button>
              <button
                onClick={() => setView('by-round')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  view === 'by-round' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500'
                }`}
              >
                By Round
              </button>
            </div>

            {view === 'lifetime' && (
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
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display font-semibold text-gray-800 text-base">Lifetime Standings</h2>
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg font-semibold active:bg-red-50"
                    >
                      Reset Stats
                    </button>
                  </div>
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

            {view === 'by-round' && (
              <section className="space-y-3">
                {roundResults.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No round data available</p>
                ) : roundResults.map(rr => (
                  <div key={rr.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{rr.courseName}</p>
                        <p className="text-xs text-gray-500">{fmtDate(rr.date)}</p>
                      </div>
                      <div className="text-right">
                        {rr.gameType && (
                          <span className="text-sm">{GAME_EMOJIS[rr.gameType]} {rr.gameType.replace(/_/g, ' ')}</span>
                        )}
                        {rr.buyInCents > 0 && (
                          <p className="text-xs text-gray-400">${(rr.buyInCents / 100).toFixed(0)} buy-in</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {rr.players
                        .sort((a, b) => b.netWinningsCents - a.netWinningsCents)
                        .map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 font-medium">{p.name}</span>
                            {p.gross > 0 && <span className="text-gray-400 text-xs">{p.gross}</span>}
                          </div>
                          {rr.buyInCents > 0 && (
                            <span className={`font-semibold ${
                              p.netWinningsCents > 0 ? 'text-green-700' :
                              p.netWinningsCents < 0 ? 'text-red-600' :
                              'text-gray-400'
                            }`}>
                              {p.netWinningsCents === 0 ? '$0' : fmtMoney(p.netWinningsCents)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
      <ConfirmModal
        open={showResetConfirm}
        title="Reset All Stats?"
        message="This will permanently delete all completed rounds, scores, and settlement history. Active rounds are not affected. This cannot be undone."
        confirmLabel={resetting ? 'Resetting...' : 'Reset Everything'}
        destructive
        onConfirm={handleResetStats}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
