import { useState } from 'react'
import { PropBetCard } from './PropBetCard'
import { CreateQuickPropForm } from './CreateQuickPropForm'
import type { PropBet, PropWager, Player } from '../../types'

interface Props {
  currentHole: number
  players: Player[]
  propBets: PropBet[]
  propWagers: PropWager[]
  currentPlayerId?: string
  onCreateProp: (title: string, stakeCents: number, targetPlayerId?: string) => void
  onAcceptProp: (propId: string, outcomeId: string) => Promise<boolean>
  onResolveProp: (propId: string, outcomeId: string) => Promise<boolean>
  onCancelProp: (propId: string) => Promise<boolean>
}

export function PropBetsPanel({
  currentHole, players, propBets, propWagers, currentPlayerId,
  onCreateProp, onAcceptProp, onResolveProp, onCancelProp,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [showRoundWide, setShowRoundWide] = useState(false)

  const holeProps = propBets.filter(pb => pb.holeNumber === currentHole && pb.status !== 'voided')
  const roundWideOpen = propBets.filter(pb =>
    pb.holeNumber !== currentHole && (pb.status === 'open' || pb.status === 'locked')
  )

  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-bold text-purple-800 dark:text-purple-300 text-sm">Props</p>
          <span className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-semibold">
            Hole {currentHole}
          </span>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-500 text-white active:bg-purple-600"
          >
            + Quick Prop
          </button>
        )}
      </div>

      {/* Quick prop creation form */}
      {showForm && (
        <CreateQuickPropForm
          players={players}
          onCreateProp={(title, stake, target) => {
            onCreateProp(title, stake, target)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Hole props */}
      {holeProps.length > 0 && (
        <div className="space-y-2">
          {holeProps.map(prop => (
            <PropBetCard
              key={prop.id}
              prop={prop}
              wagers={propWagers}
              players={players}
              currentPlayerId={currentPlayerId}
              onAccept={onAcceptProp}
              onResolve={onResolveProp}
              onCancel={onCancelProp}
            />
          ))}
        </div>
      )}

      {holeProps.length === 0 && !showForm && (
        <p className="text-xs text-purple-600 dark:text-purple-400">No props on this hole</p>
      )}

      {/* Round-wide open props (collapsed) */}
      {roundWideOpen.length > 0 && (
        <div>
          <button
            onClick={() => setShowRoundWide(!showRoundWide)}
            className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400"
          >
            <svg className={`w-3 h-3 transition-transform ${showRoundWide ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {roundWideOpen.length} other open prop{roundWideOpen.length !== 1 ? 's' : ''}
          </button>
          {showRoundWide && (
            <div className="space-y-2 mt-2">
              {roundWideOpen.map(prop => (
                <PropBetCard
                  key={prop.id}
                  prop={prop}
                  wagers={propWagers}
                  players={players}
                  currentPlayerId={currentPlayerId}
                  onAccept={onAcceptProp}
                  onResolve={onResolveProp}
                  onCancel={onCancelProp}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
