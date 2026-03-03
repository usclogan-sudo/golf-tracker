import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export function Auth() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!email.trim()) { setError('Enter your email address'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-4">⛳</div>
          <h1 className="font-display text-3xl font-800 tracking-tight text-gray-900">Fore Skins</h1>
          <p className="text-green-700 text-sm font-medium mt-1 tracking-wide">GOLF · SIDE GAMES · MONEY</p>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-2">
            <p className="text-3xl">📬</p>
            <p className="font-semibold text-green-900">Check your email</p>
            <p className="text-green-700 text-sm">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-green-600 text-sm underline mt-2"
            >
              Use a different email
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
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleSend}
              disabled={loading}
              className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-60 active:bg-green-800 transition-colors"
            >
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
            <p className="text-center text-xs text-gray-400">
              No password needed. We'll email you a sign-in link.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
