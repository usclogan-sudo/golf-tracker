import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  userId: string
  onComplete: () => void
}

export function Onboarding({ userId, onComplete }: Props) {
  const [step, setStep] = useState(0)
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
        {step === 0 && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="text-7xl">&#9971;</div>
            <h2 className="font-display text-3xl font-bold text-gray-900">Welcome to Fore Skins</h2>
            <p className="text-gray-500 text-lg">The easiest way to track golf side games, collect buy-ins, and settle up with your crew.</p>
            <button
              onClick={() => setStep(1)}
              className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg active:bg-green-800 transition-colors"
            >
              Let's Go
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 w-full animate-fade-in">
            <h2 className="font-display text-2xl font-bold text-gray-900 text-center">How It Works</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
              <div className="text-3xl flex-shrink-0">&#9971;</div>
              <div>
                <p className="font-semibold text-gray-900">Set Up Courses</p>
                <p className="text-sm text-gray-500 mt-1">Add your local courses with holes, pars, tees, and ratings — or pick from the catalog.</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
              <div className="text-3xl flex-shrink-0">&#128101;</div>
              <div>
                <p className="font-semibold text-gray-900">Add Your Players</p>
                <p className="text-sm text-gray-500 mt-1">Track handicaps, GHIN numbers, and payment methods for each golfer.</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
              <div className="text-3xl flex-shrink-0">&#127920;</div>
              <div>
                <p className="font-semibold text-gray-900">Play Side Games</p>
                <p className="text-sm text-gray-500 mt-1">Skins, Best Ball, Nassau, Wolf, BBB — with buy-ins, live scoring, and auto payouts.</p>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg active:bg-green-800 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="text-center space-y-6 w-full animate-fade-in">
            <div className="text-7xl">&#127942;</div>
            <h2 className="font-display text-2xl font-bold text-gray-900">You're All Set!</h2>
            <p className="text-gray-500 text-lg">Start by adding a course and some players, then fire up your first round.</p>
            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-60 active:bg-green-800 transition-colors"
            >
              {saving ? 'Starting...' : 'Get Started'}
            </button>
          </div>
        )}

        {/* Dot indicators */}
        <div className="flex gap-2 mt-8">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === step ? 'bg-green-700' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
