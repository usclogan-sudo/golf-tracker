// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Chainable Supabase mock ────────────────────────────────────────────────
// Each from() call creates a fresh query builder that records the chain and
// resolves to a controllable { data, error } when awaited via select/upsert/insert.

let mockResults: Array<{ data: any; error: any }> = []
let callIndex = 0

/** Record of every from() call and its chain */
let fromCalls: Array<{
  table: string
  method: string
  methodArg: any
  eqCalls: Array<[string, string]>
  selectedCalled: boolean
}> = []

function createChain(record: typeof fromCalls[0]) {
  const chain: any = {
    eq: (...args: [string, string]) => {
      record.eqCalls.push(args)
      return chain
    },
    select: () => {
      record.selectedCalled = true
      const result = mockResults[callIndex++] ?? { data: null, error: null }
      return Promise.resolve(result)
    },
    then: undefined as any, // makes it non-thenable so only select() triggers resolution
  }
  return chain
}

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const record = { table, method: '', methodArg: null, eqCalls: [] as any[], selectedCalled: false }
      fromCalls.push(record)
      return {
        upsert: (data: any) => {
          record.method = 'upsert'
          record.methodArg = data
          const result = mockResults[callIndex++] ?? { data: null, error: null }
          return Promise.resolve(result)
        },
        insert: (data: any) => {
          record.method = 'insert'
          record.methodArg = data
          const result = mockResults[callIndex++] ?? { data: null, error: null }
          return Promise.resolve(result)
        },
        update: (data: any) => {
          record.method = 'update'
          record.methodArg = data
          return createChain(record)
        },
      }
    }),
  },
}))

import { enqueue, getPending, flush, clearQueue } from '../offlineQueue'

const QUEUE_KEY = 'fore-skins-offline-queue'

beforeEach(() => {
  localStorage.clear()
  mockResults = []
  callIndex = 0
  fromCalls = []
})

// ─── enqueue ────────────────────────────────────────────────────────────────

describe('enqueue', () => {
  it('adds item to localStorage', () => {
    enqueue({ table: 'hole_scores', method: 'upsert', data: { id: 'hs-1' } })
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY)!)
    expect(stored).toHaveLength(1)
    expect(stored[0].table).toBe('hole_scores')
  })

  it('assigns id and timestamp', () => {
    enqueue({ table: 'rounds', method: 'insert', data: { id: 'r-1' } })
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY)!)
    expect(stored[0].id).toBeDefined()
    expect(typeof stored[0].id).toBe('string')
    expect(stored[0].timestamp).toBeDefined()
    expect(typeof stored[0].timestamp).toBe('number')
  })

  it('preserves existing items', () => {
    enqueue({ table: 'rounds', method: 'insert', data: { id: 'r-1' } })
    enqueue({ table: 'rounds', method: 'insert', data: { id: 'r-2' } })
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY)!)
    expect(stored).toHaveLength(2)
  })

  it('stores all fields including _expectedUpdatedAt', () => {
    enqueue({
      table: 'hole_scores', method: 'update', data: { gross_score: 4 },
      matchColumn: 'id', matchValue: 'hs-1', _expectedUpdatedAt: '2025-06-01T12:00:00Z',
    })
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY)!)
    expect(stored[0].matchColumn).toBe('id')
    expect(stored[0].matchValue).toBe('hs-1')
    expect(stored[0]._expectedUpdatedAt).toBe('2025-06-01T12:00:00Z')
  })
})

// ─── getPending ─────────────────────────────────────────────────────────────

describe('getPending', () => {
  it('returns 0 when empty', () => {
    expect(getPending()).toBe(0)
  })

  it('returns correct count after enqueues', () => {
    enqueue({ table: 'a', method: 'insert', data: {} })
    enqueue({ table: 'b', method: 'insert', data: {} })
    enqueue({ table: 'c', method: 'insert', data: {} })
    expect(getPending()).toBe(3)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(QUEUE_KEY, 'not-valid-json{{{')
    expect(getPending()).toBe(0)
  })
})

// ─── clearQueue ─────────────────────────────────────────────────────────────

