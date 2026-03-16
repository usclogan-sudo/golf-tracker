import { useState } from 'react'

const PRESETS = [
  { id: 'golfer-1', emoji: '🏌️' },
  { id: 'golfer-2', emoji: '🏌️‍♀️' },
  { id: 'golf-ball', emoji: '⛳' },
  { id: 'flag', emoji: '🚩' },
  { id: 'trophy', emoji: '🏆' },
  { id: 'eagle', emoji: '🦅' },
  { id: 'fire', emoji: '🔥' },
  { id: 'money', emoji: '💰' },
  { id: 'diamond', emoji: '💎' },
  { id: 'star', emoji: '⭐' },
]

interface Props {
  currentPreset?: string
  currentUrl?: string
  onSelect: (preset: string) => void
  onClose: () => void
}

export function AvatarPicker({ currentPreset, onSelect, onClose }: Props) {
  const [selected, setSelected] = useState(currentPreset ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl mx-4 w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">Choose Avatar</h3>
        <div className="grid grid-cols-5 gap-3">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-14 h-14 rounded-xl text-2xl flex items-center justify-center transition-all ${
                selected === p.id
                  ? 'bg-amber-100 ring-2 ring-amber-500 scale-110'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {p.emoji}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl active:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => { if (selected) onSelect(selected); onClose() }}
            disabled={!selected}
            className="flex-1 h-12 bg-gray-800 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-gray-900 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/** Render a user's avatar — preset emoji, or initials fallback */
export function UserAvatar({ preset, name, size = 'md' }: { preset?: string; name?: string; size?: 'sm' | 'md' | 'lg' }) {
  const presetData = preset ? PRESETS.find(p => p.id === preset) : null
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-lg' : size === 'lg' ? 'w-16 h-16 text-4xl' : 'w-10 h-10 text-2xl'

  if (presetData) {
    return (
      <div className={`${sizeClass} rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0`}>
        {presetData.emoji}
      </div>
    )
  }

  // Initials fallback
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
  const colors = ['bg-emerald-700', 'bg-teal-700', 'bg-cyan-700', 'bg-blue-700', 'bg-violet-700', 'bg-rose-700']
  let hash = 0
  for (let i = 0; i < (name ?? '').length; i++) hash = (hash * 31 + (name ?? '').charCodeAt(i)) & 0xffffff
  const bg = colors[Math.abs(hash) % colors.length]
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-sm'

  return (
    <div className={`${sizeClass} rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
      <span className={`${textSize} font-bold text-white font-display`}>{initials}</span>
    </div>
  )
}
