/**
 * Client for GolfCourseAPI.com (free tier: 300 req/day).
 * API key stored in VITE_GOLF_COURSE_API_KEY env var.
 */

const API_BASE = 'https://api.golfcourseapi.com/v1'

function getApiKey(): string {
  return (import.meta.env.VITE_GOLF_COURSE_API_KEY as string) ?? ''
}

function headers() {
  return {
    Authorization: `Key ${getApiKey()}`,
  }
}

// ─── Response types ──────────────────────────────────────────────────────────

export interface ApiTee {
  tee_name: string
  course_rating: number
  slope_rating: number
  front_course_rating?: number
  front_slope_rating?: number
  back_course_rating?: number
  back_slope_rating?: number
  par_total?: number
  yardage_total?: number
}

export interface ApiHole {
  hole_number: number
  par: number
  yardage?: number
  handicap?: number // stroke index
}

export interface ApiTeeBoxDetail {
  tee_name: string
  course_rating: number
  slope_rating: number
  holes?: ApiHole[]
}

export interface ApiCourseSearchResult {
  id: string
  club_name: string
  course_name: string
  location: {
    address?: string
    city?: string
    state?: string
    country?: string
    latitude?: number
    longitude?: number
  }
  holes?: number
  tees?: ApiTee[]
}

export interface ApiCourseDetail {
  id: string
  club_name: string
  course_name: string
  location: {
    address?: string
    city?: string
    state?: string
    country?: string
  }
  holes?: number
  teeboxes?: ApiTeeBoxDetail[]
}

// ─── Normalized types for our app ────────────────────────────────────────────

export interface SearchResult {
  id: string
  name: string       // "course_name" or "club_name - course_name"
  city: string
  state: string
  holeCount: number
  teeCount: number
}

// ─── API functions ───────────────────────────────────────────────────────────

export async function searchCourses(query: string): Promise<SearchResult[]> {
  if (!getApiKey() || !query.trim()) return []
  try {
    const res = await fetch(
      `${API_BASE}/courses?search=${encodeURIComponent(query.trim())}`,
      { headers: headers() },
    )
    if (!res.ok) return []
    const data = await res.json()
    const courses: ApiCourseSearchResult[] = data.courses ?? []
    return courses.map(c => ({
      id: c.id,
      name: c.course_name
        ? (c.club_name && c.club_name !== c.course_name ? `${c.club_name} - ${c.course_name}` : c.course_name)
        : c.club_name,
      city: c.location?.city ?? '',
      state: c.location?.state ?? '',
      holeCount: c.holes ?? 18,
      teeCount: c.tees?.length ?? 0,
    }))
  } catch {
    return []
  }
}

export async function getCourseDetails(courseId: string): Promise<ApiCourseDetail | null> {
  if (!getApiKey()) return null
  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}`, { headers: headers() })
    if (!res.ok) return null
    return (await res.json()) as ApiCourseDetail
  } catch {
    return null
  }
}

/**
 * Check whether the API returned enough hole-level detail to build a complete Course.
 * "Complete" = at least one tee has per-hole par and handicap (stroke index) data.
 */
export function hasCompleteScorecard(detail: ApiCourseDetail): boolean {
  if (!detail.teeboxes?.length) return false
  return detail.teeboxes.some(
    tb => tb.holes?.length && tb.holes.length >= 9
      && tb.holes.every(h => h.par > 0 && h.handicap != null && h.handicap > 0),
  )
}
