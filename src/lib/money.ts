const MAX_DOLLARS = 100_000

export function parseDollarsToCents(input: string | number | null | undefined, opts?: { allowZero?: boolean }): number {
  const allowZero = opts?.allowZero ?? true
  const raw = typeof input === 'number' ? input : parseFloat(String(input ?? '').trim())
  if (!Number.isFinite(raw)) return 0
  const cents = Math.round(raw * 100)
  if (!Number.isFinite(cents)) return 0
  const clamped = Math.min(Math.max(cents, allowZero ? 0 : 1), MAX_DOLLARS * 100)
  return clamped
}

export function parsePointsValue(input: string | number | null | undefined): number {
  const raw = typeof input === 'number' ? input : parseFloat(String(input ?? '').trim())
  if (!Number.isFinite(raw)) return 0
  const v = Math.round(raw)
  if (!Number.isFinite(v)) return 0
  return Math.min(Math.max(v, 0), MAX_DOLLARS)
}
