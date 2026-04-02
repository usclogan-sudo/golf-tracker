import { useState } from 'react'
import { fmtMoney } from '../../lib/gameLogic'
import type { PropBet, PropWager, Player } from '../../types'

interface Props {
  prop: PropBet
  wagers: PropWager[]
  players: Player[]
  currentPlayerId?: string
  onAccept?: (propId: string, outcomeId: string) => Promise<boolean>
  onResolve?: (propId: string, outcomeId: string) => Promise<boolean>
  onCancel?: (propId: string) => Promise<boolean>
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  locked: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-blue-100 text-blue-700',
  voided: 'bg-gray-100 text-gray-500',
}

export function PropBetCard({ prop, wagers, players, currentPlayerId, onAccept, onResolve, onCancel }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmResolve, setConfirmResolve] = useState<string | null>(null) // outcomeId pending confirm

  const creator = players.find(p => p.id === prop.creatorId)
  const isCreator = currentPlayerId != null && currentPlayerId === prop.creatorId
  const propWagers = wagers.filter(w => w.propBetId === prop.id)
  const hasAccepted = currentPlayerId != null && propWagers.some(w => w.playerId === currentPlayerId && w.playerId !== prop.creatorId)
  const acceptorCount = propWagers.filter(w => w.playerId !== prop.creatorId).length
  const winningOutcome = prop.outcomes.find(o => o.id === prop.winningOutcomeId)
  const hasWagers = propWagers.length > (isCreator ? 1 : 0) // creator auto-wagers, so need at least 1 acceptor

  // Pool totals per outcome
  const poolByOutcome: Record<string, number> = {}
  for (const w of propWagers) {
    poolByOutcome[w.outcomeId] = (poolByOutcome[w.outcomeId] ?? 0) + w.amountCents
  }
  const totalPool = Object.values(poolByOutcome).reduce((s, v) => s + v, 0)

  const handleAccept = async (outcomeId: string) => {
    if (busy || !onAccept) return
    setError(null)
    setBusy(true)
    try {
      const ok = await onAccept(prop.id, outcomeId)
      if (!ok) setError('Failed to accept')
    } catch {
      setError('Failed to accept')
    }
    setBusy(false)
  }

  const handleResolve = async (outcomeId: string) => {
    // Require confirmation tap
    if (confirmResolve !== outcomeId) {
      setConfirmResolve(outcomeId)
      return
    }
    if (busy || !onResolve) return
    setError(null)
    setBusy(true)
    setConfirmResolve(null)
    try {
      const ok = await onResolve(prop.id, outcomeId)
      if (!ok) setError('Failed to resolve')
    } catch {
      setError('Failed to resolve')
    }
    setBusy(false)
  }

  const handleCancel = async () => {
    if (busy || !onCancel) return
    setError(null)
    setBusy(true)
    try {
      const ok = await onCancel(prop.id)
      if (!ok) setError('Failed to cancel')
    } catch {
      setError('Failed to cancel')
    }
    setBusy(false)
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">{prop.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">{creator?.name ?? 'Unknown'}</span>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{fmtMoney(prop.stakeCents)}</span>
            {prop.wagerModel === 'pool' && (
              <span className="text-xs text-purple-600">Pool</span>
            )}
            {prop.wagerModel === 'challenge' && acceptorCount > 0 && (
              <span className="text-xs text-gray-500">{acceptorCount} in</span>
            )}
            {prop.resolveType === 'auto' && (
              <span className="text-xs text-blue-500">Auto</span>
            )}
          </div>
        </div>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_STYLES[prop.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {prop.status.charAt(0).toUpperCase() + prop.status.slice(1)}
        </span>
      </div>

      {/* Resolved: show winner */}
      {prop.status === 'resolved' && winningOutcome && (
        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg px-3 py-2">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">Winner: {winningOutcome.label}</p>
        </div>
      )}

      {/* Voided */}
      {prop.status === 'voided' && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-500">Voided — no settlements</p>
        </div>
      )}

      {/* Pool model: show outcome pools */}
      {prop.wagerModel === 'pool' && prop.status === 'open' && totalPool > 0 && (
        <div className="flex gap-1">
          {prop.outcomes.map(o => {
            const pool = poolByOutcome[o.id] ?? 0
            const pct = totalPool > 0 ? Math.round((pool / totalPool) * 100) : 0
            return (
              <button
                key={o.id}
                onClick={() => !isCreator && !hasAccepted ? handleAccept(o.id) : undefined}
                disabled={isCreator || hasAccepted || busy}
                className={`flex-1 rounded-lg px-2 py-1.5 text-center transition-colors ${
                  !isCreator && !hasAccepted ? 'active:bg-purple-100 cursor-pointer' : ''
                } bg-gray-50 dark:bg-gray-700`}
              >
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{o.label}</p>
                <p className="text-xs text-gray-500">{fmtMoney(pool)} ({pct}%)</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Actions */}
      {prop.status === 'open' && (
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {/* Challenge: Accept button for non-creator */}
          {prop.wagerModel === 'challenge' && !isCreator && !hasAccepted && onAccept && (
            <button
              onClick={() => handleAccept(prop.outcomes[1]?.id ?? 'n')}
              disabled={busy}
              className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg active:bg-green-600 disabled:opacity-50"
            >
              {busy ? 'Accepting...' : `Accept ${fmtMoney(prop.stakeCents)}`}
            </button>
          )}
          {prop.wagerModel === 'challenge' && hasAccepted && (
            <span className="text-xs text-green-600 font-semibold">Accepted</span>
          )}

          {/* Creator: resolve buttons (require at least 1 acceptor) */}
          {isCreator && prop.resolveType === 'manual' && hasWagers && onResolve && (
            <div className="flex gap-1">
              {prop.outcomes.map(o => (
                <button
                  key={o.id}
                  onClick={() => handleResolve(o.id)}
                  disabled={busy}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg disabled:opacity-50 ${
                    confirmResolve === o.id
                      ? 'bg-orange-500 text-white animate-pulse'
                      : 'bg-blue-500 text-white active:bg-blue-600'
                  }`}
                >
                  {confirmResolve === o.id ? 'Tap to confirm' : `${o.label} wins`}
                </button>
              ))}
            </div>
          )}

          {/* Creator: cancel */}
          {isCreator && onCancel && (
            <button
              onClick={handleCancel}
              disabled={busy}
              className="px-2 py-1 text-xs text-red-500 font-semibold active:text-red-700 ml-auto disabled:opacity-50"
            >
              Void
            </button>
          )}
        </div>
      )}

      {/* Error feedback */}
      {error && (
        <p className="text-xs text-red-500 font-semibold">{error}</p>
      )}
    </div>
  )
}
