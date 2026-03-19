import { useState } from 'react'

const DISMISS_KEY = 'guest-banner-dismissed'

interface Props {
  onUpgrade: () => void
}

export function GuestBanner({ onUpgrade }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  if (dismissed) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">&#9888;&#65039;</span>
        <div>
          <p className="font-semibold text-amber-900 text-sm">You&apos;re playing as a guest</p>
          <p className="text-amber-800 text-sm mt-1">
            Your data is saved locally but not backed up. Create an account to sync across devices.
          </p>
        </div>
      </div>
      <button
        onClick={onUpgrade}
        className="w-full h-12 bg-gray-800 text-white font-bold rounded-xl active:bg-gray-900 transition-colors text-sm"
      >
        Lock In Your Data &mdash; Create Account
      </button>
      <button
        onClick={() => { setDismissed(true); try { sessionStorage.setItem(DISMISS_KEY, '1') } catch {} }}
        className="w-full text-center text-gray-400 text-xs underline"
      >
        I&apos;ll risk it
      </button>
    </div>
  )
}
