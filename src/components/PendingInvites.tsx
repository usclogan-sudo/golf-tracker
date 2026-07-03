import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { reportSupabaseError } from '../lib/sentry'

interface PendingInvite {
  kind: 'round' | 'event'
  /** roundId for round invites, eventId for event invites */
  id: string
  /** round to navigate to on accept (events carry their round id) */
  roundId: string
  title: string
}

/**
 * Home-screen card listing the current user's pending round AND event invites
 * with Accept / Decline actions.
 *
 * A pending member cannot read the `rounds`/`events` row (RLS gates them behind an
 * accepted membership). Round invite display text comes from the readable
 * `round_invite` notification; event invites come from the get_my_pending_event_invites
 * SECURITY DEFINER RPC (which can read the event name for the caller).
 */
export function PendingInvites({ userId, onAccepted }: { userId: string; onAccepted?: (roundId: string) => void }) {
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const next: PendingInvite[] = []

    // Round invites: pending round_participants → title from the round_invite notification.
    const { data: pend, error: pErr } = await supabase
      .from('round_participants')
      .select('round_id')
      .eq('user_id', userId)
      .eq('status', 'pending')
    if (pErr) { reportSupabaseError(pErr, 'pending_invites.round_participants', { userId }) }
    const roundIds = (pend ?? []).map((p: any) => p.round_id)
    if (roundIds.length > 0) {
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
      for (const rid of roundIds) {
        next.push({ kind: 'round', id: rid, roundId: rid, title: byRound.get(rid) ?? 'You have a pending invite' })
      }
    }

    // Event invites: SECURITY DEFINER RPC returns event name + round for the caller.
    const { data: evData, error: evErr } = await supabase.rpc('get_my_pending_event_invites')
    if (evErr) { reportSupabaseError(evErr, 'pending_invites.events', { userId }) }
    for (const ev of ((evData as any[]) ?? [])) {
      next.push({ kind: 'event', id: ev.event_id, roundId: ev.round_id, title: `You're invited to ${ev.event_name}` })
    }

    setInvites(next)
  }, [userId])

  useEffect(() => { load() }, [load])

  const respond = async (inv: PendingInvite, accept: boolean) => {
    setBusy(inv.id)
    setError(null)
    const { error: rpcErr } = inv.kind === 'event'
      ? await supabase.rpc('respond_to_event_invite', { p_event_id: inv.id, p_accept: accept })
      : await supabase.rpc('respond_to_round_invite', { p_round_id: inv.id, p_accept: accept })
    if (rpcErr) {
      reportSupabaseError(rpcErr, inv.kind === 'event' ? 'respond_to_event_invite' : 'respond_to_round_invite', { id: inv.id, accept })
      setError(rpcErr.message || 'Could not respond to invite. Try again.')
      setBusy(null)
      return
    }
    if (inv.kind === 'round') {
      await supabase.from('notifications').update({ read: true })
        .eq('user_id', userId).eq('type', 'round_invite').eq('round_id', inv.roundId)
    }
    setInvites(prev => prev.filter(i => !(i.kind === inv.kind && i.id === inv.id)))
    setBusy(null)
    if (accept) onAccepted?.(inv.roundId)
  }

  if (invites.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="font-display font-bold text-gray-900 dark:text-gray-100">Pending invites</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {invites.map(inv => (
        <div
          key={`${inv.kind}:${inv.id}`}
          className="rounded-2xl bg-white dark:bg-gray-800 shadow p-4 space-y-3 border border-amber-200 dark:border-gray-700"
        >
          <p className="text-sm text-gray-800 dark:text-gray-100">{inv.title}</p>
          <div className="flex gap-2">
            <button
              onClick={() => respond(inv, false)}
              disabled={busy === inv.id}
              className="flex-1 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold active:scale-95 disabled:opacity-50"
            >Decline</button>
            <button
              onClick={() => respond(inv, true)}
              disabled={busy === inv.id}
              className="flex-1 h-10 rounded-xl bg-green-600 text-white text-sm font-semibold active:scale-95 disabled:opacity-50"
            >Accept</button>
          </div>
        </div>
      ))}
    </section>
  )
}
