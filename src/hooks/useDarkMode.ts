import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    localStorage.getItem('fore-skins-dark-mode') === 'true'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('fore-skins-dark-mode', String(isDark))
  }, [isDark])

  return { isDark, toggle: () => setIsDark(v => !v) }
}
