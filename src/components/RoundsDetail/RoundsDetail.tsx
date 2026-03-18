import { useEffect, useState, useMemo } from 'react'
import { supabase, rowToRound, rowToHoleScore } from '../../lib/supabase'
import type { Round, HoleScore, GameType } from '../../types'

interface Props {
  userId: string
  onBack: () => void
}

const GAME_LABELS: Record<GameType, string> = {
  skins: 'Skins',
  best_ball: 'Best Ball',
  nassau: 'Nassau',
  wolf: 'Wolf',
  bingo_bango_bongo: 'BBB',
}

export function RoundsDetail({ userId, onBack }: Props) {
  const [rounds, setRounds] = useState<Round[]>([])
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('rounds').select('*').order('date', { ascending: false }),
      supabase.from('hole_scores').select('*'),
    ]).then(([roundsRes, scoresRes]) => {
      if (roundsRes.data) setRounds(roundsRes.data.map(rowToRound))
      if (scoresRes.data) setHoleScores(scoresRes.data.map(rowToHoleScore))
      setLoading(false)
    })
  }, [userId])

  const stats = useMemo(() => {
    const complete = rounds.filter(r => r.status === 'complete')
    const byType: Record<string, number> = {}
    let wins = 0
    let losses = 0

    for (const r of complete) {
      const gt = r.game?.type ?? 'unknown'
      byType[gt] = (byType[gt] ?? 0) + 1
    }

    // Monthly breakdown
    const monthly: Record<string, { rounds: number }> = {}
    for (const r of complete) {
      const key = r.date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
      if (!monthly[key]) monthly[key] = { rounds: 0 }
      monthly[key].rounds++
    }

    // Most recent round
    const mostRecent = complete[0]

    return { total: rounds.length, complete: complete.length, byType, wins, losses, monthly, mostRecent }
  }, [rounds, userId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800 text-xl" aria-label="Back">←</button>
        <h1 className="text-xl font-bold">Rounds</h1>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* Overview */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Overview</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Rounds</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{stats.complete}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </section>

        {/* By Game Type */}
        {Object.keys(stats.byType).length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">By Game Type</p>
            <div className="space-y-2">
              {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="font-semibold text-gray-800">{GAME_LABELS[type as GameType] ?? type}</span>
                  <span className="font-bold text-amber-600">{count} round{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Monthly Activity */}
        {Object.keys(stats.monthly).length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Monthly Activity</p>
            <div className="space-y-2">
              {Object.entries(stats.monthly).map(([month, data]) => (
                <div key={month} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="font-semibold text-gray-700">{month}</span>
                  <span className="text-gray-600 text-sm">{data.rounds} round{data.rounds !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Most Recent */}
        {stats.mostRecent && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Most Recent</p>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="font-bold text-gray-800">{stats.mostRecent.courseSnapshot?.courseName ?? 'Unknown'}</p>
              <p className="text-sm text-gray-600 mt-1">
                {stats.mostRecent.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                {stats.mostRecent.game?.type && ` · ${GAME_LABELS[stats.mostRecent.game.type] ?? stats.mostRecent.game.type}`}
                {stats.mostRecent.players && ` · ${stats.mostRecent.players.length} players`}
              </p>
            </div>
          </section>
        )}

        {rounds.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">⛳</p>
            <p className="text-gray-500 font-medium">No rounds yet</p>
            <p className="text-gray-400 text-sm mt-1">Start your first round from the home screen</p>
          </div>
        )}
      </div>
    </div>
  )
}
