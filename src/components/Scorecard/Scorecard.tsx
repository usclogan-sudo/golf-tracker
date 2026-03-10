import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, rowToRound, rowToRoundPlayer, rowToHoleScore, rowToBBBPoint, rowToJunkRecord, holeScoreToRow, bbbPointToRow, junkRecordToRow } from '../../lib/supabase'
import {
  buildCourseHandicaps,
  calculateSkins,
  calculateBestBall,
  calculateNassau,
  wolfForHole,
  strokesOnHole,
  fmtMoney,
  JUNK_LABELS,
} from '../../lib/gameLogic'
import type {
  Round,
  RoundPlayer,
  HoleScore,
  BBBPoint,
  JunkRecord,
  JunkType,
  SkinsConfig,
  BestBallConfig,
  NassauConfig,
  WolfConfig,
} from '../../types'

interface Props {
  userId: string
  roundId: string
  onEndRound: () => void
  onHome: () => void
}

function ScoreStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-12 h-12 text-2xl font-bold bg-gray-100 rounded-xl disabled:opacity-30 active:bg-gray-200 flex items-center justify-center"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-10 text-center text-2xl font-bold text-gray-900">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-12 h-12 text-2xl font-bold bg-gray-100 rounded-xl disabled:opacity-30 active:bg-gray-200 flex items-center justify-center"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}

function SkinsStatus({ carry, potCents }: { carry: number; potCents: number }) {
  if (carry === 0) return null
  const valueCents = potCents * (carry + 1)
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 flex items-center gap-2">
      <span className="text-yellow-600 font-bold text-sm">🔥 Carry ×{carry + 1}</span>
      <span className="text-yellow-700 text-sm">{fmtMoney(valueCents)} on the line</span>
    </div>
  )
}

function BestBallStatus({ holesWon }: { holesWon: { A: number; B: number; tied: number } }) {
  const diff = holesWon.A - holesWon.B
  const label = diff === 0 ? 'All Square' : diff > 0 ? `Team A +${diff}` : `Team B +${Math.abs(diff)}`
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
      <span className="text-blue-700 font-bold text-sm">{label}</span>
      <span className="text-blue-500 text-xs ml-2">({holesWon.A}W · {holesWon.tied}T · {holesWon.B}W)</span>
    </div>
  )
}

