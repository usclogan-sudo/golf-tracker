import { useEffect, useMemo, useState } from 'react'
import { supabase, rowToRound, rowToRoundPlayer, rowToHoleScore, rowToEvent, rowToEventParticipant } from '../../lib/supabase'
import { buildCourseHandicaps, strokesOnHole, calculateSkins, calculateBestBall, calculateNassau, calculateWolf, calculateBBB, fmtMoney } from '../../lib/gameLogic'
import type { Round, RoundPlayer, HoleScore, GolfEvent, EventParticipant, SkinsConfig, BestBallConfig, NassauConfig, WolfConfig, Player } from '../../types'

interface Props {
  userId: string
  eventId: string
  onBack: () => void
}

export function EventLeaderboard({ userId, eventId, onBack }: Props) {
  const [event, setEvent] = useState<GolfEvent | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([])
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [eventParticipants, setEventParticipants] = useState<EventParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overall' | number>('overall')
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  // Load data
  useEffect(() => {
    supabase.from('events').select('*').eq('id', eventId).single().then(({ data }) => {
      if (!data) return
      const ev = rowToEvent(data)
      setEvent(ev)
      if (!ev.roundId) { setLoading(false); return }

      Promise.all([
        supabase.from('rounds').select('*').eq('id', ev.roundId).single(),
        supabase.from('round_players').select('*').eq('round_id', ev.roundId),
        supabase.from('hole_scores').select('*').eq('round_id', ev.roundId),
        supabase.from('event_participants').select('*').eq('event_id', eventId),
      ]).then(([roundRes, rpRes, hsRes, epRes]) => {
        if (roundRes.data) setRound(rowToRound(roundRes.data))
        if (rpRes.data) setRoundPlayers(rpRes.data.map(rowToRoundPlayer))
        if (hsRes.data) setHoleScores(hsRes.data.map(rowToHoleScore))
        if (epRes.data) setEventParticipants(epRes.data.map(rowToEventParticipant))
        setLoading(false)
      })
    })
  }, [eventId])

  // Realtime subscriptions for live score updates
  useEffect(() => {
    if (!round) return
    const channel = supabase
      .channel(`event-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores', filter: `round_id=eq.${round.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as any
          setHoleScores(prev => prev.some(s => s.id === row.id) ? prev : [...prev, rowToHoleScore(row)])
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as any
          setHoleScores(prev => prev.map(s => s.id === row.id ? rowToHoleScore(row) : s))
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as any
          setHoleScores(prev => prev.filter(s => s.id !== row.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [round?.id, eventId])

  // Presence channel for online indicators
  useEffect(() => {
    if (!event) return
    const presenceChannel = supabase.channel(`presence-event-${eventId}`)
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const userIds = new Set<string>()
        for (const entries of Object.values(state)) {
          for (const entry of entries as any[]) {
            if (entry.user_id) userIds.add(entry.user_id)
          }
        }
        setOnlineUsers(userIds)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: userId })
        }
      })

    return () => { supabase.removeChannel(presenceChannel) }
  }, [event?.id, userId])

  const players = round?.players ?? []
  const snapshot = round?.courseSnapshot
  const game = round?.game
  const groups = round?.groups

  // Only use approved scores for calculations
  const approvedScores = useMemo(() => {
    return holeScores.filter(s => s.scoreStatus !== 'rejected' && s.scoreStatus !== 'pending')
  }, [holeScores])

  const courseHcps = useMemo(() => {
    if (!snapshot || !roundPlayers) return {}
    return buildCourseHandicaps(players, roundPlayers, snapshot)
  }, [players, roundPlayers, snapshot])

  const groupNumbers = useMemo(() => {
    if (!groups) return [1]
    return [...new Set(Object.values(groups))].sort((a, b) => a - b)
  }, [groups])

  // Build leaderboard data
  const leaderboard = useMemo(() => {
    if (!snapshot) return []
    return players.map(p => {
      const pScores = approvedScores.filter(s => s.playerId === p.id)
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
      const groupNum = groups?.[p.id] ?? 1
      const participant = eventParticipants.find(ep => ep.playerId === p.id)
      const isOnline = participant ? onlineUsers.has(participant.userId) : false

      return { player: p, gross, net, vsPar, thru: pScores.length, groupNum, isOnline }
    }).sort((a, b) => a.net - b.net)
  }, [players, approvedScores, snapshot, courseHcps, groups, eventParticipants, onlineUsers])

  if (loading || !event || !round || !snapshot) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Loading leaderboard...</p>
      </div>
    )
  }

  const filteredLeaderboard = activeTab === 'overall'
    ? leaderboard
    : leaderboard.filter(e => e.groupNum === activeTab)

  // Compute positions
  const positions: number[] = []
  filteredLeaderboard.forEach((entry, idx) => {
    if (idx === 0) positions.push(1)
    else positions.push(entry.net === filteredLeaderboard[idx - 1].net ? positions[idx - 1] : idx + 1)
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-300">{snapshot.courseName}</p>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {event.name}
              <span className="inline-flex items-center gap-1 text-[10px] bg-green-500/30 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Live
              </span>
            </h1>
          </div>
          <button onClick={onBack} className="text-gray-300 text-sm font-medium px-3 min-h-[44px] rounded-lg hover:bg-gray-600">← Back</button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 sticky top-[4.5rem] z-[6]">
        <div className="max-w-2xl mx-auto flex gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overall')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
              activeTab === 'overall' ? 'bg-gray-800 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Overall
          </button>
          {groupNumbers.map(gn => (
            <button
              key={gn}
              onClick={() => setActiveTab(gn)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
                activeTab === gn ? 'bg-gray-800 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              Group {gn}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Players</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{filteredLeaderboard.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Online</p>
            <p className="text-xl font-bold text-green-600">{onlineUsers.size}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Hole</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{round.currentHole}</p>
          </div>
        </div>

        {/* Leaderboard table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-200 dark:border-gray-600">
                <th className="text-left py-2 px-1 font-medium w-8">Pos</th>
                <th className="text-left py-2 px-1 font-medium">Player</th>
                <th className="text-center py-2 px-1 font-medium">Thru</th>
                <th className="text-center py-2 px-1 font-medium">Gross</th>
                <th className="text-center py-2 px-1 font-medium">Net</th>
                <th className="text-center py-2 px-1 font-medium">vs Par</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaderboard.map((entry, idx) => (
                <tr key={entry.player.id} className={`border-b border-gray-50 dark:border-gray-700 ${positions[idx] === 1 ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                  <td className={`py-2.5 px-1 font-bold ${positions[idx] === 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {positions[idx]}
                  </td>
                  <td className="py-2.5 px-1">
                    <div className="flex items-center gap-1.5">
                      {entry.isOnline && (
                        <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                      )}
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{entry.player.name}</span>
                      {activeTab === 'overall' && groupNumbers.length > 1 && (
                        <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300">G{entry.groupNum}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-1 text-center text-gray-500">{entry.thru}</td>
                  <td className="py-2.5 px-1 text-center font-semibold text-gray-700 dark:text-gray-300">{entry.gross || '—'}</td>
                  <td className="py-2.5 px-1 text-center font-semibold text-gray-700 dark:text-gray-300">{entry.net || '—'}</td>
                  <td className={`py-2.5 px-1 text-center font-semibold ${entry.vsPar > 0 ? 'text-red-600' : entry.vsPar < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {entry.thru > 0 ? `${entry.vsPar > 0 ? '+' : ''}${entry.vsPar}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pending scores notice */}
        {holeScores.some(s => s.scoreStatus === 'pending') && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <p className="text-yellow-800 text-sm font-semibold">
              {holeScores.filter(s => s.scoreStatus === 'pending').length} pending score{holeScores.filter(s => s.scoreStatus === 'pending').length !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
        )}

        {/* Game info */}
        {game && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Game</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {game.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} · {fmtMoney(game.buyInCents)}/player · Pot {fmtMoney(game.buyInCents * players.length)}
            </p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 safe-bottom">
        <div className="max-w-2xl mx-auto">
          <button onClick={onBack} className="w-full h-14 bg-gray-800 text-white text-lg font-bold rounded-2xl active:bg-gray-900">← Back to Scorecard</button>
        </div>
      </div>
    </div>
  )
}
