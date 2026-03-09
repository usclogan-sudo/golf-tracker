import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  userId: string
  onComplete: () => void
}

export function Onboarding({ userId, onComplete }: Props) {
  const [saving, setSaving] = useState(false)

  const handleFinish = async () => {
    setSaving(true)
    await supabase
      .from('user_profiles')
      .update({ onboarding_complete: true })
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
