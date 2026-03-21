import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, rowToCourse, rowToRound, rowToHoleScore, fetchOrCreateProfile } from './lib/supabase'
import { useNotifications } from './hooks/useNotifications'
import { flush as flushOfflineQueue, getPending as getOfflinePending } from './lib/offlineQueue'
import { NotificationToast } from './components/NotificationToast'
import { NotificationBadge } from './components/NotificationBadge'
import { Auth } from './components/Auth/Auth'
import { JoinRound } from './components/JoinRound/JoinRound'
import { UpgradeAccount } from './components/Auth/UpgradeAccount'
import { GuestBanner } from './components/GuestBanner/GuestBanner'
import { CourseCatalog } from './components/CourseCatalog/CourseCatalog'
import { CourseSetup } from './components/CourseSetup/CourseSetup'
import { NewRound } from './components/NewRound/NewRound'
import { Scorecard } from './components/Scorecard/Scorecard'
import { SettleUp } from './components/SettleUp/SettleUp'
import { RoundHistory } from './components/RoundHistory/RoundHistory'
import { Settings } from './components/Settings/Settings'
import { Onboarding } from './components/Onboarding/Onboarding'
import { AdminDashboard } from './components/Admin/AdminDashboard'
import { Stats } from './components/Stats/Stats'
import { ConfirmModal } from './components/ConfirmModal'
import { UserAvatar } from './components/AvatarPicker'
import { InstallBanner } from './components/InstallBanner'
import { PlayerDirectory } from './components/PlayerDirectory/PlayerDirectory'
import { RoundsDetail } from './components/RoundsDetail/RoundsDetail'
import { CoursesDetail } from './components/CoursesDetail/CoursesDetail'
import { HandicapDetail } from './components/HandicapDetail/HandicapDetail'
import { PersonalDashboard } from './components/PersonalDashboard/PersonalDashboard'
import { TournamentList } from './components/TournamentList/TournamentList'
import { TournamentSetup } from './components/TournamentSetup/TournamentSetup'
import { TournamentDetail } from './components/TournamentDetail/TournamentDetail'
import { EventSetup } from './components/EventSetup/EventSetup'
import { EventLeaderboard } from './components/EventLeaderboard/EventLeaderboard'
import { Ledger } from './components/Ledger/Ledger'
import { LiveLeaderboard } from './components/LiveLeaderboard/LiveLeaderboard'
import type { Course, Round, HoleScore, UserProfile, GameType, StakesMode } from './types'

type Screen = 'home' | 'course-catalog' | 'course-setup' | 'new-round' | 'scorecard' | 'settle-up' | 'round-history' | 'stats' | 'settings' | 'onboarding' | 'admin' | 'upgrade-account' | 'player-directory' | 'rounds-detail' | 'courses-detail' | 'handicap-detail' | 'join-round' | 'tournament-list' | 'tournament-setup' | 'tournament-detail' | 'personal-dashboard' | 'event-setup' | 'event-leaderboard' | 'ledger' | 'spectate'

const GAME_EMOJI: Record<GameType, string> = {
  skins: '🎰 Skins',
  best_ball: '🤝 Best Ball',
  nassau: '🏳️ Nassau',
  wolf: '🐺 Wolf',
  bingo_bango_bongo: '⭐ BBB',
  hammer: '🔨 Hammer',
}

function totalPar(course: Course) {
  return course.holes.reduce((sum, h) => sum + h.par, 0)
}

function coursePhotoClass(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff
  return `course-photo-${(Math.abs(hash) % 5) + 1}`
}


function StatChip({ label, value, accent, onClick }: { label: string; value: string | number; accent?: boolean; onClick?: () => void }) {
  const cls = `flex-1 rounded-2xl py-3 px-2 text-center ${accent ? 'bg-gold-400/20 border border-gold-400/30' : 'bg-white/10'} ${onClick ? 'active:scale-95 transition-transform cursor-pointer' : ''}`
  const inner = (
    <>
      <p className={`text-xl font-bold font-display ${accent ? 'gold-text' : 'text-white'}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${accent ? 'text-gold-300' : 'text-gray-300'}`}>{label}</p>
    </>
  )
  if (onClick) {
    return <button className={cls} onClick={onClick}>{inner}</button>
  }
  return <div className={cls}>{inner}</div>
}


