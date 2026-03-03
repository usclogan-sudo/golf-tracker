import { Fragment, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../db/database'
import type { Course, Hole, Tee } from '../../types'

function defaultHoles(): Hole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    number: i + 1, par: 4, strokeIndex: i + 1, yardages: {},
  }))
}
function sumYards(holes: Hole[], teeName: string, from = 0, to = 18) {
  return holes.slice(from, to).reduce((s, h) => s + (h.yardages[teeName] ?? 0), 0)
}

interface Props { onSave: () => void; onCancel: () => void }

export function CourseSetup({ onSave, onCancel }: Props) {
  const [name, setName] = useState('')
  const [tees, setTees] = useState<Tee[]>([{ name: 'Blue', rating: 72.1, slope: 128 }])
  const [holes, setHoles] = useState<Hole[]>(defaultHoles)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const addTee = () => setTees(prev => [...prev, { name: '', rating: 72.0, slope: 113 }])
  const removeTee = (idx: number) => {
    const removedName = tees[idx].name
    setTees(prev => prev.filter((_, i) => i !== idx))
    if (removedName) {
      setHoles(prev => prev.map(hole => {
        const { [removedName]: _d, ...rest } = hole.yardages
        return { ...hole, yardages: rest }
      }))
    }
  }
  const updateTee = (idx: number, updates: Partial<Tee>) => {
    const oldName = tees[idx].name
    setTees(prev => prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)))
    if (updates.name !== undefined && updates.name !== oldName) {
      const newName = updates.name
      setHoles(prev => prev.map(hole => {
        const yards = hole.yardages[oldName]
        const { [oldName]: _d, ...rest } = hole.yardages
        return { ...hole, yardages: newName ? { ...rest, [newName]: yards ?? 0 } : rest }
      }))
    }
  }
  const updateHole = (num: number, updates: Partial<Omit<Hole, 'number' | 'yardages'>>) =>
    setHoles(prev => prev.map(h => (h.number === num ? { ...h, ...updates } : h)))
  const updateYardage = (holeNum: number, teeName: string, yards: number) =>
    setHoles(prev => prev.map(h =>
      h.number === holeNum ? { ...h, yardages: { ...h.yardages, [teeName]: yards } } : h))

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Course name is required'
    if (tees.length === 0) { errs.tees = 'At least one tee is required' }
    else {
      tees.forEach((tee, i) => {
        if (!tee.name.trim()) errs[`tee${i}name`] = 'Required'
        if (isNaN(tee.rating) || tee.rating < 60 || tee.rating > 80) errs[`tee${i}rating`] = '60–80'
        if (isNaN(tee.slope) || tee.slope < 55 || tee.slope > 155) errs[`tee${i}slope`] = '55–155'
      })
      const names = tees.map(t => t.name.trim().toLowerCase()).filter(Boolean)
      if (new Set(names).size !== names.length) errs.teeDupe = 'Tee names must be unique'
    }
    const sis = holes.map(h => h.strokeIndex)
    if (new Set(sis).size !== 18 || sis.some(si => si < 1 || si > 18))
      errs.si = 'Each stroke index 1–18 must be used exactly once'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const course: Course = { id: uuidv4(), name: name.trim(), tees, holes, createdAt: new Date() }
      await db.courses.add(course)
      onSave()
    } catch (err) {
      console.error('Failed to save course:', err)
      setErrors(prev => ({ ...prev, save: 'Failed to save. Please try again.' }))
    } finally { setSaving(false) }
  }

  const namedTees = tees.filter(t => t.name.trim())
  const frontPar = holes.slice(0, 9).reduce((s, h) => s + h.par, 0)
  const backPar = holes.slice(9).reduce((s, h) => s + h.par, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-green-700 text-xl" aria-label="Back">←</button>
        <h1 className="text-xl font-bold">New Course</h1>
      </header>
      <div className="px-4 py-5 max-w-2xl mx-auto space-y-5">
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Course Name</label>
          <input type="text" placeholder="e.g. Pebble Beach Golf Links" value={name} onChange={e => setName(e.target.value)}
            className={`w-full h-12 px-4 rounded-xl border text-base focus:outline-none focus:ring-2 focus:ring-green-600 ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </section>
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tees</h2>
            <button onClick={addTee} className="bg-green-700 text-white text-sm px-4 h-9 rounded-lg font-semibold active:bg-green-800">+ Add Tee</button>
          </div>
          {errors.tees && <p className="text-red-500 text-sm mb-2">{errors.tees}</p>}
          {errors.teeDupe && <p className="text-red-500 text-sm mb-2">{errors.teeDupe}</p>}
          <div className="space-y-3">
            {tees.map((tee, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input type="text" placeholder="Color (e.g. Blue)" value={tee.name} onChange={e => updateTee(idx, { name: e.target.value })}
                    className={`flex-1 h-11 px-3 rounded-lg border text-base focus:outline-none focus:ring-2 focus:ring-green-600 ${errors[`tee${idx}name`] ? 'border-red-400' : 'border-gray-300'}`} />
                  {tees.length > 1 && (
                    <button onClick={() => removeTee(idx)} className="w-11 h-11 text-red-500 border border-red-200 rounded-lg flex items-center justify-center text-2xl leading-none" aria-label={`Remove ${tee.name || 'tee'}`}>×</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Course Rating</label>
                    <input type="number" inputMode="decimal" step="0.1" min="60" max="80" value={tee.rating} onChange={e => updateTee(idx, { rating: parseFloat(e.target.value) })}
                      className={`w-full h-11 px-3 rounded-lg border text-base focus:outline-none focus:ring-2 focus:ring-green-600 ${errors[`tee${idx}rating`] ? 'border-red-400' : 'border-gray-300'}`} />
                    {errors[`tee${idx}rating`] && <p className="text-red-500 text-xs mt-0.5">{errors[`tee${idx}rating`]}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Slope</label>
                    <input type="number" inputMode="numeric" min="55" max="155" value={tee.slope} onChange={e => updateTee(idx, { slope: parseInt(e.target.value) })}
                      className={`w-full h-11 px-3 rounded-lg border text-base focus:outline-none focus:ring-2 focus:ring-green-600 ${errors[`tee${idx}slope`] ? 'border-red-400' : 'border-gray-300'}`} />
                    {errors[`tee${idx}slope`] && <p className="text-red-500 text-xs mt-0.5">{errors[`tee${idx}slope`]}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Holes</h2>
          {errors.si && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3"><p className="text-red-600 text-sm">{errors.si}</p></div>}
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
                  <th className="text-center pb-2 w-8 font-medium">#</th>
                  <th className="text-center pb-2 font-medium px-1" style={{ minWidth: 96 }}>Par</th>
                  <th className="text-center pb-2 font-medium px-1 w-14">SI</th>
                  {namedTees.map(t => (
                    <th key={t.name} className="text-center pb-2 font-medium px-1" style={{ minWidth: 72 }}>
                      {t.name}<span className="normal-case text-gray-300 ml-0.5">yds</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holes.map(hole => (
                  <Fragment key={hole.number}>
                    {hole.number === 10 && (
                      <tr><td colSpan={3 + namedTees.length} className="pt-3 pb-1 border-t-2 border-green-200">
                        <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Back 9</span>
                      </td></tr>
                    )}
                    <tr className={hole.number % 2 === 0 ? 'bg-gray-50/60' : 'bg-white'}>
                      <td className="py-1 text-center font-semibold text-gray-500 w-8">{hole.number}</td>
                      <td className="py-1 px-1">
                        <div className="flex gap-0.5 justify-center">
                          {[3, 4, 5].map(p => (
                            <button key={p} onClick={() => updateHole(hole.number, { par: p })}
                              className={`w-8 h-9 text-sm font-semibold rounded transition-colors ${hole.par === p ? 'bg-green-700 text-white shadow-sm' : 'bg-gray-100 text-gray-600 active:bg-gray-200'}`}>{p}</button>
                          ))}
                        </div>
                      </td>
                      <td className="py-1 px-1">
                        <input type="number" inputMode="numeric" min={1} max={18} value={hole.strokeIndex}
                          onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) updateHole(hole.number, { strokeIndex: v }) }}
                          className="w-12 h-9 text-center rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                      </td>
                      {namedTees.map(tee => (
                        <td key={tee.name} className="py-1 px-1">
                          <input type="number" inputMode="numeric" min={0} max={700} placeholder="—" value={hole.yardages[tee.name] ?? ''}
                            onChange={e => { const v = parseInt(e.target.value); updateYardage(hole.number, tee.name, isNaN(v) ? 0 : v) }}
                            className="w-16 h-9 text-center rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300">
                <tr className="text-xs font-semibold text-gray-500">
                  <td className="pt-2 pb-0.5 text-center">Out</td><td className="pt-2 pb-0.5 text-center">{frontPar}</td><td />
                  {namedTees.map(t => <td key={t.name} className="pt-2 pb-0.5 text-center">{sumYards(holes, t.name, 0, 9) || '—'}</td>)}
                </tr>
                <tr className="text-xs font-semibold text-gray-500">
                  <td className="py-0.5 text-center">In</td><td className="py-0.5 text-center">{backPar}</td><td />
                  {namedTees.map(t => <td key={t.name} className="py-0.5 text-center">{sumYards(holes, t.name, 9, 18) || '—'}</td>)}
                </tr>
                <tr className="border-t border-gray-200 text-sm font-bold text-gray-800">
                  <td className="pt-2 text-center">Tot</td><td className="pt-2 text-center">{frontPar + backPar}</td><td />
                  {namedTees.map(t => <td key={t.name} className="pt-2 text-center">{sumYards(holes, t.name) || '—'}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        {errors.save && <p className="text-red-500 text-sm text-center">{errors.save}</p>}
      </div>
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-2xl mx-auto">
          <button onClick={handleSave} disabled={saving}
            className="w-full h-14 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg disabled:opacity-60 active:bg-green-800 transition-colors">
            {saving ? 'Saving…' : 'Save Course'}
          </button>
        </div>
      </div>
    </div>
  )
}
