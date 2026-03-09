import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, playerToRow } from '../../lib/supabase'
import type { Player } from '../../types'

interface Props {
  userId: string
  player?: Player
  onSave: () => void
  onCancel: () => void
}

export function PlayerSetup({ userId, player, onSave, onCancel }: Props) {
  const [name, setName] = useState(player?.name ?? '')
  const [handicapIndex, setHandicapIndex] = useState(
    player !== undefined ? String(player.handicapIndex) : '',
  )
  const [tee, setTee] = useState(player?.tee ?? 'White')
  const [ghin, setGhin] = useState(player?.ghinNumber ?? '')
  const [venmo, setVenmo] = useState(player?.venmoUsername ?? '')
  const [zelle, setZelle] = useState(player?.zelleIdentifier ?? '')
  const [cashApp, setCashApp] = useState(player?.cashAppUsername ?? '')
  const [paypal, setPaypal] = useState(player?.paypalEmail ?? '')
  const [isPublic, setIsPublic] = useState(player?.isPublic ?? false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    const hcp = parseFloat(handicapIndex)
    if (handicapIndex === '' || isNaN(hcp) || hcp < -10 || hcp > 54) {
      errs.handicap = 'Must be between -10 and 54'
    }
    if (!ghin.trim()) {
      errs.ghin = 'GHIN number is required'
    } else if (!/^\d+$/.test(ghin.trim())) {
      errs.ghin = 'Must be numeric'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const p: Player = {
        id: player?.id ?? uuidv4(),
        name: name.trim(),
        handicapIndex: parseFloat(handicapIndex),
        tee: tee.trim() || 'White',
        ghinNumber: ghin.trim(),
        isPublic,
        ...(venmo.trim() ? { venmoUsername: venmo.trim() } : {}),
        ...(zelle.trim() ? { zelleIdentifier: zelle.trim() } : {}),
        ...(cashApp.trim() ? { cashAppUsername: cashApp.trim() } : {}),
        ...(paypal.trim() ? { paypalEmail: paypal.trim() } : {}),
        createdAt: player?.createdAt ?? new Date(),
      }
      const { error: err } = await supabase
        .from('players')
        .upsert(playerToRow(p, userId), { onConflict: 'id' })
      if (err) throw err
      onSave()
    } catch (err) {
      console.error(err)
      setErrors(prev => ({ ...prev, save: 'Failed to save. Try again.' }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button
          onClick={onCancel}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-green-700 text-xl"
          aria-label="Back"
        >
          &#8592;
        </button>
        <h1 className="text-xl font-bold">{player ? 'Edit Player' : 'New Player'}</h1>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. John Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full h-12 px-4 rounded-xl border text-base focus:outline-none focus:ring-2 focus:ring-green-600 ${
                errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Handicap Index
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="-10"
                max="54"
                placeholder="e.g. 12.4"
                value={handicapIndex}
                onChange={e => setHandicapIndex(e.target.value)}
                className={`w-full h-12 px-4 rounded-xl border text-base focus:outline-none focus:ring-2 focus:ring-green-600 ${
                  errors.handicap ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.handicap && <p className="text-red-500 text-xs mt-1">{errors.handicap}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Default Tee
              </label>
              <input
                type="text"
                placeholder="e.g. White"
                value={tee}
                onChange={e => setTee(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              GHIN Number
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1234567"
              value={ghin}
              onChange={e => setGhin(e.target.value)}
              className={`w-full h-12 px-4 rounded-xl border text-base focus:outline-none focus:ring-2 focus:ring-green-600 ${
                errors.ghin ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.ghin && <p className="text-red-500 text-xs mt-1">{errors.ghin}</p>}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Methods</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Venmo Username</label>
            <input
              type="text"
              placeholder="e.g. @username"
              value={venmo}
              onChange={e => setVenmo(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Zelle (email or phone)</label>
            <input
              type="text"
              placeholder="e.g. john@email.com or 555-1234"
              value={zelle}
              onChange={e => setZelle(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Cash App Username</label>
            <input
              type="text"
              placeholder="e.g. $username"
              value={cashApp}
              onChange={e => setCashApp(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">PayPal Email or Username</label>
            <input
              type="text"
              placeholder="e.g. john@email.com"
              value={paypal}
              onChange={e => setPaypal(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visibility</h2>
          <button
            onClick={() => setIsPublic(v => !v)}
            className={`w-full h-12 rounded-xl font-semibold border-2 flex items-center justify-between px-4 ${
              isPublic ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <span>Make Public</span>
            <span className="text-sm">{isPublic ? 'ON' : 'OFF'}</span>
          </button>
          <p className="text-xs text-gray-400">
            Public players can be browsed and imported by other users when starting a round.
          </p>
        </section>

        {errors.save && <p className="text-red-500 text-sm text-center">{errors.save}</p>}
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-60 active:bg-green-800 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Player'}
          </button>
        </div>
      </div>
    </div>
  )
}
