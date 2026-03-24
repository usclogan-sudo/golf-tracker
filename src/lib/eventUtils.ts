export const MAX_PER_GROUP = 5

/**
 * Auto-assign players to groups using round-robin distribution.
 * If all players fit in one group, they all go to group 1.
 */
export function autoAssignGroups(
  playerIds: string[],
  maxPerGroup: number = MAX_PER_GROUP,
): Record<string, number> {
  const groups: Record<string, number> = {}
  if (playerIds.length <= maxPerGroup) {
    playerIds.forEach(id => { groups[id] = 1 })
  } else {
    const numGroups = Math.ceil(playerIds.length / maxPerGroup)
    playerIds.forEach((id, i) => { groups[id] = (i % numGroups) + 1 })
  }
  return groups
}

/**
 * Validate group assignments: no group exceeds max size.
 */
export function validateGroups(
  groups: Record<string, number>,
  maxPerGroup: number = MAX_PER_GROUP,
): { valid: boolean; oversizedGroups: number[] } {
  const counts = new Map<number, number>()
  for (const groupNum of Object.values(groups)) {
    counts.set(groupNum, (counts.get(groupNum) ?? 0) + 1)
  }
  const oversizedGroups: number[] = []
  for (const [groupNum, count] of counts) {
    if (count > maxPerGroup) oversizedGroups.push(groupNum)
  }
  return { valid: oversizedGroups.length === 0, oversizedGroups }
}