describe('clearQueue', () => {
  it('removes from localStorage', () => {
    enqueue({ table: 'rounds', method: 'insert', data: {} })
    clearQueue()
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull()
  })

  it('getPending returns 0 after clear', () => {
    enqueue({ table: 'rounds', method: 'insert', data: {} })
    clearQueue()
    expect(getPending()).toBe(0)
  })
})

// ─── flush: basic operations ────────────────────────────────────────────────

describe('flush', () => {
  it('empty queue returns { synced: 0, failed: 0 }', async () => {
    const result = await flush()
    expect(result).toEqual({ synced: 0, failed: 0 })
  })

  it('calls upsert with correct data', async () => {
    enqueue({ table: 'hole_scores', method: 'upsert', data: { id: 'hs-1', gross_score: 4 } })
    mockResults = [{ data: [{}], error: null }]
    await flush()
    expect(fromCalls[0].table).toBe('hole_scores')
    expect(fromCalls[0].method).toBe('upsert')
    expect(fromCalls[0].methodArg).toEqual({ id: 'hs-1', gross_score: 4 })
  })

  it('calls insert with correct data', async () => {
    enqueue({ table: 'rounds', method: 'insert', data: { id: 'r-1' } })
    mockResults = [{ data: [{}], error: null }]
    await flush()
    expect(fromCalls[0].method).toBe('insert')
    expect(fromCalls[0].methodArg).toEqual({ id: 'r-1' })
  })

  it('clears queue after all succeed', async () => {
    enqueue({ table: 'hole_scores', method: 'upsert', data: { id: 'hs-1' } })
    mockResults = [{ data: [{}], error: null }]
    const result = await flush()
    expect(result).toEqual({ synced: 1, failed: 0 })
    expect(getPending()).toBe(0)
  })

  it('keeps failed ops in queue', async () => {
    enqueue({ table: 'hole_scores', method: 'upsert', data: { id: 'hs-1' } })
    mockResults = [{ data: null, error: { message: 'Network error' } }]
    const result = await flush()
    expect(result).toEqual({ synced: 0, failed: 1 })
    expect(getPending()).toBe(1)
  })

  it('continues processing after individual failures', async () => {
    enqueue({ table: 'a', method: 'upsert', data: { id: '1' } })
    enqueue({ table: 'b', method: 'upsert', data: { id: '2' } })
    mockResults = [
      { data: null, error: { message: 'fail' } },
      { data: [{}], error: null },
    ]
    const result = await flush()
    expect(result).toEqual({ synced: 1, failed: 1 })
    expect(getPending()).toBe(1)
  })
})

// ─── flush: update chain ────────────────────────────────────────────────────

describe('flush update operations', () => {
  it('calls update().eq(matchColumn, matchValue).select() for updates', async () => {
    enqueue({
      table: 'rounds', method: 'update', data: { status: 'complete' },
      matchColumn: 'id', matchValue: 'r-1',
    })
    mockResults = [{ data: [{ id: 'r-1' }], error: null }]
    const result = await flush()
    expect(result.synced).toBe(1)
    expect(fromCalls[0].method).toBe('update')
    expect(fromCalls[0].methodArg).toEqual({ status: 'complete' })
    expect(fromCalls[0].eqCalls[0]).toEqual(['id', 'r-1'])
    expect(fromCalls[0].selectedCalled).toBe(true)
  })

  it('does NOT add _expectedUpdatedAt eq for non-hole_scores tables', async () => {
    enqueue({
      table: 'rounds', method: 'update', data: { status: 'complete' },
      matchColumn: 'id', matchValue: 'r-1', _expectedUpdatedAt: '2025-06-01T12:00:00Z',
    })
    mockResults = [{ data: [{ id: 'r-1' }], error: null }]
    await flush()
    // Only one .eq() call — the matchColumn one, NOT the updated_at one
    expect(fromCalls[0].eqCalls).toHaveLength(1)
    expect(fromCalls[0].eqCalls[0]).toEqual(['id', 'r-1'])
  })

  it('adds _expectedUpdatedAt eq filter for hole_scores table', async () => {
    enqueue({
      table: 'hole_scores', method: 'update', data: { gross_score: 5 },
      matchColumn: 'id', matchValue: 'hs-1', _expectedUpdatedAt: '2025-06-01T12:00:00Z',
    })
    mockResults = [{ data: [{ id: 'hs-1' }], error: null }]
    await flush()
    // Two .eq() calls: matchColumn + updated_at
    expect(fromCalls[0].eqCalls).toHaveLength(2)
    expect(fromCalls[0].eqCalls[0]).toEqual(['id', 'hs-1'])
    expect(fromCalls[0].eqCalls[1]).toEqual(['updated_at', '2025-06-01T12:00:00Z'])
  })
})

