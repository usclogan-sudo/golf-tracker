import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Sentry } from '../../lib/sentry'

interface Props {
  targetUserId: string
  targetName: string
  onClose: () => void
}

interface UserDetails {
  profile: {
    user_id: string
    display_name: string | null
    handicap_index: number | null
    venmo_username: string | null
    zelle_identifier: string | null
    cashapp_username: string | null
    paypal_email: string | null
    preferred_payment: string | null
    onboarding_complete: boolean | null
    is_admin: boolean | null
    created_at: string
  } | null
  recent_rounds: Array<{
    id: string
    date: string
    status: string
    course_name: string | null
    player_count: number
    game_type: string | null
  }>
  feedback_count: number
  recent_feedback: Array<{
    id: string
    category: string
    message: string
    status: string
    app_version: string | null
    created_at: string
  }>
  admin_actions_on_user: number
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  complete: 'bg-blue-100 text-blue-700',
  abandoned: 'bg-gray-100 text-gray-500',
}

const FEEDBACK_STATUS_COLOR: Record<string, string> = {
  new: 'bg-amber-100 text-amber-700',
  triaged: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  spam: 'bg-gray-100 text-gray-500',
}

export function UserDetailsModal({ targetUserId, targetName, onClose }: Props) {
  const [data, setData] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('admin_get_user_details', { target_user_id: targetUserId }).then(({ data: result, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) {
        Sentry.captureException(rpcError, { tags: { area: 'admin-user-details' } })
        setError(rpcError.message || 'Failed to load user details')
        setLoading(false)
        return
      }
      setData(result as UserDetails)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [targetUserId])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 pt-10">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-full overflow-auto">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{targetName}</h2>
            <p className="text-xs text-gray-400 font-mono truncate">{targetUserId}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl leading-none flex-shrink-0 ml-3"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {loading && (
          <div className="px-5 py-10 flex justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-5 py-6 text-center">
            <p className="text-red-600 text-sm font-semibold">{error}</p>
            <p className="text-gray-400 text-xs mt-2">
              Check that the <code className="bg-gray-100 px-1 rounded">admin_get_user_details</code> RPC is deployed.
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="px-5 py-5 space-y-5">
            {/* Profile */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profile</p>
              {data.profile ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 space-y-1 text-sm">
                  <p><span className="text-gray-500">Name:</span> {data.profile.display_name ?? '—'}</p>
                  <p><span className="text-gray-500">Handicap:</span> {data.profile.handicap_index ?? '—'}</p>
                  <p><span className="text-gray-500">Onboarded:</span> {data.profile.onboarding_complete ? 'Yes' : 'No'}</p>
                  <p><span className="text-gray-500">Admin:</span> {data.profile.is_admin ? 'Yes' : 'No'}</p>
                  <p><span className="text-gray-500">Created:</span> {new Date(data.profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  {(data.profile.venmo_username || data.profile.zelle_identifier || data.profile.cashapp_username || data.profile.paypal_email) && (
                    <div className="pt-1 mt-1 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 mb-1">Payment handles{data.profile.preferred_payment ? ` (preferred: ${data.profile.preferred_payment})` : ''}</p>
                      {data.profile.venmo_username && <p className="text-xs">Venmo: <span className="font-mono">@{data.profile.venmo_username}</span></p>}
                      {data.profile.zelle_identifier && <p className="text-xs">Zelle: <span className="font-mono">{data.profile.zelle_identifier}</span></p>}
                      {data.profile.cashapp_username && <p className="text-xs">Cash App: <span className="font-mono">${data.profile.cashapp_username}</span></p>}
                      {data.profile.paypal_email && <p className="text-xs">PayPal: <span className="font-mono">{data.profile.paypal_email}</span></p>}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No profile record found.</p>
              )}
            </section>

            {/* Recent rounds */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Recent rounds (last 10 created by user)
              </p>
              {data.recent_rounds.length === 0 ? (
                <p className="text-sm text-gray-500">No rounds yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.recent_rounds.map(r => (
                    <div key={r.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2 flex items-center justify-between text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{r.course_name || 'Unknown course'}</p>
                        <p className="text-xs text-gray-500">
                          {r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          {r.game_type && ` · ${r.game_type.replace(/_/g, ' ')}`}
                          {` · ${r.player_count} player${r.player_count !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2 ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Feedback */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Feedback submitted ({data.feedback_count} total)
              </p>
              {data.recent_feedback.length === 0 ? (
                <p className="text-sm text-gray-500">No feedback submitted.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.recent_feedback.map(f => (
                    <div key={f.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold uppercase text-gray-500">{f.category}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${FEEDBACK_STATUS_COLOR[f.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {f.status}
                          </span>
                          {f.app_version && <span className="text-[10px] text-gray-400 font-mono">v{f.app_version}</span>}
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{f.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Activity / audit summary */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity</p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-sm">
                <p>
                  <span className="text-gray-500">Admin actions targeting this user:</span>{' '}
                  <span className="font-semibold">{data.admin_actions_on_user}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  This view itself was logged in <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded text-[10px]">admin_audit_log</code>.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
