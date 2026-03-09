import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  userId: string
  onComplete: () => void
}

export function Onboarding({ userId, onComplete }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [handicapIndex, setHandicapIndex] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleFinish = async () => {
    setError('')
    if (!displayName.trim()) { setError('Name is required'); return }
    const hcp = parseFloat(handicapIndex)
    if (isNaN(hcp) || hcp < -10 || hcp > 54) { setError('Handicap must be between -10 and 54'); return }
    setSaving(true)
    await supabase
      .from('user_profiles')
      .update({
        onboarding_complete: true,
        display_name: displayName.trim(),
        handicap_index: hcp,
      })
      .eq('user_id', userId)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="app-header text-white px-4 pt-6 pb-5 shadow-xl">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-display text-3xl font-800 tracking-tight">Fore Skins</h1>
          <p className="text-green-400 text-sm font-medium mt-0.5 tracking-wide">GOLF · SIDE GAMES · MONEY</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto w-full">
        <div className="text-center space-y-6 w-full animate-fade-in">
          <div className="text-7xl">&#9971;</div>
          <h2 className="font-display text-3xl font-bold text-gray-900">Welcome to Fore Skins</h2>
          <p className="text-gray-500 text-lg">Track golf side games, collect buy-ins, and settle up — all in one place.</p>

          <div className="space-y-3 text-left">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                placeholder="e.g. John Smith"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Handicap Index</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="e.g. 12.4"
                value={handicapIndex}
                onChange={e => setHandicapIndex(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleFinish}
            disabled={saving}
            className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-60 active:bg-green-800 transition-colors"
          >
            {saving ? 'Starting...' : 'Get Started'}
          </button>
        </div>
      </main>
    </div>
  )
}
