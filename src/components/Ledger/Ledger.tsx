import { useEffect, useState } from 'react'
import { supabase, rowToSettlementRecord, rowToRound } from '../../lib/supabase'
import { PaymentButtons } from '../PaymentButtons'
import { fmtMoney } from '../../lib/gameLogic'
import type { SettlementRecord, Round, Player } from '../../types'

interface Props {
  userId: string
  onBack: () => void
}

interface OpponentBalance {
  playerId: string
  playerName: string
  /** Positive = they owe you, negative = you owe them */
  netCents: number
  /** Breakdown per round */
  rounds: {
    roundId: string
    courseName: string
    date: string
    amountCents: number // positive = they owe you
    settlements: SettlementRecord[]
  }[]
  /** Player snapshot for payment buttons */
  player: Player | null
}

export function Ledger({ userId, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<OpponentBalance[]>([])
  const [expandedOpponent, setExpandedOpponent] = useState<string | null>(null)
  const [markingSettled, setMarkingSettled] = useState<string | null>(null)

  useEffect(() => {
    loadLedger()
  }, [])

  async function loadLedger() {
    setLoading(true)

    // Fetch all settlements + rounds
    const [settlRes, roundsRes] = await Promise.all([
      supabase.from('settlements').select('*'),
      supabase.from('rounds').select('*').eq('status', 'complete'),
    ])

    const settlements = (settlRes.data ?? []).map(rowToSettlementRecord)
    const rounds = (roundsRes.data ?? []).map(rowToRound)
    const roundMap = new Map<string, Round>()
    rounds.forEach(r => roundMap.set(r.id, r))

    // Build a player map from all round snapshots
    const playerMap = new Map<string, Player>()
    for (const r of rounds) {
      for (const p of r.players ?? []) {
        playerMap.set(p.id, p)
      }
    }

    // Build net balance per opponent across all rounds
    // We need to find which playerId represents the current user in each round
    // The userId may appear as a playerId directly (for profile-based players)
    // or we need to check round_participants
    const userPlayerIds = new Set<string>()
    userPlayerIds.add(userId) // Often the user's profile id IS their playerId

    // Also check round_participants for mapped playerIds
    const { data: partData } = await supabase.from('round_participants').select('player_id').eq('user_id', userId)
    if (partData) {
      for (const p of partData) userPlayerIds.add(p.player_id)
    }

    // Aggregate by opponent
    const opponentMap = new Map<string, { netCents: number; rounds: Map<string, { amountCents: number; settlements: SettlementRecord[] }> }>()

    for (const s of settlements) {
      const round = roundMap.get(s.roundId)
      if (!round) continue

      const isFrom = userPlayerIds.has(s.fromPlayerId)
      const isTo = userPlayerIds.has(s.toPlayerId)
      if (!isFrom && !isTo) continue
      if (isFrom && isTo) continue // Self-settlement

      const opponentId = isFrom ? s.toPlayerId : s.fromPlayerId
      // Positive = they owe us (we're the "to"), negative = we owe them (we're the "from")
      const sign = isTo ? 1 : -1
      const amount = s.status === 'paid' ? 0 : sign * s.amountCents

      if (!opponentMap.has(opponentId)) {
        opponentMap.set(opponentId, { netCents: 0, rounds: new Map() })
      }
      const opp = opponentMap.get(opponentId)!
      opp.netCents += amount

      const roundKey = s.roundId
      if (!opp.rounds.has(roundKey)) {
        opp.rounds.set(roundKey, { amountCents: 0, settlements: [] })
      }
      const roundEntry = opp.rounds.get(roundKey)!
      roundEntry.amountCents += amount
      roundEntry.settlements.push(s)
    }

    // Convert to array
    const result: OpponentBalance[] = []
    for (const [oppId, data] of opponentMap) {
      const player = playerMap.get(oppId) ?? null
      const playerName = player?.name ?? oppId.slice(0, 8)

      const roundEntries = Array.from(data.rounds.entries()).map(([roundId, entry]) => {
        const round = roundMap.get(roundId)
        return {
          roundId,
          courseName: round?.courseSnapshot?.courseName ?? 'Unknown course',
          date: round?.date ? new Date(round.date).toLocaleDateString() : '—',
          amountCents: entry.amountCents,
          settlements: entry.settlements,
        }
      }).sort((a, b) => b.date.localeCompare(a.date))

      result.push({
        playerId: oppId,
        playerName,
        netCents: data.netCents,
        rounds: roundEntries,
        player,
      })
    }

    // Sort by absolute balance descending
    result.sort((a, b) => Math.abs(b.netCents) - Math.abs(a.netCents))
    // Filter out zero balances
    setBalances(result.filter(b => b.netCents !== 0))
    setLoading(false)
  }

  const markAllSettled = async (opponentId: string) => {
    setMarkingSettled(opponentId)
    const opponent = balances.find(b => b.playerId === opponentId)
    if (!opponent) return

    // Mark all owed settlements for this opponent as paid
    const settlementIds: string[] = []
    for (const r of opponent.rounds) {
      for (const s of r.settlements) {
        if (s.status === 'owed') settlementIds.push(s.id)
      }
    }

    if (settlementIds.length > 0) {
      await supabase.from('settlements').update({ status: 'paid', paid_at: new Date().toISOString() }).in('id', settlementIds)
    }

    // Reload
    await loadLedger()
    setMarkingSettled(null)
  }

  const totalOwedToYou = balances.filter(b => b.netCents > 0).reduce((s, b) => s + b.netCents, 0)
  const totalYouOwe = balances.filter(b => b.netCents < 0).reduce((s, b) => s + Math.abs(b.netCents), 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-28">
      <header className="app-header text-white px-4 py-5 sticky top-0 z-10 shadow-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-black/20 text-xl">←</button>
          <div>
            <h1 className="text-2xl font-bold">Ledger</h1>
            <p className="text-gray-300 text-sm">Cross-round balances</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : balances.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center">
            <p className="text-3xl mb-2">🤝</p>
            <p className="font-semibold text-gray-800 dark:text-gray-100">All square!</p>
            <p className="text-sm text-gray-500 mt-1">No outstanding balances across your rounds.</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-center">
                <p className="text-xs text-green-600 dark:text-green-400 font-semibold uppercase">Owed to you</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{fmtMoney(totalOwedToYou)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 text-center">
                <p className="text-xs text-red-600 dark:text-red-400 font-semibold uppercase">You owe</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{fmtMoney(totalYouOwe)}</p>
              </div>
            </div>

            {/* Opponent list */}
            <div className="space-y-3">
              {balances.map(b => {
                const isExpanded = expandedOpponent === b.playerId
                const owedToYou = b.netCents > 0
                return (
                  <div key={b.playerId} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpandedOpponent(isExpanded ? null : b.playerId)}
                      className="w-full p-4 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
                    >
                      <div className="text-left">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{b.playerName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{b.rounds.length} round{b.rounds.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`text-lg font-bold ${owedToYou ? 'text-green-600' : 'text-red-600'}`}>
                            {owedToYou ? '+' : '-'}{fmtMoney(Math.abs(b.netCents))}
                          </p>
                          <p className={`text-xs ${owedToYou ? 'text-green-500' : 'text-red-500'}`}>
                            {owedToYou ? 'they owe you' : 'you owe'}
                          </p>
                        </div>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 space-y-3">
                        {/* Round breakdown */}
                        <div className="pt-3 space-y-2">
                          {b.rounds.map(r => (
                            <div key={r.roundId} className={`flex items-center justify-between p-3 rounded-xl ${r.amountCents > 0 ? 'bg-green-50 dark:bg-green-900/20' : r.amountCents < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{r.courseName}</p>
                                <p className="text-xs text-gray-500">{r.date}</p>
                              </div>
                              <p className={`font-bold text-sm ${r.amountCents > 0 ? 'text-green-600' : r.amountCents < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                {r.amountCents > 0 ? '+' : ''}{fmtMoney(r.amountCents === 0 ? 0 : Math.abs(r.amountCents))}
                                {r.amountCents < 0 && <span className="text-xs font-normal ml-0.5">owed</span>}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Payment buttons if you owe them */}
                        {!owedToYou && b.player && (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Pay {b.playerName}</p>
                            <PaymentButtons toPlayer={b.player} amountCents={Math.abs(b.netCents)} note="Golf ledger balance" />
                          </div>
                        )}

                        {/* Mark all settled */}
                        <button
                          onClick={() => markAllSettled(b.playerId)}
                          disabled={markingSettled === b.playerId}
                          className="w-full h-12 bg-gray-800 dark:bg-gray-600 text-white font-semibold rounded-xl active:bg-gray-900 disabled:opacity-50 transition-colors"
                        >
                          {markingSettled === b.playerId ? 'Settling...' : 'Mark All Settled'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 safe-bottom">
        <div className="max-w-2xl mx-auto">
          <button onClick={onBack} className="w-full h-14 bg-gray-800 text-white text-lg font-bold rounded-2xl active:bg-gray-900">← Back</button>
        </div>
      </div>
    </div>
  )
}
