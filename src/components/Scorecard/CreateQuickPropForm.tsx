import { useState } from 'react'
import { QUICK_TEMPLATES } from '../../lib/propTemplates'
import type { Player } from '../../types'

interface Props {
  players: Player[]
  onCreateProp: (title: string, stakeCents: number, targetPlayerId?: string) => void
  onClose: () => void
}

const AMOUNT_OPTIONS = [100, 200, 300, 500, 1000]
const MAX_TITLE_LENGTH = 120

export function CreateQuickPropForm({ players, onCreateProp, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [stakeCents, setStakeCents] = useState(500)
  const [targetPlayerId, setTargetPlayerId] = useState<string | undefined>()
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const applyTemplate = (template: string) => {
    if (template.includes('{player}')) {
      setPendingTemplate(template)
      setShowPlayerPicker(true)
    } else {
      setTitle(template)
      setPendingTemplate(null)
      setShowPlayerPicker(false)
    }
  }

  const selectPlayerForTemplate = (player: Player) => {
    if (pendingTemplate) {
      setTitle(pendingTemplate.replace('{player}', player.name))
      setTargetPlayerId(player.id)
      setPendingTemplate(null)
    } else {
      setTargetPlayerId(player.id)
    }
    setShowPlayerPicker(false)
  }

  const titleTrimmed = title.trim()
  const isValid = titleTrimmed.length > 0 && titleTrimmed.length <= MAX_TITLE_LENGTH && stakeCents > 0

  const handleCreate = () => {
    if (!isValid || submitted) return
    setSubmitted(true)
    onCreateProp(titleTrimmed, stakeCents, targetPlayerId)
    // Don't reset — parent will close/reset the form
  }

  return (
    <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-purple-800 dark:text-purple-300 text-sm">Quick Prop</p>
        <button onClick={onClose} className="text-xs text-gray-500 font-semibold">Cancel</button>
      </div>

      {/* Templates */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TEMPLATES.map(t => (
          <button
            key={t.label}
            onClick={() => applyTemplate(t.template)}
            className="px-2.5 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-lg active:bg-purple-200"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Player picker (for template) */}
      {showPlayerPicker && (
        <div className="space-y-1">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold">Who's this about?</p>
          <div className="flex flex-wrap gap-1.5">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => selectPlayerForTemplate(p)}
                className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg active:bg-gray-200"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Title input */}
      <div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
          placeholder="e.g. Stan hits the water"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          maxLength={MAX_TITLE_LENGTH}
        />
        {titleTrimmed.length > 0 && titleTrimmed.length > MAX_TITLE_LENGTH - 20 && (
          <p className="text-xs text-gray-400 mt-0.5 text-right">{titleTrimmed.length}/{MAX_TITLE_LENGTH}</p>
        )}
      </div>

      {/* Amount chips */}
      <div className="flex gap-1.5">
        {AMOUNT_OPTIONS.map(amt => (
          <button
            key={amt}
            onClick={() => setStakeCents(amt)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              stakeCents === amt
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            ${amt / 100}
          </button>
        ))}
      </div>

      {/* Target player (optional) */}
      {!showPlayerPicker && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Target player (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTargetPlayerId(undefined)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                !targetPlayerId ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              None
            </button>
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setTargetPlayerId(p.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                  targetPlayerId === p.id ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={!isValid || submitted}
        className="w-full py-2.5 bg-purple-600 text-white font-bold text-sm rounded-xl active:bg-purple-700 disabled:opacity-40"
      >
        {submitted ? 'Creating...' : `Create Prop — $${stakeCents / 100}`}
      </button>
    </div>
  )
}
