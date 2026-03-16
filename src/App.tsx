import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, rowToCourse, rowToRound, fetchOrCreateProfile } from './lib/supabase'
import { Auth } from './components/Auth/Auth'
import { UpgradeAccount } from './components/Auth/UpgradeAccount'
import { GuestBanner } from './components/GuestBanner/GuestBanner'
import { CourseCatalog } from './components/CourseCatalog/CourseCatalog'
import { CourseSetup } from './components/CourseSetup/CourseSetup'
import { NewRound } from './components/NewRound/NewRound'
import { Scorecard } from './components/Scorecard/Scorecard'
import { SettleUp } from './components/SettleUp/SettleUp'
import { NearMeCourses } from './components/NearMeCourses/NearMeCourses'
import { RoundHistory } from './components/RoundHistory/RoundHistory'
import { Settings } from './components/Settings/Settings'
import { Onboarding } from './components/Onboarding/Onboarding'
import { AdminDashboard } from './components/Admin/AdminDashboard'
import { Stats } from './components/Stats/Stats'
import { ConfirmModal } from './components/ConfirmModal'
import { UserAvatar } from './components/AvatarPicker'
import { PlayerDirectory } from './components/PlayerDirectory/PlayerDirectory'
import type { Course, Round, UserProfile, GameType, StakesMode } from './types'

type Screen = 'home' | 'course-catalog' | 'course-setup' | 'new-round' | 'scorecard' | 'settle-up' | 'round-history' | 'stats' | 'settings' | 'onboarding' | 'admin' | 'upgrade-account' | 'player-directory'

const GAME_EMOJI: Record<GameType, string> = {
  skins: '🎰 Skins',
  best_ball: '🤝 Best Ball',
  nassau: '🏳️ Nassau',
  wolf: '🐺 Wolf',
  bingo_bango_bongo: '⭐ BBB',
}

function totalPar(course: Course) {
  return course.holes.reduce((sum, h) => sum + h.par, 0)
}

function coursePhotoClass(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff
  return `course-photo-${(Math.abs(hash) % 5) + 1}`
}

function playerInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = [
  'bg-emerald-700', 'bg-teal-700', 'bg-cyan-700',
  'bg-blue-700', 'bg-violet-700', 'bg-rose-700',
]
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function StatChip({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`flex-1 rounded-2xl py-3 px-2 text-center ${accent ? 'bg-gold-400/20 border border-gold-400/30' : 'bg-white/10'}`}>
      <p className={`text-xl font-bold font-display ${accent ? 'gold-text' : 'text-white'}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${accent ? 'text-gold-300' : 'text-gray-300'}`}>{label}</p>
    </div>
  )
}


