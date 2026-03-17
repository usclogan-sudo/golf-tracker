import { useEffect, useState, useMemo } from 'react'
import { supabase, rowToRound, rowToUserProfile, rowToPinnedFriend } from '../../lib/supabase'
import { UserAvatar } from '../AvatarPicker'
import type { Round, Player, UserProfile, PinnedFriend } from '../../types'

interface Props {
  userId: string
  onBack: () => void
}

interface PlayerEntry {
  id: string
  name: string
  handicapIndex: number
  roundsPlayed: number
  sharedRounds: number  // rounds played WITH the current user
  lastPlayed: Date | null
  isRegistered: boolean
  avatarPreset?: string
  avatarUrl?: string
}

export function PlayerDirectory({ userId, onBack }: Props) {
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    const [roundsRes, profilesRes, pinsRes] = await Promise.all([
      supabase.from('rounds').select('*').in('status', ['complete', 'active']),
      supabase.from('user_profiles').select('*').not('display_name', 'is', null),
      supabase.from('pinned_friends').select('*').eq('user_id', userId),
    ])

    const rounds: Round[] = (roundsRes.data ?? []).map(rowToRound)
    const profiles: UserProfile[] = (profilesRes.data ?? []).map(rowToUserProfile)
    const pins: PinnedFriend[] = (pinsRes.data ?? []).map(rowToPinnedFriend)

    setPinnedIds(new Set(pins.map(p => p.friendUserId)))

    // Build profile lookup
    const profileMap = new Map<string, UserProfile>()
    for (const p of profiles) profileMap.set(p.userId, p)

    const playerMap = new Map<string, PlayerEntry>()

    for (const round of rounds) {
      const roundPlayers: Player[] = round.players ?? []
      const userInRound = roundPlayers.some(p => p.id === userId)

      for (const p of roundPlayers) {
        const existing = playerMap.get(p.id)
        const roundDate = new Date(round.date)
        const prof = profileMap.get(p.id)

        if (existing) {
          existing.roundsPlayed++
          if (userInRound && p.id !== userId) existing.sharedRounds++
          if (!existing.lastPlayed || roundDate > existing.lastPlayed) existing.lastPlayed = roundDate
          existing.handicapIndex = p.handicapIndex
          if (prof) {
            existing.isRegistered = true
            existing.avatarPreset = prof.avatarPreset
            existing.avatarUrl = prof.avatarUrl
          }
        } else {
          playerMap.set(p.id, {
            id: p.id,
            name: prof?.displayName ?? p.name,
            handicapIndex: p.handicapIndex,
            roundsPlayed: 1,
            sharedRounds: userInRound && p.id !== userId ? 1 : 0,
            lastPlayed: roundDate,
            isRegistered: !!prof,
            avatarPreset: prof?.avatarPreset,
            avatarUrl: prof?.avatarUrl,
          })
        }
      }
    }

    // Also add registered profiles not in any round
    for (const prof of profiles) {
      if (!playerMap.has(prof.userId) && prof.userId !== userId) {
        playerMap.set(prof.userId, {
          id: prof.userId,
          name: prof.displayName ?? 'Unknown',
          handicapIndex: prof.handicapIndex ?? 0,
          roundsPlayed: 0,
          sharedRounds: 0,
          lastPlayed: null,
          isRegistered: true,
          avatarPreset: prof.avatarPreset,
          avatarUrl: prof.avatarUrl,
        })
      }
    }

    // Remove current user
    playerMap.delete(userId)

    const arr = Array.from(playerMap.values())
    arr.sort((a, b) => {
      if (a.lastPlayed && b.lastPlayed) return b.lastPlayed.getTime() - a.lastPlayed.getTime()
      if (a.lastPlayed) return -1
      if (b.lastPlayed) return 1
      return a.name.localeCompare(b.name)
    })
    setPlayers(arr)
    setLoading(false)
  }

  const togglePin = async (playerId: string) => {
    const isPinned = pinnedIds.has(playerId)
    if (isPinned) {
      setPinnedIds(prev => { const next = new Set(prev); next.delete(playerId); return next })
      await supabase.from('pinned_friends').delete().eq('user_id', userId).eq('friend_user_id', playerId)
    } else {
      setPinnedIds(prev => new Set(prev).add(playerId))
      await supabase.from('pinned_friends').insert({ user_id: userId, friend_user_id: playerId })
    }
  }

  const filtered = search.trim()
    ? players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : players

  const pinned = filtered.filter(p => pinnedIds.has(p.id))
  const frequent = filtered
    .filter(p => !pinnedIds.has(p.id) && p.sharedRounds >= 2)
    .sort((a, b) => b.sharedRounds - a.sharedRounds)
    .slice(0, 5)
  const registered = filtered.filter(p => !pinnedIds.has(p.id) && !frequent.includes(p) && p.isRegistered)
  const guests = filtered.filter(p => !pinnedIds.has(p.id) && !frequent.includes(p) && !p.isRegistered)

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
            {pinned.length > 0 && (
              <Section title="Pinned Friends" icon="⭐">
                {pinned.map(p => <PlayerCard key={p.id} player={p} isPinned onTogglePin={() => togglePin(p.id)} />)}
              </Section>
            )}

            {frequent.length > 0 && (
              <Section title="Frequently Played">
                {frequent.map(p => <PlayerCard key={p.id} player={p} isPinned={false} onTogglePin={() => togglePin(p.id)} />)}
              </Section>
            )}

            {registered.length > 0 && (
              <Section title="Registered Players">
                {registered.map(p => <PlayerCard key={p.id} player={p} isPinned={false} onTogglePin={() => togglePin(p.id)} />)}
              </Section>
            )}

            {guests.length > 0 && (
              <Section title="All Players">
                {guests.map(p => <PlayerCard key={p.id} player={p} isPinned={false} onTogglePin={() => togglePin(p.id)} />)}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
        {icon && <span>{icon}</span>}{title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function PlayerCard({ player, isPinned, onTogglePin }: { player: PlayerEntry; isPinned: boolean; onTogglePin: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <UserAvatar url={player.avatarUrl} preset={player.avatarPreset} name={player.name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate">{player.name}</p>
          {player.isRegistered && (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Registered</span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          HCP {player.handicapIndex} · {player.roundsPlayed} round{player.roundsPlayed !== 1 ? 's' : ''}
          {player.lastPlayed && (
            <> · Last {player.lastPlayed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>
          )}
        </p>
      </div>
      <button
        onClick={onTogglePin}
        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
          isPinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'
        }`}
        aria-label={isPinned ? 'Unpin' : 'Pin'}
      >
        {isPinned ? '★' : '☆'}
      </button>
    </div>
  )
}
