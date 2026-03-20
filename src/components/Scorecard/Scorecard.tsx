import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { enqueue, flush, getPending } from '../../lib/offlineQueue'
import { supabase, rowToRound, rowToRoundPlayer, rowToHoleScore, rowToBBBPoint, rowToJunkRecord, rowToSideBet, rowToRoundParticipant, rowToEvent, rowToEventParticipant, holeScoreToRow, bbbPointToRow, junkRecordToRow, sideBetToRow, generateInviteCode } from '../../lib/supabase'
import { getCelebration, CelebrationToast, CelebrationFullscreen } from '../Celebrations'
import { ConfirmModal } from '../ConfirmModal'
import { GameRulesModal } from '../GameRulesModal'
import {
  buildCourseHandicaps,
  calculateSkins,
  calculateBestBall,
  calculateNassau,
  calculateWolf,
  calculateBBB,
  calculateHammer,
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
  SideBet,
  RoundParticipant,
  SkinsConfig,
  BestBallConfig,
  NassauConfig,
  WolfConfig,
  HammerConfig,
  HammerHoleState,
  GolfEvent,
  EventParticipant,
  ScoreStatus,
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
  const valueCents = potCents * (carry + 1)
  if (carry === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
        <span className="text-gray-500 font-bold text-sm">Skins Pot</span>
        <span className="text-gray-600 text-sm">{fmtMoney(valueCents)} per hole</span>
      </div>
    )
  }
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
  const [sideBets, setSideBets] = useState<SideBet[]>([])
  const [roundParticipants, setRoundParticipants] = useState<RoundParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteToast, setInviteToast] = useState<string | null>(null)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastFailedSave, setLastFailedSave] = useState<{ playerId: string; grossScore: number } | null>(null)
  const MAX_UNDO = 5
  const [undoStack, setUndoStack] = useState<{ playerId: string; holeNumber: number; previousScore: number; playerName: string; newScore: number }[]>([])
  const [activeGroupTab, setActiveGroupTab] = useState<number | 'all'>(1)
  const [celebration, setCelebration] = useState<{ level: 'toast' | 'fullscreen'; title: string; subtitle?: string; emoji: string; playerName: string } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; destructive?: boolean } | null>(null)
  const [scoreTab, setScoreTab] = useState<'scores' | 'leaderboard'>('scores')
  const [showSideBetForm, setShowSideBetForm] = useState(false)
  const [sideBetDesc, setSideBetDesc] = useState('')
  const [sideBetAmount, setSideBetAmount] = useState('5')
  const [sideBetParticipants, setSideBetParticipants] = useState<string[]>([])
  const [editingHcpPlayerId, setEditingHcpPlayerId] = useState<string | null>(null)
  const [editingHcpValue, setEditingHcpValue] = useState('')
  const [showHoleConfirm, setShowHoleConfirm] = useState(false)
  const [confirmParFill, setConfirmParFill] = useState(false)
  const [showMiniBoard, setShowMiniBoard] = useState(false)
  const [showGameStatus, setShowGameStatus] = useState(false)
  const { isOnline } = useOnlineStatus()
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(getPending())
  const holeNavRef = useRef<HTMLDivElement>(null)

  // Event-related state
  const [event, setEvent] = useState<GolfEvent | null>(null)
  const [eventParticipants, setEventParticipants] = useState<EventParticipant[]>([])
  const [localHole, setLocalHole] = useState<number | null>(null)
  const [showApprovalPanel, setShowApprovalPanel] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('rounds').select('*').eq('id', roundId).single(),
      supabase.from('round_players').select('*').eq('round_id', roundId),
      supabase.from('hole_scores').select('*').eq('round_id', roundId),
      supabase.from('bbb_points').select('*').eq('round_id', roundId),
      supabase.from('junk_records').select('*').eq('round_id', roundId),
      supabase.from('side_bets').select('*').eq('round_id', roundId),
      supabase.from('round_participants').select('*').eq('round_id', roundId),
    ]).then(([roundRes, rpRes, hsRes, bbbRes, junkRes, sbRes, partRes]) => {
      if (roundRes.data) setRound(rowToRound(roundRes.data))
      if (rpRes.data) setRoundPlayers(rpRes.data.map(rowToRoundPlayer))
      if (hsRes.data) setHoleScores(hsRes.data.map(rowToHoleScore))
      if (bbbRes.data) setBbbPoints(bbbRes.data.map(rowToBBBPoint))
      if (junkRes.data) setJunkRecords(junkRes.data.map(rowToJunkRecord))
      if (sbRes.data) setSideBets(sbRes.data.map(rowToSideBet))
      if (partRes.data) setRoundParticipants(partRes.data.map(rowToRoundParticipant))
      setLoading(false)
    })
  }, [roundId])

  // ─── Fetch event data when round is part of an event ──────────────────────
  useEffect(() => {
    if (!round?.eventId) return
    Promise.all([
      supabase.from('events').select('*').eq('id', round.eventId).single(),
      supabase.from('event_participants').select('*').eq('event_id', round.eventId),
    ]).then(([eventRes, epRes]) => {
      if (eventRes.data) setEvent(rowToEvent(eventRes.data))
      if (epRes.data) setEventParticipants(epRes.data.map(rowToEventParticipant))
    })
  }, [round?.eventId])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'side_bets', filter: `round_id=eq.${roundId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as any
          setSideBets(prev => prev.some(sb => sb.id === row.id) ? prev : [...prev, rowToSideBet(row)])
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as any
          setSideBets(prev => prev.map(sb => sb.id === row.id ? rowToSideBet(row) : sb))
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as any
          setSideBets(prev => prev.filter(sb => sb.id !== row.id))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `id=eq.${roundId}` }, (payload) => {
        const row = payload.new as any
        setRound(rowToRound(row))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_participants', filter: `round_id=eq.${roundId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as any
          setRoundParticipants(prev => prev.some(p => p.id === row.id) ? prev : [...prev, rowToRoundParticipant(row)])
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as any
          setRoundParticipants(prev => prev.map(p => p.id === row.id ? rowToRoundParticipant(row) : p))
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as any
          setRoundParticipants(prev => prev.filter(p => p.id !== row.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roundId])

  // Flush offline queue when coming back online
  useEffect(() => {
    if (isOnline && getPending() > 0) {
      setSyncing(true)
      flush().then(({ synced }) => {
        setPendingCount(getPending())
        setSyncing(false)
        if (synced > 0) {
          // Refetch scores after sync
          supabase.from('hole_scores').select('*').eq('round_id', roundId).then(({ data }) => {
            if (data) setHoleScores(data.map(rowToHoleScore))
          })
        }
      })
    }
  }, [isOnline, roundId])

  const players = round?.players ?? []
  const snapshot = round?.courseSnapshot
  const game = round?.game
  const isEventRound = !!round?.eventId
  // For event rounds, use local hole navigation; for regular rounds, use DB-synced hole
  const currentHole = (isEventRound && localHole !== null) ? localHole : (round?.currentHole ?? 1)

  // Initialize localHole from round's currentHole on first load
  useEffect(() => {
    if (isEventRound && localHole === null && round) {
      setLocalHole(round.currentHole)
    }
  }, [isEventRound, round?.currentHole])

  // Auto-scroll hole nav bar to current hole
  useEffect(() => {
    if (!holeNavRef.current) return
    const btn = holeNavRef.current.querySelector(`[data-hole="${currentHole}"]`) as HTMLElement | null
    if (btn) btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [currentHole])

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
    const playerName = players.find(p => p.id === playerId)?.name ?? ''
    setUndoStack(prev => [{ playerId, holeNumber: currentHole, previousScore, playerName, newScore: grossScore }, ...prev].slice(0, MAX_UNDO))

    // Trigger celebration
    const celeb = getCelebration(grossScore, par)
    if (celeb) {
      const playerName = players.find(p => p.id === playerId)?.name ?? ''
      setCelebration({ ...celeb, playerName })
    }

    try {
      // Event self-scoring: use event RPC which auto-sets pending/approved status
      if (isEventRound && myEventParticipant) {
        const scoreStatus: ScoreStatus = canApproveScores ? 'approved' : 'pending'
        if (existing) {
          setHoleScores(prev => prev.map(s => s.id === existing.id ? { ...s, grossScore, scoreStatus } : s))
        } else {
          const tempId = uuidv4()
          setHoleScores(prev => [...prev, { id: tempId, roundId, playerId, holeNumber: currentHole, grossScore, scoreStatus, submittedBy: userId }])
        }
        const { data, error } = await supabase.rpc('submit_event_score', {
          p_round_id: roundId,
          p_player_id: playerId,
          p_hole_number: currentHole,
          p_gross_score: grossScore,
        })
        if (error) throw error
        // Update with actual status from server
        if (data) {
          const actualStatus = (data as any).status as ScoreStatus
          const actualId = (data as any).id as string
          setHoleScores(prev => prev.map(s =>
            (s.playerId === playerId && s.holeNumber === currentHole)
              ? { ...s, id: actualId, scoreStatus: actualStatus }
              : s
          ))
        }
      // Participant self-entry: use RPC so scores are stored with creator's user_id
      } else if (selfEntryOnly && myParticipant && playerId === myParticipant.playerId) {
        if (existing) {
          setHoleScores(prev => prev.map(s => s.id === existing.id ? { ...s, grossScore } : s))
        } else {
          const tempId = uuidv4()
          setHoleScores(prev => [...prev, { id: tempId, roundId, playerId, holeNumber: currentHole, grossScore }])
        }
        const { error } = await supabase.rpc('submit_participant_score', {
          p_round_id: roundId,
          p_player_id: playerId,
          p_hole_number: currentHole,
          p_gross_score: grossScore,
        })
        if (error) throw error
      } else if (existing) {
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
      if (!isOnline) {
        // Queue for offline sync — local state is already updated optimistically
        const existing = holeScores.find(s => s.playerId === playerId && s.holeNumber === currentHole)
        if (existing) {
          enqueue({
            table: 'hole_scores',
            method: 'update',
            data: { gross_score: grossScore },
            matchColumn: 'id',
            matchValue: existing.id,
          })
        } else {
          enqueue({
            table: 'hole_scores',
            method: 'insert',
            data: holeScoreToRow({ id: uuidv4(), roundId, playerId, holeNumber: currentHole, grossScore }, userId),
          })
        }
        setPendingCount(getPending())
        // No error shown — offline indicator is displayed instead
      } else {
        setSaveError('Score failed to save — check your connection')
        setLastFailedSave({ playerId, grossScore })
      }
    }
  }

  const undoLastChange = async () => {
    if (undoStack.length === 0) return
    const [top, ...rest] = undoStack
    setUndoStack(rest)
    const existing = holeScores.find(s => s.playerId === top.playerId && s.holeNumber === top.holeNumber)
    if (existing) {
      setHoleScores(prev => prev.map(s => s.id === existing.id ? { ...s, grossScore: top.previousScore } : s))
      try {
        await supabase.from('hole_scores').update({ gross_score: top.previousScore }).eq('id', existing.id)
      } catch {
        if (!isOnline) {
          enqueue({
            table: 'hole_scores',
            method: 'update',
            data: { gross_score: top.previousScore },
            matchColumn: 'id',
            matchValue: existing.id,
          })
          setPendingCount(getPending())
        }
      }
    }
  }

  const goToHole = async (holeNum: number) => {
    setSaveError(null)
    setConfirmParFill(false)
    if (isEventRound) {
      // Event rounds: navigate locally, only event manager updates DB
      setLocalHole(holeNum)
      if (isEventManager) {
        setRound(prev => prev ? { ...prev, currentHole: holeNum } : prev)
        const { error } = await supabase.from('rounds').update({ current_hole: holeNum }).eq('id', roundId)
        if (error) setSaveError('Failed to save hole change — check your connection')
      }
    } else {
      setRound(prev => prev ? { ...prev, currentHole: holeNum } : prev)
      const { error } = await supabase.from('rounds').update({ current_hole: holeNum }).eq('id', roundId)
      if (error) setSaveError('Failed to save hole change — check your connection')
    }
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

  // Side bet handlers
  const createSideBet = async () => {
    if (!sideBetDesc.trim() || sideBetParticipants.length < 2) return
    const amountCents = Math.round(parseFloat(sideBetAmount) * 100) || 500
    const newBet: SideBet = {
      id: uuidv4(),
      roundId,
      holeNumber: currentHole,
      description: sideBetDesc.trim(),
      amountCents,
      participants: sideBetParticipants,
      status: 'open',
      createdAt: new Date(),
    }
    setSideBets(prev => [...prev, newBet])
    await supabase.from('side_bets').insert(sideBetToRow(newBet, userId))
    setSideBetDesc('')
    setSideBetAmount('5')
    setSideBetParticipants([])
    setShowSideBetForm(false)
  }

  const resolveSideBet = async (betId: string, winnerId: string) => {
    setSideBets(prev => prev.map(sb => sb.id === betId ? { ...sb, winnerPlayerId: winnerId, status: 'resolved' as const } : sb))
    await supabase.from('side_bets').update({ winner_player_id: winnerId, status: 'resolved' }).eq('id', betId)
  }

  const cancelSideBet = async (betId: string) => {
    setSideBets(prev => prev.map(sb => sb.id === betId ? { ...sb, status: 'cancelled' as const } : sb))
    await supabase.from('side_bets').update({ status: 'cancelled' }).eq('id', betId)
  }

  const saveHandicapEdit = async () => {
    if (!editingHcpPlayerId || !round) return
    const newHcp = parseFloat(editingHcpValue)
    if (isNaN(newHcp) || newHcp < 0 || newHcp > 54) return
    // Update the player snapshot in the round
    const updatedPlayers = (round.players ?? []).map(p =>
      p.id === editingHcpPlayerId ? { ...p, handicapIndex: newHcp } : p
    )
    setRound(prev => prev ? { ...prev, players: updatedPlayers } : prev)
    setEditingHcpPlayerId(null)
    setEditingHcpValue('')
    // Persist: update round's player snapshot
    await supabase.from('rounds').update({ players: updatedPlayers }).eq('id', roundId)
    // Also update the player in the players table
    await supabase.from('players').update({ handicap_index: newHcp }).eq('id', editingHcpPlayerId)
  }

  // Role-based access (must be before approvedScores which depends on isEventRound)
  const isCreator = userId === round?.createdBy
  const isGameMaster = userId === round?.gameMasterId
  const isScoremasterRole = isCreator || isGameMaster
  const myParticipant = roundParticipants.find(p => p.userId === userId)
  const selfEntryOnly = !!myParticipant && !isScoremasterRole

  // Event role detection
  const myEventParticipant = eventParticipants.find(ep => ep.userId === userId)
  const isEventManager = myEventParticipant?.role === 'manager' || isCreator
  const isGroupScorekeeper = myEventParticipant?.role === 'scorekeeper'
  const canApproveScores = isEventRound && (isEventManager || isGroupScorekeeper || isScoremasterRole)
  const myEventGroupNumber = myEventParticipant?.groupNumber

  // For event rounds, participants can self-score (not read-only)
  const readOnly = readOnlyProp || (!isScoremasterRole && !myParticipant && !myEventParticipant)

  // Filter scores for game logic: only use approved scores
  const approvedScores = useMemo(() => {
    if (!isEventRound) return holeScores
    return holeScores.filter(s => s.scoreStatus !== 'rejected' && s.scoreStatus !== 'pending')
  }, [holeScores, isEventRound])

  // Pending scores for approval panel
  const pendingScores = useMemo(() => {
    if (!isEventRound) return []
    return holeScores.filter(s => s.scoreStatus === 'pending')
  }, [holeScores, isEventRound])

  // Game result calculations (all depend on approvedScores, must come after it)
  const skinsResult = useMemo(() => {
    if (!game || game.type !== 'skins' || !snapshot) return null
    return calculateSkins(players, approvedScores, snapshot, game.config as SkinsConfig, courseHcps)
  }, [game, players, approvedScores, snapshot, courseHcps])

  const bestBallResult = useMemo(() => {
    if (!game || game.type !== 'best_ball' || !snapshot) return null
    return calculateBestBall(players, approvedScores, snapshot, game.config as BestBallConfig, courseHcps)
  }, [game, players, approvedScores, snapshot, courseHcps])

  const nassauResult = useMemo(() => {
    if (!game || game.type !== 'nassau' || !snapshot) return null
    return calculateNassau(players, approvedScores, snapshot, game.config as NassauConfig, courseHcps)
  }, [game, players, approvedScores, snapshot, courseHcps])

  const wolfResult = useMemo(() => {
    if (!game || game.type !== 'wolf' || !snapshot) return null
    return calculateWolf(players, approvedScores, snapshot, game.config as WolfConfig, courseHcps)
  }, [game, players, approvedScores, snapshot, courseHcps])

  const bbbResult = useMemo(() => {
    if (!game || game.type !== 'bingo_bango_bongo') return null
    return calculateBBB(players, bbbPoints)
  }, [game, players, bbbPoints])

  // Hammer game state
  const hammerConfig = game?.type === 'hammer' ? game.config as HammerConfig : null
  const hammerStates = hammerConfig?.hammerStates ?? {}

  const hammerResult = useMemo(() => {
    if (!game || game.type !== 'hammer' || !snapshot || players.length !== 2) return null
    return calculateHammer(players, approvedScores, snapshot, game.config as HammerConfig, courseHcps)
  }, [game, players, approvedScores, snapshot, courseHcps])

  const currentHammerState = hammerStates[currentHole] ?? null

  const currentCarry = useMemo(() => {
    if (!skinsResult) return 0
    const prevHole = skinsResult.holeResults.find(h => h.holeNumber === currentHole - 1)
    if (!prevHole) return 0
    return prevHole.winnerId === null ? prevHole.carry + 1 : 0
  }, [skinsResult, currentHole])

  const miniBoard = useMemo(() => {
    if (!snapshot) return []
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
    const positions: number[] = []
    board.forEach((entry, idx) => {
      if (idx === 0) positions.push(1)
      else positions.push(entry.net === board[idx - 1].net ? positions[idx - 1] : idx + 1)
    })
    return board.map((entry, idx) => ({ ...entry, pos: positions[idx] }))
  }, [players, holeScores, snapshot, courseHcps])

  const headerClass = game?.stakesMode === 'high_roller' ? 'hr-header' : 'app-header'

  if (loading || !round || !snapshot) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400">Loading round…</p></div>
  }

  const junkConfig = round?.junkConfig
  const wolfConfig = game?.type === 'wolf' ? game.config as WolfConfig : null
  const wolfId = wolfConfig ? wolfForHole(wolfConfig.wolfOrder, currentHole) : null
  const wolfDecision = wolfConfig?.holeDecisions?.[currentHole]
  const currentBBB = bbbPoints.find(p => p.holeNumber === currentHole)

  // Hammer interaction functions
  const updateHammerState = async (holeNum: number, state: HammerHoleState) => {
    if (!round || !game || game.type !== 'hammer') return
    const updatedStates = { ...(game.config as HammerConfig).hammerStates, [holeNum]: state }
    const updatedConfig = { ...game.config, hammerStates: updatedStates }
    const updatedGame = { ...game, config: updatedConfig }
    setRound({ ...round, game: updatedGame })
    // Persist to DB
    await supabase.from('rounds').update({
      game: JSON.stringify(updatedGame),
    }).eq('id', roundId)
  }

  const throwHammer = () => {
    if (!hammerConfig || players.length !== 2) return
    const current = currentHammerState
    if (current && current.declined) return // Already resolved
    const maxPresses = hammerConfig.maxPresses
    const baseValue = hammerConfig.baseValueCents
    if (!current) {
      // First throw on this hole — player 0 starts with hammer
      const newState: HammerHoleState = {
        hammerHolder: players[0].id,
        value: baseValue * 2,
        presses: 1,
        declined: false,
      }
      updateHammerState(currentHole, newState)
    } else {
      if (maxPresses != null && current.presses >= maxPresses) return
      const newState: HammerHoleState = {
        ...current,
        hammerHolder: players.find(p => p.id !== current.hammerHolder)!.id,
        value: current.value * 2,
        presses: current.presses + 1,
        declined: false,
      }
      updateHammerState(currentHole, newState)
    }
  }

  const declineHammer = () => {
    if (!currentHammerState || currentHammerState.declined) return
    const decliner = players.find(p => p.id !== currentHammerState.hammerHolder)!.id
    const newState: HammerHoleState = {
      ...currentHammerState,
      declined: true,
      declinedBy: decliner,
    }
    updateHammerState(currentHole, newState)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-32">
      <header className={`${headerClass} text-white px-4 py-3 sticky top-0 z-10 shadow-xl`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
              {event ? `${event.name} · ` : ''}{snapshot.courseName}
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/30 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                {readOnly ? 'Spectating' : isEventRound ? (canApproveScores ? 'Scorekeeper' : 'Self-Entry') : selfEntryOnly ? 'Self-Entry' : 'Live'}
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
            {isScoremasterRole && (
              <button
                onClick={async () => {
                  // Use event invite code when in event context, else round code
                  let code = (event?.inviteCode) ?? round.inviteCode
                  if (!code) {
                    code = generateInviteCode()
                    setRound(prev => prev ? { ...prev, inviteCode: code! } : prev)
                    await supabase.from('rounds').update({ invite_code: code }).eq('id', roundId)
                  }
                  const title = event ? `Join ${event.name}!` : 'Join my round!'
                  const text = event
                    ? `Join ${event.name} on Fore Skins! Code: ${code}`
                    : `Join my round on Fore Skins! Code: ${code}`
                  const url = `${window.location.origin}${window.location.pathname}?join=${code}`
                  if (navigator.share) {
                    try { await navigator.share({ title, text, url }) } catch {}
                  } else {
                    await navigator.clipboard.writeText(url)
                  }
                  setInviteToast(`Link copied! Code: ${code}`)
                  setTimeout(() => setInviteToast(null), 3000)
                }}
                className="text-cyan-300 text-sm font-medium px-3 min-h-[44px] rounded-lg hover:bg-gray-600"
              >
                Invite
              </button>
            )}
            {!readOnly && (
              <button
                onClick={async () => {
                  let code = (event?.inviteCode) ?? round.inviteCode
                  if (!code) {
                    code = generateInviteCode()
                    setRound(prev => prev ? { ...prev, inviteCode: code! } : prev)
                    await supabase.from('rounds').update({ invite_code: code }).eq('id', roundId)
                  }
                  const url = `${window.location.origin}${window.location.pathname}?spectate=${code}`
                  const title = 'Watch live leaderboard!'
                  const text = `Follow the round live on Fore Skins!`
                  if (navigator.share) {
                    try { await navigator.share({ title, text, url }) } catch {}
                  } else {
                    await navigator.clipboard.writeText(url)
                  }
                  setInviteToast('Spectator link copied!')
                  setTimeout(() => setInviteToast(null), 3000)
                }}
                className="text-green-300 text-sm font-medium px-2 min-h-[44px] rounded-lg hover:bg-gray-600"
              >
                📡 Live
              </button>
            )}
            {game && <button onClick={() => setShowRulesModal(true)} className="text-cyan-300 text-sm font-medium px-2 min-h-[44px] rounded-lg hover:bg-gray-600">Rules</button>}
            {!readOnly && !selfEntryOnly && <button onClick={confirmEndRound} className="text-yellow-300 text-sm font-medium px-3 min-h-[44px] rounded-lg hover:bg-gray-600">End Round</button>}
            <button onClick={confirmGoHome} className="text-gray-300 text-sm font-medium px-3 min-h-[44px] rounded-lg hover:bg-gray-600">← Back</button>
          </div>
        </div>
        <div ref={holeNavRef} className="max-w-2xl mx-auto mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: snapshot?.holes.length ?? 18 }, (_, i) => i + 1).map(n => {
            const hasScore = players.length > 0 && players.every(p => holeScores.some(s => s.playerId === p.id && s.holeNumber === n))
            return (
              <button key={n} data-hole={n} onClick={() => goToHole(n)}
                className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-full text-sm font-bold flex-shrink-0 transition-colors flex items-center justify-center ${
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

      {/* Mini-leaderboard on Scores tab */}
      {scoreTab === 'scores' && miniBoard.length > 0 && (
        <div className="px-4 pt-3 max-w-2xl mx-auto">
          <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowMiniBoard(!showMiniBoard)}
              className="w-full px-3 py-2 flex items-center justify-between"
            >
              {showMiniBoard ? (
                <span className="text-xs font-semibold text-gray-500 uppercase">Standings</span>
              ) : (
                <div className="flex-1 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold text-gray-600">
                  {miniBoard.map((e, i) => (
                    <span key={e.player.id}>
                      {i > 0 && <span className="text-gray-300 mx-0.5">·</span>}
                      {e.pos}. {e.player.name}{' '}
                      <span className={e.vsPar > 0 ? 'text-red-500' : e.vsPar < 0 ? 'text-green-600' : 'text-gray-400'}>
                        ({e.thru > 0 ? `${e.vsPar > 0 ? '+' : ''}${e.vsPar === 0 ? 'E' : e.vsPar}` : '—'})
                      </span>
                    </span>
                  ))}
                </div>
              )}
              <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{showMiniBoard ? '▾' : '▸'}</span>
            </button>
            {showMiniBoard && (
              <div className="px-3 pb-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase">
                      <th className="text-left py-1 px-1 font-medium w-6">Pos</th>
                      <th className="text-left py-1 px-1 font-medium">Player</th>
                      <th className="text-center py-1 px-1 font-medium">Net</th>
                      <th className="text-center py-1 px-1 font-medium">vs Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {miniBoard.map(e => (
                      <tr key={e.player.id} className={e.pos === 1 ? 'bg-amber-50' : ''}>
                        <td className={`py-1 px-1 font-bold text-sm ${e.pos === 1 ? 'text-amber-600' : 'text-gray-500'}`}>{e.pos}</td>
                        <td className="py-1 px-1 font-semibold text-gray-800 text-sm">{e.player.name}</td>
                        <td className="py-1 px-1 text-center font-semibold text-gray-700 text-sm">{e.net || '—'}</td>
                        <td className={`py-1 px-1 text-center font-semibold text-sm ${e.vsPar > 0 ? 'text-red-600' : e.vsPar < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {e.thru > 0 ? `${e.vsPar > 0 ? '+' : ''}${e.vsPar === 0 ? 'E' : e.vsPar}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Game summaries */}
                <div className="mt-1.5 space-y-0.5">
                  {skinsResult && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold">Skins:</span>{' '}
                      {skinsResult.totalSkins === 0 ? 'No skins won yet' : (
                        <>
                          {players.filter(p => (skinsResult.skinsWon[p.id] ?? 0) > 0).map(p => `${p.name} ${skinsResult.skinsWon[p.id]}`).join(', ')}
                          {skinsResult.pendingCarry > 0 && ` · ${skinsResult.pendingCarry} carry`}
                        </>
                      )}
                    </p>
                  )}
                  {nassauResult && (() => {
                    const getName = (id: string | null) => id ? (players.find(p => p.id === id)?.name ?? '?') : null
                    const segs = [
                      { label: 'F', seg: nassauResult.front },
                      { label: 'B', seg: nassauResult.back },
                      { label: 'T', seg: nassauResult.total },
                    ]
                    return (
                      <p className="text-xs text-gray-500">
                        <span className="font-semibold">Nassau:</span>{' '}
                        {segs.map(({ label, seg }) => {
                          const leader = seg.incomplete ? 'In play' : seg.winner ? getName(seg.winner) : seg.tiedPlayers.length > 1 ? 'Tied' : '—'
                          return `${label}: ${leader}`
                        }).join(' · ')}
                      </p>
                    )
                  })()}
                  {bestBallResult && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold">Best Ball:</span> Team A {bestBallResult.holesWon.A} – Team B {bestBallResult.holesWon.B}
                    </p>
                  )}
                  {wolfResult && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold">Wolf:</span>{' '}
                      {players.slice().sort((a, b) => (wolfResult.netUnits[b.id] ?? 0) - (wolfResult.netUnits[a.id] ?? 0))
                        .map(p => { const u = wolfResult.netUnits[p.id] ?? 0; return `${p.name} ${u > 0 ? '+' : ''}${u}` }).join(', ')}
                    </p>
                  )}
                  {hammerResult && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold">Hammer:</span>{' '}
                      {players.map(p => { const c = hammerResult.netCents[p.id] ?? 0; return `${p.name} ${c >= 0 ? '+' : '−'}${fmtMoney(Math.abs(c))}` }).join(', ')}
                    </p>
                  )}
                  {bbbResult && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold">BBB:</span>{' '}
                      {players.slice().sort((a, b) => (bbbResult.pointsWon[b.id] ?? 0) - (bbbResult.pointsWon[a.id] ?? 0))
                        .map(p => `${p.name} ${bbbResult.pointsWon[p.id] ?? 0}`).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
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

                  const positions: number[] = []
                  board.forEach((entry, idx) => {
                    if (idx === 0) positions.push(1)
                    else positions.push(entry.net === board[idx - 1].net ? positions[idx - 1] : idx + 1)
                  })

                  return board.map((entry, idx) => (
                    <tr key={entry.player.id} className={`border-b border-gray-50 ${positions[idx] === 1 ? 'bg-amber-50' : ''}`}>
                      <td className={`py-2.5 px-1 font-bold ${positions[idx] === 1 ? 'text-amber-600' : 'text-gray-500'}`}>{positions[idx]}</td>
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
            {skinsResult && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Skins — {skinsResult.totalSkins} won{skinsResult.pendingCarry > 0 ? ` · ${skinsResult.pendingCarry} carry` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {players.filter(p => (skinsResult.skinsWon[p.id] ?? 0) > 0).map(p => (
                    <span key={p.id} className="text-xs bg-amber-50 text-amber-700 font-semibold px-2 py-1 rounded-lg">
                      {p.name}: {skinsResult.skinsWon[p.id]}
                    </span>
                  ))}
                  {skinsResult.totalSkins === 0 && (
                    <span className="text-xs text-gray-400">No skins won yet</span>
                  )}
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

            {nassauResult && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Nassau</p>
                <div className="space-y-1">
                  {[
                    { label: 'Front', seg: nassauResult.front },
                    { label: 'Back', seg: nassauResult.back },
                    { label: 'Total', seg: nassauResult.total },
                  ].map(({ label, seg }) => {
                    const leader = seg.winner ? players.find(p => p.id === seg.winner)?.name : null
                    const tiedNames = seg.tiedPlayers.map(id => players.find(p => p.id === id)?.name).filter(Boolean).join(', ')
                    return (
                      <p key={label} className="text-sm text-gray-700">
                        <span className="font-semibold">{label}:</span>{' '}
                        {seg.incomplete ? <span className="text-gray-400">In progress</span> : leader ? <span className="text-teal-700 font-semibold">{leader}</span> : tiedNames ? <span className="text-gray-500">Tied ({tiedNames})</span> : '—'}
                      </p>
                    )
                  })}
                </div>
              </div>
            )}

            {wolfResult && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Wolf — Net Units</p>
                <div className="flex flex-wrap gap-2">
                  {players.slice().sort((a, b) => (wolfResult.netUnits[b.id] ?? 0) - (wolfResult.netUnits[a.id] ?? 0)).map(p => {
                    const u = wolfResult.netUnits[p.id] ?? 0
                    return (
                      <span key={p.id} className={`text-xs font-semibold px-2 py-1 rounded-lg ${u > 0 ? 'bg-purple-50 text-purple-700' : u < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                        {p.name}: {u > 0 ? '+' : ''}{u}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {bbbResult && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Bingo Bango Bongo</p>
                <div className="flex flex-wrap gap-2">
                  {players.slice().sort((a, b) => (bbbResult.pointsWon[b.id] ?? 0) - (bbbResult.pointsWon[a.id] ?? 0)).map(p => {
                    const pts = bbbResult.pointsWon[p.id] ?? 0
                    return (
                      <span key={p.id} className={`text-xs font-semibold px-2 py-1 rounded-lg ${pts > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                        {p.name}: {pts}pt{pts !== 1 ? 's' : ''}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {scoreTab === 'scores' && (
      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {!isOnline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-yellow-600 text-lg">📡</span>
            <div className="flex-1">
              <p className="text-yellow-800 text-sm font-semibold">You're offline</p>
              <p className="text-yellow-600 text-xs">Scores are saved locally and will sync when you reconnect</p>
            </div>
            {pendingCount > 0 && (
              <span className="text-yellow-700 text-xs font-bold bg-yellow-100 px-2 py-1 rounded-full">{pendingCount} queued</span>
            )}
          </div>
        )}
        {syncing && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-blue-500 animate-spin text-sm">↻</span>
            <p className="text-blue-700 text-sm font-semibold">Syncing scores...</p>
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
            <p className="text-red-700 text-sm font-semibold flex-1">{saveError}</p>
            {lastFailedSave && (
              <button
                onClick={() => { setSaveError(null); setLastFailedSave(null); setScore(lastFailedSave.playerId, lastFailedSave.grossScore) }}
                className="text-red-600 text-xs font-bold bg-red-100 px-3 py-1.5 rounded-lg active:bg-red-200 whitespace-nowrap"
              >
                Retry
              </button>
            )}
            <button onClick={() => { setSaveError(null); setLastFailedSave(null) }} className="text-red-400 text-lg font-bold ml-1">&times;</button>
          </div>
        )}
        {/* Game Status accordion */}
        {(skinsResult || bestBallResult || nassauResult || (wolfConfig && wolfId) || (game?.type === 'hammer' && hammerConfig) || (game?.type === 'bingo_bango_bongo') || (junkConfig && junkConfig.types.length > 0)) && (
          <button
            onClick={() => setShowGameStatus(!showGameStatus)}
            className="w-full flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Game Status</span>
            <span className="text-gray-400 text-sm">{showGameStatus ? '▾' : '▸'}</span>
          </button>
        )}
        {showGameStatus && skinsResult && (
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
        {showGameStatus && bestBallResult && <BestBallStatus holesWon={bestBallResult.holesWon} />}

        {/* Nassau status */}
        {showGameStatus && nassauResult && (() => {
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
        {showGameStatus && !readOnly && wolfConfig && wolfId && (() => {
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

        {/* Hammer panel */}
        {showGameStatus && game?.type === 'hammer' && hammerConfig && players.length === 2 && (() => {
          const baseValue = hammerConfig.baseValueCents
          const hState = currentHammerState
          const holeValue = hState ? hState.value : baseValue
          const holderName = hState ? (players.find(p => p.id === hState.hammerHolder)?.name ?? '?') : players[0].name
          const receiverName = hState
            ? (players.find(p => p.id !== hState.hammerHolder)?.name ?? '?')
            : players[1].name
          const receiverId = hState
            ? players.find(p => p.id !== hState.hammerHolder)?.id
            : players[1].id
          const holderId = hState ? hState.hammerHolder : players[0].id
          const canThrow = !readOnly && (!hState || (!hState.declined && (hammerConfig.maxPresses == null || hState.presses < hammerConfig.maxPresses)))
          const canDecline = !readOnly && hState && !hState.declined && hState.presses > 0

          // Running totals from hammerResult
          const p1Total = hammerResult?.netCents[players[0].id] ?? 0
          const p2Total = hammerResult?.netCents[players[1].id] ?? 0

          return (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-orange-800 text-sm">🔨 Hammer</p>
                <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                  Hole value: {fmtMoney(holeValue)}
                </span>
              </div>

              {hState?.declined ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <p className="text-sm text-red-700 font-semibold">
                    {players.find(p => p.id === hState.declinedBy)?.name} declined — {holderName} wins {fmtMoney(hState.value / 2)}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-orange-600">
                    {hState
                      ? `${holderName} threw the hammer (×${hState.presses}) — ${receiverName} to respond`
                      : `${holderName} holds the hammer`}
                  </p>
                  {!readOnly && (
                    <div className="flex gap-2">
                      <button
                        onClick={throwHammer}
                        disabled={!canThrow}
                        className="flex-1 py-2 rounded-lg text-sm font-bold bg-orange-500 text-white active:bg-orange-600 disabled:opacity-40"
                      >
                        🔨 Throw Hammer
                      </button>
                      {canDecline && (
                        <button
                          onClick={declineHammer}
                          className="flex-1 py-2 rounded-lg text-sm font-bold bg-red-100 text-red-700 border border-red-200 active:bg-red-200"
                        >
                          Decline
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Running totals */}
              <div className="flex gap-2 pt-1 border-t border-orange-200">
                {players.map(p => {
                  const net = hammerResult?.netCents[p.id] ?? 0
                  return (
                    <div key={p.id} className={`flex-1 text-center rounded-lg py-1 ${net > 0 ? 'bg-green-50' : net < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <p className="text-xs text-gray-500">{p.name}</p>
                      <p className={`text-sm font-bold ${net > 0 ? 'text-green-700' : net < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                        {net >= 0 ? '+' : ''}{fmtMoney(Math.abs(net))}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* BBB panel */}
        {showGameStatus && !readOnly && game?.type === 'bingo_bango_bongo' && (() => {
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

        {/* Merged Hole Bets panel (junks + side bets) */}
        {showGameStatus && !readOnly && (() => {
          const hasJunks = junkConfig && junkConfig.types.length > 0
          const holeJunks = hasJunks ? junkRecords.filter(jr => jr.holeNumber === currentHole) : []
          const holeBets = sideBets.filter(sb => sb.holeNumber === currentHole && sb.status !== 'cancelled')
          if (!hasJunks && holeBets.length === 0 && !showSideBetForm) {
            // Show minimal panel with just "Add Side Bet" button
            return (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">🎯 Hole Bets — Hole {currentHole}</p>
                  <button
                    onClick={() => setShowSideBetForm(true)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500 text-white active:bg-amber-600"
                  >
                    + Side Bet
                  </button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No bets on this hole</p>
              </div>
            )
          }
          return (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-3 space-y-3">
              <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">🎯 Hole Bets — Hole {currentHole}</p>

              {/* Quick Junks Row */}
              {hasJunks && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    🎲 Junks <span className="text-indigo-400 font-normal">{fmtMoney(junkConfig!.valueCents)}/junk</span>
                  </p>
                  {junkConfig!.types.map(jt => {
                    const info = JUNK_LABELS[jt]
                    const isSnake = jt === 'snake'
                    return (
                      <div key={jt} className="space-y-1">
                        <p className={`text-xs font-semibold ${isSnake ? 'text-red-600' : 'text-indigo-700 dark:text-indigo-300'}`}>
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
                                    : 'bg-white dark:bg-gray-700 border border-indigo-200 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
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
              )}

              {/* Divider between junks and side bets */}
              {hasJunks && (holeBets.length > 0 || showSideBetForm) && (
                <div className="border-t border-amber-200 dark:border-amber-600" />
              )}

              {/* Side Bets List */}
              {holeBets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">💰 Side Bets</p>
                  {holeBets.map(bet => {
                    const participantNames = bet.participants.map(id => players.find(p => p.id === id)?.name ?? '?')
                    const winnerName = bet.winnerPlayerId ? players.find(p => p.id === bet.winnerPlayerId)?.name : null
                    return (
                      <div key={bet.id} className={`rounded-lg p-2.5 ${bet.status === 'resolved' ? 'bg-green-50 dark:bg-green-900/30' : 'bg-white dark:bg-gray-800'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{bet.description}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {fmtMoney(bet.amountCents)} · {participantNames.join(' vs ')}
                            </p>
                          </div>
                          {bet.status === 'resolved' && winnerName && (
                            <span className="text-xs font-bold text-green-700 dark:text-green-400">🏆 {winnerName}</span>
                          )}
                          {bet.status === 'open' && (
                            <button
                              onClick={() => cancelSideBet(bet.id)}
                              className="text-xs text-red-500 font-semibold"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {bet.status === 'open' && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400 self-center">Winner:</span>
                            {bet.participants.map(pid => {
                              const pName = players.find(p => p.id === pid)?.name ?? '?'
                              return (
                                <button
                                  key={pid}
                                  onClick={() => resolveSideBet(bet.id, pid)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 active:bg-green-200"
                                >
                                  {pName}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* New Side Bet Form */}
              {showSideBetForm && (
                <div className="space-y-2 bg-white dark:bg-gray-800 rounded-lg p-3">
                  <input
                    type="text"
                    placeholder="e.g. CTP on #7, longest drive..."
                    value={sideBetDesc}
                    onChange={e => setSideBetDesc(e.target.value)}
                    className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      value={sideBetAmount}
                      onChange={e => setSideBetAmount(e.target.value)}
                      min="1"
                      step="1"
                      className="w-20 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">per loser</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Participants:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {players.map(p => {
                      const active = sideBetParticipants.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSideBetParticipants(prev => active ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            active ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-700 border border-amber-200 dark:border-amber-600 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={createSideBet}
                    disabled={!sideBetDesc.trim() || sideBetParticipants.length < 2}
                    className="w-full py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white active:bg-amber-600 disabled:opacity-40"
                  >
                    Create Bet ({sideBetParticipants.length < 2 ? 'need 2+ players' : `$${sideBetAmount} each`})
                  </button>
                </div>
              )}

              {/* Add Side Bet button at bottom */}
              {!showSideBetForm && (
                <button
                  onClick={() => setShowSideBetForm(true)}
                  className="w-full text-xs font-semibold px-2.5 py-2 rounded-lg bg-amber-500 text-white active:bg-amber-600"
                >
                  + Add Side Bet
                </button>
              )}
            </div>
          )
        })()}

        {/* Event Approval Panel */}
        {isEventRound && canApproveScores && pendingScores.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 space-y-2">
            <button
              onClick={() => setShowApprovalPanel(!showApprovalPanel)}
              className="w-full flex items-center justify-between"
            >
              <p className="font-bold text-yellow-800 text-sm">
                ⏳ {pendingScores.length} Pending Score{pendingScores.length !== 1 ? 's' : ''}
              </p>
              <span className="text-yellow-600 text-xs font-semibold">
                {showApprovalPanel ? 'Hide' : 'Review'}
              </span>
            </button>
            {showApprovalPanel && (
              <div className="space-y-2 mt-2">
                {pendingScores.map(score => {
                  const player = players.find(p => p.id === score.playerId)
                  const hole = snapshot?.holes.find(h => h.number === score.holeNumber)
                  return (
                    <div key={score.id} className="flex items-center justify-between bg-white rounded-lg p-2.5">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{player?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-gray-500">
                          Hole {score.holeNumber} · Par {hole?.par ?? '?'} · Shot {score.grossScore}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={async () => {
                            setHoleScores(prev => prev.map(s => s.id === score.id ? { ...s, scoreStatus: 'approved' as ScoreStatus } : s))
                            await supabase.rpc('approve_score', { p_score_id: score.id })
                          }}
                          className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg active:bg-green-600"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            setHoleScores(prev => prev.map(s => s.id === score.id ? { ...s, scoreStatus: 'rejected' as ScoreStatus } : s))
                            await supabase.rpc('reject_score', { p_score_id: score.id })
                          }}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg active:bg-red-600"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
          const isMyPlayer = selfEntryOnly && myParticipant?.playerId === player.id
          const isMyEventPlayer = isEventRound && myEventParticipant?.playerId === player.id
          const isEditable = isMyPlayer || isMyEventPlayer || (!readOnly && !selfEntryOnly && isInActiveGroup && activeGroupTab !== 'all')

          // Score status for event rounds
          const currentScore = holeScores.find(s => s.playerId === player.id && s.holeNumber === currentHole)
          const scoreStatus = isEventRound ? (currentScore?.scoreStatus ?? undefined) : undefined
          const isPending = scoreStatus === 'pending'
          const isRejected = scoreStatus === 'rejected'

          // Filter out players not in the active group tab (unless showing 'all')
          if (hasGroups && groupNums.length > 1 && activeGroupTab !== 'all' && playerGroup !== activeGroupTab) {
            return null
          }

          // Compact read-only row for "all" tab or readOnly mode with groups
          if (!isEditable) {
            return (
              <div key={player.id} className={`bg-white rounded-xl shadow-sm border px-4 py-2.5 flex items-center justify-between ${isPending ? 'border-yellow-300 bg-yellow-50/50' : isRejected ? 'border-red-300 bg-red-50/50' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <p className={`font-semibold text-sm ${isRejected ? 'text-gray-400 line-through' : isPending ? 'text-gray-600' : 'text-gray-800'}`}>{player.name}</p>
                  {hasGroups && groupNums.length > 1 && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">G{playerGroup}</span>
                  )}
                  {isPending && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-700">PENDING</span>}
                  {isRejected && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-200 text-red-700">REJECTED</span>}
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className={`text-sm font-bold px-1.5 py-0.5 rounded ${isPending ? 'opacity-50' : ''} ${isRejected ? 'line-through opacity-40' : ''} ${getScoreClass(grossScore, par)}`}>{grossScore}</span>
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
            <div key={player.id} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border p-4 ${isPending ? 'border-yellow-300' : isRejected ? 'border-red-300' : 'border-gray-100 dark:border-gray-700'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-800 text-lg">{player.name}</p>
                    {isPending && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-700">PENDING</span>}
                    {isRejected && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-200 text-red-700">REJECTED</span>}
                  </div>
                  {editingHcpPlayerId === player.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        max="54"
                        value={editingHcpValue}
                        onChange={e => setEditingHcpValue(e.target.value)}
                        className="w-16 h-8 px-2 rounded-lg border border-amber-300 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') saveHandicapEdit(); if (e.key === 'Escape') setEditingHcpPlayerId(null) }}
                      />
                      <button onClick={saveHandicapEdit} className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-lg">Save</button>
                      <button onClick={() => setEditingHcpPlayerId(null)} className="text-xs text-gray-500">Cancel</button>
                    </div>
                  ) : (
                    <p className={`text-sm text-gray-500 ${!readOnly ? 'cursor-pointer active:text-amber-600' : ''}`}
                      onClick={() => {
                        if (readOnly) return
                        setEditingHcpPlayerId(player.id)
                        setEditingHcpValue(String(player.handicapIndex))
                      }}
                    >
                      HCP {player.handicapIndex}
                      {strokesGiven > 0 && <span className="ml-2 text-amber-600 font-semibold">+{strokesGiven} stroke{strokesGiven !== 1 ? 's' : ''}</span>}
                      {!readOnly && <span className="ml-1 text-gray-300 text-xs">✎</span>}
                    </p>
                  )}
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
        {!readOnly && !showHoleConfirm && (() => {
          const missingPlayers = players.filter(p => !holeScores.some(s => s.playerId === p.id && s.holeNumber === currentHole))
          return missingPlayers.length > 0 ? (
            <p className="text-amber-600 text-xs font-medium text-center py-1.5 bg-amber-50 rounded-xl">
              Not all players have scores for this hole
            </p>
          ) : null
        })()}

        {/* Hole Confirm Panel */}
        {showHoleConfirm && (() => {
          const unscoredPlayers = players.filter(p => !holeScores.some(s => s.playerId === p.id && s.holeNumber === currentHole))
          const needsParWarning = unscoredPlayers.length > 0 && !confirmParFill
          return (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
              <p className="font-bold text-blue-800 text-sm">Confirm Hole {currentHole} Scores</p>

              {/* Par fill warning */}
              {needsParWarning && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
                  <p className="text-amber-800 text-sm font-semibold">
                    {unscoredPlayers.length === 1
                      ? `${unscoredPlayers[0].name} has no score`
                      : `${unscoredPlayers.map(p => p.name).join(', ')} have no scores`}
                  </p>
                  <p className="text-amber-700 text-xs">
                    {unscoredPlayers.length === 1 ? 'Score' : 'Scores'} will be recorded as par ({par})
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmParFill(true)}
                      className="flex-1 h-10 bg-amber-500 text-white font-bold rounded-xl active:bg-amber-600 text-sm"
                    >
                      Record as Par & Next
                    </button>
                    <button
                      onClick={() => { setShowHoleConfirm(false); setConfirmParFill(false) }}
                      className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold rounded-xl active:bg-gray-200 text-sm"
                    >
                      Edit Scores
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {players.map(p => {
                  const hs = holeScores.find(s => s.playerId === p.id && s.holeNumber === currentHole)
                  const score = hs?.grossScore ?? par
                  const isAssumed = !hs
                  return (
                    <div key={p.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${isAssumed ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
                      <span className="text-sm font-medium text-gray-800">{p.name}</span>
                      <span className={`text-sm font-bold ${isAssumed ? 'text-amber-600' : 'text-gray-800'}`}>
                        {score} {isAssumed && <span className="text-xs font-normal">(par assumed)</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
              {!needsParWarning && (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      // Auto-save par for unscored players
                      if (unscoredPlayers.length > 0) {
                        await Promise.all(unscoredPlayers.map(p => setScore(p.id, par)))
                      }
                      setShowHoleConfirm(false)
                      setConfirmParFill(false)
                      goToHole(currentHole + 1)
                    }}
                    className="flex-1 h-12 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700 text-sm"
                  >
                    Confirm & Next →
                  </button>
                  <button
                    onClick={() => { setShowHoleConfirm(false); setConfirmParFill(false) }}
                    className="flex-1 h-12 bg-gray-100 text-gray-700 font-bold rounded-xl active:bg-gray-200 text-sm"
                  >
                    Edit Scores
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {!showHoleConfirm && (currentHole < (snapshot?.holes.length ?? 18) ? (
          <button onClick={() => {
            if (!readOnly && !selfEntryOnly && isScoremasterRole) {
              setShowHoleConfirm(true)
            } else {
              goToHole(currentHole + 1)
            }
          }}
            className="w-full h-14 bg-gray-800 text-white text-lg font-bold rounded-2xl active:bg-gray-900 transition-colors shadow-lg">Next Hole →</button>
        ) : readOnly ? (
          <button onClick={onHome}
            className="w-full h-14 bg-gray-600 text-white text-lg font-bold rounded-2xl active:bg-gray-700 transition-colors shadow-lg">Back to Home</button>
        ) : (
          <button onClick={confirmEndRound}
            className="w-full h-14 bg-yellow-500 text-white text-lg font-bold rounded-2xl active:bg-yellow-600 transition-colors shadow-lg">🏁 End Round & Settle Up</button>
        ))}
      </div>
      )} {/* end scoreTab === 'scores' */}

      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 safe-bottom">
        <div className="p-4 max-w-2xl mx-auto flex gap-3">
          <button onClick={() => goToHole(Math.max(1, currentHole - 1))} disabled={currentHole === 1}
            className="flex-1 h-14 bg-gray-100 rounded-2xl font-bold text-xl text-gray-600 disabled:opacity-30 active:bg-gray-200">&larr; Prev</button>
          {!readOnly && undoStack.length > 0 && (
            <button onClick={undoLastChange}
              className="flex-1 h-14 bg-amber-100 rounded-2xl text-amber-700 font-bold text-sm active:bg-amber-200 flex flex-col items-center justify-center" aria-label="Undo">
              <span>Undo</span>
              <span className="text-[10px] text-amber-500 font-semibold">H{undoStack[0].holeNumber} {undoStack[0].playerName} {undoStack[0].newScore}→{undoStack[0].previousScore}</span>
            </button>
          )}
        </div>
      </div>

      {/* Invite toast */}
      {inviteToast && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="bg-gray-800 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-semibold">
            {inviteToast}
          </div>
        </div>
      )}

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

      {/* Game rules modal */}
      {showRulesModal && game && <GameRulesModal gameType={game.type} onClose={() => setShowRulesModal(false)} />}
    </div>
  )
}
