// Gimme — wordmark. "GIMME" set in the display serif (Playfair Display),
// tracked wide. Optional brass "THAT'S GOOD." sub-line for hero moments.
import type { CSSProperties } from 'react'

type Tone = 'onNavy' | 'onLight'

const INK: Record<Tone, string> = {
  onNavy: '#F2ECDD', // cream on navy
  onLight: '#16263B', // navy on cream
}

export function Wordmark({
  size = 28,
  tone = 'onNavy',
  subline = false,
  style,
}: {
  size?: number
  tone?: Tone
  subline?: boolean
  style?: CSSProperties
}) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1, ...style }}>
      <span
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontWeight: 800,
          fontSize: size,
          letterSpacing: '0.14em',
          color: INK[tone],
          // pull the right padding the tracking adds, so the mark optically centers
          paddingLeft: '0.14em',
        }}
      >
        GIMME
      </span>
      {subline && (
        <span
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontWeight: 600,
            fontSize: Math.max(9, Math.round(size * 0.32)),
            letterSpacing: '0.28em',
            color: '#C2A24C',
            marginTop: Math.round(size * 0.18),
            paddingLeft: '0.28em',
          }}
        >
          THAT&apos;S GOOD.
        </span>
      )}
    </span>
  )
}

export default Wordmark
