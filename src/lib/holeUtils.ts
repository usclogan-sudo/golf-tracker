import type { CourseSnapshot, Hole, HolesMode, Round } from '../types'

// ─── Config type ──────────────────────────────────────────────────────────────

export interface HolesConfig {
  holesMode?: HolesMode
  startingHole?: number
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of playable holes based on mode and starting hole.
 *
 * - `front_9`: holes 1-9 (first half of the course)
 * - `back_9`: holes from (totalHoles/2 + 1) to end
 * - `full_18` with startingHole: rotates the full hole list so play begins at
 *   startingHole and wraps around (shotgun start)
 * - `full_18` (default): all holes in order
 */
export function getPlayableHoles(snapshot: CourseSnapshot, config?: HolesConfig): Hole[] {
  const allHoles = [...snapshot.holes].sort((a, b) => a.number - b.number)
  const mode = config?.holesMode ?? 'full_18'
  const totalHoles = allHoles.length

  if (mode === 'front_9') {
    const half = Math.ceil(totalHoles / 2)
    return allHoles.slice(0, half)
  }

  if (mode === 'back_9') {
    const half = Math.ceil(totalHoles / 2)
    return allHoles.slice(half)
  }

  // full_18 — check for shotgun rotation
  const startHole = config?.startingHole ?? 1
  if (startHole > 1) {
    const startIdx = allHoles.findIndex(h => h.number === startHole)
    if (startIdx > 0) {
      return [...allHoles.slice(startIdx), ...allHoles.slice(0, startIdx)]
    }
  }

  return allHoles
}

/** Returns just the hole numbers in play order. */
export function getPlayableHoleNumbers(snapshot: CourseSnapshot, config?: HolesConfig): number[] {
  return getPlayableHoles(snapshot, config).map(h => h.number)
}

/**
 * Returns a new CourseSnapshot containing only the playable holes (in play order).
 * All other snapshot fields (tees, courseId, courseName) are preserved.
 */
export function makePlayableSnapshot(snapshot: CourseSnapshot, config?: HolesConfig): CourseSnapshot {
  return {
    ...snapshot,
    holes: getPlayableHoles(snapshot, config),
  }
}

/**
 * Splits the playable holes into front and back halves based on play order
 * (not course hole numbers). For a 9-hole round the split is 5/4.
 */
export function getFrontBackSplit(playableHoles: Hole[]): { frontHoles: number[]; backHoles: number[] } {
  const half = Math.ceil(playableHoles.length / 2)
  return {
    frontHoles: playableHoles.slice(0, half).map(h => h.number),
    backHoles: playableHoles.slice(half).map(h => h.number),
  }
}

/** Extract HolesConfig from a Round, optionally applying a group's shotgun start. */
export function roundToHolesConfig(round: Round, groupNumber?: number): HolesConfig {
  let startingHole = round.startingHole

  // If this group has a shotgun start, override the starting hole
  if (groupNumber != null && round.shotgunStarts?.[groupNumber] != null) {
    startingHole = round.shotgunStarts[groupNumber]
  }

  return {
    holesMode: round.holesMode,
    startingHole,
  }
}
