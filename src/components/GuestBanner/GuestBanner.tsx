interface Props {
  onUpgrade: () => void
}

export function GuestBanner({ onUpgrade }: Props) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg flex-shrink-0">&#128100;</span>
        <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm truncate">Playing as guest</p>
      </div>
      <button
        onClick={onUpgrade}
        className="flex-shrink-0 px-4 py-2 bg-gray-800 text-white font-bold rounded-xl active:bg-gray-900 transition-colors text-sm"
      >
        Create Account
      </button>
    </div>
  )
}
