import { supabase } from './supabase'

const QUEUE_KEY = 'fore-skins-offline-queue'

export interface QueuedOperation {
  id: string
  table: string
  method: 'upsert' | 'insert' | 'update'
  data: Record<string, any>
  /** For updates: column to match on */
  matchColumn?: string
  matchValue?: string
  /** For hole_scores updates: expected updated_at for conflict detection */
  _expectedUpdatedAt?: string
  timestamp: number
}

function getQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedOperation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueue(op: Omit<QueuedOperation, 'id' | 'timestamp'>) {
  const queue = getQueue()
  // Deduplicate: replace existing entry for same table+key (last write wins)
  const existingIdx = op.matchColumn && op.matchValue
    ? queue.findIndex(q => q.table === op.table && q.matchColumn === op.matchColumn && q.matchValue === op.matchValue)
    : -1
  const entry = {
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  } as QueuedOperation
  if (existingIdx >= 0) {
    queue[existingIdx] = entry
  } else {
    queue.push(entry)
  }
  saveQueue(queue)
}

export function getPending(): number {
  return getQueue().length
}

let flushing = false

export async function flush(): Promise<{ synced: number; failed: number }> {
  if (flushing) return { synced: 0, failed: 0 }
  flushing = true
  try {
  const queue = getQueue()
  if (queue.length === 0) { flushing = false; return { synced: 0, failed: 0 } }

  let synced = 0
  let failed = 0
  const remaining: QueuedOperation[] = []

  for (const op of queue) {
    try {
      let result
      if (op.method === 'upsert') {
        result = await supabase.from(op.table).upsert(op.data)
      } else if (op.method === 'insert') {
        result = await supabase.from(op.table).insert(op.data)
      } else if (op.method === 'update' && op.matchColumn && op.matchValue) {
        const query = supabase.from(op.table).update(op.data).eq(op.matchColumn, op.matchValue)
        // Conflict detection: if we have an expected updated_at, condition on it
        if (op._expectedUpdatedAt && op.table === 'hole_scores') {
          query.eq('updated_at', op._expectedUpdatedAt)
        }
        result = await query.select()
        // If 0 rows updated on a conflict-checked write, someone else changed it — drop silently
        // (Realtime subscription already pushed the correct value)
        if (op._expectedUpdatedAt && result?.data && Array.isArray(result.data) && result.data.length === 0) {
          synced++ // treat as resolved (not failed)
          continue
        }
      }
      if (result?.error) {
        throw result.error
      }
      synced++
    } catch {
      failed++
      remaining.push(op)
    }
  }

  saveQueue(remaining)
  return { synced, failed }
  } finally {
    flushing = false
  }
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}