function CourseCard({ course, onEdit, onDelete }: { course: Course; onEdit: () => void; onDelete: () => void }) {
  const par = totalPar(course)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <button onClick={onEdit} className="w-full text-left active:bg-gray-50 dark:active:bg-gray-700 transition-colors">
        <div className={`h-10 ${coursePhotoClass(course.name)} flex items-end px-4 pb-2`}>
          <span className="text-white/60 text-xs font-medium tracking-wider uppercase">Golf Course</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 font-display">{course.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Par {par} · {course.tees.length} tee{course.tees.length !== 1 ? 's' : ''} · {course.tees.map(t => t.name).join(', ')}
            </p>
          </div>
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
      <div className="px-4 pb-3">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-xs text-red-400 hover:text-red-600 font-medium"
        >
          Remove course
        </button>
      </div>
    </div>
  )
}

function Home({
  userId,
  userProfile,
  onNewRound,
  onNewHighRollerRound,
  onAddCourse,
  onResumeRound,
  onEditCourse,
  onDeleteCourse,
  onRoundHistory,
  onStats,
  onPlayers,
  onSettings,
  onSignOut,
  isAdmin,
  onAdmin,
  isAnonymous,
  onUpgrade,
  onEndRound,
  onViewRound,
  onRoundsDetail,
  onCoursesDetail,
  onHandicapDetail,
  onJoinRound,
  notificationCount,
  onTournaments,
  onPersonalDashboard,
  onCreateEvent,
  onLedger,
}: {

  userId: string
  userProfile: UserProfile | null
  onNewRound: () => void
  onNewHighRollerRound: () => void
  onAddCourse: (courseName?: string) => void
  onResumeRound: (roundId: string) => void
  onEditCourse: (course: Course) => void
  onDeleteCourse: (courseId: string) => void
  onRoundHistory: () => void
  onStats: () => void
  onPlayers: () => void
  onSettings: () => void
  onSignOut: () => void
  isAdmin: boolean
  onAdmin: () => void
  isAnonymous?: boolean
  onUpgrade?: () => void
  onEndRound?: (roundId: string) => void
  onViewRound?: (roundId: string) => void
  onRoundsDetail: () => void
  onCoursesDetail: () => void
  onHandicapDetail: () => void
  notificationCount?: number
  onJoinRound: (code?: string) => void
  onTournaments: () => void
  onPersonalDashboard: () => void
  onCreateEvent: () => void
  onLedger: () => void
}) {
  const [courses, setCourses] = useState<Course[]>([])
  const [activeRounds, setActiveRounds] = useState<Round[]>([])
  const [participantRounds, setParticipantRounds] = useState<Round[]>([])
  const [roundCount, setRoundCount] = useState(0)
  const [joinCode, setJoinCode] = useState('')
  const [unsettledCount, setUnsettledCount] = useState(0)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [personalSummary, setPersonalSummary] = useState<{
    totalRounds: number
    lastCourse: string
    lastDate: string
    lastScore: number | null
  } | null>(null)

  useEffect(() => {
    setFetchError(null)
    supabase.from('courses').select('*').eq('user_id', userId).neq('hidden', true).order('name').then(({ data, error }) => {
      if (error) { setFetchError('Failed to load data. Pull down to refresh.'); return }
      if (data) setCourses(data.map(rowToCourse))
    })
    // Fetch both owned active rounds and rounds joined as participant
    Promise.all([
      supabase.from('rounds').select('*').eq('status', 'active'),
      supabase.from('round_participants').select('round_id').eq('user_id', userId),
    ]).then(([roundsRes, partRes]) => {
      if (roundsRes.error) { setFetchError('Failed to load data. Pull down to refresh.'); return }
      if (roundsRes.data) {
        const all = roundsRes.data.map(rowToRound)
        const joinedRoundIds = new Set((partRes.data ?? []).map((p: any) => p.round_id))
        setActiveRounds(all.filter(r => r.createdBy === userId))
        setParticipantRounds(all.filter(r =>
          r.createdBy !== userId && (
            r.players?.some(p => p.id === userId) || joinedRoundIds.has(r.id)
          )
        ))
      }
    })
    supabase.from('rounds').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setRoundCount(count ?? 0)
    })

    // Unsettled rounds count
    supabase.from('settlements').select('round_id').eq('status', 'owed').then(({ data }) => {
      if (data) {
        const uniqueRounds = new Set(data.map((d: any) => d.round_id))
        setUnsettledCount(uniqueRounds.size)
      }
    })

    // Personal summary
    Promise.all([
      supabase.from('rounds').select('*').eq('status', 'complete').order('date', { ascending: false }),
      supabase.from('hole_scores').select('*'),
    ]).then(([roundsRes, scoresRes]) => {
      if (roundsRes.error || scoresRes.error) return
      if (!roundsRes.data || !scoresRes.data) return
      const completedRounds = roundsRes.data.map(rowToRound)
      const allScores = scoresRes.data.map(rowToHoleScore)

      // Find rounds where current user played
      const myRounds = completedRounds.filter(r =>
        r.players?.some(p => p.id === userId)
      )

      if (myRounds.length === 0) return

      const lastRound = myRounds[0]
      const lastScores = allScores.filter(s => s.roundId === lastRound.id && s.playerId === userId)
      const lastScore = lastScores.length > 0 ? lastScores.reduce((sum, s) => sum + s.grossScore, 0) : null

      setPersonalSummary({
        totalRounds: myRounds.length,
        lastCourse: lastRound.courseSnapshot?.courseName ?? 'Unknown',
        lastDate: lastRound.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        lastScore,
      })
    })
  }, [userId])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 pb-8">
      <header className="app-header text-white px-4 pt-6 pb-5 sticky top-0 z-10 shadow-xl">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="font-display text-3xl font-800 tracking-tight leading-none">Fore Skins</h1>
              <p className="text-amber-400 text-sm font-medium mt-0.5 tracking-wide">GOLF · SIDE GAMES · MONEY</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={onAdmin}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-600 border border-gray-500 text-gray-300"
                  aria-label="Admin"
                >
                  <span className="text-lg">🛡️</span>
                </button>
              )}
              <button onClick={onSettings} aria-label="Settings">
                <UserAvatar url={userProfile?.avatarUrl} preset={userProfile?.avatarPreset} name={userProfile?.displayName} size="sm" />
              </button>
              <button
                onClick={onSignOut}
                className="text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-600 border border-gray-500"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <StatChip label="Rounds" value={roundCount} onClick={onRoundsDetail} />
            <StatChip label="Courses" value={courses.length} onClick={onCoursesDetail} />
            {userProfile?.handicapIndex != null && (
              <StatChip label="Handicap" value={userProfile.handicapIndex} accent onClick={onHandicapDetail} />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button onClick={onPersonalDashboard} className={`text-sm font-medium flex items-center gap-1.5 transition-colors ${roundCount > 0 ? 'text-gray-300 hover:text-white' : 'text-gray-500'}`}>
              <span>📈</span> My Stats
            </button>
            {roundCount > 0 && (
              <>
                <button onClick={onRoundHistory} className="text-gray-300 text-sm font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                  <span>📋</span> Round History
                  {(notificationCount ?? 0) > 0 && <NotificationBadge count={notificationCount!} />}
                </button>
                <button onClick={onStats} className="text-gray-300 text-sm font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                  <span>📊</span> Leaderboard
                </button>
                <button onClick={onLedger} className="text-gray-300 text-sm font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                  <span>💰</span> Ledger
                </button>
                <button onClick={onPlayers} className="text-gray-300 text-sm font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                  <span>🏌️</span> Players
                </button>
                <button onClick={onTournaments} className="text-gray-300 text-sm font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                  <span>🏆</span> Tournaments
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 pt-5 max-w-2xl mx-auto space-y-6">
        <InstallBanner />

        {fetchError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 flex items-center justify-between">
            <p className="text-red-700 dark:text-red-400 text-sm font-medium">{fetchError}</p>
            <button onClick={() => setFetchError(null)} className="text-red-400 text-lg leading-none ml-2">&times;</button>
          </div>
        )}

        {isAnonymous && onUpgrade && (
          <GuestBanner onUpgrade={onUpgrade} />
        )}

        {/* Personal Summary */}
        {personalSummary && (
          <button
            onClick={onPersonalDashboard}
            className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-gray-800 dark:text-gray-100">{personalSummary.totalRounds} Round{personalSummary.totalRounds !== 1 ? 's' : ''} Played</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Last: {personalSummary.lastCourse}, {personalSummary.lastDate}
                  {personalSummary.lastScore != null && ` — Shot ${personalSummary.lastScore}`}
                </p>
              </div>
              <span className="text-xs text-amber-600 font-semibold">View Stats →</span>
            </div>
          </button>
        )}
        {unsettledCount > 0 && (
          <button
            onClick={onRoundHistory}
            className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left active:bg-amber-100 transition-colors"
          >
            <p className="text-amber-800 text-sm font-semibold">
              💰 {unsettledCount} round{unsettledCount !== 1 ? 's' : ''} ha{unsettledCount !== 1 ? 've' : 's'} unsettled payouts
            </p>
            <p className="text-amber-600 text-xs mt-0.5">Tap to view in Round History →</p>
          </button>
        )}

        {!personalSummary && roundCount === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 px-5 py-5 space-y-4">
            <div className="text-center">
              <p className="text-3xl mb-1">⛳</p>
              <p className="font-display font-bold text-gray-800 dark:text-gray-100 text-lg">Welcome to Fore Skins!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Get started in 3 easy steps</p>
            </div>
            <div className="space-y-2">
              <button onClick={() => onAddCourse()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 text-left active:bg-gray-100 dark:active:bg-gray-600 transition-colors">
                <span className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Add a course</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Set up holes, pars, and tees</p>
                </div>
              </button>
              <button onClick={onSettings} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 text-left active:bg-gray-100 dark:active:bg-gray-600 transition-colors">
                <span className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Set up your profile</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Name, handicap, and payment info</p>
                </div>
              </button>
              <button onClick={onNewRound} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 text-left active:bg-gray-100 dark:active:bg-gray-600 transition-colors">
                <span className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Start a round</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pick a game and hit the links</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {activeRounds.length > 0 && (
          <section className="space-y-3">
            {activeRounds.map(round => (
              <div key={round.id} className="rounded-2xl overflow-hidden shadow-lg">
                <button onClick={() => onResumeRound(round.id)}
                  className="w-full active:scale-[0.98] transition-transform">
                  <div className="bg-gradient-to-r from-amber-500 to-yellow-400 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="font-display font-bold text-amber-950 text-lg leading-tight">Round in Progress</p>
                        <p className="text-amber-800 text-sm mt-0.5">{round.courseSnapshot?.courseName ?? 'Unknown course'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold text-amber-950 text-2xl">&#9971; {round.currentHole}</p>
                        <p className="text-amber-800 text-xs">Hole</p>
                      </div>
                    </div>
                    <div className="mt-3 bg-amber-950/20 rounded-xl px-4 py-2 flex items-center justify-between">
                      <span className="text-amber-900 text-sm font-semibold">
                        {round.players?.length ?? 0} players · {round.game?.type ? (GAME_EMOJI[round.game.type] ?? round.game.type) : 'Unknown'}
                        {round.game?.stakesMode === 'high_roller' && ' 💎'}
                      </span>
                      <span className="text-amber-900 text-sm font-bold">Tap to Resume &rarr;</span>
                    </div>
                  </div>
                </button>
                {onEndRound && (
                  <div className="bg-amber-100 px-5 py-2 flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEndRound(round.id) }}
                      className="text-red-600 text-sm font-semibold hover:text-red-800 transition-colors"
                    >
                      End Round
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Participant rounds — rounds you're playing in but someone else is scoring */}
        {participantRounds.length > 0 && onViewRound && (
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-gray-800 dark:text-gray-100 text-base">Your Active Games</h2>
            {participantRounds.map(round => (
              <button
                key={round.id}
                onClick={() => onViewRound(round.id)}
                className="w-full rounded-2xl overflow-hidden shadow-md active:scale-[0.98] transition-transform"
              >
                <div className="bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="font-display font-bold text-blue-950 text-lg leading-tight">Live Scoreboard</p>
                      <p className="text-blue-800 text-sm mt-0.5">{round.courseSnapshot?.courseName ?? 'Unknown course'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-blue-950 text-2xl">&#9971; {round.currentHole}</p>
                      <p className="text-blue-800 text-xs">Hole</p>
                    </div>
                  </div>
                  <div className="mt-3 bg-blue-950/20 rounded-xl px-4 py-2 flex items-center justify-between">
                    <span className="text-blue-900 text-sm font-semibold">
                      {round.players?.length ?? 0} players · {round.game?.type ? (GAME_EMOJI[round.game.type] ?? round.game.type) : 'Unknown'}
                    </span>
                    <span className="text-blue-900 text-sm font-bold">Tap to Watch &rarr;</span>
                  </div>
                </div>
              </button>
            ))}
          </section>
        )}

        <button onClick={onNewRound}
          className="w-full rounded-2xl shadow-lg overflow-hidden active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}>
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="text-left">
              <p className="font-display font-bold text-white text-xl">Start New Round</p>
              <p className="text-gray-300 text-sm mt-0.5">Skins · Best Ball · Nassau · Wolf · BBB</p>
            </div>
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-4xl border border-white/20">▶</div>
          </div>
        </button>

        <button onClick={onNewHighRollerRound}
          className="w-full rounded-2xl shadow-lg overflow-hidden active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #1a0e00 0%, #5c3d00 100%)' }}>
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="text-left">
              <p className="font-display font-bold text-xl"
                style={{ background: 'linear-gradient(135deg,#d97706,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                💎 High Roller Round
              </p>
              <p className="text-amber-400 text-sm mt-0.5">Premium stakes · Nassau · Wolf · Skins</p>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-4xl border border-amber-600/40 bg-amber-900/30">💎</div>
          </div>
        </button>


        <button onClick={onCreateEvent}
          className="w-full rounded-2xl shadow-lg overflow-hidden active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)' }}>
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="text-left">
              <p className="font-display font-bold text-white text-xl">Create Event</p>
              <p className="text-blue-200 text-sm mt-0.5">Multi-group outing · Players self-score</p>
            </div>
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-3xl border border-white/20">🏌️</div>
          </div>
        </button>

        {/* Join Round */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <p className="font-display font-semibold text-gray-800 dark:text-gray-100 text-sm mb-2">Join a Round</p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              placeholder="Enter code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && joinCode.length === 6 && onJoinRound(joinCode)}
              className="flex-1 h-11 px-3 text-center font-mono font-bold tracking-widest rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
            />
            <button
              onClick={() => onJoinRound(joinCode)}
              disabled={joinCode.length !== 6}
              className="h-11 px-5 bg-gray-800 text-white font-bold rounded-xl text-sm disabled:opacity-40 active:bg-gray-900 transition-colors"
            >
              Join
            </button>
          </div>
        </div>

        {userProfile?.displayName && (
          <section>
            <h2 className="font-display font-semibold text-gray-800 dark:text-gray-100 text-base mb-3">Your Profile</h2>
            <button
              onClick={onSettings}
              className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 text-left flex items-center gap-3 active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
            >
              <UserAvatar url={userProfile.avatarUrl} preset={userProfile.avatarPreset} name={userProfile.displayName} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{userProfile.displayName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">HCP {userProfile.handicapIndex ?? '—'}</p>
              </div>
              <span className="text-xs text-amber-600 font-semibold">Edit</span>
            </button>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-gray-800 dark:text-gray-100 text-base">
              Your Courses
              {courses.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{courses.length}</span>}
            </h2>
            <button onClick={() => onAddCourse()} className="text-amber-600 text-sm font-semibold flex items-center gap-1">
              <span className="text-lg leading-none">+</span> Add
            </button>
          </div>
          {courses.length === 0 && (
            <button onClick={() => onAddCourse()} className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-8 text-center active:bg-gray-50 dark:active:bg-gray-800">
              <p className="text-3xl mb-2">🏌️</p>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Add your first course</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Holes, pars, slope & rating</p>
            </button>
          )}
          {courses.length > 0 && (
            <div className="space-y-3">
              {courses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onEdit={() => onEditCourse(course)}
                  onDelete={() => onDeleteCourse(course.id)}
                />
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-gray-400 pb-4">Fore Skins Golf · Data synced to cloud</p>
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [screen, setScreen] = useState<Screen>('home')
  const [afterCourseSetup, setAfterCourseSetup] = useState<Screen>('home')
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)
  const [newRoundStakesMode, setNewRoundStakesMode] = useState<StakesMode>('standard')
  const [editingCourse, setEditingCourse] = useState<Course | undefined>(undefined)
  const [homeKey, setHomeKey] = useState(0)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [playAgainRound, setPlayAgainRound] = useState<Round | null>(null)
  const [newCourseName, setNewCourseName] = useState('')
  const [scorecardReadOnly, setScorecardReadOnly] = useState(false)
  const [appConfirmModal, setAppConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>(null)
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null)
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  const [spectateCode, setSpectateCode] = useState<string | null>(null)
  const { unreadCount: notificationCount, latestToast, dismissToast } = useNotifications(session?.user?.id ?? null)

  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(() => {
    // Check sessionStorage first (survives auth redirect)
    const stored = sessionStorage.getItem('pendingJoinCode')
    if (stored) return stored
    // Check URL param
    const params = new URLSearchParams(window.location.search)
    // Handle ?spectate=CODE
    const spectateParam = params.get('spectate')
    if (spectateParam) {
      window.history.replaceState({}, '', window.location.pathname)
      // Will be picked up by the effect below
      setTimeout(() => setSpectateCode(spectateParam), 0)
      return null
    }
    const joinCode = params.get('join')
    if (joinCode) {
      sessionStorage.setItem('pendingJoinCode', joinCode)
      window.history.replaceState({}, '', window.location.pathname)
      return joinCode
    }
    return null
  })

  // Flush offline queue on app mount if online and items are pending
  useEffect(() => {
    if (navigator.onLine && getOfflinePending() > 0) {
      flushOfflineQueue()
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load user profile after session is established
  useEffect(() => {
    if (!session) {
      setUserProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    fetchOrCreateProfile(session.user.id).then(async profile => {
      // Auto-complete onboarding for anonymous guests — skip straight to app
      if (session.user.is_anonymous && profile && !profile.onboardingComplete) {
        await supabase.from('user_profiles').update({ onboarding_complete: true }).eq('user_id', session.user.id)
        profile = { ...profile, onboardingComplete: true }
      }
      setUserProfile(profile)
      setProfileLoading(false)
    })
  }, [session])

  // Auto-navigate to join-round when pending invite code exists
  useEffect(() => {
    if (pendingJoinCode && userProfile?.onboardingComplete && screen === 'home') {
      setScreen('join-round')
    }
  }, [pendingJoinCode, userProfile?.onboardingComplete])

  // Auto-navigate to spectate when spectate code is set
  useEffect(() => {
    if (spectateCode) {
      setScreen('spectate')
    }
  }, [spectateCode])

  // Browser back button support: push state on screen change, listen for popstate
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const s = e.state?.screen as Screen | undefined
      if (s) {
        setScreen(s)
      } else {
        setHomeKey(k => k + 1)
        setScreen('home')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    // Don't push duplicate entries for 'home' on initial load
    const currentState = window.history.state?.screen
    if (screen !== currentState) {
      if (screen === 'home') {
        window.history.replaceState({ screen }, '', window.location.pathname)
      } else {
        window.history.pushState({ screen }, '', window.location.pathname)
      }
    }
  }, [screen])

  // Still checking auth state
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not signed in
  if (session === null) {
    return <Auth inviteCode={pendingJoinCode ?? undefined} />
  }

  // Loading profile
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const userId = session.user.id
  const isAnonymous = session.user.is_anonymous ?? false

  // Onboarding gate
  if (userProfile && !userProfile.onboardingComplete) {
    return (
      <Onboarding
        userId={userId}
        onComplete={() => setUserProfile(prev => prev ? { ...prev, onboardingComplete: true } : prev)}
      />
    )
  }

  const goHome = () => {
    setHomeKey(k => k + 1)
    setScreen('home')
  }

  if (screen === 'course-catalog') {
    return (
      <CourseCatalog
        userId={userId}
        onDone={goHome}
        onAddCustom={() => setScreen('course-setup')}
        onPrefillCourse={(course) => { setEditingCourse(course); setScreen('course-setup') }}
      />
    )
  }
  if (screen === 'course-setup') {
    return (
      <CourseSetup
        userId={userId}
        course={editingCourse}
        initialName={newCourseName}
        onSave={() => { setEditingCourse(undefined); setNewCourseName(''); if (afterCourseSetup === 'new-round') { setScreen('new-round') } else { goHome() } }}
        onCancel={() => { setEditingCourse(undefined); setNewCourseName(''); setScreen(afterCourseSetup === 'new-round' ? 'new-round' : 'course-catalog') }}
      />
    )
  }
  if (screen === 'new-round') {
    return (
      <NewRound
        userId={userId}
        onStart={roundId => { setActiveRoundId(roundId); setPlayAgainRound(null); setScreen('scorecard') }}
        onCancel={() => { setPlayAgainRound(null); goHome() }}
        onAddCourse={() => { setAfterCourseSetup('new-round'); setScreen('course-catalog') }}
        initialStakesMode={newRoundStakesMode}
        templateRound={playAgainRound}
      />
    )
  }
  if (screen === 'join-round') {
    return (
      <JoinRound
        userId={userId}
        initialCode={pendingJoinCode ?? undefined}
        onJoined={(roundId) => {
          setPendingJoinCode(null)
          sessionStorage.removeItem('pendingJoinCode')
          setActiveRoundId(roundId)
          setScorecardReadOnly(false)
          setScreen('scorecard')
        }}
        onCancel={() => {
          setPendingJoinCode(null)
          sessionStorage.removeItem('pendingJoinCode')
          goHome()
        }}
      />
    )
  }
  if (screen === 'scorecard' && activeRoundId) {
    return <Scorecard userId={userId} roundId={activeRoundId} onEndRound={() => setScreen('settle-up')} onHome={() => { setScorecardReadOnly(false); goHome() }} readOnly={scorecardReadOnly} />
  }
  if (screen === 'settle-up' && activeRoundId) {
    return (
      <SettleUp
        roundId={activeRoundId}
        userId={userId}
        onDone={() => { setActiveRoundId(null); goHome() }}
        onContinue={() => setScreen('scorecard')}
      />
    )
  }
  if (screen === 'round-history') {
    return <RoundHistory userId={userId} onBack={goHome} onViewSettlements={(id) => { setActiveRoundId(id); setScreen('settle-up') }} onPlayAgain={(round) => { setPlayAgainRound(round); setScreen('new-round') }} />
  }
  if (screen === 'stats') {
    return <Stats userId={userId} onBack={goHome} />
  }
  if (screen === 'player-directory') {
    return <PlayerDirectory userId={userId} onBack={goHome} />
  }
  if (screen === 'rounds-detail') {
    return <RoundsDetail userId={userId} onBack={goHome} />
  }
  if (screen === 'courses-detail') {
    return <CoursesDetail userId={userId} onBack={goHome} />
  }
  if (screen === 'handicap-detail') {
    return <HandicapDetail userId={userId} userProfile={userProfile} onBack={goHome} />
  }
  if (screen === 'personal-dashboard') {
    return <PersonalDashboard userId={userId} onBack={goHome} />
  }
  if (screen === 'upgrade-account') {
    return (
      <UpgradeAccount
        onComplete={goHome}
        onCancel={goHome}
      />
    )
  }
  if (screen === 'settings') {
    return (
      <Settings
        userId={userId}
        email={session.user.email ?? ''}
        onBack={() => {
          // Refresh profile in case user edited it
          fetchOrCreateProfile(userId).then(p => setUserProfile(p))
          goHome()
        }}
        onSignOut={() => supabase.auth.signOut()}
        isAdmin={userProfile?.isAdmin}
        onAdmin={() => setScreen('admin')}
        isAnonymous={isAnonymous}
        onUpgrade={() => setScreen('upgrade-account')}
      />
    )
  }
  if (screen === 'admin' && userProfile?.isAdmin) {
    return <AdminDashboard userId={userId} onBack={goHome} />
  }
  if (screen === 'tournament-list') {
    return (
      <TournamentList
        userId={userId}
        onBack={goHome}
        onViewTournament={(id) => { setActiveTournamentId(id); setScreen('tournament-detail') }}
        onNewTournament={() => setScreen('tournament-setup')}
      />
    )
  }
  if (screen === 'tournament-setup') {
    return (
      <TournamentSetup
        userId={userId}
        onCreated={(id) => { setActiveTournamentId(id); setScreen('tournament-detail') }}
        onCancel={() => setScreen('tournament-list')}
      />
    )
  }
  if (screen === 'tournament-detail' && activeTournamentId) {
    return (
      <TournamentDetail
        userId={userId}
        tournamentId={activeTournamentId}
        onBack={() => setScreen('tournament-list')}
        onStartRound={() => {
          // TODO: Could auto-create a linked round in the future
          setScreen('tournament-list')
        }}
      />
    )
  }
  if (screen === 'event-setup') {
    return (
      <EventSetup
        userId={userId}
        onStart={(roundId, eventId) => {
          setActiveRoundId(roundId)
          setActiveEventId(eventId)
          setScorecardReadOnly(false)
          setScreen('scorecard')
        }}
        onCancel={goHome}
        onAddCourse={() => { setAfterCourseSetup('home'); setScreen('course-catalog') }}
      />
    )
  }
  if (screen === 'event-leaderboard' && activeEventId) {
    return (
      <EventLeaderboard
        userId={userId}
        eventId={activeEventId}
        onBack={() => {
          if (activeRoundId) setScreen('scorecard')
          else goHome()
        }}
      />
    )
  }
  if (screen === 'ledger') {
    return <Ledger userId={userId} onBack={goHome} />
  }
  if (screen === 'spectate' && spectateCode) {
    return <LiveLeaderboard inviteCode={spectateCode} onBack={() => { setSpectateCode(null); goHome() }} />
  }

  const handleDeleteCourse = (courseId: string) => {
    setAppConfirmModal({
      title: 'Remove Course?',
      message: 'Remove this course from your list?',
      destructive: true,
      onConfirm: async () => {
        setAppConfirmModal(null)
        await supabase.from('courses').update({ hidden: true }).eq('id', courseId)
        setHomeKey(k => k + 1)
      },
    })
  }

  const handleEndRound = async (roundId: string) => {
    const [hsRes, roundRes] = await Promise.all([
      supabase.from('hole_scores').select('player_id, hole_number').eq('round_id', roundId),
      supabase.from('rounds').select('players, course_snapshot').eq('id', roundId).single(),
    ])
    const playerCount = (roundRes.data?.players as any[])?.length ?? 0
    const totalHoles = (roundRes.data?.course_snapshot as any)?.holes?.length ?? 18
    const scores = hsRes.data ?? []
    const holesComplete = Array.from({ length: totalHoles }, (_, i) => i + 1)
      .filter(n => {
        const scoredPlayers = new Set(scores.filter((s: any) => s.hole_number === n).map((s: any) => s.player_id))
        return scoredPlayers.size >= playerCount
      }).length
    const missing = totalHoles - holesComplete
    const msg = missing > 0
      ? `${holesComplete} of ${totalHoles} holes scored (${missing} incomplete). You can view results in Settle Up.`
      : `All ${totalHoles} holes scored. View results in Settle Up.`
    setAppConfirmModal({
      title: 'End Round?',
      message: msg,
      onConfirm: async () => {
        setAppConfirmModal(null)
        await supabase.from('rounds').update({ status: 'complete' }).eq('id', roundId)
        setActiveRoundId(roundId)
        setScreen('settle-up')
      },
    })
  }

  return (
    <>
    <Home
      key={homeKey}
      userId={userId}
      userProfile={userProfile}
      onNewRound={() => { setNewRoundStakesMode('standard'); setScreen('new-round') }}
      onNewHighRollerRound={() => { setNewRoundStakesMode('high_roller'); setScreen('new-round') }}
      onAddCourse={(courseName) => {
        setAfterCourseSetup('home')
        if (courseName) {
          setNewCourseName(courseName)
          setScreen('course-setup')
        } else {
          setScreen('course-catalog')
        }
      }}
      onEditCourse={(course: Course) => { setEditingCourse(course); setScreen('course-setup') }}
      onDeleteCourse={handleDeleteCourse}
      onResumeRound={roundId => { setScorecardReadOnly(false); setActiveRoundId(roundId); setScreen('scorecard') }}
      onRoundHistory={() => setScreen('round-history')}
      onStats={() => setScreen('stats')}
      onPlayers={() => setScreen('player-directory')}
      onSettings={() => setScreen('settings')}
      onSignOut={() => supabase.auth.signOut()}
      isAdmin={userProfile?.isAdmin ?? false}
      onAdmin={() => setScreen('admin')}
      isAnonymous={isAnonymous}
      onUpgrade={() => setScreen('upgrade-account')}
      onEndRound={handleEndRound}
      onViewRound={roundId => { setScorecardReadOnly(false); setActiveRoundId(roundId); setScreen('scorecard') }}
      onRoundsDetail={() => setScreen('rounds-detail')}
      onCoursesDetail={() => setScreen('courses-detail')}
      onHandicapDetail={() => setScreen('handicap-detail')}
      onJoinRound={(code) => {
        if (code) setPendingJoinCode(code)
        setScreen('join-round')
      }}
      notificationCount={notificationCount}
      onTournaments={() => setScreen('tournament-list')}
      onPersonalDashboard={() => setScreen('personal-dashboard')}
      onCreateEvent={() => setScreen('event-setup')}
      onLedger={() => setScreen('ledger')}
    />
    {appConfirmModal && (
      <ConfirmModal
        open={true}
        title={appConfirmModal.title}
        message={appConfirmModal.message}
        onConfirm={appConfirmModal.onConfirm}
        onCancel={() => setAppConfirmModal(null)}
        destructive={appConfirmModal.destructive}
      />
    )}
    {latestToast && <NotificationToast notification={latestToast} onDismiss={dismissToast} />}
    </>
  )
}
