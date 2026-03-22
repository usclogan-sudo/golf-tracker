import { useRef, useState, useCallback } from 'react'

export function useShareImage(filename: string) {
  const shareRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)

  const shareImage = useCallback(async () => {
    if (!shareRef.current || sharing) return
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(shareRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      })

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      )
      if (!blob) return

      const safeName = filename.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
      const file = new File([blob], `${safeName}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
        } catch (e) {
          // User cancelled share sheet — not an error
          if (e instanceof Error && e.name === 'AbortError') return
          throw e
        }
      } else {
        // Desktop fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${safeName}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setSharing(false)
    }
  }, [filename, sharing])

  return { shareRef, sharing, shareImage }
}