// ─── flush: score conflict detection ────────────────────────────────────────

describe('flush score conflict detection', () => {
  it('0-row update with _expectedUpdatedAt treated as resolved (not failed)', async () => {
    enqueue({
      table: 'hole_scores', method: 'update', data: { gross_score: 5 },
      matchColumn: 'id', matchValue: 'hs-1', _expectedUpdatedAt: '2025-06-01T12:00:00Z',
    })
    // Supabase returns empty array — someone else already updated this score
    mockResults = [{ data: [], error: null }]
    const result = await flush()
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(0)
    expect(getPending()).toBe(0)
  })

  it('1-row update with _expectedUpdatedAt treated as normal success', async () => {
    enqueue({
      table: 'hole_scores', method: 'update', data: { gross_score: 5 },
      matchColumn: 'id', matchValue: 'hs-1', _expectedUpdatedAt: '2025-06-01T12:00:00Z',
    })
    mockResults = [{ data: [{ id: 'hs-1', gross_score: 5 }], error: null }]
    const result = await flush()
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(0)
    expect(getPending()).toBe(0)
  })

  it('update without _expectedUpdatedAt does NOT trigger conflict resolution', async () => {
    enqueue({
      table: 'hole_scores', method: 'update', data: { gross_score: 5 },
      matchColumn: 'id', matchValue: 'hs-1',
      // no _expectedUpdatedAt
    })
    // 0 rows but no conflict flag — goes through normal path, result has no error so synced
    mockResults = [{ data: [], error: null }]
    const result = await flush()
    // Without _expectedUpdatedAt, the 0-row check is skipped → falls through to error check
    // result.error is null → synced++
    expect(result.synced).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('update error still counts as failed', async () => {
    enqueue({
      table: 'hole_scores', method: 'update', data: { gross_score: 5 },
      matchColumn: 'id', matchValue: 'hs-1', _expectedUpdatedAt: '2025-06-01T12:00:00Z',
    })
    mockResults = [{ data: null, error: { message: 'RLS violation' } }]
    const result = await flush()
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(1)
    expect(getPending()).toBe(1)
  })

  it('mixed: upsert success + conflict-resolved update + failed insert', async () => {
    enqueue({ table: 'hole_scores', method: 'upsert', data: { id: 'hs-1' } })
    enqueue({
      table: 'hole_scores', method: 'update', data: { gross_score: 3 },
      matchColumn: 'id', matchValue: 'hs-2', _expectedUpdatedAt: '2025-06-01T12:00:00Z',
    })
    enqueue({ table: 'rounds', method: 'insert', data: { id: 'r-1' } })
    mockResults = [
      { data: [{}], error: null },        // upsert succeeds
      { data: [], error: null },           // update conflict → resolved
      { data: null, error: { message: 'fail' } }, // insert fails
    ]
    const result = await flush()
    expect(result.synced).toBe(2)
    expect(result.failed).toBe(1)
    expect(getPending()).toBe(1)
    // Only the failed insert remains
    const remaining = JSON.parse(localStorage.getItem(QUEUE_KEY)!)
    expect(remaining[0].table).toBe('rounds')
    expect(remaining[0].method).toBe('insert')
  })

  it('skips update ops missing matchColumn/matchValue', async () => {
    enqueue({ table: 'hole_scores', method: 'update', data: { gross_score: 5 } })
    // No matchColumn/matchValue → the update branch isn't entered
    // result stays undefined → result?.error is undefined → synced++
    const result = await flush()
    expect(result.synced).toBe(1)
  })
})
