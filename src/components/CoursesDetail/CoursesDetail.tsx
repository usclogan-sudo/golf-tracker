import { useEffect, useState, useMemo } from 'react'
import { supabase, rowToRound, rowToHoleScore, rowToCourse } from '../../lib/supabase'
import type { Round, HoleScore, Course } from '../../types'

interface Props {
  userId: string
  onBack: () => void
}

interface CourseStats {
  courseId: string
  courseName: string
  timesPlayed: number
  bestGross: number | null
  totalGross: number
  roundsWithScores: number
}

export function CoursesDetail({ userId, onBack }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('*').eq('user_id', userId).neq('hidden', true),
      supabase.from('rounds').select('*').in('status', ['complete', 'active']),
      supabase.from('hole_scores').select('*'),
    ]).then(([coursesRes, roundsRes, scoresRes]) => {
      if (coursesRes.data) setCourses(coursesRes.data.map(rowToCourse))
      if (roundsRes.data) setRounds(roundsRes.data.map(rowToRound))
      if (scoresRes.data) setHoleScores(scoresRes.data.map(rowToHoleScore))
      setLoading(false)
    })
  }, [userId])

  const courseStats = useMemo(() => {
    const map = new Map<string, CourseStats>()

    for (const r of rounds) {
      const cId = r.courseSnapshot?.courseId ?? r.courseId
      const cName = r.courseSnapshot?.courseName ?? 'Unknown'
      if (!map.has(cId)) {
        map.set(cId, { courseId: cId, courseName: cName, timesPlayed: 0, bestGross: null, totalGross: 0, roundsWithScores: 0 })
      }
      const stat = map.get(cId)!
      stat.timesPlayed++

      // Compute user's gross for this round
      const myScores = holeScores.filter(s => s.roundId === r.id && s.playerId === userId)
      if (myScores.length > 0) {
        const gross = myScores.reduce((sum, s) => sum + s.grossScore, 0)
        stat.totalGross += gross
        stat.roundsWithScores++
        if (stat.bestGross === null || gross < stat.bestGross) stat.bestGross = gross
      }
    }

    const arr = Array.from(map.values())
    arr.sort((a, b) => b.timesPlayed - a.timesPlayed)
    return arr
  }, [rounds, holeScores, userId])

  const favorites = courseStats.filter(c => c.timesPlayed >= 3)
  const others = courseStats.filter(c => c.timesPlayed < 3)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const CourseStatCard = ({ stat }: { stat: CourseStats }) => {
    const avgGross = stat.roundsWithScores > 0 ? Math.round(stat.totalGross / stat.roundsWithScores) : null
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <p className="font-bold text-gray-800">{stat.courseName}</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-gray-600">{stat.timesPlayed} round{stat.timesPlayed !== 1 ? 's' : ''}</span>
          {stat.bestGross != null && (
            <span className="text-green-700 font-semibold">Best: {stat.bestGross}</span>
          )}
          {avgGross != null && (
            <span className="text-gray-500">Avg: {avgGross}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800 text-xl" aria-label="Back">←</button>
        <h1 className="text-xl font-bold">Courses</h1>
        <span className="text-sm text-gray-300 ml-auto">{courses.length} saved</span>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {favorites.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Favorites (3+ rounds)</h2>
            <div className="space-y-2">
              {favorites.map(c => <CourseStatCard key={c.courseId} stat={c} />)}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {favorites.length > 0 ? 'Other Courses' : 'Courses'}
            </h2>
            <div className="space-y-2">
              {others.map(c => <CourseStatCard key={c.courseId} stat={c} />)}
            </div>
          </section>
        )}

        {courseStats.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="text-gray-500 font-medium">No course data yet</p>
            <p className="text-gray-400 text-sm mt-1">Play a round to see course stats</p>
          </div>
        )}
      </div>
    </div>
  )
}
