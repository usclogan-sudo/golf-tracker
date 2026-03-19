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
  queue.push({
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  })
  saveQueue(queue)
}

export function getPending(): number {
  return getQueue().length
}

export async function flush(): Promise<{ synced: number; failed: number }> {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

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
        result = await supabase.from(op.table).update(op.data).eq(op.matchColumn, op.matchValue)
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
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}
