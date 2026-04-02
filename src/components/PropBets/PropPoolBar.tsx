import { fmtMoney } from '../../lib/gameLogic'
import type { PropBet, PropWager } from '../../types'

interface Props {
  prop: PropBet
  wagers: PropWager[]
}

export function PropPoolBar({ prop, wagers }: Props) {
  const propWagers = wagers.filter(w => w.propBetId === prop.id)
  const poolByOutcome: Record<string, number> = {}
  for (const w of propWagers) {
    poolByOutcome[w.outcomeId] = (poolByOutcome[w.outcomeId] ?? 0) + w.amountCents
  }
  const totalPool = Object.values(poolByOutcome).reduce((s, v) => s + v, 0)
  if (totalPool === 0) return null

  return (
    <div className="space-y-1">
      <div className="flex rounded-lg overflow-hidden h-6">
        {prop.outcomes.map(o => {
          const pool = poolByOutcome[o.id] ?? 0
          const pct = totalPool > 0 ? (pool / totalPool) * 100 : 0
          if (pct === 0) return null
          const colors: Record<number, string> = {
            0: 'bg-purple-500',
            1: 'bg-indigo-500',
          }
          const idx = prop.outcomes.indexOf(o)
          return (
            <div
              key={o.id}
              className={`${colors[idx] ?? 'bg-gray-500'} flex items-center justify-center text-white text-xs font-bold transition-all`}
              style={{ width: `${Math.max(pct, 10)}%` }}
            >
              {Math.round(pct)}%
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs">
        {prop.outcomes.map(o => {
          const pool = poolByOutcome[o.id] ?? 0
          return (
            <span key={o.id} className="text-gray-600 dark:text-gray-400">
              {o.label}: {fmtMoney(pool)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
