import { useState, useRef, useEffect } from 'react'

const GOLF_TERMS: Record<string, string> = {
  SI: 'Stroke Index — difficulty ranking of each hole (1 = hardest)',
  Net: 'Your score after handicap strokes are subtracted',
  Gross: 'Your actual score before any handicap adjustment',
  Skins: 'Each hole is worth a set amount — win the hole outright to win the skin',
  Nassau: 'Three separate bets: front 9, back 9, and overall 18',
  Press: 'A new bet within Nassau, started when you\'re down',
  'Best Ball': 'Teams of 2 — the lower score on each hole counts for the team',
  Wolf: 'Rotating "wolf" picks a partner each hole, or goes alone for double stakes',
  BBB: 'Bingo Bango Bongo — points for first on green, closest to pin, first to hole out',
  Hammer: 'Two-player game where you can "throw the hammer" to double the hole\'s value',
  HCP: 'Handicap — a number representing your average strokes over par',
}

interface TooltipProps {
  term: string
  children: React.ReactNode
}

let activeTooltipSetter: ((open: boolean) => void) | null = null

export function Tooltip({ term, children }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const definition = GOLF_TERMS[term]

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [open])

  if (!definition) return <>{children}</>

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open) {
      // Close any other open tooltip
      if (activeTooltipSetter && activeTooltipSetter !== setOpen) {
        activeTooltipSetter(false)
      }
      activeTooltipSetter = setOpen
    }
    setOpen(!open)
  }

  return (
    <span className="relative inline-flex items-center gap-0.5" ref={ref}>
      {children}
      <button
        onClick={handleToggle}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold leading-none flex-shrink-0 active:bg-gray-300"
        aria-label={`What is ${term}?`}
      >
        ?
      </button>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 shadow-lg">
          <p className="font-bold mb-0.5">{term}</p>
          <p className="text-gray-300 leading-relaxed">{definition}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-800" />
        </div>
      )}
    </span>
  )
}
