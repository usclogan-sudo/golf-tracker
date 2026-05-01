import { useEffect } from 'react'

/**
 * Binds a `beforeunload` warning while `hasUnsaved` is true. Prevents the
 * user from navigating away (back button, tab close) while the offline
 * queue holds writes that haven't synced.
 *
 * Modern browsers ignore the custom message and show their own dialog —
 * we just need to set `returnValue` to trigger it.
 */
export function useUnsavedChangesPrompt(hasUnsaved: boolean) {
  useEffect(() => {
    if (!hasUnsaved) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])
}
