import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, rowToRound, rowToRoundPlayer, rowToHoleScore, rowToBuyIn, rowToBBBPoint, rowToJunkRecord, rowToSideBet, rowToSettlementRecord, settlementRecordToRow, rowToUserProfile, rowToEvent } from '../../lib/supabase'
import { PaymentButtons, getPreferredPayment } from '../PaymentButtons'
import { Tooltip } from '../ui/Tooltip'
import {
  buildCourseHandicaps,
  strokesOnHole,
  calculateSkins,
  calculateBestBall,
  calculateNassau,
  calculateWolf,
  calculateBBB,
  calculateHammer,
  calculateVegas,
  calculateStableford,
  calculateDots,
  calculateBanker,
  calculateQuota,
  calculateSkinsPayouts,
  calculateBestBallPayouts,
  calculateNassauPayouts,
  calculateWolfPayouts,
  calculateBBBPayouts,
  calculateHammerPayouts,
  calculateVegasPayouts,
  calculateStablefordPayouts,
  calculateDotsPayouts,
  calculateBankerPayouts,
  calculateQuotaPayouts,
  calculateJunks,
  calculateSideBetSettlements,
  buildUnifiedSettlements,
  JUNK_LABELS,
  fmtAmount,
} from '../../lib/gameLogic'
import type { PlayerPayout, JunkResult, SideBetSettlement, HammerResult } from '../../lib/gameLogic'
import type {
  Round,
  RoundPlayer,
  HoleScore,
  BuyIn,
  BBBPoint,
  JunkRecord,
  Player,
  SkinsConfig,
  BestBallConfig,
  NassauConfig,
  WolfConfig,
  HammerConfig,
  VegasConfig,
  StablefordConfig,
  DotsConfig,
  BankerConfig,
  QuotaConfig,
  GameType,
  SideBet,
  SettlementRecord,
  UserProfile,
  GolfEvent,
} from '../../types'
import { ShareCard, useShareImage } from '../ShareCard'
import type { ShareCardLeaderboardEntry, ShareCardPayout } from '../ShareCard'

interface Props {
  roundId: string
  userId?: string
  eventId?: string
  onDone: () => void
  onContinue: () => void
}

const GAME_LABELS: Record<GameType, string> = {
  skins: 'Skins',
  best_ball: 'Best Ball',
  nassau: 'Nassau',
  wolf: 'Wolf',
  bingo_bango_bongo: 'Bingo Bango Bongo',
  hammer: 'Hammer',
  vegas: 'Vegas',
  stableford: 'Stableford',
  dots: 'Dots',
  banker: 'Banker',
  quota: 'Quota',
}

/** Merge fresh profile payment info over snapshot player data */
function mergePaymentInfo(player: Player, profiles: Map<string, UserProfile>, participantMap: Map<string, string>): Player {
  const linkedUserId = participantMap.get(player.id)
  if (!linkedUserId) return player
  const profile = profiles.get(linkedUserId)
  if (!profile) return player
  return {
    ...player,
    venmoUsername: profile.venmoUsername ?? player.venmoUsername,
    zelleIdentifier: profile.zelleIdentifier ?? player.zelleIdentifier,
    cashAppUsername: profile.cashAppUsername ?? player.cashAppUsername,
    paypalEmail: profile.paypalEmail ?? player.paypalEmail,
  }
}

function NudgeButton({ playerName, amountCents, toPlayer }: { playerName: string; amountCents: number; toPlayer: Player }) {
  const [nudgeCopied, setNudgeCopied] = useState(false)
  const paymentLink = toPlayer.venmoUsername
    ? `venmo.com/${toPlayer.venmoUsername.replace('@', '')}`
    : toPlayer.cashAppUsername
    ? `cash.app/$${toPlayer.cashAppUsername.replace('$', '')}`
    : toPlayer.paypalEmail
    ? `paypal.me/${toPlayer.paypalEmail}`
    : null
  const msg = `Hey ${playerName}! You owe ${fmtAmount(amountCents)} for golf.${paymentLink ? ` Pay here: ${paymentLink}` : ''}`
  const handleNudge = () => {
    navigator.clipboard.writeText(msg).then(() => { setNudgeCopied(true); setTimeout(() => setNudgeCopied(false), 2000) })
  }
  return (
    <button onClick={handleNudge} className={`text-xs transition-colors ${nudgeCopied ? 'text-green-600 font-semibold' : 'text-amber-600 underline'}`}>
      {nudgeCopied ? 'Copied!' : '📨 Nudge'}
    </button>
  )
}

