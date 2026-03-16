import { useEffect, useState } from 'react'
import { supabase, rowToRound } from '../../lib/supabase'
import { UserAvatar } from '../AvatarPicker'
import type { Round, Player } from '../../types'

interface Props {
  userId: string
  onBack: () => void
}

interface PlayerEntry {
  id: string
  name: string
  handicapIndex: number
  roundsPlayed: number
  lastPlayed: Date | null
}

export function PlayerDirectory({ userId, onBack }: Props) {
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadPlayers()
  }, [userId])

  const loadPlayers = async () => {
    const { data: roundRows } = await supabase
      .from('rounds')
      .select('*')
      .in('status', ['complete', 'active'])

    if (!roundRows) { setLoading(false); return }
    const rounds: Round[] = roundRows.map(rowToRound)

    const playerMap = new Map<string, PlayerEntry>()

    for (const round of rounds) {
      const roundPlayers: Player[] = round.players ?? []
      for (const p of roundPlayers) {
        const existing = playerMap.get(p.id)
        const roundDate = new Date(round.date)
        if (existing) {
          existing.roundsPlayed++
          if (!existing.lastPlayed || roundDate > existing.lastPlayed) {
            existing.lastPlayed = roundDate
          }
          // Keep latest handicap
          existing.handicapIndex = p.handicapIndex
        } else {
          playerMap.set(p.id, {
            id: p.id,
            name: p.name,
            handicapIndex: p.handicapIndex,
            roundsPlayed: 1,
            lastPlayed: roundDate,
          })
        }
      }
    }

    const arr = Array.from(playerMap.values())
    arr.sort((a, b) => {
      // Most recently played first
      if (a.lastPlayed && b.lastPlayed) return b.lastPlayed.getTime() - a.lastPlayed.getTime()
      if (a.lastPlayed) return -1
      if (b.lastPlayed) return 1
      return a.name.localeCompare(b.name)
    })
    setPlayers(arr)
    setLoading(false)
  }

  const filtered = search.trim()
    ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : players

  const recentPlayers = filtered.filter(p => {
    if (!p.lastPlayed) return false
    const daysAgo = (Date.now() - p.lastPlayed.getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 30
  })
  const otherPlayers = filtered.filter(p => !recentPlayers.includes(p))

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800 text-xl" aria-label="Back">←</button>
        <h1 className="text-xl font-bold">Players</h1>
        <span className="text-sm text-gray-300 ml-auto">{players.length} total</span>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="text-gray-500 font-medium">{search ? 'No players found' : 'No players yet'}</p>
            <p className="text-gray-400 text-sm mt-1">{search ? 'Try a different search' : 'Players appear after your first round'}</p>
          </div>
        ) : (
          <>
            {recentPlayers.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recently Played</h2>
                <div className="space-y-2">
                  {recentPlayers.map(p => (
                    <PlayerCard key={p.id} player={p} />
                  ))}
                </div>
              </section>
            )}

            {otherPlayers.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {recentPlayers.length > 0 ? 'All Players' : 'Players'}
                </h2>
                <div className="space-y-2">
                  {otherPlayers.map(p => (
                    <PlayerCard key={p.id} player={p} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PlayerCard({ player }: { player: PlayerEntry }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <UserAvatar name={player.name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{player.name}</p>
        <p className="text-sm text-gray-500">
          HCP {player.handicapIndex} · {player.roundsPlayed} round{player.roundsPlayed !== 1 ? 's' : ''}
          {player.lastPlayed && (
            <> · Last {player.lastPlayed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>
          )}
        </p>
      </div>
    </div>
  )
}