export function Scorecard({ userId, roundId, onEndRound, onHome }: Props) {
  const [round, setRound] = useState<Round | null>(null)
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([])
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [bbbPoints, setBbbPoints] = useState<BBBPoint[]>([])
  const [junkRecords, setJunkRecords] = useState<JunkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastChange, setLastChange] = useState<{ playerId: string; holeNumber: number; previousScore: number } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('rounds').select('*').eq('id', roundId).single(),
      supabase.from('round_players').select('*').eq('round_id', roundId),
      supabase.from('hole_scores').select('*').eq('round_id', roundId),
      supabase.from('bbb_points').select('*').eq('round_id', roundId),
      supabase.from('junk_records').select('*').eq('round_id', roundId),
    ]).then(([roundRes, rpRes, hsRes, bbbRes, junkRes]) => {
      if (roundRes.data) setRound(rowToRound(roundRes.data))
      if (rpRes.data) setRoundPlayers(rpRes.data.map(rowToRoundPlayer))
      if (hsRes.data) setHoleScores(hsRes.data.map(rowToHoleScore))
      if (bbbRes.data) setBbbPoints(bbbRes.data.map(rowToBBBPoint))
      if (junkRes.data) setJunkRecords(junkRes.data.map(rowToJunkRecord))
      setLoading(false)
    })
  }, [roundId])

  // ─── Realtime subscriptions for multi-device sync ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`round-${roundId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores', filter: `round_id=eq.${roundId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as any
          setHoleScores(prev => {
            if (prev.some(s => s.id === row.id)) return prev
            return [...prev, rowToHoleScore(row)]
          })
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as any
          setHoleScores(prev => prev.map(s => s.id === row.id ? rowToHoleScore(row) : s))
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as any
          setHoleScores(prev => prev.filter(s => s.id !== row.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bbb_points', filter: `round_id=eq.${roundId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as any
          setBbbPoints(prev => prev.some(p => p.id === row.id) ? prev : [...prev, rowToBBBPoint(row)])
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as any
          setBbbPoints(prev => prev.map(p => p.id === row.id ? rowToBBBPoint(row) : p))
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as any
          setBbbPoints(prev => prev.filter(p => p.id !== row.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'junk_records', filter: `round_id=eq.${roundId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as any
          setJunkRecords(prev => prev.some(jr => jr.id === row.id) ? prev : [...prev, rowToJunkRecord(row)])
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as any
          setJunkRecords(prev => prev.map(jr => jr.id === row.id ? rowToJunkRecord(row) : jr))
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as any
          setJunkRecords(prev => prev.filter(jr => jr.id !== row.id))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `id=eq.${roundId}` }, (payload) => {
        const row = payload.new as any
        setRound(rowToRound(row))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roundId])

  const players = round?.players ?? []
  const snapshot = round?.courseSnapshot
  const game = round?.game
  const currentHole = round?.currentHole ?? 1

  const courseHcps = useMemo(() => {
    if (!snapshot || !roundPlayers) return {}
    return buildCourseHandicaps(players, roundPlayers, snapshot)
  }, [players, roundPlayers, snapshot])

  const hole = snapshot?.holes.find(h => h.number === currentHole)
  const par = hole?.par ?? 4
  const strokeIndex = hole?.strokeIndex ?? currentHole

  const getScore = (playerId: string): number => {
    const hs = holeScores.find(s => s.playerId === playerId && s.holeNumber === currentHole)
    return hs?.grossScore ?? par
  }

  const setScore = async (playerId: string, grossScore: number) => {
    setSaveError(null)
    const existing = holeScores.find(s => s.playerId === playerId && s.holeNumber === currentHole)
    const previousScore = existing?.grossScore ?? par
    setLastChange({ playerId, holeNumber: currentHole, previousScore })
    try {
      if (existing) {
        setHoleScores(prev => prev.map(s => s.id === existing.id ? { ...s, grossScore } : s))
        const { error } = await supabase.from('hole_scores').update({ gross_score: grossScore }).eq('id', existing.id)
        if (error) throw error
      } else {
        const newScore: HoleScore = { id: uuidv4(), roundId, playerId, holeNumber: currentHole, grossScore }
        setHoleScores(prev => [...prev, newScore])
        const { error } = await supabase.from('hole_scores').insert(holeScoreToRow(newScore, userId))
        if (error) throw error
      }
    } catch {
      setSaveError('Score failed to save — check your connection')
    }
  }

  const undoLastChange = async () => {
    if (!lastChange) return
    const existing = holeScores.find(s => s.playerId === lastChange.playerId && s.holeNumber === lastChange.holeNumber)
    if (existing) {
      setHoleScores(prev => prev.map(s => s.id === existing.id ? { ...s, grossScore: lastChange.previousScore } : s))
      await supabase.from('hole_scores').update({ gross_score: lastChange.previousScore }).eq('id', existing.id)
    }
    setLastChange(null)
  }

  const goToHole = async (holeNum: number) => {
    setSaveError(null)
    setRound(prev => prev ? { ...prev, currentHole: holeNum } : prev)
    const { error } = await supabase.from('rounds').update({ current_hole: holeNum }).eq('id', roundId)
    if (error) setSaveError('Failed to save hole change — check your connection')
  }

  const endRound = async () => {
    const totalHoles = snapshot?.holes.length ?? 18
    const holesWithAllScores = Array.from({ length: totalHoles }, (_, i) => i + 1)
      .filter(n => players.every(p => holeScores.some(s => s.playerId === p.id && s.holeNumber === n)))
      .length
    const missing = totalHoles - holesWithAllScores
    const msg = missing > 0
      ? `End round? ${holesWithAllScores} of ${totalHoles} holes scored (${missing} incomplete). You can still view results in Settle Up.`
      : `End round? All ${totalHoles} holes scored. View results in Settle Up.`
    if (!window.confirm(msg)) return
    setRound(prev => prev ? { ...prev, status: 'complete' } : prev)
    await supabase.from('rounds').update({ status: 'complete' }).eq('id', roundId)
    onEndRound()
  }

  // Wolf decision handler
  const updateWolfDecision = async (holeNumber: number, partnerId: string | null) => {
    if (!round?.game || round.game.type !== 'wolf') return
    const wolfConfig = round.game.config as WolfConfig
    const current = wolfConfig.holeDecisions?.[holeNumber]
    const newPartnerId = current?.partnerId === partnerId ? undefined : partnerId
    const updatedConfig: WolfConfig = {
      ...wolfConfig,
      holeDecisions: {
        ...(wolfConfig.holeDecisions ?? {}),
        ...(newPartnerId === undefined
          ? (() => { const d = { ...(wolfConfig.holeDecisions ?? {}) }; delete d[holeNumber]; return d })()
          : { [holeNumber]: { partnerId: newPartnerId } }),
      },
    }
    const updatedGame = { ...round.game, config: updatedConfig }
    setRound(prev => prev ? { ...prev, game: updatedGame } : prev)
    await supabase.from('rounds').update({ game: updatedGame }).eq('id', roundId)
  }

  // Press handler (Skins & Nassau)
  const handlePress = async () => {
    if (!round?.game) return
    const config = round.game.config as any
    const presses = [...(config.presses ?? []), { holeNumber: currentHole, playerId: userId }]
    const updatedConfig = { ...config, presses }
    const updatedGame = { ...round.game, config: updatedConfig }
    setRound(prev => prev ? { ...prev, game: updatedGame } : prev)
    await supabase.from('rounds').update({ game: updatedGame }).eq('id', roundId)
  }

  // BBB point handler
  const setBBBPoint = async (category: 'bingo' | 'bango' | 'bongo', playerId: string) => {
    const existing = bbbPoints.find(p => p.holeNumber === currentHole)
    const currentVal = existing?.[category]
    const newVal = currentVal === playerId ? null : playerId

    if (existing) {
      const updated = { ...existing, [category]: newVal }
      setBbbPoints(prev => prev.map(p => p.id === existing.id ? updated : p))
      await supabase.from('bbb_points').update({ [category]: newVal }).eq('id', existing.id)
    } else {
      const newPoint: BBBPoint = {
        id: uuidv4(),
        roundId,
        holeNumber: currentHole,
        bingo: category === 'bingo' ? newVal : null,
        bango: category === 'bango' ? newVal : null,
        bongo: category === 'bongo' ? newVal : null,
      }
      setBbbPoints(prev => [...prev, newPoint])
      await supabase.from('bbb_points').insert(bbbPointToRow(newPoint, userId))
    }
  }

  // Junk toggle handler
  const toggleJunk = async (junkType: JunkType, playerId: string) => {
    const existing = junkRecords.find(jr => jr.holeNumber === currentHole && jr.playerId === playerId && jr.junkType === junkType)
    if (existing) {
      setJunkRecords(prev => prev.filter(jr => jr.id !== existing.id))
      await supabase.from('junk_records').delete().eq('id', existing.id)
    } else {
      const newRecord: JunkRecord = { id: uuidv4(), roundId, holeNumber: currentHole, playerId, junkType }
      setJunkRecords(prev => [...prev, newRecord])
      await supabase.from('junk_records').insert(junkRecordToRow(newRecord, userId))
    }
  }

  const skinsResult = useMemo(() => {
    if (!game || game.type !== 'skins' || !snapshot) return null
    return calculateSkins(players, holeScores, snapshot, game.config as SkinsConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const bestBallResult = useMemo(() => {
    if (!game || game.type !== 'best_ball' || !snapshot) return null
    return calculateBestBall(players, holeScores, snapshot, game.config as BestBallConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const nassauResult = useMemo(() => {
    if (!game || game.type !== 'nassau' || !snapshot) return null
    return calculateNassau(players, holeScores, snapshot, game.config as NassauConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const currentCarry = useMemo(() => {
    if (!skinsResult) return 0
    const prevHole = skinsResult.holeResults.find(h => h.holeNumber === currentHole - 1)
    if (!prevHole) return 0
    return prevHole.winnerId === null ? prevHole.carry + 1 : 0
  }, [skinsResult, currentHole])

  const headerClass = game?.stakesMode === 'high_roller' ? 'hr-header' : 'app-header'

  if (loading || !round || !snapshot) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading round…</p></div>
  }

  const junkConfig = round?.junkConfig
  const wolfConfig = game?.type === 'wolf' ? game.config as WolfConfig : null
  const wolfId = wolfConfig ? wolfForHole(wolfConfig.wolfOrder, currentHole) : null
  const wolfDecision = wolfConfig?.holeDecisions?.[currentHole]
  const currentBBB = bbbPoints.find(p => p.holeNumber === currentHole)

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className={`${headerClass} text-white px-4 py-3 sticky top-0 z-10 shadow-xl`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-green-300 font-medium flex items-center gap-1.5">
              {snapshot.courseName}
              <span className="inline-flex items-center gap-1 text-[10px] bg-green-500/30 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Live
              </span>
            </p>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Hole {currentHole}
              <span className="text-green-300 font-normal text-base">Par {par} · SI {strokeIndex}</span>
              {game?.stakesMode === 'high_roller' && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg,#d97706,#fbbf24)', color: '#000' }}>
                  💎
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={endRound} className="text-yellow-300 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-green-700">End Round</button>
            <button onClick={() => { if (window.confirm('Leave scoring? Your round is saved and you can resume from the Home screen.')) onHome() }} className="text-green-300 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-green-700">Home</button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-2 flex gap-1 overflow-x-auto pb-1">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(n => {
            const hasScore = players.length > 0 && players.every(p => holeScores.some(s => s.playerId === p.id && s.holeNumber === n))
            return (
              <button key={n} onClick={() => goToHole(n)}
                className={`w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${
                  n === currentHole ? 'bg-white text-green-800' : hasScore ? 'bg-green-500 text-white' : 'bg-green-900/40 text-green-400 border border-green-600/30'
                }`}>{n}</button>
            )
          })}
        </div>
      </header>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-red-700 text-sm font-semibold">{saveError}</p>
            <button onClick={() => setSaveError(null)} className="text-red-400 text-lg font-bold ml-2">&times;</button>
          </div>
        )}
        {/* Game status bars */}
        {skinsResult && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SkinsStatus carry={currentCarry} potCents={game!.buyInCents * players.length * (1 + ((game!.config as any).presses?.length ?? 0))} />
            </div>
            <button
              onClick={handlePress}
              className="px-3 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl active:bg-orange-600 flex-shrink-0"
            >
              Press{(game!.config as any).presses?.length ? ` (${(game!.config as any).presses.length})` : ''}
            </button>
          </div>
        )}
        {bestBallResult && <BestBallStatus holesWon={bestBallResult.holesWon} />}

        {/* Nassau status */}
        {nassauResult && (() => {
          const getName = (id: string | null) => id ? (players.find(p => p.id === id)?.name ?? '?') : null
          const pressCount = (game!.config as any).presses?.length ?? 0
          const segs = [
            { label: 'F9', seg: nassauResult.front },
            { label: 'B9', seg: nassauResult.back },
            { label: '18', seg: nassauResult.total },
          ]
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="font-bold text-teal-700 text-sm mr-1">Nassau</span>
                {segs.map(({ label, seg }) => {
                  const leaderName = seg.incomplete
                    ? '—'
                    : seg.winner
                    ? getName(seg.winner)
                    : seg.tiedPlayers.length > 1
                    ? 'Tied'
                    : '—'
                  return (
                    <div key={label} className="text-center px-2 border-l border-teal-200">
                      <p className="text-xs text-teal-500">{label}</p>
                      <p className="text-xs font-semibold text-teal-800 truncate max-w-[64px]">{leaderName}</p>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={handlePress}
                className="px-3 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl active:bg-orange-600 flex-shrink-0"
              >
                Press{pressCount ? ` (${pressCount})` : ''}
              </button>
            </div>
          )
        })()}

        {/* Wolf panel */}
        {wolfConfig && wolfId && (() => {
          const wolfPlayer = players.find(p => p.id === wolfId)
          const nonWolfs = players.filter(p => p.id !== wolfId)
          return (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2">
              <p className="font-bold text-purple-800 text-sm">🐺 Wolf: {wolfPlayer?.name}</p>
              <p className="text-xs text-purple-600">Pick a partner after tee shots, or go Lone Wolf:</p>
              <div className="flex flex-wrap gap-2">
                {nonWolfs.map(p => (
                  <button
                    key={p.id}
                    onClick={() => updateWolfDecision(currentHole, p.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      wolfDecision?.partnerId === p.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-purple-200 text-purple-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  onClick={() => updateWolfDecision(currentHole, null)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    wolfDecision !== undefined && wolfDecision.partnerId === null
                      ? 'bg-red-500 text-white'
                      : 'bg-white border border-red-200 text-red-600'
                  }`}
                >
                  Lone Wolf 🐺
                </button>
              </div>
              {wolfDecision && (
                <p className="text-xs text-purple-500">
                  {wolfDecision.partnerId === null
                    ? `${wolfPlayer?.name} going LONE WOLF`
                    : `${wolfPlayer?.name} + ${players.find(p => p.id === wolfDecision.partnerId)?.name}`}
                </p>
              )}
            </div>
          )
        })()}

        {/* BBB panel */}
        {game?.type === 'bingo_bango_bongo' && (() => {
          const BBBRow = ({
            category,
            icon,
            label,
          }: {
            category: 'bingo' | 'bango' | 'bongo'
            icon: string
            label: string
          }) => (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-700">{icon} {label}</p>
              <div className="flex flex-wrap gap-1.5">
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setBBBPoint(category, p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      currentBBB?.[category] === p.id
                        ? 'bg-amber-500 text-white'
                        : 'bg-white border border-amber-200 text-amber-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
              <p className="font-bold text-amber-800 text-sm">⭐ Bingo Bango Bongo — Hole {currentHole}</p>
              <BBBRow category="bingo" icon="🟢" label="Bingo — First on green" />
              <BBBRow category="bango" icon="📍" label="Bango — Closest to pin" />
              <BBBRow category="bongo" icon="🏆" label="Bongo — First to hole out" />
            </div>
          )
        })()}

        {/* Junk panel */}
        {junkConfig && junkConfig.types.length > 0 && (() => {
          const holeJunks = junkRecords.filter(jr => jr.holeNumber === currentHole)
          return (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-3">
              <p className="font-bold text-indigo-800 text-sm">
                🎲 Junks — Hole {currentHole}
                <span className="text-indigo-400 font-normal text-xs ml-2">{fmtMoney(junkConfig.valueCents)}/junk</span>
              </p>
              {junkConfig.types.map(jt => {
                const info = JUNK_LABELS[jt]
                const isSnake = jt === 'snake'
                return (
                  <div key={jt} className="space-y-1">
                    <p className={`text-xs font-semibold ${isSnake ? 'text-red-600' : 'text-indigo-700'}`}>
                      {info.emoji} {info.name} — {info.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {players.map(p => {
                        const active = holeJunks.some(jr => jr.playerId === p.id && jr.junkType === jt)
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleJunk(jt, p.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              active
                                ? isSnake ? 'bg-red-500 text-white' : 'bg-indigo-500 text-white'
                                : 'bg-white border border-indigo-200 text-indigo-700'
                            }`}
                          >
                            {p.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Score cards */}
        {players.map(player => {
          const grossScore = getScore(player.id)
          const courseHcp = courseHcps[player.id] ?? 0
          const strokesGiven = strokesOnHole(courseHcp, strokeIndex)
          const netScore = grossScore - strokesGiven
          let scoreBadge = ''
          if (grossScore < par - 1) scoreBadge = '🦅 Eagle'
          else if (grossScore === par - 1) scoreBadge = '🐦 Birdie'
          else if (grossScore === par) scoreBadge = '— Par'
          else if (grossScore === par + 1) scoreBadge = 'Bogey'
          else if (grossScore === par + 2) scoreBadge = 'Double'
          else if (grossScore > par + 2) scoreBadge = `+${grossScore - par}`

          // Running total through current hole
          const scoredHoles = holeScores.filter(s => s.playerId === player.id)
          const runningGross = scoredHoles.reduce((sum, s) => sum + s.grossScore, 0)
          const runningPar = scoredHoles.reduce((sum, s) => {
            const h = snapshot?.holes.find(h => h.number === s.holeNumber)
            return sum + (h?.par ?? 0)
          }, 0)
          const runningVsPar = runningGross - runningPar
          const holesPlayed = scoredHoles.length

          // Score validation warnings
          const warnings: string[] = []
          if (grossScore === 1 && par >= 4) warnings.push('Hole in one! Verify score')
          if (grossScore >= par + 5) warnings.push(`That's +${grossScore - par} over par — verify score`)

          return (
            <div key={player.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-800 text-lg">{player.name}</p>
                  <p className="text-sm text-gray-500">HCP {player.handicapIndex}
                    {strokesGiven > 0 && <span className="ml-2 text-green-700 font-semibold">+{strokesGiven} stroke{strokesGiven !== 1 ? 's' : ''}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{scoreBadge}</p>
                  {strokesGiven > 0 && <p className="text-sm font-semibold text-green-700">Net {netScore}</p>}
                  {holesPlayed > 0 && (
                    <p className={`text-xs font-semibold mt-0.5 ${runningVsPar > 0 ? 'text-red-500' : runningVsPar < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      Thru {holesPlayed}: {runningGross} ({runningVsPar > 0 ? '+' : ''}{runningVsPar})
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 font-medium">Gross score</p>
                <ScoreStepper value={grossScore} min={1} max={15} onChange={v => setScore(player.id, v)} />
              </div>
              {warnings.map((w, i) => (
                <p key={i} className="text-amber-600 text-xs font-medium mt-2 bg-amber-50 rounded-lg px-3 py-1.5">{w}</p>
              ))}
            </div>
          )
        })}

        {/* Hole result callout for Skins */}
        {skinsResult && skinsResult.holeResults.length >= currentHole && (() => {
          const hr = skinsResult.holeResults[currentHole - 1]
          if (!hr || hr.winnerId === null) return null
          const winner = players.find(p => p.id === hr.winnerId)
          return (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
              <p className="text-green-800 font-bold">🏆 {winner?.name} wins {hr.skinsInPlay} skin{hr.skinsInPlay !== 1 ? 's' : ''}</p>
            </div>
          )
        })()}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-gray-200">
        {(() => {
          const missingPlayers = players.filter(p => !holeScores.some(s => s.playerId === p.id && s.holeNumber === currentHole))
          return missingPlayers.length > 0 ? (
            <p className="text-amber-600 text-xs font-medium text-center py-1.5 bg-amber-50">
              Not all players have scores for this hole
            </p>
          ) : null
        })()}
        <div className="p-4 max-w-2xl mx-auto flex gap-3">
          <button onClick={() => goToHole(Math.max(1, currentHole - 1))} disabled={currentHole === 1}
            className="w-16 h-14 bg-gray-100 rounded-2xl font-bold text-xl text-gray-600 disabled:opacity-30 active:bg-gray-200">&larr;</button>
          {lastChange && lastChange.holeNumber === currentHole && (
            <button onClick={undoLastChange}
              className="w-16 h-14 bg-amber-100 rounded-2xl text-amber-700 font-bold text-xs active:bg-amber-200" aria-label="Undo">Undo</button>
          )}
          {currentHole < 18 ? (
            <button onClick={() => goToHole(currentHole + 1)}
              className="flex-1 h-14 bg-green-700 text-white text-lg font-bold rounded-2xl active:bg-green-800 transition-colors">Next Hole →</button>
          ) : (
            <button onClick={endRound}
              className="flex-1 h-14 bg-yellow-500 text-white text-lg font-bold rounded-2xl active:bg-yellow-600 transition-colors">🏁 End Round & Settle Up</button>
          )}
        </div>
      </div>
    </div>
  )
}
