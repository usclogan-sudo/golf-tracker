import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, courseToRow, playerToRow, roundToRow, roundPlayerToRow, buyInToRow, rowToCourse, rowToPlayer } from '../../lib/supabase'
import { fmtMoney } from '../../lib/gameLogic'
import { venturaCourses } from '../../data/venturaCourses'
import type {
  Course,
  Player,
  Round,
  Game,
  SkinsConfig,
  BestBallConfig,
  NassauConfig,
  WolfConfig,
  BBBConfig,
  BuyIn,
  PaymentMethod,
  GameType,
  StakesMode,
} from '../../types'

interface Props {
  userId: string
  onStart: (roundId: string) => void
  onCancel: () => void
  onAddCourse: () => void
  initialStakesMode?: StakesMode
}

const STANDARD_PRESETS = [500, 1000, 2000, 5000]
const HIGH_ROLLER_PRESETS = [10000, 25000, 50000, 100000]

// ─── Step 1: Course Picker ────────────────────────────────────────────────────

function CoursePicker({
  userId,
  onSelect,
  onAddCourse,
  onCancel,
  stakesMode,
}: {
  userId: string
  onSelect: (course: Course) => void
  onAddCourse: () => void
  onCancel: () => void
  stakesMode: StakesMode
}) {
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState<string | null>(null)
  const [savedCourses, setSavedCourses] = useState<Course[]>([])
  const headerClass = stakesMode === 'high_roller' ? 'hr-header' : 'app-header'

  useEffect(() => {
    supabase.from('courses').select('*').order('name').then(({ data }) => {
      if (data) setSavedCourses(data.map(rowToCourse))
    })
  }, [])

  // Merge saved courses with catalog, deduplicating by name
  const savedNames = new Set(savedCourses.map(c => c.name))
  const catalogOnly = venturaCourses.filter(t => !savedNames.has(t.name))

  const allCourses: { id: string; name: string; city?: string; par: number; tees: string; fromDb: boolean; dbCourse?: Course; templateName?: string }[] = [
    ...savedCourses.map(c => ({
      id: c.id,
      name: c.name,
      par: c.holes.reduce((s, h) => s + h.par, 0),
      tees: c.tees.map(t => t.name).join(', '),
      fromDb: true,
      dbCourse: c,
    })),
    ...catalogOnly.map(t => ({
      id: `catalog-${t.name}`,
      name: t.name,
      city: t.city,
      par: t.holes.reduce((s, h) => s + h.par, 0),
      tees: t.tees.map(t => t.name).join(', '),
      fromDb: false,
      templateName: t.name,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const filtered = query.trim()
    ? allCourses.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.city ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : allCourses

  const handleSelect = async (item: typeof allCourses[number]) => {
    if (selecting) return
    if (item.fromDb && item.dbCourse) {
      onSelect(item.dbCourse)
      return
    }
    // Catalog course — save to DB first, then select
    setSelecting(item.id)
    const template = venturaCourses.find(t => t.name === item.templateName)!
    const course: Course = {
      id: uuidv4(),
      name: template.name,
      tees: template.tees,
      holes: template.holes,
      createdAt: new Date(),
    }
    await supabase.from('courses').insert(courseToRow(course, userId))
    onSelect(course)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className={`${headerClass} text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3`}>
        <button
          onClick={onCancel}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/20 text-xl"
          aria-label="Cancel"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">Select Course</h1>
          {stakesMode === 'high_roller' && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'linear-gradient(135deg,#d97706,#fbbf24)', color: '#000' }}>
              💎 HIGH ROLLER
            </span>
          )}
        </div>
      </header>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-3">
        <input
          type="text"
          placeholder="Search courses…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
        />

        <div className="space-y-2">
          {filtered.map(course => (
            <button
              key={course.id}
              onClick={() => handleSelect(course)}
              disabled={!!selecting}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left active:bg-gray-50 disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{course.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Par {course.par} · {course.tees}
                    {course.city && !course.fromDb && (
                      <span className="ml-1 text-gray-400">· {course.city}</span>
                    )}
                  </p>
                </div>
                {selecting === course.id && (
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8">No courses match "{query}"</p>
          )}
        </div>

        <button
          onClick={onAddCourse}
          className="w-full h-12 border-2 border-dashed border-green-300 text-green-700 font-semibold rounded-2xl active:bg-green-50"
        >
          + Add Custom Course
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Player Picker ────────────────────────────────────────────────────

function PlayerPicker({
  userId,
  course,
  onNext,
  onBack,
  stakesMode,
}: {
  userId: string
  course: Course
  onNext: (players: Player[]) => void
  onBack: () => void
  stakesMode: StakesMode
}) {
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [playerTees, setPlayerTees] = useState<Record<string, string>>({})

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHcp, setNewHcp] = useState('')
  const [newGhin, setNewGhin] = useState('')
  const [newTee, setNewTee] = useState(course.tees[0]?.name ?? 'White')
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)

  const MAX_PLAYERS = 8
  const headerClass = stakesMode === 'high_roller' ? 'hr-header' : 'app-header'

  useEffect(() => {
    supabase.from('players').select('*').order('name').then(({ data }) => {
      if (data) setAllPlayers(data.map(rowToPlayer))
    })
  }, [])

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setPlayerTees(pt => {
          const c = { ...pt }
          delete c[id]
          return c
        })
      } else if (next.size < MAX_PLAYERS) {
        next.add(id)
      }
      return next
    })
  }

  const handleAddPlayer = async () => {
    if (!newName.trim()) { setAddError('Name is required'); return }
    const hcp = parseFloat(newHcp)
    if (isNaN(hcp) || hcp < -10 || hcp > 54) { setAddError('Handicap must be between -10 and 54'); return }
    if (!newGhin.trim()) { setAddError('GHIN number is required'); return }
    if (!/^\d+$/.test(newGhin.trim())) { setAddError('GHIN must be numeric'); return }
    setSaving(true)
    try {
      const newPlayer: Player = { id: uuidv4(), name: newName.trim(), handicapIndex: hcp, tee: newTee, ghinNumber: newGhin.trim(), createdAt: new Date() }
      const { error: err } = await supabase.from('players').insert(playerToRow(newPlayer, userId))
      if (err) throw err
      setAllPlayers(prev => [...prev, newPlayer].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedIds(prev => { const n = new Set(prev); n.add(newPlayer.id); return n })
      setNewName(''); setNewHcp(''); setNewGhin(''); setAddError(''); setShowAddForm(false)
    } catch { setAddError('Failed to save. Try again.') }
    finally { setSaving(false) }
  }

  const handleNext = () => {
    const selected = allPlayers
      .filter(p => selectedIds.has(p.id))
      .map(p => ({ ...p, tee: playerTees[p.id] ?? p.tee }))
    onNext(selected)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className={`${headerClass} text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3`}>
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/20 text-xl"
          aria-label="Back"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">Select Players</h1>
          <p className="text-green-300 text-xs truncate">{course.name}</p>
        </div>
      </header>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-3">
        <p className="text-xs text-gray-500 px-1">
          {selectedIds.size === 0
            ? `Select up to ${MAX_PLAYERS} players`
            : `${selectedIds.size} player${selectedIds.size !== 1 ? 's' : ''} selected`}
          {selectedIds.size === MAX_PLAYERS && ' (max)'}
        </p>

        {allPlayers.length > 0 && (
          <div className="space-y-2">
            {allPlayers.map(player => {
              const selected = selectedIds.has(player.id)
              const activeTee = playerTees[player.id] ?? player.tee
              return (
                <div
                  key={player.id}
                  className={`bg-white rounded-2xl shadow-sm border transition-colors ${
                    selected ? 'border-green-400 bg-green-50' : 'border-gray-100'
                  }`}
                >
                  <button
                    onClick={() => toggle(player.id)}
                    disabled={!selected && selectedIds.size >= MAX_PLAYERS}
                    className="w-full p-4 text-left flex items-center gap-3 disabled:opacity-40"
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? 'border-green-600 bg-green-600' : 'border-gray-300'
                      }`}
                    >
                      {selected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{player.name}</p>
                      <p className="text-sm text-gray-500">HCP {player.handicapIndex}</p>
                    </div>
                  </button>

                  {selected && course.tees.length > 1 && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Tee:</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {course.tees.map(t => (
                          <button
                            key={t.name}
                            onClick={() => setPlayerTees(prev => ({ ...prev, [player.id]: t.name }))}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              activeTee === t.name
                                ? 'bg-green-700 text-white'
                                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                            }`}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {showAddForm ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <p className="font-semibold text-gray-700 text-sm">Quick Add Player</p>
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="decimal"
                placeholder="Handicap Index"
                value={newHcp}
                onChange={e => setNewHcp(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="GHIN Number"
                value={newGhin}
                onChange={e => setNewGhin(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <select
              value={newTee}
              onChange={e => setNewTee(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {course.tees.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
            {addError && <p className="text-red-500 text-sm">{addError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddForm(false); setNewName(''); setNewHcp(''); setNewGhin(''); setAddError('') }}
                className="flex-1 h-11 border border-gray-300 rounded-xl text-gray-600 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlayer}
                disabled={saving}
                className="flex-1 h-11 bg-green-700 text-white rounded-xl font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={selectedIds.size >= MAX_PLAYERS}
            className="w-full h-12 border-2 border-dashed border-green-300 text-green-700 font-semibold rounded-2xl active:bg-green-50 disabled:opacity-40"
          >
            + Add New Player
          </button>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleNext}
            disabled={selectedIds.size === 0}
            className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-40 active:bg-green-800 transition-colors"
          >
            {selectedIds.size === 0
              ? 'Select at Least 1 Player'
              : `Next · ${selectedIds.size} Player${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Game Setup ───────────────────────────────────────────────────────

function GameSetup({
  players,
  initialStakesMode,
  onNext,
  onBack,
}: {
  players: Player[]
  initialStakesMode: StakesMode
  onNext: (game: Game) => void
  onBack: () => void
}) {
  const [stakesMode, setStakesMode] = useState<StakesMode>(initialStakesMode)
  const [type, setType] = useState<GameType>('skins')
  const [buyInDollars, setBuyInDollars] = useState(initialStakesMode === 'high_roller' ? '100' : '10')
  const [showCustomBuyIn, setShowCustomBuyIn] = useState(false)

  // Skins
  const [skinsMode, setSkinsMode] = useState<'gross' | 'net'>('net')
  const [carryovers, setCarryovers] = useState(true)

  // Best Ball
  const [bbScoring, setBbScoring] = useState<'match' | 'total'>('match')
  const [bbMode, setBbMode] = useState<'gross' | 'net'>('net')
  const [teams, setTeams] = useState<Record<string, 'A' | 'B'>>(() => {
    const t: Record<string, 'A' | 'B'> = {}
    players.forEach((p, i) => (t[p.id] = i % 2 === 0 ? 'A' : 'B'))
    return t
  })

  // Nassau
  const [nassauMode, setNassauMode] = useState<'gross' | 'net'>('net')

  // Wolf
  const [wolfMode, setWolfMode] = useState<'gross' | 'net'>('net')
  const [wolfOrder, setWolfOrder] = useState<string[]>(() => players.map(p => p.id))

  // BBB
  const [bbbMode, setBbbMode] = useState<'gross' | 'net'>('net')

  const presets = stakesMode === 'high_roller' ? HIGH_ROLLER_PRESETS : STANDARD_PRESETS

  const handleStakesChange = (mode: StakesMode) => {
    setStakesMode(mode)
    const newPresets = mode === 'high_roller' ? HIGH_ROLLER_PRESETS : STANDARD_PRESETS
    setBuyInDollars(String(newPresets[0] / 100))
    setShowCustomBuyIn(false)
  }

  const selectPreset = (cents: number) => {
    setBuyInDollars(String(cents / 100))
    setShowCustomBuyIn(false)
  }

  const buyInCents = Math.max(0, Math.round(parseFloat(buyInDollars || '0') * 100))
  const activePreset = presets.find(p => p === buyInCents) ?? null

  const bestBallAllowed = players.length >= 2 && players.length % 2 === 0
  const wolfAllowed = players.length >= 3

  const teamCounts = useMemo(() => {
    let a = 0, b = 0
    for (const p of players) {
      if (teams[p.id] === 'A') a++
      else b++
    }
    return { a, b }
  }, [players, teams])
  const teamsValid = teamCounts.a >= 1 && teamCounts.a === teamCounts.b

  const canContinue =
    buyInCents > 0 &&
    (type === 'skins' ||
      type === 'nassau' ||
      type === 'bingo_bango_bongo' ||
      (type === 'best_ball' && bestBallAllowed && teamsValid) ||
      (type === 'wolf' && wolfAllowed))

  const moveWolfPlayer = (index: number, dir: -1 | 1) => {
    const next = [...wolfOrder]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setWolfOrder(next)
  }

  const makeGame = (): Game => {
    const id = uuidv4()
    if (type === 'skins') {
      const config: SkinsConfig = { mode: skinsMode, carryovers }
      return { id, type: 'skins', buyInCents, stakesMode, config }
    }
    if (type === 'best_ball') {
      const config: BestBallConfig = { scoring: bbScoring, mode: bbMode, teams }
      return { id, type: 'best_ball', buyInCents, stakesMode, config }
    }
    if (type === 'nassau') {
      const config: NassauConfig = { mode: nassauMode }
      return { id, type: 'nassau', buyInCents, stakesMode, config }
    }
    if (type === 'wolf') {
      const config: WolfConfig = { mode: wolfMode, wolfOrder }
      return { id, type: 'wolf', buyInCents, stakesMode, config }
    }
    // bingo_bango_bongo
    const config: BBBConfig = { mode: bbbMode }
    return { id, type: 'bingo_bango_bongo', buyInCents, stakesMode, config }
  }

  const headerClass = stakesMode === 'high_roller' ? 'hr-header' : 'app-header'

  const GameButton = ({
    gameType,
    label,
    disabled = false,
    fullWidth = false,
  }: {
    gameType: GameType
    label: string
    disabled?: boolean
    fullWidth?: boolean
  }) => (
    <button
      onClick={() => !disabled && setType(gameType)}
      disabled={disabled}
      className={`h-14 rounded-xl font-semibold text-sm disabled:opacity-40 transition-colors ${fullWidth ? 'col-span-2' : ''} ${
        type === gameType
          ? stakesMode === 'high_roller'
            ? 'text-black'
            : 'bg-green-700 text-white'
          : 'bg-gray-100 text-gray-700'
      }`}
      style={type === gameType && stakesMode === 'high_roller'
        ? { background: 'linear-gradient(135deg,#d97706,#fbbf24)' }
        : undefined}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className={`${headerClass} text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3`}>
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/20 text-xl"
          aria-label="Back"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold">Choose Game</h1>
          {stakesMode === 'high_roller' && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'linear-gradient(135deg,#d97706,#fbbf24)', color: '#000' }}>
              💎 HIGH ROLLER
            </span>
          )}
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">

        {/* Stakes Mode */}
        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stakes</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleStakesChange('standard')}
              className={`h-14 rounded-xl font-semibold ${
                stakesMode === 'standard' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              🎯 Standard
            </button>
            <button
              onClick={() => handleStakesChange('high_roller')}
              className={`h-14 rounded-xl font-bold ${
                stakesMode === 'high_roller' ? 'text-black' : 'bg-gray-100 text-gray-700'
              }`}
              style={stakesMode === 'high_roller'
                ? { background: 'linear-gradient(135deg,#d97706,#fbbf24)' }
                : undefined}
            >
              💎 High Roller
            </button>
          </div>
        </section>

        {/* Game Type */}
        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Game Type</p>
          <div className="grid grid-cols-2 gap-2">
            <GameButton gameType="skins" label="🎰 Skins" />
            <GameButton gameType="best_ball" label="🤝 Best Ball" disabled={!bestBallAllowed} />
            <GameButton gameType="nassau" label="🏳️ Nassau" />
            <GameButton gameType="wolf" label="🐺 Wolf" disabled={!wolfAllowed} />
            <GameButton gameType="bingo_bango_bongo" label="⭐ Bingo Bango Bongo" fullWidth />
          </div>
          {!bestBallAllowed && type === 'best_ball' && (
            <p className="text-sm text-gray-400">Best Ball requires an even number of players (2, 4, 6…).</p>
          )}
          {!wolfAllowed && type === 'wolf' && (
            <p className="text-sm text-gray-400">Wolf requires at least 3 players.</p>
          )}
        </section>

        {/* Buy-in */}
        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Buy-in Per Player{type === 'nassau' ? ' (covers all 3 bets)' : ''}
          </p>

          <div className="flex gap-2 flex-wrap">
            {presets.map(cents => (
              <button
                key={cents}
                onClick={() => selectPreset(cents)}
                className={`px-4 h-10 rounded-xl font-semibold text-sm transition-colors ${
                  activePreset === cents
                    ? stakesMode === 'high_roller'
                      ? 'text-black'
                      : 'bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
                style={activePreset === cents && stakesMode === 'high_roller'
                  ? { background: 'linear-gradient(135deg,#d97706,#fbbf24)' }
                  : undefined}
              >
                {fmtMoney(cents)}
              </button>
            ))}
            <button
              onClick={() => setShowCustomBuyIn(v => !v)}
              className={`px-4 h-10 rounded-xl font-semibold text-sm transition-colors ${
                showCustomBuyIn || activePreset === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Custom
            </button>
          </div>

          {showCustomBuyIn && (
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-500">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                autoFocus
                value={buyInDollars}
                onChange={e => setBuyInDollars(e.target.value)}
                className="flex-1 h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          )}

          <div className="bg-green-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total pot</span>
            <span className="font-bold text-green-800 text-lg">{fmtMoney(buyInCents * players.length)}</span>
          </div>

          {type === 'nassau' && (
            <p className="text-xs text-gray-500">
              = {fmtMoney(Math.floor(buyInCents / 3))} per bet × 3 bets (Front 9, Back 9, Total)
            </p>
          )}
        </section>

        {/* Skins Options */}
        {type === 'skins' && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Skins Options</p>
            <div>
              <p className="text-sm text-gray-600 mb-2">Scoring</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSkinsMode('net')}
                  className={`h-12 rounded-xl font-semibold ${skinsMode === 'net' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Net (handicap)
                </button>
                <button onClick={() => setSkinsMode('gross')}
                  className={`h-12 rounded-xl font-semibold ${skinsMode === 'gross' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Gross (raw)
                </button>
              </div>
            </div>
            <button
              onClick={() => setCarryovers(v => !v)}
              className={`w-full h-12 rounded-xl font-semibold border-2 ${
                carryovers ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              Carryovers: {carryovers ? 'ON ✓ (recommended)' : 'OFF'}
            </button>
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
              Lowest score wins the hole.{' '}
              {carryovers ? 'Ties carry the pot forward until someone wins it clean.' : 'Ties push — no carry.'}
            </p>
          </section>
        )}

        {/* Best Ball Options */}
        {type === 'best_ball' && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Best Ball Options</p>
            <div>
              <p className="text-sm text-gray-600 mb-2">Format</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setBbScoring('match')}
                  className={`h-12 rounded-xl font-semibold text-sm ${bbScoring === 'match' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Match Play
                </button>
                <button onClick={() => setBbScoring('total')}
                  className={`h-12 rounded-xl font-semibold text-sm ${bbScoring === 'total' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Stroke Play
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Scoring</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setBbMode('net')}
                  className={`h-12 rounded-xl font-semibold ${bbMode === 'net' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Net (handicap)
                </button>
                <button onClick={() => setBbMode('gross')}
                  className={`h-12 rounded-xl font-semibold ${bbMode === 'gross' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Gross (raw)
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Teams (tap to assign)</p>
              <div className="grid grid-cols-2 gap-2">
                {(['A', 'B'] as const).map(team => (
                  <div key={team} className={`rounded-xl border-2 p-3 ${team === 'A' ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${team === 'A' ? 'text-blue-700' : 'text-orange-700'}`}>Team {team}</p>
                    <div className="space-y-1.5">
                      {players.map(p => (
                        <button key={p.id}
                          onClick={() => setTeams(prev => ({ ...prev, [p.id]: team }))}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            teams[p.id] === team
                              ? team === 'A' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'
                              : 'bg-white text-gray-600 border border-gray-200'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {!teamsValid && (
                <p className="text-red-600 text-sm mt-2">
                  Teams must be equal size. ({teamCounts.a} / {teamCounts.b})
                </p>
              )}
            </div>
          </section>
        )}

        {/* Nassau Options */}
        {type === 'nassau' && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nassau Options</p>
            <div>
              <p className="text-sm text-gray-600 mb-2">Scoring</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setNassauMode('net')}
                  className={`h-12 rounded-xl font-semibold ${nassauMode === 'net' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Net (handicap)
                </button>
                <button onClick={() => setNassauMode('gross')}
                  className={`h-12 rounded-xl font-semibold ${nassauMode === 'gross' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Gross (raw)
                </button>
              </div>
            </div>
            <div className="bg-teal-50 rounded-xl p-3 text-sm text-teal-700 space-y-1">
              <p className="font-semibold">3 separate bets:</p>
              <p>• Front 9 — lowest total strokes wins</p>
              <p>• Back 9 — lowest total strokes wins</p>
              <p>• Full 18 — lowest total strokes wins</p>
            </div>
          </section>
        )}

        {/* Wolf Options */}
        {type === 'wolf' && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wolf Options</p>
            <div>
              <p className="text-sm text-gray-600 mb-2">Scoring</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setWolfMode('net')}
                  className={`h-12 rounded-xl font-semibold ${wolfMode === 'net' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Net (handicap)
                </button>
                <button onClick={() => setWolfMode('gross')}
                  className={`h-12 rounded-xl font-semibold ${wolfMode === 'gross' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Gross (raw)
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Wolf Rotation Order</p>
              <p className="text-xs text-gray-400 mb-2">Player 1 is Wolf on hole 1, Player 2 on hole 2, etc.</p>
              <div className="space-y-2">
                {wolfOrder.map((playerId, index) => {
                  const player = players.find(p => p.id === playerId)
                  return (
                    <div key={playerId} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="flex-1 font-medium text-gray-800">{player?.name}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveWolfPlayer(index, -1)}
                          disabled={index === 0}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-30 flex items-center justify-center text-sm"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveWolfPlayer(index, 1)}
                          disabled={index === wolfOrder.length - 1}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-30 flex items-center justify-center text-sm"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-sm text-purple-700 space-y-1">
              <p className="font-semibold">How it works:</p>
              <p>• Wolf picks a partner after each tee shot, or goes Lone Wolf</p>
              <p>• Lone Wolf wins: Wolf gets 2× from each opponent</p>
              <p>• Partner wins: Wolf and partner each get 1× from opponents</p>
            </div>
          </section>
        )}

        {/* BBB Options */}
        {type === 'bingo_bango_bongo' && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bingo Bango Bongo Options</p>
            <div>
              <p className="text-sm text-gray-600 mb-2">Scoring</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setBbbMode('net')}
                  className={`h-12 rounded-xl font-semibold ${bbbMode === 'net' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Net (handicap)
                </button>
                <button onClick={() => setBbbMode('gross')}
                  className={`h-12 rounded-xl font-semibold ${bbbMode === 'gross' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  Gross (raw)
                </button>
              </div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700 space-y-1">
              <p className="font-semibold">3 points per hole:</p>
              <p>🟢 <strong>Bingo</strong> — First ball on the green</p>
              <p>📍 <strong>Bango</strong> — Closest to pin when all are on green</p>
              <p>🏆 <strong>Bongo</strong> — First to hole out (make the putt)</p>
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => onNext(makeGame())}
            disabled={!canContinue}
            className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-40 active:bg-green-800 transition-colors"
          >
            Next: Collect Buy-ins
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Treasurer + Buy-in Collection ────────────────────────────────────

function TreasurerAndBuyIns({
  userId,
  course,
  players,
  game,
  onCreateRound,
  onBack,
}: {
  userId: string
  course: Course
  players: Player[]
  game: Game
  onCreateRound: (roundId: string) => void
  onBack: () => void
}) {
  const [treasurerId, setTreasurerId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('venmo')
  const [paid, setPaid] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    players.forEach(p => (init[p.id] = false))
    return init
  })
  const [allowStartUnpaid, setAllowStartUnpaid] = useState(false)
  const [saving, setSaving] = useState(false)

  const potCents = game.buyInCents * players.length
  const allPaid = players.every(p => paid[p.id])
  const canStart = !!treasurerId && (allPaid || allowStartUnpaid)
  const treasurer = players.find(p => p.id === treasurerId)
  const headerClass = game.stakesMode === 'high_roller' ? 'hr-header' : 'app-header'

  const startRound = async () => {
    if (!treasurerId) return
    setSaving(true)
    try {
      const roundId = uuidv4()
      const round: Round = {
        id: roundId,
        courseId: course.id,
        date: new Date(),
        status: 'active',
        currentHole: 1,
        courseSnapshot: {
          courseId: course.id,
          courseName: course.name,
          tees: course.tees,
          holes: course.holes,
        },
        players,
        game,
        treasurerPlayerId: treasurerId,
      }

      const buyIns: BuyIn[] = players.map(p => ({
        id: uuidv4(),
        roundId,
        playerId: p.id,
        amountCents: game.buyInCents,
        method,
        status: paid[p.id] ? 'marked_paid' : 'unpaid',
        ...(paid[p.id] ? { paidAt: new Date() } : {}),
      }))

      const roundPlayers = players.map(p => ({
        id: uuidv4(),
        roundId,
        playerId: p.id,
        teePlayed: p.tee,
      }))

      // Insert round, round_players, and buy_ins
      await Promise.all([
        supabase.from('rounds').insert(roundToRow(round, userId)),
        supabase.from('round_players').insert(roundPlayers.map(rp => roundPlayerToRow(rp, userId))),
        supabase.from('buy_ins').insert(buyIns.map(b => buyInToRow(b, userId))),
      ])

      onCreateRound(roundId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      <header className={`${headerClass} text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3`}>
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/20 text-xl"
          aria-label="Back"
        >
          ←
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Buy-ins & Treasurer</h1>
          <p className="text-green-300 text-xs truncate">
            Pot {fmtMoney(potCents)} · {course.name}
            {game.stakesMode === 'high_roller' && (
              <span className="ml-2 font-bold" style={{ color: '#fbbf24' }}>💎 HIGH ROLLER</span>
            )}
          </p>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Treasurer</p>
            <p className="text-sm text-gray-500 mt-1">Who is holding the pot?</p>
          </div>
          <div className="space-y-2">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setTreasurerId(p.id)}
                className={`w-full p-4 rounded-2xl border-2 text-left font-semibold transition-colors ${
                  treasurerId === p.id
                    ? 'border-green-500 bg-green-50 text-green-900'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {p.name}
                {treasurerId === p.id && (
                  <span className="ml-2 text-sm font-normal text-green-600">✓ Treasurer</span>
                )}
              </button>
            ))}
          </div>
          {!treasurerId && (
            <p className="text-red-500 text-sm">Choose a treasurer before starting.</p>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Method</p>
          <div className="grid grid-cols-4 gap-2">
            {(['venmo', 'cash', 'zelle', 'paypal'] as PaymentMethod[]).map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`h-11 rounded-xl font-semibold capitalize text-sm ${
                  method === m ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500">
            {fmtMoney(game.buyInCents)} per player → pay{' '}
            <strong>{treasurer?.name ?? '…'}</strong>
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirm Payments</p>
            <p className="text-sm text-gray-500 mt-1">Tap each player once they've paid the treasurer.</p>
          </div>
          <div className="space-y-2">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setPaid(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-colors ${
                  paid[p.id] ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                }`}
              >
                <span className="font-semibold text-gray-800">{p.name}</span>
                <span
                  className={`text-sm font-bold px-3 py-1.5 rounded-full ${
                    paid[p.id] ? 'bg-green-600 text-white' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {paid[p.id] ? '✓ PAID' : 'UNPAID'}
                </span>
              </button>
            ))}
          </div>
          {!allPaid && (
            <label className="flex items-start gap-3 text-sm text-gray-500 mt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowStartUnpaid}
                onChange={e => setAllowStartUnpaid(e.target.checked)}
                className="mt-0.5 w-5 h-5 flex-shrink-0"
              />
              <span>Start anyway — I'll collect on the course (good luck with that)</span>
            </label>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-2xl mx-auto space-y-2">
          <button
            onClick={startRound}
            disabled={!canStart || saving}
            className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-40 active:bg-green-800 transition-colors"
          >
            {saving
              ? 'Starting…'
              : !treasurerId
              ? 'Choose a Treasurer First'
              : allPaid
              ? '⛳ Tee It Up!'
              : 'Collect Buy-ins to Start'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── NewRound orchestrator ────────────────────────────────────────────────────

export function NewRound({ userId, onStart, onCancel, onAddCourse, initialStakesMode = 'standard' }: Props) {
  const [step, setStep] = useState<'course' | 'players' | 'game' | 'money'>('course')
  const [course, setCourse] = useState<Course | null>(null)
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [game, setGame] = useState<Game | null>(null)

  if (step === 'course') {
    return (
      <CoursePicker
        userId={userId}
        onSelect={c => { setCourse(c); setStep('players') }}
        onAddCourse={onAddCourse}
        onCancel={onCancel}
        stakesMode={initialStakesMode}
      />
    )
  }

  if (step === 'players' && course) {
    return (
      <PlayerPicker
        userId={userId}
        course={course}
        onNext={ps => { setPlayers(ps); setStep('game') }}
        onBack={() => setStep('course')}
        stakesMode={initialStakesMode}
      />
    )
  }

  if (step === 'game' && players) {
    return (
      <GameSetup
        players={players}
        initialStakesMode={initialStakesMode}
        onNext={g => { setGame(g); setStep('money') }}
        onBack={() => setStep('players')}
      />
    )
  }

  if (step === 'money' && course && players && game) {
    return (
      <TreasurerAndBuyIns
        userId={userId}
        course={course}
        players={players}
        game={game}
        onBack={() => setStep('game')}
        onCreateRound={rid => onStart(rid)}
      />
    )
  }

  return (
    <CoursePicker
      userId={userId}
      onSelect={c => { setCourse(c); setStep('players') }}
      onAddCourse={onAddCourse}
      onCancel={onCancel}
      stakesMode={initialStakesMode}
    />
  )
}