export function SettleUp({ roundId, userId, eventId, onDone, onContinue }: Props) {
  const [round, setRound] = useState<Round | null>(null)
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([])
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [buyIns, setBuyIns] = useState<BuyIn[]>([])
  const [bbbPoints, setBbbPoints] = useState<BBBPoint[]>([])
  const [junkRecords, setJunkRecords] = useState<JunkRecord[]>([])
  const [sideBets, setSideBets] = useState<SideBet[]>([])
  const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([])
  const [profileMap, setProfileMap] = useState<Map<string, UserProfile>>(new Map())
  const [participantMap, setParticipantMap] = useState<Map<string, string>>(new Map()) // playerId → userId
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [settlementsInitialized, setSettlementsInitialized] = useState(false)
  const [eventData, setEventData] = useState<GolfEvent | null>(null)
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(null)
  const [showBuyInDetails, setShowBuyInDetails] = useState<boolean | null>(null) // null = auto
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const toggleSection = (key: string) => setExpandedSections(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  const [mutationError, setMutationError] = useState<string | null>(null)
  const { shareRef, sharing, shareImage } = useShareImage('fore-skins-results')

  const loadSettleUpData = () => {
    setLoadError(false)
    setLoading(true)
    Promise.all([
      supabase.from('rounds').select('*').eq('id', roundId).single(),
      supabase.from('round_players').select('*').eq('round_id', roundId),
      supabase.from('hole_scores').select('*').eq('round_id', roundId),
      supabase.from('buy_ins').select('*').eq('round_id', roundId),
      supabase.from('bbb_points').select('*').eq('round_id', roundId),
      supabase.from('junk_records').select('*').eq('round_id', roundId),
      supabase.from('side_bets').select('*').eq('round_id', roundId),
      supabase.from('settlements').select('*').eq('round_id', roundId),
      supabase.from('round_participants').select('*').eq('round_id', roundId),
    ]).then(([roundRes, rpRes, hsRes, biRes, bbbRes, junkRes, sbRes, settlRes, partRes]) => {
      if (roundRes.error || !roundRes.data) {
        setLoadError(true)
        setLoading(false)
        return
      }
      setRound(rowToRound(roundRes.data))
      if (rpRes.data) setRoundPlayers(rpRes.data.map(rowToRoundPlayer))
      if (hsRes.data) setHoleScores(hsRes.data.map(rowToHoleScore))
      if (biRes.data) setBuyIns(biRes.data.map(rowToBuyIn))
      if (bbbRes.data) setBbbPoints(bbbRes.data.map(rowToBBBPoint))
      if (junkRes.data) setJunkRecords(junkRes.data.map(rowToJunkRecord))
      if (sbRes.data) setSideBets(sbRes.data.map(rowToSideBet))
      if (settlRes.data) setSettlementRecords(settlRes.data.map(rowToSettlementRecord))

      // Build participant map: playerId → userId
      if (partRes.data) {
        const pMap = new Map<string, string>()
        for (const row of partRes.data) {
          pMap.set(row.player_id, row.user_id)
        }
        setParticipantMap(pMap)

        // Fetch fresh user profiles for linked players
        const userIds = [...new Set(partRes.data.map((r: any) => r.user_id))]
        if (userIds.length > 0) {
          supabase.from('user_profiles').select('*').in('user_id', userIds).then(({ data }) => {
            if (data) {
              const map = new Map<string, UserProfile>()
              for (const row of data) {
                map.set(row.user_id, rowToUserProfile(row))
              }
              setProfileMap(map)
            }
          })
        }
      }

      setLoading(false)
    }).catch(() => {
      setLoadError(true)
      setLoading(false)
    })

    // Fetch event data if eventId provided or round has one
    if (eventId) {
      supabase.from('events').select('*').eq('id', eventId).single().then(({ data }) => {
        if (data) setEventData(rowToEvent(data))
      })
    }
  }

  useEffect(() => {
    loadSettleUpData()
  }, [roundId, eventId])

  // Fetch event from round if not provided via prop
  useEffect(() => {
    if (!eventData && round?.eventId) {
      supabase.from('events').select('*').eq('id', round.eventId).single().then(({ data }) => {
        if (data) setEventData(rowToEvent(data))
      })
    }
  }, [round?.eventId, eventData])

  const players = round?.players ?? []
  const snapshot = round?.courseSnapshot
  const game = round?.game
  const treasurerId = round?.treasurerPlayerId
  const treasurer = players.find(p => p.id === treasurerId)

  // Merge fresh payment info from profiles over snapshot
  const enrichedPlayers = useMemo(() => {
    return players.map(p => mergePaymentInfo(p, profileMap, participantMap))
  }, [players, profileMap, participantMap])

  const courseHcps = useMemo(() => {
    if (!snapshot || !roundPlayers) return {}
    return buildCourseHandicaps(players, roundPlayers, snapshot)
  }, [players, roundPlayers, snapshot])

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

  const wolfResult = useMemo(() => {
    if (!game || game.type !== 'wolf' || !snapshot) return null
    return calculateWolf(players, holeScores, snapshot, game.config as WolfConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const bbbResult = useMemo(() => {
    if (!game || game.type !== 'bingo_bango_bongo') return null
    return calculateBBB(players, bbbPoints)
  }, [game, players, bbbPoints])

  const hammerResult = useMemo((): HammerResult | null => {
    if (!game || game.type !== 'hammer' || !snapshot) return null
    return calculateHammer(players, holeScores, snapshot, game.config as HammerConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const vegasResult = useMemo(() => {
    if (!game || game.type !== 'vegas' || !snapshot) return null
    return calculateVegas(players, holeScores, snapshot, game.config as VegasConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const stablefordResult = useMemo(() => {
    if (!game || game.type !== 'stableford' || !snapshot) return null
    return calculateStableford(players, holeScores, snapshot, game.config as StablefordConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const dotsResult = useMemo(() => {
    if (!game || game.type !== 'dots') return null
    return calculateDots(players, junkRecords, game.config as DotsConfig)
  }, [game, players, junkRecords])

  const bankerResult = useMemo(() => {
    if (!game || game.type !== 'banker' || !snapshot) return null
    return calculateBanker(players, holeScores, snapshot, game.config as BankerConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const quotaResult = useMemo(() => {
    if (!game || game.type !== 'quota' || !snapshot) return null
    return calculateQuota(players, holeScores, snapshot, game.config as QuotaConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const junkResult = useMemo((): JunkResult | null => {
    if (!round?.junkConfig || junkRecords.length === 0) return null
    return calculateJunks(players, junkRecords, round.junkConfig)
  }, [round?.junkConfig, players, junkRecords])

  const sideBetSettlements = useMemo((): SideBetSettlement[] => {
    return calculateSideBetSettlements(sideBets)
  }, [sideBets])

  const payouts = useMemo((): PlayerPayout[] => {
    if (!game || !snapshot) return []
    if (game.type === 'skins' && skinsResult) {
      return calculateSkinsPayouts(skinsResult, game, players.length)
    }
    if (game.type === 'best_ball' && bestBallResult) {
      return calculateBestBallPayouts(bestBallResult, game.config as BestBallConfig, game, players)
    }
    if (game.type === 'nassau' && nassauResult) {
      return calculateNassauPayouts(nassauResult, game, players, holeScores, snapshot!, courseHcps)
    }
    if (game.type === 'wolf' && wolfResult) {
      return calculateWolfPayouts(wolfResult, game, players)
    }
    if (game.type === 'bingo_bango_bongo' && bbbResult) {
      return calculateBBBPayouts(bbbResult, game, players)
    }
    if (game.type === 'hammer' && hammerResult) {
      return calculateHammerPayouts(hammerResult, game, players)
    }
    if (game.type === 'vegas' && vegasResult) {
      return calculateVegasPayouts(vegasResult, game.config as VegasConfig, game, players)
    }
    if (game.type === 'stableford' && stablefordResult) {
      return calculateStablefordPayouts(stablefordResult, game, players)
    }
    if (game.type === 'dots' && dotsResult) {
      return calculateDotsPayouts(dotsResult, game, players)
    }
    if (game.type === 'banker' && bankerResult) {
      return calculateBankerPayouts(bankerResult, game, players)
    }
    if (game.type === 'quota' && quotaResult) {
      return calculateQuotaPayouts(quotaResult, game, players)
    }
    return []
  }, [game, players, snapshot, skinsResult, bestBallResult, nassauResult, wolfResult, bbbResult, hammerResult, vegasResult, stablefordResult, dotsResult, bankerResult, quotaResult])

  // Persist settlements: compute + insert on first view, or load from DB
  const persistSettlements = useCallback(async () => {
    if (!treasurerId || !userId || settlementsInitialized) return
    setSettlementsInitialized(true)

    // If DB already has settlements for this round, use those
    if (settlementRecords.length > 0) return

    // No payouts and no junk and no side bets → nothing to settle
    if (payouts.length === 0 && !junkResult && sideBetSettlements.length === 0) return

    const unified = buildUnifiedSettlements(payouts, treasurerId, junkResult, sideBetSettlements)
    if (unified.length === 0) return

    const records: SettlementRecord[] = unified.map(s => ({
      id: uuidv4(),
      roundId,
      fromPlayerId: s.fromId,
      toPlayerId: s.toId,
      amountCents: s.amountCents,
      reason: s.reason,
      source: s.source,
      status: 'owed' as const,
    }))

    setSettlementRecords(records)
    const { error } = await supabase.from('settlements').insert(records.map(r => settlementRecordToRow(r, userId)))
    if (error) console.error('Failed to persist settlements:', error)
  }, [treasurerId, userId, settlementsInitialized, settlementRecords.length, payouts, junkResult, sideBetSettlements, roundId])

  useEffect(() => {
    if (!loading && round && game && snapshot) {
      persistSettlements()
    }
  }, [loading, round, game, snapshot, persistSettlements])

  const potCents = game ? game.buyInCents * players.length : 0
  const unpaidBuyIns = buyIns.filter(b => b.status === 'unpaid')
  const playerById = (id: string) => enrichedPlayers.find(p => p.id === id)

  // Treasurer access control
  const isTreasurer = userId === treasurerId || userId === round?.createdBy

  const toggleBuyInPaid = async (buyIn: BuyIn) => {
    const newStatus = buyIn.status === 'unpaid' ? 'marked_paid' : 'unpaid'
    const newPaidAt = newStatus === 'marked_paid' ? new Date().toISOString() : null
    const prevBuyIns = buyIns
    setBuyIns(prev => prev.map(b =>
      b.id === buyIn.id
        ? { ...b, status: newStatus as BuyIn['status'], paidAt: newPaidAt ? new Date(newPaidAt) : undefined }
        : b
    ))
    setMutationError(null)
    const { error } = await supabase.from('buy_ins').update({ status: newStatus, paid_at: newPaidAt }).eq('id', buyIn.id)
    if (error) {
      setBuyIns(prevBuyIns)
      setMutationError('Failed to update buy-in status. Please try again.')
    }
  }

  const toggleSettlementPaid = async (settlement: SettlementRecord) => {
    const newStatus = settlement.status === 'owed' ? 'paid' : 'owed'
    const newPaidAt = newStatus === 'paid' ? new Date().toISOString() : null
    const prevRecords = settlementRecords
    setSettlementRecords(prev => prev.map(s =>
      s.id === settlement.id
        ? { ...s, status: newStatus as SettlementRecord['status'], paidAt: newPaidAt ? new Date(newPaidAt) : undefined }
        : s
    ))
    setMutationError(null)
    const { error } = await supabase.from('settlements').update({ status: newStatus, paid_at: newPaidAt }).eq('id', settlement.id)
    if (error) {
      setSettlementRecords(prevRecords)
      setMutationError('Failed to update settlement. Please try again.')
    }
  }

  const markPlayerSettled = async (settlementIds: string[]) => {
    const paidAt = new Date().toISOString()
    const prevRecords = settlementRecords
    setSettlementRecords(prev => prev.map(s =>
      settlementIds.includes(s.id) ? { ...s, status: 'paid' as SettlementRecord['status'], paidAt: new Date(paidAt) } : s
    ))
    setMutationError(null)
    const { error } = await supabase.from('settlements').update({ status: 'paid', paid_at: paidAt }).in('id', settlementIds)
    if (error) {
      setSettlementRecords(prevRecords)
      setMutationError('Failed to mark settlements as paid. Please try again.')
    }
  }

  // Collection Checklist: aggregate settlements by counterparty from treasurer's perspective
  // (must be before early return to keep hook order stable)
  const collectionChecklist = useMemo(() => {
    if (!treasurerId || settlementRecords.length === 0) return []
    const byPlayer = new Map<string, { collectCents: number; payCents: number; owedIds: string[]; totalIds: string[]; paidCount: number }>()
    for (const s of settlementRecords) {
      const involvesT = s.fromPlayerId === treasurerId || s.toPlayerId === treasurerId
      if (!involvesT) {
        const key = s.fromPlayerId + '→' + s.toPlayerId
        if (!byPlayer.has(key)) byPlayer.set(key, { collectCents: 0, payCents: 0, owedIds: [], totalIds: [], paidCount: 0 })
        const entry = byPlayer.get(key)!
        entry.totalIds.push(s.id)
        if (s.status === 'paid') entry.paidCount++
        else entry.owedIds.push(s.id)
        entry.collectCents += s.amountCents
        continue
      }
      const counterpartyId = s.fromPlayerId === treasurerId ? s.toPlayerId : s.fromPlayerId
      if (!byPlayer.has(counterpartyId)) byPlayer.set(counterpartyId, { collectCents: 0, payCents: 0, owedIds: [], totalIds: [], paidCount: 0 })
      const entry = byPlayer.get(counterpartyId)!
      entry.totalIds.push(s.id)
      if (s.status === 'paid') { entry.paidCount++; continue }
      entry.owedIds.push(s.id)
      if (s.toPlayerId === treasurerId) {
        entry.collectCents += s.amountCents
      } else {
        entry.payCents += s.amountCents
      }
    }
    const result: { playerId: string; playerName: string; netCents: number; owedIds: string[]; totalCount: number; paidCount: number; player: Player | undefined; isDirect?: boolean; directLabel?: string }[] = []
    for (const [key, data] of byPlayer) {
      if (key.includes('→')) {
        const [fromId, toId] = key.split('→')
        const fromP = playerById(fromId)
        const toP = playerById(toId)
        if (data.owedIds.length === 0) continue
        result.push({
          playerId: key,
          playerName: `${fromP?.name ?? '?'} → ${toP?.name ?? '?'}`,
          netCents: data.collectCents,
          owedIds: data.owedIds,
          totalCount: data.totalIds.length,
          paidCount: data.paidCount,
          player: fromP,
          isDirect: true,
          directLabel: `${fromP?.name ?? '?'} pays ${toP?.name ?? '?'}`,
        })
      } else {
        const net = data.collectCents - data.payCents
        if (data.owedIds.length === 0) continue
        result.push({
          playerId: key,
          playerName: playerById(key)?.name ?? key.slice(0, 8),
          netCents: net,
          owedIds: data.owedIds,
          totalCount: data.totalIds.length,
          paidCount: data.paidCount,
          player: playerById(key),
        })
      }
    }
    return result.sort((a, b) => Math.abs(b.netCents) - Math.abs(a.netCents))
  }, [settlementRecords, treasurerId, enrichedPlayers])

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-red-500 font-semibold">Failed to load round data</p>
        <button onClick={loadSettleUpData} className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl active:bg-amber-600">Tap to Retry</button>
        <button onClick={onDone} className="text-gray-500 text-sm underline mt-2">Go Back</button>
      </div>
    )
  }

  if (loading || !round || !game || !snapshot) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  const gameLabel = GAME_LABELS[game.type] ?? game.type
  const isHighRoller = game.stakesMode === 'high_roller'
  const isPoints = game.stakesMode === 'points'
  const fmt = (cents: number) => fmtAmount(cents, game.stakesMode)
  const headerClass = isHighRoller ? 'hr-header' : 'app-header'

  const owedSettlements = settlementRecords.filter(s => s.status === 'owed')
  const paidSettlements = settlementRecords.filter(s => s.status === 'paid')
  const allSettled = settlementRecords.length > 0 && owedSettlements.length === 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-32">
      {mutationError && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-center text-sm font-semibold px-4 py-3 shadow-lg">
          {mutationError}
          <button onClick={() => setMutationError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}
      <header className={`${headerClass} text-white px-4 py-5 sticky top-0 z-10 shadow-xl`}>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Settle Up 💰
            {isHighRoller && (
              <span className="text-sm font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'linear-gradient(135deg,#d97706,#fbbf24)', color: '#000' }}>
                💎 HIGH ROLLER
              </span>
            )}
          </h1>
          <p className="text-gray-300 text-sm mt-0.5">
            {eventData ? `${eventData.name} · ` : ''}{snapshot.courseName} · {gameLabel}
          </p>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* Non-treasurer banner */}
        {!isTreasurer && treasurer && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-amber-800 text-sm font-semibold">Only {treasurer.name} can manage payments</p>
            <p className="text-amber-600 text-xs mt-0.5">You can view results and standings below.</p>
          </div>
        )}

        {/* ── You Owe / You Collect Summary (moved to top) ── */}
        {settlementRecords.length > 0 && userId && (() => {
          const myPlayerId = Array.from(participantMap.entries()).find(([, uid]) => uid === userId)?.[0]
            ?? (treasurerId && (userId === round?.createdBy) ? treasurerId : null)
          if (!myPlayerId) {
            const totalOwed = owedSettlements.reduce((s, r) => s + r.amountCents, 0)
            return (
              <section className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500">Total in play</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{fmt(totalOwed)}</p>
                <p className="text-xs text-gray-400 mt-1">{owedSettlements.length} settlement{owedSettlements.length !== 1 ? 's' : ''} remaining</p>
              </section>
            )
          }
          let collectCents = 0
          let oweCents = 0
          const collectFrom: { name: string; cents: number }[] = []
          const oweTo: { name: string; cents: number }[] = []
          for (const s of settlementRecords.filter(r => r.status === 'owed')) {
            if (s.toPlayerId === myPlayerId) {
              collectCents += s.amountCents
              const from = playerById(s.fromPlayerId)
              collectFrom.push({ name: from?.name ?? '?', cents: s.amountCents })
            } else if (s.fromPlayerId === myPlayerId) {
              oweCents += s.amountCents
              const to = playerById(s.toPlayerId)
              oweTo.push({ name: to?.name ?? '?', cents: s.amountCents })
            }
          }
          const net = collectCents - oweCents
          return (
            <section className={`rounded-2xl p-4 text-center space-y-2 ${
              net > 0 ? 'bg-green-50 border-2 border-green-200' :
              net < 0 ? 'bg-red-50 border-2 border-red-200' :
              'bg-gray-50 border border-gray-200'
            }`}>
              <p className={`text-2xl font-bold ${
                net > 0 ? 'text-green-700' : net < 0 ? 'text-red-700' : 'text-gray-600'
              }`}>
                {net > 0 ? `You collect ${fmt(net)}` : net < 0 ? `You owe ${fmt(Math.abs(net))}` : "You're even"}
              </p>
              {collectFrom.length > 0 && (
                <p className="text-sm text-green-600">
                  {collectFrom.map(c => `From ${c.name}: ${fmt(c.cents)}`).join(' · ')}
                </p>
              )}
              {oweTo.length > 0 && (
                <p className="text-sm text-red-600">
                  {oweTo.map(c => `To ${c.name}: ${fmt(c.cents)}`).join(' · ')}
                </p>
              )}
            </section>
          )
        })()}

        {/* Collection Checklist — treasurer's aggregated view */}
        {isTreasurer && collectionChecklist.length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Collection Checklist</p>
              {(() => {
                const totalItems = collectionChecklist.reduce((s, c) => s + c.totalCount, 0)
                const paidItems = collectionChecklist.reduce((s, c) => s + c.paidCount, 0)
                const pct = totalItems > 0 ? Math.round((paidItems / totalItems) * 100) : 0
                return (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{paidItems} of {totalItems} settled</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="space-y-2">
              {collectionChecklist.map(item => {
                const pref = item.player ? getPreferredPayment(item.player) : null
                return (
                  <div key={item.playerId} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                          {item.isDirect ? item.directLabel : item.netCents > 0
                            ? `Collect ${fmt(item.netCents)} from ${item.playerName}`
                            : item.netCents < 0
                            ? `Pay ${fmt(Math.abs(item.netCents))} to ${item.playerName}`
                            : `Settle with ${item.playerName}`}
                        </p>
                        {pref && !item.isDirect && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">via {pref.method} {pref.handle}</p>
                        )}
                      </div>
                      <p className={`text-2xl font-bold ${item.netCents > 0 ? 'text-green-600' : item.netCents < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {item.isDirect ? fmt(item.netCents) : fmt(Math.abs(item.netCents))}
                      </p>
                    </div>
                    {!isPoints && !item.isDirect && item.player && item.netCents < 0 && (
                      <PaymentButtons toPlayer={item.player} amountCents={Math.abs(item.netCents)} note={`Golf — ${snapshot.courseName}`} />
                    )}
                    <button
                      onClick={() => markPlayerSettled(item.owedIds)}
                      className="w-full h-10 bg-green-600 text-white text-sm font-semibold rounded-xl active:bg-green-700 transition-colors"
                    >
                      Mark {item.owedIds.length === 1 ? 'Paid' : `All ${item.owedIds.length} Paid`}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {buyIns.length > 0 && (() => {
          const allBuyInsPaid = unpaidBuyIns.length === 0
          const isExpanded = showBuyInDetails !== null ? showBuyInDetails : !allBuyInsPaid
          return (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
            <button
              onClick={() => setShowBuyInDetails(!isExpanded)}
              className="w-full flex items-center justify-between"
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buy-In Status</p>
              {allBuyInsPaid && !isExpanded ? (
                <span className="text-green-600 text-sm font-semibold">All buy-ins collected ✓</span>
              ) : (
                <span className="text-gray-400 text-sm">{isExpanded ? '▾' : '▸'}</span>
              )}
            </button>
            {isExpanded && (
              <>
                {isTreasurer && unpaidBuyIns.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-red-700 text-sm font-semibold">
                      {unpaidBuyIns.length} unpaid — collect {fmt(unpaidBuyIns.length * game.buyInCents)} before distributing
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {buyIns.map(b => {
                    const p = playerById(b.playerId)
                    const isPaid = b.status === 'marked_paid'
                    const playerReported = b.playerReportedAt && b.status === 'unpaid'
                    return (
                      <div key={b.id} className={`flex items-center justify-between p-3 rounded-xl ${isPaid ? 'bg-green-50' : playerReported ? 'bg-amber-50' : 'bg-red-50'}`}>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{p?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-gray-500">
                            {fmt(b.amountCents)}
                            {p?.venmoUsername && <span className="ml-1 text-blue-500">Venmo</span>}
                            {p?.zelleIdentifier && <span className="ml-1 text-purple-500">Zelle</span>}
                            {p?.cashAppUsername && <span className="ml-1 text-green-500">CashApp</span>}
                            {p?.paypalEmail && <span className="ml-1 text-yellow-600">PayPal</span>}
                          </p>
                          {playerReported && (
                            <p className="text-xs text-amber-600 font-semibold mt-0.5">
                              Player says they paid via {b.method ?? 'cash'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isTreasurer && !isPaid && p?.venmoUsername && (
                            <a href={`https://venmo.com/u/${p.venmoUsername.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 font-semibold underline">Venmo</a>
                          )}
                          {isTreasurer ? (
                            <button
                              onClick={() => toggleBuyInPaid(b)}
                              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                                isPaid
                                  ? 'bg-green-600 text-white active:bg-gray-800'
                                  : 'bg-red-100 text-red-700 active:bg-red-200'
                              }`}
                            >
                              {isPaid ? 'Paid' : 'Mark Paid'}
                            </button>
                          ) : (
                            <span className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${isPaid ? 'text-green-600' : 'text-red-500'}`}>
                              {isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>
          )
        })()}

        {/* Summary */}
        <section className={`rounded-2xl shadow-sm p-4 ${isHighRoller ? 'border-2' : 'bg-white'}`}
          style={isHighRoller ? { background: '#1a0e00', borderColor: '#d97706' } : undefined}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isHighRoller ? 'text-amber-400' : 'text-gray-500'}`}>Summary</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className={`rounded-xl p-3 ${isHighRoller ? 'bg-black/30' : 'bg-gray-50'}`}>
              <p className={`text-xs ${isHighRoller ? 'text-amber-400' : 'text-gray-500'}`}>Players</p>
              <p className={`text-xl font-bold ${isHighRoller ? 'text-white' : 'text-gray-800'}`}>{players.length}</p>
            </div>
            <div className={`rounded-xl p-3 ${isHighRoller ? 'bg-black/30' : 'bg-gray-50'}`}>
              <p className={`text-xs ${isHighRoller ? 'text-amber-400' : 'text-gray-500'}`}>Buy-in</p>
              <p className={`text-xl font-bold ${isHighRoller ? 'text-white' : 'text-gray-800'}`}>{fmt(game.buyInCents)}</p>
            </div>
            <div className={`rounded-xl p-3 ${isHighRoller ? 'bg-amber-900/40' : 'bg-green-50'}`}>
              <p className={`text-xs ${isHighRoller ? 'text-amber-400' : 'text-gray-500'}`}>Total pot</p>
              <p className={`text-xl font-bold ${isHighRoller ? 'text-amber-400' : 'text-green-800'}`}>{fmt(potCents)}</p>
            </div>
          </div>
          <p className={`text-sm mt-3 ${isHighRoller ? 'text-amber-200' : 'text-gray-500'}`}>
            Treasurer: <strong>{treasurer?.name ?? 'Not assigned'}</strong>
          </p>
        </section>

        {/* ── Group Breakdown (Event only) ── */}
        {eventData && round?.groups && (() => {
          const groupNums = [...new Set(Object.values(round.groups!))].sort((a, b) => a - b)
          if (groupNums.length <= 1) return null
          return (
            <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Group Breakdown</p>
              {groupNums.map(gn => {
                const groupPlayerIds = Object.entries(round.groups!)
                  .filter(([, g]) => g === gn)
                  .map(([pid]) => pid)
                const groupPlayers = players.filter(p => groupPlayerIds.includes(p.id))
                const groupScores = holeScores.filter(s => groupPlayerIds.includes(s.playerId))
                return (
                  <div key={gn} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Group {gn}</p>
                    <div className="space-y-1">
                      {groupPlayers.map(p => {
                        const pScores = groupScores.filter(s => s.playerId === p.id)
                        const gross = pScores.reduce((s, hs) => s + hs.grossScore, 0)
                        const scoredPar = pScores.reduce((s, hs) => {
                          const hole = snapshot?.holes.find(h => h.number === hs.holeNumber)
                          return s + (hole?.par ?? 0)
                        }, 0)
                        const vsPar = gross - scoredPar
                        return (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                            <span className={`font-semibold ${vsPar > 0 ? 'text-red-600' : vsPar < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {pScores.length > 0 ? `${gross} (${vsPar > 0 ? '+' : ''}${vsPar})` : '—'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })()}

        {/* ── Scoreboard ── */}
        {snapshot && players.length > 0 && holeScores.length > 0 && (() => {
          const totalPar = snapshot.holes.reduce((s, h) => s + h.par, 0)
          const board = players.map(p => {
            const pScores = holeScores.filter(s => s.playerId === p.id)
            const gross = pScores.reduce((s, hs) => s + hs.grossScore, 0)
            const courseHcp = courseHcps[p.id] ?? 0
            const netStrokes = pScores.reduce((s, hs) => {
              const hole = snapshot.holes.find(h => h.number === hs.holeNumber)
              return s + (hole ? strokesOnHole(courseHcp, hole.strokeIndex) : 0)
            }, 0)
            const net = gross - netStrokes
            const vsPar = gross - totalPar
            return { player: p, gross, net, vsPar }
          })
          const bestGross = Math.min(...board.map(b => b.gross))
          const bestNet = Math.min(...board.map(b => b.net))

          return (
            <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scoreboard</p>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium">Player</th>
                      <th className="text-center py-2 px-2 font-medium"><Tooltip term="Gross">Gross</Tooltip></th>
                      <th className="text-center py-2 px-2 font-medium"><Tooltip term="Net">Net</Tooltip></th>
                      <th className="text-center py-2 px-2 font-medium">vs Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.sort((a, b) => a.net - b.net).map(({ player, gross, net, vsPar }) => (
                      <tr key={player.id} className="border-b border-gray-50">
                        <td className="py-2 px-2 font-semibold text-gray-800">{player.name}</td>
                        <td className={`py-2 px-2 text-center font-semibold ${gross === bestGross ? 'text-green-700' : 'text-gray-700'}`}>
                          {gross}{gross === bestGross ? ' *' : ''}
                        </td>
                        <td className={`py-2 px-2 text-center font-semibold ${net === bestNet ? 'text-green-700' : 'text-gray-700'}`}>
                          {net}{net === bestNet ? ' *' : ''}
                        </td>
                        <td className={`py-2 px-2 text-center font-semibold ${vsPar > 0 ? 'text-red-600' : vsPar < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                          {vsPar > 0 ? '+' : ''}{vsPar}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400">* Best score</p>
            </section>
          )
        })()}

        {/* ── Collapsible Game Results ── */}
        {skinsResult && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('skins')} className="w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🎰 Skins · {skinsResult.totalSkins} skin{skinsResult.totalSkins !== 1 ? 's' : ''}</span>
              <span className="text-gray-400 text-sm">{expandedSections.has('skins') ? '▾' : '▸'}</span>
            </button>
            {expandedSections.has('skins') && (
              <div className="px-4 pb-4 space-y-2">
                {skinsResult.totalSkins === 0 ? (
                  <p className="text-gray-500 text-sm">No skins won — all holes tied. Pot refunded.</p>
                ) : (
                  players.map(p => {
                    const skins = skinsResult.skinsWon[p.id] ?? 0
                    return (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${skins > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <span className="font-semibold text-gray-800">{p.name}</span>
                        <span className={`font-bold ${skins > 0 ? 'text-green-700' : 'text-gray-400'}`}>{skins} skin{skins !== 1 ? 's' : ''}</span>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </section>
        )}

        {bestBallResult && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('bestball')} className="w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🤝 Best Ball · {bestBallResult.winner === 'tie' ? 'Tied' : `Team ${bestBallResult.winner} Wins`}</span>
              <span className="text-gray-400 text-sm">{expandedSections.has('bestball') ? '▾' : '▸'}</span>
            </button>
            {expandedSections.has('bestball') && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-600 font-medium">Team A</p><p className="text-2xl font-bold text-blue-800">{bestBallResult.holesWon.A}</p><p className="text-xs text-blue-500">holes</p></div>
                  <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 font-medium">Tied</p><p className="text-2xl font-bold text-gray-600">{bestBallResult.holesWon.tied}</p><p className="text-xs text-gray-400">holes</p></div>
                  <div className="bg-orange-50 rounded-xl p-3"><p className="text-xs text-orange-600 font-medium">Team B</p><p className="text-2xl font-bold text-orange-800">{bestBallResult.holesWon.B}</p><p className="text-xs text-orange-500">holes</p></div>
                </div>
                {(() => {
                  const config = game.config as BestBallConfig
                  return (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {(['A', 'B'] as const).map(team => (
                        <div key={team} className={`rounded-xl p-3 ${team === 'A' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                          <p className={`text-xs font-bold mb-1 ${team === 'A' ? 'text-blue-700' : 'text-orange-700'}`}>Team {team}</p>
                          {players.filter(p => config.teams[p.id] === team).map(p => (<p key={p.id} className="text-gray-700">{p.name}</p>))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </section>
        )}

        {nassauResult && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('nassau')} className="w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🏳️ Nassau · {nassauResult.total.winner ? playerById(nassauResult.total.winner)?.name : 'In Progress'}</span>
              <span className="text-gray-400 text-sm">{expandedSections.has('nassau') ? '▾' : '▸'}</span>
            </button>
            {expandedSections.has('nassau') && (
              <div className="px-4 pb-4 space-y-3">
                {[
                  { label: `Front (${nassauResult.front.holeRange})`, seg: nassauResult.front },
                  { label: `Back (${nassauResult.back.holeRange})`, seg: nassauResult.back },
                  { label: `Total (${nassauResult.total.holeRange})`, seg: nassauResult.total },
                ].map(({ label, seg }) => {
                  const winner = seg.winner ? playerById(seg.winner) : null
                  const tiedNames = seg.tiedPlayers.map(id => playerById(id)?.name).filter(Boolean).join(', ')
                  return (
                    <div key={label} className={`rounded-xl p-3 ${seg.winner ? 'bg-teal-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-700 text-sm">{label}</p>
                        <p className={`font-bold text-sm ${seg.winner ? 'text-teal-700' : 'text-gray-400'}`}>
                          {seg.incomplete ? 'Incomplete' : seg.winner ? `🏆 ${winner?.name}` : tiedNames ? `Tied: ${tiedNames}` : '—'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {wolfResult && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('wolf')} className="w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🐺 Wolf · Net Units</span>
              <span className="text-gray-400 text-sm">{expandedSections.has('wolf') ? '▾' : '▸'}</span>
            </button>
            {expandedSections.has('wolf') && (
              <div className="px-4 pb-4 space-y-2">
                {players.slice().sort((a, b) => (wolfResult.netUnits[b.id] ?? 0) - (wolfResult.netUnits[a.id] ?? 0)).map(p => {
                  const units = wolfResult.netUnits[p.id] ?? 0
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${units > 0 ? 'bg-purple-50' : units < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      <span className={`font-bold ${units > 0 ? 'text-purple-700' : units < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {units > 0 ? `+${units}` : units} unit{Math.abs(units) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {bbbResult && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('bbb')} className="w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">⭐ BBB · {bbbResult.totalPoints} points</span>
              <span className="text-gray-400 text-sm">{expandedSections.has('bbb') ? '▾' : '▸'}</span>
            </button>
            {expandedSections.has('bbb') && (
              <div className="px-4 pb-4 space-y-2">
                {players.slice().sort((a, b) => (bbbResult.pointsWon[b.id] ?? 0) - (bbbResult.pointsWon[a.id] ?? 0)).map(p => {
                  const pts = bbbResult.pointsWon[p.id] ?? 0
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${pts > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      <span className={`font-bold ${pts > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{pts} point{pts !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {hammerResult && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('hammer')} className="w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🔨 Hammer · {hammerResult.totalHolesPlayed} holes</span>
              <span className="text-gray-400 text-sm">{expandedSections.has('hammer') ? '▾' : '▸'}</span>
            </button>
            {expandedSections.has('hammer') && (
              <div className="px-4 pb-4 space-y-2">
                {players.slice().sort((a, b) => (hammerResult.netCents[b.id] ?? 0) - (hammerResult.netCents[a.id] ?? 0)).map(p => {
                  const net = hammerResult.netCents[p.id] ?? 0
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${net > 0 ? 'bg-green-50' : net < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      <span className={`font-bold ${net > 0 ? 'text-green-700' : net < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {net > 0 ? '+' : ''}{fmt(Math.abs(net))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {junkResult && round?.junkConfig && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('junk')} className="w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🎲 Junks · {fmt(round.junkConfig.valueCents)}/junk</span>
              <span className="text-gray-400 text-sm">{expandedSections.has('junk') ? '▾' : '▸'}</span>
            </button>
            {expandedSections.has('junk') && (
              <div className="px-4 pb-4 space-y-2">
                {players.slice().sort((a, b) => (junkResult.netCents[b.id] ?? 0) - (junkResult.netCents[a.id] ?? 0)).map(p => {
                  const net = junkResult.netCents[p.id] ?? 0
                  const tallies = junkResult.tallies[p.id]
                  const junkDetails = tallies
                    ? round.junkConfig!.types.filter(jt => tallies[jt] > 0).map(jt => `${JUNK_LABELS[jt].emoji}${tallies[jt]}`).join(' ')
                    : ''
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${net > 0 ? 'bg-indigo-50' : net < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <div>
                        <span className="font-semibold text-gray-800">{p.name}</span>
                        {junkDetails && <span className="text-xs ml-2">{junkDetails}</span>}
                      </div>
                      <span className={`font-bold ${net > 0 ? 'text-indigo-700' : net < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {net === 0 ? fmt(0) : `${net > 0 ? '+' : ''}${fmt(Math.abs(net))}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {sideBets.filter(sb => sb.status === 'resolved').length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => toggleSection('sidebets')} className="w-full flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">💰 Side Bets · {sideBets.filter(sb => sb.status === 'resolved').length} resolved</span>
              <span className="text-gray-400 text-sm">{expandedSections.has('sidebets') ? '▾' : '▸'}</span>
            </button>
            {expandedSections.has('sidebets') && (
              <div className="px-4 pb-4 space-y-2">
                {sideBets.filter(sb => sb.status === 'resolved').map(bet => {
                  const winnerName = bet.winnerPlayerId ? playerById(bet.winnerPlayerId)?.name : '?'
                  const losers = bet.participants.filter(id => id !== bet.winnerPlayerId)
                  return (
                    <div key={bet.id} className="bg-amber-50 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{bet.description}</p>
                          <p className="text-xs text-gray-500">Hole {bet.holeNumber} · {fmt(bet.amountCents)}/loser</p>
                        </div>
                        <span className="text-sm font-bold text-amber-700">🏆 {winnerName}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {losers.map(id => playerById(id)?.name).join(', ')} → {winnerName}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Winners / Payouts ── */}
        {payouts.length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Winners</p>
            <div className="space-y-2">
              {payouts.map(payout => {
                const winner = playerById(payout.playerId)
                return (
                  <div key={payout.playerId} className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
                    <div><p className="font-bold text-gray-800">{winner?.name}</p><p className="text-xs text-gray-500">{payout.reason}</p></div>
                    <p className="text-2xl font-bold text-green-700">{fmt(payout.amountCents)}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Unified Settlements (game + junk) with Mark Paid ── */}
        {settlementRecords.length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Settlements</p>
                <p className="text-sm text-gray-500 mt-1">
                  {allSettled
                    ? <span className="text-green-600 font-semibold">All settled!</span>
                    : <span>{owedSettlements.length} remaining{paidSettlements.length > 0 ? ` · ${paidSettlements.length} paid` : ''}</span>
                  }
                </p>
              </div>
              {isTreasurer && (
                <button
                  onClick={async () => {
                    await supabase.from('settlements').delete().eq('round_id', roundId)
                    setSettlementRecords([])
                    setSettlementsInitialized(false)
                  }}
                  className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg font-semibold active:bg-gray-100"
                >
                  Recalculate
                </button>
              )}
            </div>
            {settlementRecords.map(s => {
              const fromPlayer = playerById(s.fromPlayerId)
              const toPlayer = playerById(s.toPlayerId)
              if (!fromPlayer || !toPlayer) return null
              const isPaid = s.status === 'paid'
              return (
                <div key={s.id} className={`space-y-2 p-3 rounded-xl ${isPaid ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setExpandedSettlement(expandedSettlement === s.id ? null : s.id)}
                        className="flex items-center gap-1 text-left"
                      >
                        <p className="font-bold text-gray-800">{fromPlayer.name} → {toPlayer.name}</p>
                        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${expandedSettlement === s.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        {s.reason && <p className="text-xs text-gray-500 truncate">{s.reason}</p>}
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                          s.source === 'side_bet' ? 'bg-amber-100 text-amber-700' : s.source === 'junk' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {s.source === 'side_bet' ? 'Side Bet' : s.source === 'junk' ? 'Junk' : 'Game'}
                        </span>
                      </div>
                      {!isPaid && (() => {
                        const pref = getPreferredPayment(toPlayer)
                        return pref ? (
                          <p className="text-xs text-blue-600 mt-0.5">Pay via {pref.method} {pref.handle}</p>
                        ) : null
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-2xl font-bold ${isPaid ? 'text-green-700' : 'text-gray-800'}`}>{fmt(s.amountCents)}</p>
                      {isTreasurer ? (
                        <button
                          onClick={() => toggleSettlementPaid(s)}
                          className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                            isPaid
                              ? 'bg-green-600 text-white active:bg-gray-800'
                              : 'bg-amber-100 text-amber-700 active:bg-amber-200'
                          }`}
                        >
                          {isPaid ? 'Paid' : 'Mark Paid'}
                        </button>
                      ) : (
                        <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                          {isPaid ? 'Paid' : 'Owed'}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isPoints && !isPaid && (
                    <PaymentButtons toPlayer={toPlayer} amountCents={s.amountCents} note={s.reason ?? 'settlement'} compact />
                  )}
                  {!isPoints && !isPaid && isTreasurer && (
                    <NudgeButton playerName={fromPlayer.name} amountCents={s.amountCents} toPlayer={toPlayer} />
                  )}
                  {expandedSettlement === s.id && s.reason && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-1 space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Breakdown</p>
                      {s.reason.split(/[,;]/).map((item, i) => {
                        const trimmed = item.trim()
                        if (!trimmed) return null
                        return (
                          <div key={i} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 pl-2">
                            <span>{trimmed}</span>
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-100 pl-2 pt-1 border-t border-gray-100 dark:border-gray-600">
                        <span>Total</span>
                        <span>{fmt(s.amountCents)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {treasurerId && payouts.some(p => p.playerId === treasurerId) && (() => {
          const keep = payouts.find(p => p.playerId === treasurerId)!
          return (
            <section className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="font-bold text-green-800">{treasurer?.name} keeps {fmt(keep.amountCents)}</p>
              <p className="text-sm text-green-700">{keep.reason} — taken from the pot directly</p>
            </section>
          )
        })()}

        {payouts.length === 0 && settlementRecords.length === 0 && (
          <section className="bg-gray-50 rounded-2xl p-4 text-center">
            <p className="text-gray-600 font-semibold">No winners calculated yet</p>
            <p className="text-gray-500 text-sm mt-1">Each player gets {fmt(game.buyInCents)} back from the treasurer.</p>
          </section>
        )}

        {/* ── Share Results ── */}
        {(() => {
          const totalPar = snapshot.holes.reduce((s, h) => s + h.par, 0)
          const shareBoard = players.map(p => {
            const pScores = holeScores.filter(s => s.playerId === p.id)
            const gross = pScores.reduce((s, hs) => s + hs.grossScore, 0)
            const courseHcp = courseHcps[p.id] ?? 0
            const netStrokes = pScores.reduce((s, hs) => {
              const hole = snapshot.holes.find(h => h.number === hs.holeNumber)
              return s + (hole ? strokesOnHole(courseHcp, hole.strokeIndex) : 0)
            }, 0)
            return { player: p, gross, net: gross - netStrokes, vsPar: gross - totalPar }
          }).sort((a, b) => a.net - b.net)

          const positions: number[] = []
          shareBoard.forEach((entry, idx) => {
            positions.push(idx === 0 ? 1 : entry.net === shareBoard[idx - 1].net ? positions[idx - 1] : idx + 1)
          })
          const leaderboard: ShareCardLeaderboardEntry[] = shareBoard.map((entry, idx) => ({
            pos: positions[idx], name: entry.player.name, gross: entry.gross, net: entry.net, vsPar: entry.vsPar,
          }))

          const gameResults: string[] = []
          if (skinsResult) {
            if (skinsResult.totalSkins === 0) {
              gameResults.push('Skins: All holes tied')
            } else {
              players.forEach(p => {
                const skins = skinsResult.skinsWon[p.id] ?? 0
                if (skins > 0) gameResults.push(`${p.name}: ${skins} skin${skins !== 1 ? 's' : ''}`)
              })
            }
          }
          if (bestBallResult) {
            const config = game.config as BestBallConfig
            const teamNames = (team: 'A' | 'B') => players.filter(p => config.teams[p.id] === team).map(p => p.name).join(' & ')
            gameResults.push(`Team A (${teamNames('A')}): ${bestBallResult.holesWon.A} holes`)
            gameResults.push(`Team B (${teamNames('B')}): ${bestBallResult.holesWon.B} holes`)
            gameResults.push(bestBallResult.winner === 'tie' ? 'Result: All Square' : `Winner: Team ${bestBallResult.winner}`)
          }
          if (nassauResult) {
            [{ l: 'Front', s: nassauResult.front }, { l: 'Back', s: nassauResult.back }, { l: 'Total', s: nassauResult.total }].forEach(({ l, s }) => {
              const winner = s.winner ? playerById(s.winner)?.name : null
              gameResults.push(`${l}: ${s.incomplete ? 'Incomplete' : winner ? winner : 'Tied'}`)
            })
          }
          if (wolfResult) {
            players.slice().sort((a, b) => (wolfResult.netUnits[b.id] ?? 0) - (wolfResult.netUnits[a.id] ?? 0)).forEach(p => {
              const u = wolfResult.netUnits[p.id] ?? 0
              gameResults.push(`${p.name}: ${u > 0 ? '+' : ''}${u} unit${Math.abs(u) !== 1 ? 's' : ''}`)
            })
          }
          if (bbbResult) {
            players.slice().sort((a, b) => (bbbResult.pointsWon[b.id] ?? 0) - (bbbResult.pointsWon[a.id] ?? 0)).forEach(p => {
              const pts = bbbResult.pointsWon[p.id] ?? 0
              gameResults.push(`${p.name}: ${pts} pt${pts !== 1 ? 's' : ''}`)
            })
          }
          if (hammerResult) {
            players.slice().sort((a, b) => (hammerResult.netCents[b.id] ?? 0) - (hammerResult.netCents[a.id] ?? 0)).forEach(p => {
              const net = hammerResult.netCents[p.id] ?? 0
              gameResults.push(`${p.name}: ${net > 0 ? '+' : ''}${fmt(Math.abs(net))}`)
            })
          }
          if (vegasResult) {
            gameResults.push(`Team A: ${vegasResult.netPoints.A} pts`)
            gameResults.push(`Team B: ${vegasResult.netPoints.B} pts`)
            gameResults.push(vegasResult.winner === 'tie' ? 'Result: Tied' : `Winner: Team ${vegasResult.winner}`)
          }
          if (stablefordResult) {
            players.slice().sort((a, b) => (stablefordResult.points[b.id] ?? 0) - (stablefordResult.points[a.id] ?? 0)).forEach(p => {
              gameResults.push(`${p.name}: ${stablefordResult.points[p.id] ?? 0} pts`)
            })
          }
          if (dotsResult) {
            players.slice().sort((a, b) => (dotsResult.netCents[b.id] ?? 0) - (dotsResult.netCents[a.id] ?? 0)).forEach(p => {
              const net = dotsResult.netCents[p.id] ?? 0
              gameResults.push(`${p.name}: ${net > 0 ? '+' : ''}${fmt(Math.abs(net))}`)
            })
          }
          if (bankerResult) {
            players.slice().sort((a, b) => (bankerResult.netCents[b.id] ?? 0) - (bankerResult.netCents[a.id] ?? 0)).forEach(p => {
              const net = bankerResult.netCents[p.id] ?? 0
              gameResults.push(`${p.name}: ${net > 0 ? '+' : ''}${fmt(Math.abs(net))}`)
            })
          }
          if (quotaResult) {
            players.slice().sort((a, b) => (quotaResult.netPoints[b.id] ?? 0) - (quotaResult.netPoints[a.id] ?? 0)).forEach(p => {
              const net = quotaResult.netPoints[p.id] ?? 0
              gameResults.push(`${p.name}: ${net > 0 ? '+' : ''}${net} (quota ${quotaResult.quotas[p.id] ?? 0})`)
            })
          }

          const sharePayouts: ShareCardPayout[] = payouts.map(p => ({
            name: playerById(p.playerId)?.name ?? 'Unknown',
            amountCents: p.amountCents,
            reason: p.reason,
          }))

          const dateStr = round.date.toISOString().slice(0, 10)
          const courseSafe = snapshot.courseName.replace(/[^a-z0-9]/gi, '-').toLowerCase()

          return (
            <>
              <button
                onClick={shareImage}
                disabled={sharing}
                className="w-full h-14 bg-emerald-600 text-white text-lg font-bold rounded-2xl active:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sharing ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                {sharing ? 'Creating image…' : 'Share Results'}
              </button>
              <div style={{ position: 'absolute', left: -9999, top: 0 }}>
                <ShareCard
                  ref={shareRef}
                  courseName={snapshot.courseName}
                  date={round.date}
                  gameLabel={gameLabel}
                  stakesMode={game.stakesMode}
                  leaderboard={leaderboard}
                  gameResults={gameResults}
                  payouts={sharePayouts}
                  totalPot={potCents > 0 ? potCents : null}
                />
              </div>
            </>
          )
        })()}
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 safe-bottom">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button onClick={onContinue} className="flex-1 h-14 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl active:bg-gray-50">← Back to Scores</button>
          <button onClick={onDone} className="flex-1 h-14 bg-gray-800 text-white text-lg font-bold rounded-2xl active:bg-gray-900 transition-colors">✓ Done</button>
        </div>
      </div>
    </div>
  )
}
