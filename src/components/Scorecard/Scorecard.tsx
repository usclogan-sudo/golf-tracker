import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, rowToRound, rowToRoundPlayer, rowToHoleScore, rowToBBBPoint, rowToJunkRecord, holeScoreToRow, bbbPointToRow, junkRecordToRow } from '../../lib/supabase'
import { getCelebration, CelebrationToast, CelebrationFullscreen } from '../Celebrations'
import { ConfirmModal } from '../ConfirmModal'
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
  readOnly?: boolean
}

function getScoreClass(score: number, par: number): string {
  const diff = score - par
  if (score === 1) return 'score-eagle'
  if (diff <= -2) return 'score-eagle'
  if (diff === -1) return 'score-birdie'
  if (diff === 0) return 'score-par'
  if (diff === 1) return 'score-bogey'
  if (diff === 2) return 'score-double'
  return 'score-worse'
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

export function Scorecard({ userId, roundId, onEndRound, onHome, readOnly: readOnlyProp = false }: Props) {
  const [round, setRound] = useState<Round | null>(null)
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([])
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [bbbPoints, setBbbPoints] = useState<BBBPoint[]>([])
  const [junkRecords, setJunkRecords] = useState<JunkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastChange, setLastChange] = useState<{ playerId: string; holeNumber: number; previousScore: number } | null>(null)
  const [activeGroupTab, setActiveGroupTab] = useState<number | 'all'>(1)
  const [celebration, setCelebration] = useState<{ level: 'toast' | 'fullscreen'; title: string; subtitle?: string; emoji: string; playerName: string } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>(null)
  const [scoreTab, setScoreTab] = useState<'scores' | 'leaderboard'>('scores')

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

    // Trigger celebration
    const celeb = getCelebration(grossScore, par)
    if (celeb) {
      const playerName = players.find(p => p.id === playerId)?.name ?? ''
      setCelebration({ ...celeb, playerName })
    }

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

  const confirmEndRound = () => {
    const totalHoles = snapshot?.holes.length ?? 18
    const holesWithAllScores = Array.from({ length: totalHoles }, (_, i) => i + 1)
      .filter(n => players.every(p => holeScores.some(s => s.playerId === p.id && s.holeNumber === n)))
      .length
    const missing = totalHoles - holesWithAllScores
    const msg = missing > 0
      ? `${holesWithAllScores} of ${totalHoles} holes scored (${missing} incomplete). You can still view results in Settle Up.`
      : `All ${totalHoles} holes scored. View results in Settle Up.`
    setConfirmModal({
      title: 'End Round?',
      message: msg,
      onConfirm: async () => {
        setConfirmModal(null)
        setRound(prev => prev ? { ...prev, status: 'complete' } : prev)
        await supabase.from('rounds').update({ status: 'complete' }).eq('id', roundId)
        onEndRound()
      },
    })
  }

  const confirmGoHome = () => {
    if (readOnly) { onHome(); return }
    setConfirmModal({
      title: 'Leave Scoring?',
      message: 'Your round is saved and you can resume from the Home screen.',
      onConfirm: () => { setConfirmModal(null); onHome() },
    })
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

  // Role-based access: only round creator or game master can edit scores
  const isCreator = userId === round?.createdBy
  const isGameMaster = userId === round?.gameMasterId
  const readOnly = readOnlyProp || (!isCreator && !isGameMaster)

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
            <p className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
              {snapshot.courseName}
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/30 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                {readOnly ? 'Spectating' : 'Live'}
              </span>
            </p>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Hole {currentHole}
              <span className="text-gray-300 font-normal text-base">Par {par} · SI {strokeIndex}</span>
              {game?.stakesMode === 'high_roller' && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg,#d97706,#fbbf24)', color: '#000' }}>
                  💎
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && <button onClick={confirmEndRound} className="text-yellow-300 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-600">End Round</button>}
            <button onClick={confirmGoHome} className="text-gray-300 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-600">Home</button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: snapshot?.holes.length ?? 18 }, (_, i) => i + 1).map(n => {
            const hasScore = players.length > 0 && players.every(p => holeScores.some(s => s.playerId === p.id && s.holeNumber === n))
            return (
              <button key={n} onClick={() => goToHole(n)}
                className={`w-10 h-10 min-w-[2.5rem] rounded-full text-sm font-bold flex-shrink-0 transition-colors flex items-center justify-center ${
                  n === currentHole ? 'bg-white text-gray-800 ring-2 ring-amber-400' : hasScore ? 'bg-amber-500 text-white' : 'bg-gray-700/40 text-gray-400 border border-gray-500/30'
                }`}>{n}</button>
            )
          })}
        </div>
      </header>

      {/* Score / Leaderboard tab toggle */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 sticky top-[calc(5.5rem+2rem)] z-[6]">
        <div className="max-w-2xl mx-auto flex gap-1">
          <button
            onClick={() => setScoreTab('scores')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              scoreTab === 'scores' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Scores
          </button>
          <button
            onClick={() => setScoreTab('leaderboard')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              scoreTab === 'leaderboard' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {/* Group tabs */}
      {scoreTab === 'scores' && round.groups && (() => {
        const groupNums = [...new Set(Object.values(round.groups))].sort((a, b) => a - b)
        if (groupNums.length <= 1) return null
        return (
          <div className="bg-white border-b border-gray-200 px-4 py-2 sticky top-[calc(5.5rem+2rem)] z-[5]">
            <div className="max-w-2xl mx-auto flex gap-1 overflow-x-auto">
              {groupNums.map(gn => (
                <button
                  key={gn}
                  onClick={() => setActiveGroupTab(gn)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
                    activeGroupTab === gn ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Group {gn}
                </button>
              ))}
              <button
                onClick={() => setActiveGroupTab('all')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
                  activeGroupTab === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                All
              </button>
            </div>
          </div>
        )
      })()}

      {/* Leaderboard tab */}
      {scoreTab === 'leaderboard' && snapshot && (
        <div className="px-4 py-4 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
                  <th className="text-left py-2 px-1 font-medium w-8">Pos</th>
                  <th className="text-left py-2 px-1 font-medium">Player</th>
                  <th className="text-center py-2 px-1 font-medium">Thru</th>
                  <th className="text-center py-2 px-1 font-medium">Gross</th>
                  <th className="text-center py-2 px-1 font-medium">Net</th>
                  <th className="text-center py-2 px-1 font-medium">vs Par</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalPar = snapshot.holes.reduce((s, h) => s + h.par, 0)
                  const board = players.map(p => {
                    const pScores = holeScores.filter(s => s.playerId === p.id)
                    const gross = pScores.reduce((s, hs) => s + hs.grossScore, 0)
                    const courseHcp = courseHcps[p.id] ?? 0
                    const netStrokes = pScores.reduce((s, hs) => {
                      const hole = snapshot.holes.find(h => h.number === hs.holeNumber)
                      return s + (hole ? strokesOnHole(courseHcp, hole.strokeIndex, snapshot.holes.length) : 0)
                    }, 0)
                    const net = gross - netStrokes
                    const scoredPar = pScores.reduce((s, hs) => {
                      const hole = snapshot.holes.find(h => h.number === hs.holeNumber)
                      return s + (hole?.par ?? 0)
                    }, 0)
                    const vsPar = gross - scoredPar
                    return { player: p, gross, net, vsPar, thru: pScores.length }
                  }).sort((a, b) => a.net - b.net)

                  return board.map((entry, idx) => (
                    <tr key={entry.player.id} className={`border-b border-gray-50 ${idx === 0 ? 'bg-amber-50' : ''}`}>
                      <td className={`py-2.5 px-1 font-bold ${idx === 0 ? 'text-amber-600' : 'text-gray-500'}`}>{idx + 1}</td>
                      <td className="py-2.5 px-1 font-semibold text-gray-800">{entry.player.name}</td>
                      <td className="py-2.5 px-1 text-center text-gray-500">{entry.thru}</td>
                      <td className="py-2.5 px-1 text-center font-semibold text-gray-700">{entry.gross || '—'}</td>
                      <td className="py-2.5 px-1 text-center font-semibold text-gray-700">{entry.net || '—'}</td>
                      <td className={`py-2.5 px-1 text-center font-semibold ${entry.vsPar > 0 ? 'text-red-600' : entry.vsPar < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {entry.thru > 0 ? `${entry.vsPar > 0 ? '+' : ''}${entry.vsPar}` : '—'}
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>

            {/* Game-specific running totals */}
            {skinsResult && skinsResult.totalSkins > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Skins</p>
                <div className="flex flex-wrap gap-2">
                  {players.filter(p => (skinsResult.skinsWon[p.id] ?? 0) > 0).map(p => (
                    <span key={p.id} className="text-xs bg-amber-50 text-amber-700 font-semibold px-2 py-1 rounded-lg">
                      {p.name}: {skinsResult.skinsWon[p.id]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {bestBallResult && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Best Ball</p>
                <p className="text-sm font-semibold text-gray-700">
                  Team A: {bestBallResult.holesWon.A}W · Team B: {bestBallResult.holesWon.B}W · Tied: {bestBallResult.holesWon.tied}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {scoreTab === 'scores' && (
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
            {!readOnly && (
              <button
                onClick={handlePress}
                className="px-3 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl active:bg-orange-600 flex-shrink-0"
              >
                Press{(game!.config as any).presses?.length ? ` (${(game!.config as any).presses.length})` : ''}
              </button>
            )}
          </div>
        )}
        {bestBallResult && <BestBallStatus holesWon={bestBallResult.holesWon} />}

        {/* Nassau status */}
        {nassauResult && (() => {
          const getName = (id: string | null) => id ? (players.find(p => p.id === id)?.name ?? '?') : null
          const pressCount = (game!.config as any).presses?.length ?? 0
          const totalHoles = snapshot?.holes.length ?? 18
          const half = Math.ceil(totalHoles / 2)
          const segs = [
            { label: `F${half}`, seg: nassauResult.front },
            { label: `B${totalHoles - half}`, seg: nassauResult.back },
            { label: `${totalHoles}`, seg: nassauResult.total },
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
              {!readOnly && (
                <button
                  onClick={handlePress}
                  className="px-3 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl active:bg-orange-600 flex-shrink-0"
                >
                  Press{pressCount ? ` (${pressCount})` : ''}
                </button>
              )}
            </div>
          )
        })()}

        {/* Wolf panel */}
        {!readOnly && wolfConfig && wolfId && (() => {
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
        {!readOnly && game?.type === 'bingo_bango_bongo' && (() => {
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
        {!readOnly && junkConfig && junkConfig.types.length > 0 && (() => {
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

          // Determine if this player's card should be editable or compact read-only
          const playerGroup = round.groups?.[player.id]
          const hasGroups = round.groups && Object.keys(round.groups).length > 0
          const groupNums = hasGroups ? [...new Set(Object.values(round.groups!))].sort((a, b) => a - b) : []
          const isInActiveGroup = !hasGroups || groupNums.length <= 1 || activeGroupTab === 'all' || activeGroupTab === playerGroup
          const isEditable = !readOnly && isInActiveGroup && activeGroupTab !== 'all'

          // Filter out players not in the active group tab (unless showing 'all')
          if (hasGroups && groupNums.length > 1 && activeGroupTab !== 'all' && playerGroup !== activeGroupTab) {
            return null
          }

          // Compact read-only row for "all" tab or readOnly mode with groups
          if (!isEditable) {
            return (
              <div key={player.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800 text-sm">{player.name}</p>
                  {hasGroups && groupNums.length > 1 && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">G{playerGroup}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className={`text-sm font-bold px-1.5 py-0.5 rounded ${getScoreClass(grossScore, par)}`}>{grossScore}</span>
                  {strokesGiven > 0 && <span className="text-xs text-amber-600 font-semibold">Net {netScore}</span>}
                  {holesPlayed > 0 && (
                    <span className={`text-xs font-semibold ${runningVsPar > 0 ? 'text-red-500' : runningVsPar < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {runningGross} ({runningVsPar > 0 ? '+' : ''}{runningVsPar})
                    </span>
                  )}
                </div>
              </div>
            )
          }

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
                    {strokesGiven > 0 && <span className="ml-2 text-amber-600 font-semibold">+{strokesGiven} stroke{strokesGiven !== 1 ? 's' : ''}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${getScoreClass(grossScore, par)}`}>{scoreBadge}</span>
                  {strokesGiven > 0 && <p className="text-sm font-semibold text-amber-600 mt-0.5">Net {netScore}</p>}
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
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
              <p className="text-gray-800 font-bold">🏆 {winner?.name} wins {hr.skinsInPlay} skin{hr.skinsInPlay !== 1 ? 's' : ''}</p>
            </div>
          )
        })()}

        {/* Next Hole / End Round — in scrollable content */}
        {!readOnly && (() => {
          const missingPlayers = players.filter(p => !holeScores.some(s => s.playerId === p.id && s.holeNumber === currentHole))
          return missingPlayers.length > 0 ? (
            <p className="text-amber-600 text-xs font-medium text-center py-1.5 bg-amber-50 rounded-xl">
              Not all players have scores for this hole
            </p>
          ) : null
        })()}

        {currentHole < (snapshot?.holes.length ?? 18) ? (
          <button onClick={() => goToHole(currentHole + 1)}
            className="w-full h-14 bg-gray-800 text-white text-lg font-bold rounded-2xl active:bg-gray-900 transition-colors shadow-lg">Next Hole →</button>
        ) : readOnly ? (
          <button onClick={onHome}
            className="w-full h-14 bg-gray-600 text-white text-lg font-bold rounded-2xl active:bg-gray-700 transition-colors shadow-lg">Back to Home</button>
        ) : (
          <button onClick={confirmEndRound}
            className="w-full h-14 bg-yellow-500 text-white text-lg font-bold rounded-2xl active:bg-yellow-600 transition-colors shadow-lg">🏁 End Round & Settle Up</button>
        )}
      </div>
      )} {/* end scoreTab === 'scores' */}

      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 safe-bottom">
        <div className="p-4 max-w-2xl mx-auto flex gap-3">
          <button onClick={() => goToHole(Math.max(1, currentHole - 1))} disabled={currentHole === 1}
            className="flex-1 h-14 bg-gray-100 rounded-2xl font-bold text-xl text-gray-600 disabled:opacity-30 active:bg-gray-200">&larr; Prev</button>
          {!readOnly && lastChange && lastChange.holeNumber === currentHole && (
            <button onClick={undoLastChange}
              className="flex-1 h-14 bg-amber-100 rounded-2xl text-amber-700 font-bold text-sm active:bg-amber-200" aria-label="Undo">Undo</button>
          )}
        </div>
      </div>

      {/* Celebrations */}
      {celebration && celebration.level === 'toast' && (
        <CelebrationToast config={celebration} playerName={celebration.playerName} onDone={() => setCelebration(null)} />
      )}
      {celebration && celebration.level === 'fullscreen' && (
        <CelebrationFullscreen config={celebration} playerName={celebration.playerName} onDismiss={() => setCelebration(null)} />
      )}

      {/* Confirm modal */}
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title ?? ''}
        message={confirmModal?.message ?? ''}
        onConfirm={confirmModal?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmModal(null)}
        destructive={confirmModal?.destructive}
      />
    </div>
  )
}
