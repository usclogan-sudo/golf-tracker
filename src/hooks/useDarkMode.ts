import { useState, useEffect } from 'react'

const KEY = 'gimme-dark-mode'
const LEGACY_KEY = 'fore-skins-dark-mode'

function readInitial(): boolean {
  const current = localStorage.getItem(KEY)
  if (current !== null) return current === 'true'
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy !== null) {
    localStorage.setItem(KEY, legacy)
    localStorage.removeItem(LEGACY_KEY)
    return legacy === 'true'
  }
  return false
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState(readInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem(KEY, String(isDark))
  }, [isDark])

  return { isDark, toggle: () => setIsDark(v => !v) }
}
