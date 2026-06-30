import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { reportSupabaseError } from '../lib/sentry'

interface PendingInvite {
  roundId: string
  title: string
}

/**
 * Home-screen card listing the current user's pending round invites with
 * Accept / Decline actions.
 *
 * Note: a pending member cannot read the `rounds` row (RLS gates it behind an
 * accepted membership), so the display text is sourced from the user's own
 * readable `round_invite` notification rather than a rounds join.
 */
export function PendingInvites({ userId, onAccepted }: { userId: string; onAccepted?: (roundId: string) => void }) {
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: pend, error: pErr } = await supabase
      .from('round_participants')
      .select('round_id')
      .eq('user_id', userId)
      .eq('status', 'pending')
    if (pErr) { reportSupabaseError(pErr, 'pending_invites.participants', { userId }); return }
    const roundIds = (pend ?? []).map((p: any) => p.round_id)
    if (roundIds.length === 0) { setInvites([]); return }

    const { data: notifs } = await supabase
      .from('notifications')
      .select('round_id, title, created_at')
      .eq('user_id', userId)
      .eq('type', 'round_invite')
      .in('round_id', roundIds)
      .order('created_at', { ascending: false })
    const byRound = new Map<string, string>()
    for (const n of (notifs ?? []) as any[]) {
      if (!byRound.has(n.round_id)) byRound.set(n.round_id, n.title)
    }
    setInvites(roundIds.map((rid: string) => ({
      roundId: rid,
      title: byRound.get(rid) ?? 'You have a pending invite',
    })))
  }, [userId])

  useEffect(() => { load() }, [load])

  const respond = async (roundId: string, accept: boolean) => {
    setBusy(roundId)
    setError(null)
    const { error: rpcErr } = await supabase.rpc('respond_to_round_invite', { p_round_id: roundId, p_accept: accept })
    if (rpcErr) {
      reportSupabaseError(rpcErr, 'respond_to_round_invite', { roundId, accept })
      setError(rpcErr.message || 'Could not respond to invite. Try again.')
      setBusy(null)
      return
    }
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', userId).eq('type', 'round_invite').eq('round_id', roundId)
    setInvites(prev => prev.filter(i => i.roundId !== roundId))
    setBusy(null)
    if (accept) onAccepted?.(roundId)
  }

  if (invites.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="font-display font-bold text-gray-900 dark:text-gray-100">Pending invites</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {invites.map(inv => (
        <div
          key={inv.roundId}
          className="rounded-2xl bg-white dark:bg-gray-800 shadow p-4 space-y-3 border border-amber-200 dark:border-gray-700"
        >
          <p className="text-sm text-gray-800 dark:text-gray-100">{inv.title}</p>
          <div className="flex gap-2">
            <button
              onClick={() => respond(inv.roundId, false)}
              disabled={busy === inv.roundId}
              className="flex-1 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold active:scale-95 disabled:opacity-50"
            >Decline</button>
            <button
              onClick={() => respond(inv.roundId, true)}
              disabled={busy === inv.roundId}
              className="flex-1 h-10 rounded-xl bg-green-600 text-white text-sm font-semibold active:scale-95 disabled:opacity-50"
            >Accept</button>
          </div>
        </div>
      ))}
    </section>
  )
}
