import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { RoundParticipant } from '../../types'

interface RoundPreview {
  id: string
  courseName: string
  gameType: string
  players: { id: string; name: string }[]
  participants: { id: string; userId: string; playerId: string }[]
  currentHole: number
}

interface EventPreview {
  id: string
  name: string
  roundId: string
  courseName: string
  gameType: string
  players: { id: string; name: string }[]
  groups?: Record<string, number>
  participants: { id: string; userId: string; playerId: string; role: string; groupNumber?: number }[]
  groupScorekeepers: Record<number, string>
  currentHole: number
}

interface Props {
  userId: string
  initialCode?: string
  onJoined: (roundId: string) => void
  onCancel: () => void
}

export function JoinRound({ userId, initialCode, onJoined, onCancel }: Props) {
  const [code, setCode] = useState(initialCode ?? '')
  const [step, setStep] = useState<'code' | 'pick'>(initialCode ? 'code' : 'code')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<RoundPreview | null>(null)
  const [eventPreview, setEventPreview] = useState<EventPreview | null>(null)
  const [joining, setJoining] = useState(false)

  // Auto-lookup if initialCode provided
  useEffect(() => {
    if (initialCode) lookupRound(initialCode)
  }, [initialCode])

  const lookupRound = async (inviteCode: string) => {
    setLoading(true)
    setError(null)
    setPreview(null)
    setEventPreview(null)
    try {
      // Try event lookup first
      const { data: eventData, error: eventErr } = await supabase.rpc('get_event_by_invite', {
        p_invite_code: inviteCode.toUpperCase().trim(),
      })

      if (eventData && !eventErr) {
        const ed = eventData as any
        const roundData = ed.round ?? {}
        setEventPreview({
          id: ed.id,
          name: ed.name,
          roundId: roundData.id,
          courseName: roundData.course_snapshot?.courseName ?? 'Unknown Course',
          gameType: roundData.game?.type ?? 'Unknown',
          players: (roundData.players ?? []).map((p: any) => ({ id: p.id, name: p.name })),
          groups: roundData.groups ?? undefined,
          participants: (ed.participants ?? []).map((p: any) => ({
            id: p.id,
            userId: p.user_id,
            playerId: p.player_id,
            role: p.role,
            groupNumber: p.group_number,
          })),
          groupScorekeepers: ed.group_scorekeepers ?? {},
          currentHole: roundData.current_hole ?? 1,
        })
        setStep('pick')
        return
      }

      // Fall back to regular round lookup
      const { data, error: rpcError } = await supabase.rpc('get_round_by_invite', {
        p_invite_code: inviteCode.toUpperCase().trim(),
      })
      if (rpcError) throw rpcError
      if (!data) throw new Error('Round not found')

      const roundData = data as any
      setPreview({
        id: roundData.id,
        courseName: roundData.course_snapshot?.courseName ?? 'Unknown Course',
        gameType: roundData.game?.type ?? 'Unknown',
        players: (roundData.players ?? []).map((p: any) => ({ id: p.id, name: p.name })),
        participants: (roundData.participants ?? []).map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          playerId: p.player_id,
        })),
        currentHole: roundData.current_hole ?? 1,
      })
      setStep('pick')
    } catch (err: any) {
      setError(err.message?.includes('not found') || err.message?.includes('no longer active')
        ? 'Invalid or expired invite code'
        : err.message ?? 'Failed to look up round')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (playerId: string) => {
    if (!preview && !eventPreview) return
    setJoining(true)
    setError(null)
    try {
      if (eventPreview) {
        // Join event
        const { data, error: rpcError } = await supabase.rpc('join_event', {
          p_invite_code: code.toUpperCase().trim(),
          p_player_id: playerId,
        })
        if (rpcError) throw rpcError
        onJoined(eventPreview.roundId)
      } else if (preview) {
        // Join regular round
        const { data, error: rpcError } = await supabase.rpc('join_round', {
          p_invite_code: code.toUpperCase().trim(),
          p_player_id: playerId,
        })
        if (rpcError) throw rpcError
        onJoined(preview.id)
      }
    } catch (err: any) {
      setError(err.message?.includes('already claimed')
        ? 'This player is already claimed by another user'
        : err.message ?? 'Failed to join')
      setJoining(false)
    }
  }

  const activePreview = eventPreview ?? preview
  const activePlayers = eventPreview?.players ?? preview?.players ?? []
  const activeParticipants = eventPreview?.participants ?? preview?.participants ?? []

  const isPlayerClaimed = (playerId: string) => {
    return activeParticipants.some((p: any) => p.playerId === playerId && p.userId !== userId)
  }

  const isAlreadyJoined = activeParticipants.some((p: any) => p.userId === userId)

  const GAME_LABELS: Record<string, string> = {
    skins: 'Skins',
    best_ball: 'Best Ball',
    nassau: 'Nassau',
    wolf: 'Wolf',
    bingo_bango_bongo: 'BBB',
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex flex-col">
      <header className="app-header text-white px-4 py-3 shadow-xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold font-display">Join Round</h1>
          <button onClick={onCancel} className="text-gray-300 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-600">
            Cancel
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6">
        {step === 'code' && !preview && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-2">🔗</p>
              <h2 className="font-display font-bold text-xl text-gray-900">Enter Invite Code</h2>
              <p className="text-sm text-gray-500 mt-1">Get the 6-character code from the scoremaster</p>
            </div>

            <input
              type="text"
              maxLength={6}
              placeholder="ABC123"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && lookupRound(code)}
              className="w-full h-14 px-4 text-center text-2xl font-mono font-bold tracking-[0.3em] rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
              autoFocus
            />

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              onClick={() => lookupRound(code)}
              disabled={code.length !== 6 || loading}
              className="w-full h-14 bg-gray-800 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-40 active:bg-gray-900 transition-colors"
            >
              {loading ? 'Looking up...' : 'Find Round'}
            </button>
          </div>
        )}

        {step === 'pick' && activePreview && (
          <div className="space-y-4">
            {/* Preview card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                {eventPreview ? 'Event Found' : 'Round Found'}
              </p>
              {eventPreview && (
                <h2 className="font-display font-bold text-xl text-gray-900 dark:text-gray-100 mt-1">{eventPreview.name}</h2>
              )}
              <p className={`${eventPreview ? 'text-gray-600 dark:text-gray-400 text-sm mt-0.5' : 'font-display font-bold text-xl text-gray-900 dark:text-gray-100 mt-1'}`}>
                {eventPreview?.courseName ?? preview?.courseName}
              </p>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span>{GAME_LABELS[(eventPreview?.gameType ?? preview?.gameType) ?? ''] ?? (eventPreview?.gameType ?? preview?.gameType)}</span>
                <span>·</span>
                <span>{activePlayers.length} players</span>
                {eventPreview && eventPreview.groups && (
                  <>
                    <span>·</span>
                    <span>{new Set(Object.values(eventPreview.groups)).size} groups</span>
                  </>
                )}
                <span>·</span>
                <span>Hole {eventPreview?.currentHole ?? preview?.currentHole}</span>
              </div>
            </div>

            {/* Player picker */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-3">
              <h3 className="font-display font-semibold text-gray-800 dark:text-gray-100">Which player are you?</h3>

              {isAlreadyJoined && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-800 dark:text-green-400">
                  You've already joined! Tap your name to continue.
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="space-y-2">
                {activePlayers.map(player => {
                  const claimed = isPlayerClaimed(player.id)
                  const isMine = activeParticipants.some((p: any) => p.playerId === player.id && p.userId === userId)
                  const groupNum = eventPreview?.groups?.[player.id]
                  return (
                    <button
                      key={player.id}
                      onClick={() => handleJoin(player.id)}
                      disabled={claimed || joining}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between ${
                        isMine
                          ? 'bg-amber-50 border-amber-300 active:bg-amber-100'
                          : claimed
                            ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                            : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 active:bg-gray-50'
                      }`}
                    >
                      <div>
                        <p className={`font-semibold ${claimed ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                          {player.name}
                          {groupNum && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300">G{groupNum}</span>}
                        </p>
                        {claimed && <p className="text-xs text-gray-400">Already claimed</p>}
                        {isMine && <p className="text-xs text-amber-600 font-medium">Your player</p>}
                      </div>
                      {!claimed && (
                        <span className={`text-sm font-semibold ${isMine ? 'text-amber-600' : 'text-gray-400'}`}>
                          {isMine ? 'Continue →' : 'Join as →'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => { setStep('code'); setPreview(null); setError(null) }}
              className="w-full text-center text-sm text-gray-500 py-2"
            >
              ← Enter a different code
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