function CourseCard({ course, onEdit, onDelete }: { course: Course; onEdit: () => void; onDelete: () => void }) {
  const par = totalPar(course)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={onEdit} className="w-full text-left active:bg-gray-50 transition-colors">
        <div className={`h-10 ${coursePhotoClass(course.name)} flex items-end px-4 pb-2`}>
          <span className="text-white/60 text-xs font-medium tracking-wider uppercase">Golf Course</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 font-display">{course.name}</p>
            <p className="text-sm text-gray-500 mt-0.5">
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
  onPlayAgain,
  isAnonymous,
  onUpgrade,
  onEndRound,
  onViewRound,
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
  onPlayAgain: (round: Round) => void
  isAnonymous?: boolean
  onUpgrade?: () => void
  onEndRound?: (roundId: string) => void
  onViewRound?: (roundId: string) => void
}) {
  const [courses, setCourses] = useState<Course[]>([])
  const [activeRounds, setActiveRounds] = useState<Round[]>([])
  const [participantRounds, setParticipantRounds] = useState<Round[]>([])
  const [roundCount, setRoundCount] = useState(0)


  useEffect(() => {
    supabase.from('courses').select('*').eq('user_id', userId).neq('hidden', true).order('name').then(({ data }) => {
      if (data) setCourses(data.map(rowToCourse))
    })
    supabase.from('rounds').select('*').eq('status', 'active').then(({ data }) => {
      if (data) {
        const all = data.map(rowToRound)
        // Rounds I created (scoremaster)
        setActiveRounds(all.filter(r => r.createdBy === userId))
        // Rounds I'm a participant in but didn't create
        setParticipantRounds(all.filter(r =>
          r.createdBy !== userId &&
          r.players?.some(p => p.id === userId)
        ))
      }
    })
    supabase.from('rounds').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setRoundCount(count ?? 0)
    })
  }, [userId])

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
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
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-600 border border-gray-500 text-gray-300"
                  aria-label="Admin"
                >
                  <span className="text-lg">🛡️</span>
                </button>
              )}
              <button onClick={onSettings} aria-label="Settings">
                <UserAvatar preset={userProfile?.avatarPreset} name={userProfile?.displayName} size="sm" />
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
            <StatChip label="Rounds" value={roundCount} />
            <StatChip label="Courses" value={courses.length} />
            {userProfile?.handicapIndex != null && (
              <StatChip label="Handicap" value={userProfile.handicapIndex} accent />
            )}
          </div>
          {roundCount > 0 && (
            <div className="mt-3 flex items-center gap-4">
              <button onClick={onRoundHistory} className="text-gray-300 text-sm font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                <span>📋</span> Round History
              </button>
              <button onClick={onStats} className="text-gray-300 text-sm font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                <span>📊</span> Leaderboard
              </button>
              <button onClick={onPlayers} className="text-gray-300 text-sm font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                <span>🏌️</span> Players
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="px-4 pt-5 max-w-2xl mx-auto space-y-6">
        {isAnonymous && onUpgrade && (
          <GuestBanner onUpgrade={onUpgrade} />
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
            <h2 className="font-display font-semibold text-gray-800 text-base">Your Active Games</h2>
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


        <NearMeCourses onAddCourse={(name) => onAddCourse(name)} />

        {userProfile?.displayName && (
          <section>
            <h2 className="font-display font-semibold text-gray-800 text-base mb-3">Your Profile</h2>
            <button
              onClick={onSettings}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left flex items-center gap-3 active:bg-gray-50 transition-colors"
            >
              <UserAvatar preset={userProfile.avatarPreset} name={userProfile.displayName} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{userProfile.displayName}</p>
                <p className="text-sm text-gray-500">HCP {userProfile.handicapIndex ?? '—'}</p>
              </div>
              <span className="text-xs text-amber-600 font-semibold">Edit</span>
            </button>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-gray-800 text-base">
              Your Courses
              {courses.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{courses.length}</span>}
            </h2>
            <button onClick={onAddCourse} className="text-amber-600 text-sm font-semibold flex items-center gap-1">
              <span className="text-lg leading-none">+</span> Add
            </button>
          </div>
          {courses.length === 0 && (
            <button onClick={onAddCourse} className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-8 text-center active:bg-gray-50">
              <p className="text-3xl mb-2">🏌️</p>
              <p className="text-gray-500 font-medium">Add your first course</p>
              <p className="text-gray-400 text-sm mt-1">Holes, pars, slope & rating</p>
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not signed in
  if (session === null) {
    return <Auth />
  }

  // Loading profile
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
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
  if (screen === 'scorecard' && activeRoundId) {
    return <Scorecard userId={userId} roundId={activeRoundId} onEndRound={() => setScreen('settle-up')} onHome={() => { setScorecardReadOnly(false); goHome() }} readOnly={scorecardReadOnly} />
  }
  if (screen === 'settle-up' && activeRoundId) {
    return (
      <SettleUp
        roundId={activeRoundId}
        onDone={() => { setActiveRoundId(null); goHome() }}
        onContinue={() => setScreen('scorecard')}
      />
    )
  }
  if (screen === 'round-history') {
    return <RoundHistory userId={userId} onBack={goHome} />
  }
  if (screen === 'stats') {
    return <Stats userId={userId} onBack={goHome} />
  }
  if (screen === 'player-directory') {
    return <PlayerDirectory userId={userId} onBack={goHome} />
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

  const [appConfirmModal, setAppConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>(null)

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

  const handlePlayAgain = (round: Round) => {
    setPlayAgainRound(round)
    setNewRoundStakesMode(round.game?.stakesMode ?? 'standard')
    setScreen('new-round')
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
      onPlayAgain={handlePlayAgain}
      isAnonymous={isAnonymous}
      onUpgrade={() => setScreen('upgrade-account')}
      onEndRound={handleEndRound}
      onViewRound={roundId => { setScorecardReadOnly(true); setActiveRoundId(roundId); setScreen('scorecard') }}
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
    </>
  )
}
