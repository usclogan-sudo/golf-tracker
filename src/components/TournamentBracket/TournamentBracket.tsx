import type { TournamentMatchup, Player } from '../../types'
import { countBracketRounds } from '../../lib/tournamentLogic'

interface Props {
  matchups: TournamentMatchup[]
  players: Player[]
  onStartMatch?: (matchup: TournamentMatchup) => void
}

export function TournamentBracket({ matchups, players, onStartMatch }: Props) {
  const winnersMatchups = matchups.filter(m => !m.loserBracket)
  const totalRounds = countBracketRounds(winnersMatchups)
  const playerName = (id?: string) => id ? (players.find(p => p.id === id)?.name ?? 'TBD') : 'TBD'

  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-4" style={{ minWidth: `${totalRounds * 200}px` }}>
          {rounds.map(round => {
            const roundMatchups = winnersMatchups
              .filter(m => m.bracketRound === round)
              .sort((a, b) => a.matchNumber - b.matchNumber)

            return (
              <div key={round} className="flex-1 min-w-[180px] space-y-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
                  {round === totalRounds ? 'Final' : round === totalRounds - 1 ? 'Semifinal' : `Round ${round}`}
                </p>
                <div className="space-y-3 flex flex-col justify-around h-full">
                  {roundMatchups.map(m => {
                    const isComplete = m.status === 'complete'
                    const canStart = m.status === 'pending' && m.playerAId && m.playerBId
                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl border-2 overflow-hidden ${
                          isComplete ? 'border-green-300 dark:border-green-700' : canStart ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className={`px-3 py-2 text-sm flex items-center justify-between border-b ${
                          m.winnerId === m.playerAId ? 'bg-green-50 dark:bg-green-900/30 font-bold' : 'bg-white dark:bg-gray-800'
                        } ${!m.playerAId ? 'text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          <span className="truncate">{playerName(m.playerAId)}</span>
                          {m.winnerId === m.playerAId && <span className="text-green-600 dark:text-green-400 text-xs ml-1">W</span>}
                        </div>
                        <div className={`px-3 py-2 text-sm flex items-center justify-between ${
                          m.winnerId === m.playerBId ? 'bg-green-50 dark:bg-green-900/30 font-bold' : 'bg-white dark:bg-gray-800'
                        } ${!m.playerBId ? 'text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          <span className="truncate">{playerName(m.playerBId)}</span>
                          {m.winnerId === m.playerBId && <span className="text-green-600 dark:text-green-400 text-xs ml-1">W</span>}
                        </div>
                        {canStart && onStartMatch && (
                          <button
                            onClick={() => onStartMatch(m)}
                            className="w-full px-3 py-1.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-semibold text-center active:bg-amber-200"
                          >
                            Start Match
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
