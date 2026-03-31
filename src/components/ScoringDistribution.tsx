interface Props {
  eagles: number
  birdies: number
  pars: number
  bogeys: number
  doubles: number
  worse: number
}

export function ScoringDistribution({ eagles, birdies, pars, bogeys, doubles, worse }: Props) {
  if (eagles + birdies + pars + bogeys + doubles + worse === 0) return null

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        { label: 'Eagles+', count: eagles, color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' },
        { label: 'Birdies', count: birdies, color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
        { label: 'Pars', count: pars, color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
        { label: 'Bogeys', count: bogeys, color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' },
        { label: 'Doubles', count: doubles, color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' },
        { label: 'Worse', count: worse, color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
      ].map(({ label, count, color }) => (
        <div key={label} className={`rounded-xl p-2 ${color}`}>
          <p className="text-lg font-bold font-display">{count}</p>
          <p className="text-xs">{label}</p>
        </div>
      ))}
    </div>
  )
}
