import { useState } from 'react'
import { supabase } from '../../lib/supabase'

type AuthMode = 'splash' | 'sign-in' | 'sign-up' | 'forgot-password' | 'magic-link'

export function Auth() {
  const [mode, setMode] = useState<AuthMode>('splash')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const resetState = (nextMode: AuthMode) => {
    setError(null)
    setMessage(null)
    setPassword('')
    setMode(nextMode)
  }

  const handleSignIn = async () => {
    if (!email.trim()) { setError('Enter your email address'); return }
    if (!password) { setError('Enter your password'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (err) setError(err.message)
    setLoading(false)
  }

  const handleSignUp = async () => {
    if (!email.trim()) { setError('Enter your email address'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin + '/golf-tracker/' },
    })
    if (err) {
      setError(err.message)
    } else {
      setMessage('Check your email to confirm your account, then sign in.')
    }
    setLoading(false)
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email address'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/golf-tracker/',
    })
    if (err) {
      setError(err.message)
    } else {
      setMessage('Check your email for a password reset link.')
    }
    setLoading(false)
  }

  const handleMagicLink = async () => {
    if (!email.trim()) { setError('Enter your email address'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + '/golf-tracker/',
      },
    })
    if (err) {
      setError(err.message)
    } else {
      setMessage('Check your email for a sign-in link.')
    }
    setLoading(false)
  }

  const handleGuestLogin = async () => {
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInAnonymously()
    if (err) setError(err.message)
    setLoading(false)
  }

  const handleSubmit = () => {
    if (mode === 'sign-in') handleSignIn()
    else if (mode === 'sign-up') handleSignUp()
    else if (mode === 'forgot-password') handleForgotPassword()
    else if (mode === 'magic-link') handleMagicLink()
  }

  const title = {
    'splash': '',
    'sign-in': 'Sign In',
    'sign-up': 'Create Account',
    'forgot-password': 'Reset Password',
    'magic-link': 'Magic Link',
  }[mode]

  const buttonLabel = {
    'splash': '',
    'sign-in': 'Sign In',
    'sign-up': 'Create Account',
    'forgot-password': 'Send Reset Link',
    'magic-link': 'Send Magic Link',
  }[mode]

  const showPassword = mode === 'sign-in' || mode === 'sign-up'

  // Splash screen
  if (mode === 'splash') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <div className="text-7xl mb-4">&#9971;</div>
            <h1 className="font-display text-4xl font-800 tracking-tight text-gray-900">Fore Skins</h1>
            <p className="text-green-700 text-sm font-medium mt-2 tracking-widest uppercase">Golf &middot; Side Games &middot; Money</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => resetState('sign-up')}
              className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg active:bg-green-800 transition-colors"
            >
              Create Account
            </button>
            <button
              onClick={() => resetState('sign-in')}
              className="w-full h-14 bg-white text-green-700 text-lg font-bold rounded-2xl shadow-sm border-2 border-green-700 active:bg-green-50 transition-colors"
            >
              Sign In
            </button>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div className="text-center">
            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="text-gray-500 text-sm underline disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Try it first \u2014 no account needed'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Form screens (sign-in, sign-up, forgot-password, magic-link)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-4">&#9971;</div>
          <h1 className="font-display text-3xl font-800 tracking-tight text-gray-900">Fore Skins</h1>
          <p className="text-green-700 text-sm font-medium mt-1 tracking-wide">GOLF &middot; SIDE GAMES &middot; MONEY</p>
        </div>

        {message ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-2">
            <p className="text-3xl">&#128236;</p>
            <p className="font-semibold text-green-900">{message}</p>
            <button
              onClick={() => resetState('sign-in')}
              className="text-green-600 text-sm underline mt-2"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => resetState('splash')}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg"
                aria-label="Back"
              >
                &larr;
              </button>
              <p className="font-semibold text-gray-700">{title}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
                autoFocus
              />
            </div>

            {showPassword && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-60 active:bg-green-800 transition-colors"
            >
              {loading ? 'Loading...' : buttonLabel}
            </button>

            <div className="space-y-2 text-center text-sm">
              {mode === 'sign-in' && (
                <>
                  <button onClick={() => resetState('forgot-password')} className="text-green-600 underline block w-full">
                    Forgot password?
                  </button>
                  <button onClick={() => resetState('magic-link')} className="text-gray-500 underline block w-full">
                    Sign in with magic link instead
                  </button>
                  <p className="text-gray-400 pt-1">
                    No account?{' '}
                    <button onClick={() => resetState('sign-up')} className="text-green-600 underline">
                      Create one
                    </button>
                  </p>
                </>
              )}
              {mode === 'sign-up' && (
                <p className="text-gray-400">
                  Already have an account?{' '}
                  <button onClick={() => resetState('sign-in')} className="text-green-600 underline">
                    Sign in
                  </button>
                </p>
              )}
              {(mode === 'forgot-password' || mode === 'magic-link') && (
                <button onClick={() => resetState('sign-in')} className="text-green-600 underline">
                  Back to Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
