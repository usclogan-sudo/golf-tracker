import type { PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js'
import { reportSupabaseError } from './sentry'

type SupabaseResult = PostgrestSingleResponse<any> | PostgrestResponse<any>

/**
 * Wraps a Supabase write call to ensure errors are surfaced (console + Sentry).
 * Use for fire-and-forget writes where you don't need the result but want to
 * know if something went wrong.
 *
 * Usage:
 *   safeWrite(supabase.from('table').insert(data), 'insert notification')
 */
export async function safeWrite(
  promise: PromiseLike<SupabaseResult>,
  label: string
): Promise<boolean> {
  try {
    const result = await promise
    if (result.error) {
      console.error(`[safeWrite] ${label}:`, result.error.message)
      reportSupabaseError(result.error, `safeWrite.${label}`)
      return false
    }
    return true
  } catch (err) {
    console.error(`[safeWrite] ${label}:`, err)
    reportSupabaseError(err, `safeWrite.${label}.exception`)
    return false
  }
}
