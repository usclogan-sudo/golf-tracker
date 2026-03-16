import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, courseToRow } from '../../lib/supabase'
import { venturaCourses } from '../../data/venturaCourses'
import type { Course } from '../../types'

interface Props {
  userId: string
  onDone: () => void
  onAddCustom: () => void
}

function totalPar(holes: { par: number }[]) {
  return holes.reduce((s, h) => s + h.par, 0)
}

export function CourseCatalog({ userId, onDone, onAddCustom }: Props) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const filtered = query.trim()
    ? venturaCourses.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.city.toLowerCase().includes(query.toLowerCase())
      )
    : venturaCourses

  // Group by city
  const cities = Array.from(new Set(filtered.map(c => c.city)))

  const handleAdd = async (templateName: string) => {
    if (adding) return
    const template = venturaCourses.find(c => c.name === templateName)
    if (!template) return

    // Check for duplicate
    const { count } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('name', template.name)
    if (count && count > 0) {
      setAdded(prev => new Set(prev).add(templateName))
      return
    }

    setAdding(templateName)
    setError(null)
    try {
      const course: Course = {
        id: uuidv4(),
        name: template.name,
        tees: template.tees,
        holes: template.holes,
        createdAt: new Date(),
      }
      const { error: err } = await supabase.from('courses').insert(courseToRow(course, userId))
      if (err) throw err
      setAdded(prev => new Set(prev).add(templateName))
      setTimeout(onDone, 600)
    } catch {
      setError(`Failed to add ${template.name}. Please try again.`)
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="app-header text-white px-4 py-4 sticky top-0 z-10 shadow-xl flex items-center gap-3">
        <button
          onClick={onDone}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-600 text-xl"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Course Catalog</h1>
      </header>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          <input
            type="text"
            placeholder="Search courses or city…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-2xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-3xl mb-2">⛳</p>
            <p className="font-medium">No courses match "{query}"</p>
          </div>
        )}

        {/* Course list grouped by city */}
        {cities.map(city => (
          <section key={city}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">{city}</h2>
            <div className="space-y-2">
              {filtered.filter(c => c.city === city).map(course => {
                const par = totalPar(course.holes)
                const isAdding = adding === course.name
                const isAdded = added.has(course.name)

                return (
                  <button
                    key={course.name}
                    onClick={() => handleAdd(course.name)}
                    disabled={isAdding || isAdded}
                    className={`w-full bg-white rounded-2xl shadow-sm border text-left px-4 py-4 flex items-center gap-4 transition-all
                      ${isAdded
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-gray-100 active:bg-gray-50'
                      }
                      ${isAdding ? 'opacity-70' : ''}
                    `}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl
                      ${isAdded ? 'bg-amber-100' : 'bg-gray-100'}`}>
                      {isAdded ? '✓' : '⛳'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm leading-tight ${isAdded ? 'text-green-800' : 'text-gray-900'}`}>
                        {course.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Par {par} · {course.tees.length} tees · {course.tees.map(t => t.name).join(', ')}
                      </p>
                    </div>
                    {isAdding ? (
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    ) : isAdded ? (
                      <span className="text-amber-600 font-semibold text-sm flex-shrink-0">Added</span>
                    ) : (
                      <span className="text-amber-600 font-semibold text-sm flex-shrink-0">+ Add</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        <p className="text-center text-xs text-gray-400 py-2">
          Ratings sourced from USGA/Greenskeeper.org · Verify before posting handicap rounds
        </p>
      </div>

      {/* Add Custom Course button */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onAddCustom}
            className="w-full h-14 border-2 border-green-700 text-amber-600 text-base font-bold rounded-2xl active:bg-amber-50 transition-colors"
          >
            + Add Custom Course
          </button>
        </div>
      </div>
    </div>
  )
}
