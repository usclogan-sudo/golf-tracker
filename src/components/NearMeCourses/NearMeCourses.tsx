import { useEffect, useRef, useState } from 'react'

interface NearbyCourse {
  id: number
  name: string
  lat: number
  lon: number
  distanceMiles: number
  holes?: string
  website?: string
}

interface Props {
  onAddCourse: (courseName?: string) => void
}

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function courseHash(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff
  return Math.abs(hash)
}

function courseGradient(name: string): string {
  const gradients = [
    'linear-gradient(135deg, #1a4731 0%, #2d7a53 100%)',
    'linear-gradient(135deg, #0d3320 0%, #1b5c3a 100%)',
    'linear-gradient(135deg, #163d22 0%, #2a6b44 100%)',
    'linear-gradient(135deg, #0f3d2a 0%, #1e6645 100%)',
    'linear-gradient(135deg, #0a2e1a 0%, #175e38 100%)',
    'linear-gradient(135deg, #1c3a15 0%, #336b28 100%)',
  ]
  return gradients[courseHash(name) % gradients.length]
}

/** SVG golf scene overlay — varies by course name for visual variety */
function CourseScene({ name }: { name: string }) {
  const h = courseHash(name)
  const variant = h % 4
  // Vary hill shapes, tree positions, flag position
  const hillY = 50 + (h % 20)
  const flagX = 100 + (h % 80)
  const treeX1 = 20 + (h % 40)
  const treeX2 = 140 + (h % 50)
  const hasWater = variant === 2
  const hasBunker = variant === 1 || variant === 3

  return (
    <svg viewBox="0 0 208 96" fill="none" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
      {/* Sky gradient overlay */}
      <defs>
        <linearGradient id={`sky-${h}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#87CEEB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="208" height="50" fill={`url(#sky-${h})`} />

      {/* Rolling hills / fairway */}
      <path
        d={`M0 ${hillY} Q52 ${hillY - 18} 104 ${hillY - 5} Q156 ${hillY + 10} 208 ${hillY - 8} L208 96 L0 96 Z`}
        fill="#2e8b57" opacity="0.35"
      />
      <path
        d={`M0 ${hillY + 12} Q70 ${hillY - 2} 130 ${hillY + 8} Q180 ${hillY + 18} 208 ${hillY + 5} L208 96 L0 96 Z`}
        fill="#228b22" opacity="0.3"
      />

      {/* Water hazard */}
      {hasWater && (
        <ellipse cx="160" cy={hillY + 20} rx="35" ry="10" fill="#1e90ff" opacity="0.25" />
      )}

      {/* Bunker */}
      {hasBunker && (
        <ellipse cx={flagX + 20} cy={hillY + 8} rx="12" ry="5" fill="#f4e4a0" opacity="0.4" />
      )}

      {/* Trees */}
      <g opacity="0.5">
        {/* Tree 1 */}
        <rect x={treeX1} y={hillY - 22} width="2.5" height="14" fill="#3d2b1f" />
        <ellipse cx={treeX1 + 1} cy={hillY - 25} rx="8" ry="10" fill="#1b5e20" />
        {/* Tree 2 */}
        <rect x={treeX2} y={hillY - 18} width="2" height="12" fill="#3d2b1f" />
        <ellipse cx={treeX2 + 1} cy={hillY - 21} rx="6" ry="8" fill="#2e7d32" />
        {/* Tree 3 (sometimes) */}
        {variant !== 0 && (
          <>
            <rect x={treeX1 + 60} y={hillY - 15} width="2" height="10" fill="#3d2b1f" />
            <ellipse cx={treeX1 + 61} cy={hillY - 18} rx="7" ry="9" fill="#1b5e20" />
          </>
        )}
      </g>

      {/* Flag */}
      <g>
        <line x1={flagX} y1={hillY - 20} x2={flagX} y2={hillY + 2} stroke="white" strokeWidth="1.5" opacity="0.8" />
        <polygon points={`${flagX},${hillY - 20} ${flagX + 12},${hillY - 16} ${flagX},${hillY - 12}`} fill="#ef4444" opacity="0.85" />
        {/* Hole */}
        <ellipse cx={flagX} cy={hillY + 3} rx="3" ry="1.5" fill="#1a1a1a" opacity="0.4" />
      </g>

      {/* Subtle sun/moon */}
      <circle cx="185" cy="18" r="10" fill="#fbbf24" opacity="0.15" />
    </svg>
  )
}

export function NearMeCourses({ onAddCourse }: Props) {
  const [state, setState] = useState<'idle' | 'requesting' | 'loading' | 'done' | 'denied' | 'error'>('idle')
  const [courses, setCourses] = useState<NearbyCourse[]>([])
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const hasFetched = useRef(false)

  const requestLocation = () => {
    if (!navigator.geolocation) { setState('error'); return }
    setState('requesting')
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLon(pos.coords.longitude); setState('loading') },
      () => setState('denied'),
      { timeout: 10000, maximumAge: 300000 },
    )
  }

  useEffect(() => {
    if (state !== 'loading' || userLat === null || userLon === null || hasFetched.current) return
    hasFetched.current = true
    const query = `[out:json][timeout:15];(
      way["leisure"="golf_course"](around:40000,${userLat},${userLon});
      relation["leisure"="golf_course"](around:40000,${userLat},${userLon});
    );out center tags;`
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: query, headers: { 'Content-Type': 'text/plain' },
    })
      .then(r => r.json())
      .then(data => {
        const results: NearbyCourse[] = data.elements
          .filter((el: any) => el.tags?.name && (el.center || (el.lat && el.lon)))
          .map((el: any) => {
            const lat = el.center?.lat ?? el.lat
            const lon = el.center?.lon ?? el.lon
            return { id: el.id, name: el.tags.name, lat, lon,
              distanceMiles: distanceMiles(userLat!, userLon!, lat, lon),
              holes: el.tags['golf:holes'] ?? el.tags.holes }
          })
          .sort((a: NearbyCourse, b: NearbyCourse) => a.distanceMiles - b.distanceMiles)
          .slice(0, 8)
        setCourses(results)
        setState('done')
      })
      .catch(() => setState('error'))
  }, [state, userLat, userLon])

  if (state === 'idle') {
    return (
      <section>
        <h2 className="font-display font-semibold text-gray-800 text-base mb-3">Courses Near You</h2>
        <button onClick={requestLocation}
          className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm active:bg-gray-50">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📍</div>
          <div className="text-left">
            <p className="font-semibold text-gray-800">Find courses near me</p>
            <p className="text-sm text-gray-500 mt-0.5">Shows golf courses within 25 miles</p>
          </div>
        </button>
      </section>
    )
  }

  if (state === 'requesting' || state === 'loading') {
    return (
      <section>
        <h2 className="font-display font-semibold text-gray-800 text-base mb-3">Courses Near You</h2>
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-6 text-center shadow-sm">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 font-medium">{state === 'requesting' ? 'Getting your location…' : 'Finding nearby courses…'}</p>
        </div>
      </section>
    )
  }

  if (state === 'denied') {
    return (
      <section>
        <h2 className="font-display font-semibold text-gray-800 text-base mb-3">Courses Near You</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="font-semibold text-amber-800">Location access denied</p>
          <p className="text-amber-700 text-sm mt-1">
            Enable location in your browser settings, or{' '}
            <button onClick={() => onAddCourse()} className="underline font-semibold">add a course manually</button>.
          </p>
        </div>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section>
        <h2 className="font-display font-semibold text-gray-800 text-base mb-3">Courses Near You</h2>
        <div className="bg-gray-100 border border-gray-200 rounded-2xl px-5 py-4">
          <p className="font-semibold text-gray-700">Couldn't load nearby courses</p>
          <p className="text-gray-500 text-sm mt-1">
            <button onClick={() => { hasFetched.current = false; requestLocation() }}
              className="underline font-semibold text-amber-600">Try again</button>
          </p>
        </div>
      </section>
    )
  }

  if (state === 'done' && courses.length === 0) {
    return (
      <section>
        <h2 className="font-display font-semibold text-gray-800 text-base mb-3">Courses Near You</h2>
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-5 text-center shadow-sm">
          <p className="text-gray-500">No courses found within 25 miles.</p>
          <button onClick={() => onAddCourse()} className="mt-3 text-amber-600 font-semibold text-sm underline">Add a course manually</button>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-gray-800 text-base">
          Courses Near You
          <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{courses.length}</span>
        </h2>
        <button onClick={() => { hasFetched.current = false; requestLocation() }} className="text-amber-600 text-sm font-semibold">Refresh</button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {courses.map(course => (
          <button key={course.id} onClick={() => onAddCourse(course.name)}
            className="flex-none w-52 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden text-left active:scale-95 transition-transform snap-start">
            <div className="h-24 flex flex-col justify-end p-3 relative" style={{ background: courseGradient(course.name) }}>
              <CourseScene name={course.name} />
              <div className="bg-black/30 backdrop-blur-sm rounded-lg px-2 py-1 self-start relative z-10">
                <p className="text-white text-xs font-semibold">
                  📍 {course.distanceMiles < 1 ? `${(course.distanceMiles * 5280).toFixed(0)} ft` : `${course.distanceMiles.toFixed(1)} mi`}
                </p>
              </div>
            </div>
            <div className="px-3 py-3">
              <p className="font-display font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{course.name}</p>
              <p className="text-xs text-gray-500 mt-1">{course.holes ? `${course.holes} holes · ` : ''}Tap to add</p>
            </div>
          </button>
        ))}
        <button onClick={() => onAddCourse()}
          className="flex-none w-44 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center py-8 px-4 active:bg-gray-100 snap-start">
          <span className="text-3xl mb-2">+</span>
          <p className="text-gray-500 text-sm font-medium text-center">Add Custom Course</p>
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">Data from OpenStreetMap</p>
    </section>
  )
}
