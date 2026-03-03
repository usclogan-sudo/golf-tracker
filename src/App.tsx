import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CourseCatalog } from './components/CourseCatalog/CourseCatalog'
import { CourseSetup } from './components/CourseSetup/CourseSetup'
import { PlayerSetup } from './components/PlayerSetup/PlayerSetup'
import { NewRound } from './components/NewRound/NewRound'
import { Scorecard } from './components/Scorecard/Scorecard'
import { SettleUp } from './components/SettleUp/SettleUp'
import { NearMeCourses } from './components/NearMeCourses/NearMeCourses'
import { db } from './db/database'
import type { Course, Player, GameType, StakesMode } from './types'

type Screen = 'home' | 'course-catalog' | 'course-setup' | 'player-setup' | 'new-round' | 'scorecard' | 'settle-up'

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
      <p className={`text-xs mt-0.5 ${accent ? 'text-gold-300' : 'text-green-300'}`}>{label}</p>
    </div>
  )
}

function PlayerCard({ player, onEdit }: { player: Player; onEdit: () => void }) {
  return (
    <button
      onClick={onEdit}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left w-full flex items-center gap-3 active:bg-gray-50 transition-colors"
    >
      <div className={`w-10 h-10 rounded-full ${avatarColor(player.name)} flex items-center justify-center flex-shrink-0`}>
        <span className="text-sm font-bold text-white font-display">{playerInitials(player.name)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{player.name}</p>
        <p className="text-sm text-gray-500">HCP {player.handicapIndex} · {player.tee} tees</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function CourseCard({ course }: { course: Course }) {
  const par = totalPar(course)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className={`h-10 ${coursePhotoClass(course.name)} flex items-end px-4 pb-2`}>
        <span className="text-white/60 text-xs font-medium tracking-wider uppercase">Golf Course</span>
      </div>
      <div className="px-4 py-3">
        <p className="font-semibold text-gray-900 font-display">{course.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">
          Par {par} · {course.tees.length} tee{course.tees.length !== 1 ? 's' : ''} · {course.tees.map(t => t.name).join(', ')}
        </p>
      </div>
    </div>
  )
}

function Home({
  onNewRound, onNewHighRollerRound, onAddCourse, onAddPlayer, onResumeRound, onEditPlayer,
}: {
  onNewRound: () => void
  onNewHighRollerRound: () => void
  onAddCourse: () => void
  onAddPlayer: () => void
  onResumeRound: (roundId: string) => void
  onEditPlayer: () => void
}) {
  const courses      = useLiveQuery(() => db.courses.orderBy('name').toArray(), [])
  const players      = useLiveQuery(() => db.players.orderBy('name').toArray(), [])
  const activeRounds = useLiveQuery(() => db.rounds.where('status').equals('active').reverse().toArray(), [])
  const allRounds    = useLiveQuery(() => db.rounds.toArray(), [])

  const roundCount  = allRounds?.length ?? 0
  const playerCount = players?.length ?? 0
  const courseCount = courses?.length ?? 0

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="app-header text-white px-4 pt-6 pb-5 sticky top-0 z-10 shadow-xl">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="font-display text-3xl font-800 tracking-tight leading-none">Fore Skins</h1>
              <p className="text-green-400 text-sm font-medium mt-0.5 tracking-wide">GOLF · SIDE GAMES · MONEY</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-3xl border border-white/10">⛳</div>
          </div>
          <div className="flex gap-2">
            <StatChip label="Rounds" value={roundCount} />
            <StatChip label="Players" value={playerCount} />
            <StatChip label="Courses" value={courseCount} />
          </div>
        </div>
      </header>

      <main className="px-4 pt-5 max-w-2xl mx-auto space-y-6">
        {activeRounds && activeRounds.length > 0 && (
          <section>
            {activeRounds.map(round => (
              <button key={round.id} onClick={() => onResumeRound(round.id)}
                className="w-full rounded-2xl overflow-hidden shadow-lg active:scale-[0.98] transition-transform">
                <div className="bg-gradient-to-r from-amber-500 to-yellow-400 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="font-display font-bold text-amber-950 text-lg leading-tight">Round in Progress</p>
                      <p className="text-amber-800 text-sm mt-0.5">{round.courseSnapshot?.courseName ?? 'Unknown course'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-amber-950 text-2xl">⛳ {round.currentHole}</p>
                      <p className="text-amber-800 text-xs">Hole</p>
                    </div>
                  </div>
                  <div className="mt-3 bg-amber-950/20 rounded-xl px-4 py-2 flex items-center justify-between">
                    <span className="text-amber-900 text-sm font-semibold">
                      {round.players?.length ?? 0} players · {round.game?.type ? (GAME_EMOJI[round.game.type] ?? round.game.type) : 'Unknown'}
                      {round.game?.stakesMode === 'high_roller' && ' 💎'}
                    </span>
                    <span className="text-amber-900 text-sm font-bold">Tap to Resume →</span>
                  </div>
                </div>
              </button>
            ))}
          </section>
        )}

        <button onClick={onNewRound}
          className="w-full rounded-2xl shadow-lg overflow-hidden active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #155c36 0%, #288f52 100%)' }}>
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="text-left">
              <p className="font-display font-bold text-white text-xl">Start New Round</p>
              <p className="text-green-300 text-sm mt-0.5">Skins · Best Ball · Nassau · Wolf · BBB</p>
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

        <NearMeCourses onAddCourse={onAddCourse} />

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-gray-800 text-base">
              Your Players
              {playerCount > 0 && <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{playerCount}</span>}
            </h2>
            <button onClick={onAddPlayer} className="text-forest-600 text-sm font-semibold flex items-center gap-1">
              <span className="text-lg leading-none">+</span> Add
            </button>
          </div>
          {players?.length === 0 && (
            <button onClick={onAddPlayer} className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-8 text-center active:bg-gray-50">
              <p className="text-3xl mb-2">👤</p>
              <p className="text-gray-500 font-medium">Add your first player</p>
              <p className="text-gray-400 text-sm mt-1">Handicaps & tee preferences saved</p>
            </button>
          )}
          {players && players.length > 0 && (
            <div className="space-y-2">
              {players.map(player => <PlayerCard key={player.id} player={player} onEdit={onEditPlayer} />)}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-gray-800 text-base">
              Your Courses
              {courseCount > 0 && <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{courseCount}</span>}
            </h2>
            <button onClick={onAddCourse} className="text-forest-600 text-sm font-semibold flex items-center gap-1">
              <span className="text-lg leading-none">+</span> Add
            </button>
          </div>
          {courses?.length === 0 && (
            <button onClick={onAddCourse} className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-8 text-center active:bg-gray-50">
              <p className="text-3xl mb-2">🏌️</p>
              <p className="text-gray-500 font-medium">Add your first course</p>
              <p className="text-gray-400 text-sm mt-1">Holes, pars, slope & rating</p>
            </button>
          )}
          {courses && courses.length > 0 && (
            <div className="space-y-3">
              {courses.map(course => <CourseCard key={course.id} course={course} />)}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-gray-400 pb-4">Fore Skins Golf · All data stored on your device</p>
      </main>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [afterCourseSetup, setAfterCourseSetup] = useState<Screen>('home')
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)
  const [newRoundStakesMode, setNewRoundStakesMode] = useState<StakesMode>('standard')

  if (screen === 'course-catalog') {
    return (
      <CourseCatalog
        onDone={() => setScreen(afterCourseSetup)}
        onAddCustom={() => setScreen('course-setup')}
      />
    )
  }
  if (screen === 'course-setup') {
    return <CourseSetup onSave={() => setScreen(afterCourseSetup)} onCancel={() => setScreen('course-catalog')} />
  }
  if (screen === 'player-setup') {
    return <PlayerSetup onSave={() => setScreen('home')} onCancel={() => setScreen('home')} />
  }
  if (screen === 'new-round') {
    return (
      <NewRound
        onStart={roundId => { setActiveRoundId(roundId); setScreen('scorecard') }}
        onCancel={() => setScreen('home')}
        onAddCourse={() => { setAfterCourseSetup('new-round'); setScreen('course-catalog') }}
        initialStakesMode={newRoundStakesMode}
      />
    )
  }
  if (screen === 'scorecard' && activeRoundId) {
    return <Scorecard roundId={activeRoundId} onEndRound={() => setScreen('settle-up')} onHome={() => setScreen('home')} />
  }
  if (screen === 'settle-up' && activeRoundId) {
    return (
      <SettleUp
        roundId={activeRoundId}
        onDone={() => { setActiveRoundId(null); setScreen('home') }}
        onContinue={() => setScreen('scorecard')}
      />
    )
  }

  return (
    <Home
      onNewRound={() => { setNewRoundStakesMode('standard'); setScreen('new-round') }}
      onNewHighRollerRound={() => { setNewRoundStakesMode('high_roller'); setScreen('new-round') }}
      onAddCourse={() => { setAfterCourseSetup('home'); setScreen('course-catalog') }}
      onAddPlayer={() => setScreen('player-setup')}
      onEditPlayer={() => setScreen('player-setup')}
      onResumeRound={roundId => { setActiveRoundId(roundId); setScreen('scorecard') }}
    />
  )
}
