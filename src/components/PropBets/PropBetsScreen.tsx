import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, rowToPropBet, propBetToRow, rowToPropWager, propWagerToRow, rowToRound } from '../../lib/supabase'
import { fmtMoney } from '../../lib/gameLogic'
import { PropBetCard } from '../Scorecard/PropBetCard'
import { PropPoolBar } from './PropPoolBar'
import { CreateSkillPropForm } from './CreateSkillPropForm'
import { applyPropBetPayload, applyPropWagerPayload } from '../../lib/realtimeReducers'
import type { PropBet, PropWager, Player, Round } from '../../types'

interface Props {
  roundId: string
  userId: string
  onBack: () => void
}

export function PropBetsScreen({ roundId, userId, onBack }: Props) {
  const [propBets, setPropBets] = useState<PropBet[]>([])
  const [propWagers, setPropWagers] = useState<PropWager[]>([])
  const [round, setRound] = useState<Round | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<'active' | 'resolved'>('active')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [myPlayerId, setMyPlayerId] = useState<string | undefined>()

  useEffect(() => {
    Promise.all([
      supabase.from('prop_bets').select('*').eq('round_id', roundId),
      supabase.from('prop_wagers').select('*').eq('round_id', roundId),
      supabase.from('rounds').select('*').eq('id', roundId).single(),
      supabase.from('round_participants').select('*').eq('round_id', roundId),
    ]).then(([pbRes, pwRes, roundRes, partRes]) => {
      if (roundRes.error || !roundRes.data) {
        setLoadError(true)
        setLoading(false)
        return
      }
      if (pbRes.data) setPropBets(pbRes.data.map(rowToPropBet))
      if (pwRes.data) setPropWagers(pwRes.data.map(rowToPropWager))
      const r = rowToRound(roundRes.data)
      setRound(r)
      setPlayers(r.players ?? [])
      if (partRes.data) {
        const myPart = (partRes.data as any[]).find((rp: any) => rp.user_id === userId)
        if (myPart) setMyPlayerId(myPart.player_id)
      }
      setLoading(false)
    }).catch(() => {
      setLoadError(true)
      setLoading(false)
    })
  }, [roundId, userId])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`props-${roundId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prop_bets', filter: `round_id=eq.${roundId}` }, (payload) => {
        setPropBets(prev => applyPropBetPayload(prev, payload as any))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prop_wagers', filter: `round_id=eq.${roundId}` }, (payload) => {
        setPropWagers(prev => applyPropWagerPayload(prev, payload as any))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roundId])

  const activeProps = propBets.filter(pb => pb.status === 'open' || pb.status === 'locked')
  const resolvedProps = propBets.filter(pb => pb.status === 'resolved' || pb.status === 'voided')
  const displayProps = tab === 'active' ? activeProps : resolvedProps

  // Group by category
  const quickProps = displayProps.filter(p => p.category === 'quick')
  const skillProps = displayProps.filter(p => p.category === 'skill')
  const h2hProps = displayProps.filter(p => p.category === 'h2h')

  const createSkillProp = async (propData: Omit<PropBet, 'id' | 'userId' | 'createdAt'>) => {
    if (!myPlayerId) return
    const propId = uuidv4()
    const wagerId = uuidv4()
    const newProp: PropBet = { ...propData, id: propId, userId, createdAt: new Date() }
    const creatorWager: PropWager = {
      id: wagerId,
      propBetId: propId,
      roundId,
      playerId: myPlayerId,
      userId,
      outcomeId: newProp.outcomes[0]?.id ?? 'over',
      amountCents: newProp.stakeCents,
      createdAt: new Date(),
    }

    setPropBets(prev => [...prev, newProp])
    setPropWagers(prev => [...prev, creatorWager])
    setShowCreateForm(false)

    const { error: propErr } = await supabase.from('prop_bets').insert(propBetToRow(newProp, userId))
    if (propErr) {
      console.error('Failed to create skill prop:', propErr)
      setPropBets(prev => prev.filter(p => p.id !== propId))
      setPropWagers(prev => prev.filter(w => w.id !== wagerId))
      return
    }
    const { error: wagerErr } = await supabase.from('prop_wagers').insert(propWagerToRow(creatorWager, userId))
    if (wagerErr) console.error('Failed to create creator wager:', wagerErr)
  }

  const acceptProp = async (propId: string, outcomeId: string): Promise<boolean> => {
    if (!myPlayerId) return false
    const prop = propBets.find(p => p.id === propId)
    if (!prop || prop.status !== 'open') return false
    if (propWagers.some(w => w.propBetId === propId && w.playerId === myPlayerId)) return false
    if (prop.creatorId === myPlayerId) return false

    const wager: PropWager = {
      id: uuidv4(),
      propBetId: propId,
      roundId,
      playerId: myPlayerId,
      userId,
      outcomeId,
      amountCents: prop.stakeCents,
      createdAt: new Date(),
    }
    setPropWagers(prev => [...prev, wager])
    const { error } = await supabase.from('prop_wagers').insert(propWagerToRow(wager, userId))
    if (error) {
      console.error('Failed to accept prop:', error)
      setPropWagers(prev => prev.filter(w => w.id !== wager.id))
      return false
    }
    return true
  }

  const resolveProp = async (propId: string, outcomeId: string): Promise<boolean> => {
    const prop = propBets.find(p => p.id === propId)
    if (!prop || prop.status !== 'open') return false
    if (prop.creatorId !== myPlayerId) return false

    const prev = prop.status
    setPropBets(ps => ps.map(pb => pb.id === propId ? { ...pb, status: 'resolved' as const, winningOutcomeId: outcomeId, resolvedAt: new Date() } : pb))
    const { error, count } = await supabase.from('prop_bets')
      .update({ status: 'resolved', winning_outcome_id: outcomeId, resolved_at: new Date().toISOString() })
      .eq('id', propId)
      .eq('status', 'open')
    if (error || count === 0) {
      console.error('Failed to resolve prop:', error)
      setPropBets(ps => ps.map(pb => pb.id === propId ? { ...pb, status: prev } : pb))
      return false
    }
    return true
  }

  const cancelProp = async (propId: string): Promise<boolean> => {
    const prop = propBets.find(p => p.id === propId)
    if (!prop || prop.status !== 'open') return false
    if (prop.creatorId !== myPlayerId) return false

    setPropBets(ps => ps.map(pb => pb.id === propId ? { ...pb, status: 'voided' as const } : pb))
    const { error, count } = await supabase.from('prop_bets')
      .update({ status: 'voided' })
      .eq('id', propId)
      .eq('status', 'open')
    if (error || count === 0) {
      console.error('Failed to void prop:', error)
      setPropBets(ps => ps.map(pb => pb.id === propId ? { ...pb, status: 'open' as const } : pb))
      return false
    }
    return true
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500">Failed to load props</p>
        <button onClick={onBack} className="px-4 py-2 bg-purple-500 text-white rounded-xl font-bold">Go Back</button>
      </div>
    )
  }

  const renderSection = (title: string, props: PropBet[]) => {
    if (props.length === 0) return null
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
        {props.map(prop => (
          <div key={prop.id} className="space-y-1">
            <PropBetCard
              prop={prop}
              wagers={propWagers}
              players={players}
              currentPlayerId={myPlayerId}
              onAccept={acceptProp}
              onResolve={resolveProp}
              onCancel={cancelProp}
            />
            {prop.wagerModel === 'pool' && (
              <PropPoolBar prop={prop} wagers={propWagers} />
            )}
          </div>
        ))}
      </div>
    )
  }

  // P&L summary for resolved tab
  const myResolvedPnl = (() => {
    if (!myPlayerId || tab !== 'resolved') return null
    let totalWon = 0
    let totalLost = 0
    for (const prop of resolvedProps) {
      if (prop.status !== 'resolved') continue
      const myWagers = propWagers.filter(w => w.propBetId === prop.id && w.playerId === myPlayerId)
      for (const w of myWagers) {
        if (w.outcomeId === prop.winningOutcomeId) {
          totalWon += w.amountCents
        } else {
          totalLost += w.amountCents
        }
      }
    }
    const net = totalWon - totalLost
    return { totalWon, totalLost, net }
  })()

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-500 font-semibold">&larr; Back</button>
        <h2 className="font-display font-bold text-gray-800 dark:text-gray-100 text-lg">Props</h2>
        <div className="w-12" />
      </div>

      {/* Round info */}
      {round && (
        <p className="text-xs text-gray-400 text-center">
          {round.courseSnapshot?.courseName} — Hole {round.currentHole}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-2 text-sm font-bold rounded-xl ${tab === 'active' ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
        >
          Active ({activeProps.length})
        </button>
        <button
          onClick={() => setTab('resolved')}
          className={`flex-1 py-2 text-sm font-bold rounded-xl ${tab === 'resolved' ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
        >
          Resolved ({resolvedProps.length})
        </button>
      </div>

      {/* P&L summary */}
      {myResolvedPnl && (
        <div className={`rounded-xl p-3 text-center ${myResolvedPnl.net >= 0 ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
          <p className={`text-lg font-bold ${myResolvedPnl.net >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
            {myResolvedPnl.net >= 0 ? '+' : ''}{fmtMoney(myResolvedPnl.net)}
          </p>
          <p className="text-xs text-gray-500">Won {fmtMoney(myResolvedPnl.totalWon)} / Lost {fmtMoney(myResolvedPnl.totalLost)}</p>
        </div>
      )}

      {/* Props list */}
      <div className="space-y-4">
        {renderSection('Quick Props', quickProps)}
        {renderSection('Skill Props', skillProps)}
        {renderSection('Head to Head', h2hProps)}
        {displayProps.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            {tab === 'active' ? 'No active props' : 'No resolved props yet'}
          </p>
        )}
      </div>

      {/* Create Skill Prop form */}
      {showCreateForm && myPlayerId && (
        <CreateSkillPropForm
          players={players}
          roundId={roundId}
          creatorId={myPlayerId}
          onCreateProp={createSkillProp}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* FAB */}
      {!showCreateForm && tab === 'active' && myPlayerId && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl font-bold active:bg-purple-700 z-50"
        >
          +
        </button>
      )}
    </div>
  )
}
