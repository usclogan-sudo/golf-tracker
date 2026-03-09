import { useState } from 'react'

interface Props {
  onUpgrade: () => void
}

export function GuestBanner({ onUpgrade }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">&#9888;&#65039;</span>
        <div>
          <p className="font-semibold text-amber-900 text-sm">Your rounds aren&apos;t saved to an account</p>
          <p className="text-amber-800 text-sm mt-1">
            One cleared cache and your game history, players, and winnings are gone forever.
          </p>
        </div>
      </div>
      <button
        onClick={onUpgrade}
        className="w-full h-12 bg-green-700 text-white font-bold rounded-xl active:bg-green-800 transition-colors text-sm"
      >
        Lock In Your Data &mdash; Create Account
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="w-full text-center text-gray-400 text-xs underline"
      >
        I&apos;ll risk it
      </button>
    </div>
  )
}
