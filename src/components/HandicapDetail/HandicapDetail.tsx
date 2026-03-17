import { useEffect, useState, useMemo } from 'react'
import { supabase, rowToRound, rowToHoleScore } from '../../lib/supabase'
import type { Round, HoleScore, UserProfile } from '../../types'

interface Props {
  userId: string
  userProfile: UserProfile | null
  onBack: () => void
}

interface RoundEntry {
  date: Date
  courseName: string
  gross: number
  par: number
}

export function HandicapDetail({ userId, userProfile, onBack }: Props) {
  const [rounds, setRounds] = useState<Round[]>([])
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('rounds').select('*').eq('status', 'complete').order('date', { ascending: false }),
      supabase.from('hole_scores').select('*'),
    ]).then(([roundsRes, scoresRes]) => {
      if (roundsRes.data) setRounds(roundsRes.data.map(rowToRound))
      if (scoresRes.data) setHoleScores(scoresRes.data.map(rowToHoleScore))
      setLoading(false)
    })
  }, [userId])

  const roundEntries = useMemo((): RoundEntry[] => {
    const entries: RoundEntry[] = []
    for (const r of rounds) {
      const myScores = holeScores.filter(s => s.roundId === r.id && s.playerId === userId)
      if (myScores.length === 0) continue
      const gross = myScores.reduce((sum, s) => sum + s.grossScore, 0)
      const par = r.courseSnapshot?.holes.reduce((s, h) => s + h.par, 0) ?? 72
      entries.push({
        date: r.date,
        courseName: r.courseSnapshot?.courseName ?? 'Unknown',
        gross,
        par,
      })
    }
    return entries
  }, [rounds, holeScores, userId])

  const last10 = roundEntries.slice(0, 10)
  const bestRound = roundEntries.length > 0 ? roundEntries.reduce((best, e) => e.gross < best.gross ? e : best) : null
  const worstRound = roundEntries.length > 0 ? roundEntries.reduce((worst, e) => e.gross > worst.gross ? e : worst) : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800 text-xl" aria-label="Back">←</button>
        <h1 className="text-xl font-bold">Handicap</h1>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* Current Handicap */}
        <section className="bg-white rounded-2xl shadow-sm p-4 text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Handicap Index</p>
          <p className="text-5xl font-bold gold-text font-display">
            {userProfile?.handicapIndex != null ? userProfile.handicapIndex : '—'}
          </p>
        </section>

        {/* Best / Worst */}
        {(bestRound || worstRound) && (
          <div className="grid grid-cols-2 gap-3">
            {bestRound && (
              <section className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Best Round</p>
                <p className="text-2xl font-bold text-gray-800">{bestRound.gross}</p>
                <p className="text-xs text-gray-500 mt-1">{bestRound.courseName}</p>
                <p className="text-xs text-gray-400">{bestRound.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
              </section>
            )}
            {worstRound && (
              <section className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Worst Round</p>
                <p className="text-2xl font-bold text-gray-800">{worstRound.gross}</p>
                <p className="text-xs text-gray-500 mt-1">{worstRound.courseName}</p>
                <p className="text-xs text-gray-400">{worstRound.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
              </section>
            )}
          </div>
        )}

        {/* Last 10 Rounds */}
        {last10.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last {last10.length} Rounds</p>
            <div className="space-y-2">
              {last10.map((entry, i) => {
                const vsPar = entry.gross - entry.par
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{entry.courseName}</p>
                      <p className="text-xs text-gray-400">{entry.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{entry.gross}</p>
                      <p className={`text-xs font-semibold ${vsPar > 0 ? 'text-red-500' : vsPar < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {vsPar > 0 ? '+' : ''}{vsPar}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {roundEntries.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-500 font-medium">No scoring data yet</p>
            <p className="text-gray-400 text-sm mt-1">Complete a round to see your trend</p>
          </div>
        )}
      </div>
    </div>
  )
}
