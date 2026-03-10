import { useEffect, useState } from 'react'
import { supabase, rowToUserProfile } from '../../lib/supabase'
import type { UserProfile } from '../../types'

interface Props {
  userId: string
  email: string
  onBack: () => void
  onSignOut: () => void
  isAdmin?: boolean
  onAdmin?: () => void
  isAnonymous?: boolean
  onUpgrade?: () => void
}

export function Settings({ userId, email, onBack, onSignOut, isAdmin, onAdmin, isAnonymous, onUpgrade }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [handicapIndex, setHandicapIndex] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (data) {
        const p = rowToUserProfile(data)
        setProfile(p)
        setDisplayName(p.displayName ?? '')
        setHandicapIndex(p.handicapIndex != null ? String(p.handicapIndex) : '')
      }
    })
  }, [userId])

  const handleSaveProfile = async () => {
    setProfileMessage(null)
    if (!displayName.trim()) { setProfileMessage({ type: 'error', text: 'Name is required' }); return }
    const hcp = parseFloat(handicapIndex)
    if (isNaN(hcp) || hcp < -10 || hcp > 54) { setProfileMessage({ type: 'error', text: 'Handicap must be between -10 and 54' }); return }
    setProfileSaving(true)
    const { error } = await supabase.from('user_profiles').update({
      display_name: displayName.trim(),
      handicap_index: hcp,
    }).eq('user_id', userId)
    setProfileSaving(false)
    if (error) {
      setProfileMessage({ type: 'error', text: error.message })
    } else {
      setProfileMessage({ type: 'success', text: 'Profile updated' })
    }
  }

  const handleChangePassword = async () => {
    setPwMessage(null)
    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (error) {
      setPwMessage({ type: 'error', text: error.message })
    } else {
      setPwMessage({ type: 'success', text: 'Password updated successfully' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    setDeleteError('')
    try {
      // Delete all user data from all tables
      const tables = ['hole_scores', 'bbb_points', 'buy_ins', 'round_players', 'rounds', 'players', 'courses']
      for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '')
        if (error) console.error(`Failed to delete from ${table}:`, error)
      }
      await supabase.auth.signOut()
      onSignOut()
    } catch {
      setDeleteError('Failed to delete account data. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-green-700 text-xl" aria-label="Back">←</button>
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-5">
        {/* Account info */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Account</p>
          <p className="text-gray-800 font-medium">{isAnonymous ? 'Guest (no account)' : email}</p>
        </section>

        {/* Profile editing */}
        {!isAnonymous && profile && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Profile</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Handicap Index</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={handicapIndex}
                onChange={e => setHandicapIndex(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            {profileMessage && (
              <p className={`text-sm ${profileMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {profileMessage.text}
              </p>
            )}
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="w-full h-12 bg-green-700 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-green-800 transition-colors"
            >
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </section>
        )}

        {/* Admin Dashboard */}
        {isAdmin && onAdmin && (
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <button
              onClick={onAdmin}
              className="w-full flex items-center gap-3 text-left"
            >
              <span className="text-2xl">🛡️</span>
              <div>
                <p className="font-semibold text-gray-800">Admin Dashboard</p>
                <p className="text-sm text-gray-500">Manage shared courses & game presets</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </section>
        )}

        {/* Create Account (anonymous) or Change Password (authenticated) */}
        {isAnonymous ? (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Create Account</p>
            <p className="text-sm text-gray-600">
              Your data isn't backed up. Create an account to keep it safe.
            </p>
            <button
              onClick={onUpgrade}
              className="w-full h-12 bg-green-700 text-white font-semibold rounded-xl active:bg-green-800 transition-colors"
            >
              Create Account
            </button>
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Password</p>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {pwMessage && (
              <p className={`text-sm ${pwMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {pwMessage.text}
              </p>
            )}
            <button
              onClick={handleChangePassword}
              disabled={pwSaving || !newPassword}
              className="w-full h-12 bg-green-700 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-green-800 transition-colors"
            >
              {pwSaving ? 'Updating...' : 'Update Password'}
            </button>
          </section>
        )}

        {/* Delete account */}
        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3 border border-red-200">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Danger Zone</p>
          <p className="text-sm text-gray-600">
            This will permanently delete all your data (courses, players, rounds, scores).
            Type <strong>DELETE</strong> to confirm.
          </p>
          <input
            type="text"
            placeholder='Type "DELETE" to confirm'
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {deleteError && <p className="text-red-500 text-sm">{deleteError}</p>}
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== 'DELETE' || deleting}
            className="w-full h-12 bg-red-600 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-red-700 transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete All Data & Sign Out'}
          </button>
        </section>
      </div>
    </div>
  )
}
