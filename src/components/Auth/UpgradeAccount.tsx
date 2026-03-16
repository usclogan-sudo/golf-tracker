import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  onComplete: () => void
  onCancel: () => void
}

export function UpgradeAccount({ onComplete, onCancel }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleUpgrade = async () => {
    if (!email.trim()) { setError('Enter your email address'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({
      email: email.trim(),
      password,
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setMessage('Check your email to confirm, then you\'re all set!')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">&#128274;</div>
          <h1 className="font-display text-2xl font-800 tracking-tight text-gray-900">Secure Your Account</h1>
          <p className="text-gray-500 text-sm mt-2">All your existing data stays &mdash; we just add a login.</p>
        </div>

        {message ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-2">
            <p className="text-3xl">&#128236;</p>
            <p className="font-semibold text-green-900">{message}</p>
            <button
              onClick={onComplete}
              className="text-amber-600 text-sm underline mt-2"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpgrade()}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full h-14 bg-gray-800 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-60 active:bg-gray-900 transition-colors"
            >
              {loading ? 'Loading...' : 'Create Account'}
            </button>

            <button
              onClick={onCancel}
              className="w-full text-center text-gray-500 text-sm underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
