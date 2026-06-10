import { forwardRef } from 'react'

export interface ShareCardStanding {
  name: string
  netCents: number
}

export interface ShareCardSettlement {
  fromName: string
  toName: string
  amountCents: number
}

export interface ShareCardProps {
  courseName: string
  date: Date
  gameLabel: string | null
  /** Sorted by netCents descending. First entry is the winner. */
  standings: ShareCardStanding[]
  /** Net-out who-owes-who pairs. */
  settlements: ShareCardSettlement[]
}

const NAVY  = '#16263B'
const CREAM = '#F2ECDD'
const BRASS = '#C2A24C'
const SLATE = '#2E4257'
const CREAM_MUTED = 'rgba(242, 236, 221, 0.62)'

const SERIF = '"Playfair Display", Georgia, serif'
const SANS  = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const SUBLINES = [
  'Standings are official.',
  'Squared away.',
  'Card of the year.',
  'Worth the walk.',
  'The course remembers.',
  '{winner} has the card.',
  '{winner} bought the next round. (Of golf.)',
  'Lunch is on {lastPlace}.',
]

function fmt(cents: number, withSign = false): string {
  const abs = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(cents) / 100)
  if (!withSign) return abs
  if (cents === 0) return abs
  return (cents > 0 ? '+' : '−') + abs
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function pickSubline(winner: string, lastPlace: string | null, salt: string): string {
  const pool = SUBLINES.filter(line => lastPlace || !line.includes('{lastPlace}'))
  const idx = hashStr(salt + winner) % pool.length
  return pool[idx]
    .replace('{winner}', winner)
    .replace('{lastPlace}', lastPlace ?? '')
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { courseName, date, gameLabel, standings, settlements },
  ref
) {
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const winner = standings.find(s => s.netCents > 0) ?? standings[0] ?? null
  const lastPlace = standings.length >= 3 ? standings[standings.length - 1] : null
  const subline = winner
    ? pickSubline(winner.name, lastPlace?.name ?? null, courseName + dateStr)
    : 'All square. Onto the next.'

  const contextLine = [courseName, gameLabel, dateStr].filter(Boolean).join(' · ').toUpperCase()

  return (
    <div
      ref={ref}
      style={{
        width: 540,
        height: 960,
        background: NAVY,
        color: CREAM,
        fontFamily: SANS,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 24,
          border: `1px solid ${BRASS}`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          padding: '52px 56px 40px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Seal placeholder — until public/seal.svg ships per docs/ICON-ASSETS-V1.md */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 86,
              height: 96,
              borderRadius: '50% / 46%',
              background: NAVY,
              border: `3px solid ${CREAM}`,
              boxShadow: `inset 0 0 0 2px ${BRASS}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: CREAM,
              fontFamily: SERIF,
              fontWeight: 800,
              fontSize: 46,
              lineHeight: 1,
              transform: 'translateY(-2px)',
            }}
          >
            G
          </div>
        </div>

        {/* Context line */}
        <div
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: BRASS,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {contextLine}
        </div>
        <div
          style={{
            height: 1,
            background: BRASS,
            opacity: 0.55,
            margin: '12px auto 32px',
            width: 220,
          }}
        />

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 54,
              lineHeight: 1.05,
              color: CREAM,
              letterSpacing: -0.5,
            }}
          >
            {winner && winner.netCents > 0 ? `${winner.name} takes it.` : 'All square.'}
          </div>
          {winner && winner.netCents > 0 && (
            <div
              style={{
                fontFamily: SERIF,
                fontWeight: 700,
                fontSize: 40,
                color: BRASS,
                marginTop: 6,
              }}
            >
              {fmt(winner.netCents, true)}
            </div>
          )}
        </div>

        {/* Sub-line */}
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 18,
            color: CREAM_MUTED,
            textAlign: 'center',
            marginBottom: 30,
          }}
        >
          {subline}
        </div>

        {/* Standings */}
        {standings.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 2.5,
                color: BRASS,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              STANDINGS
            </div>
            {standings.map((s, idx) => {
              const isWinner = idx === 0 && s.netCents > 0
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: SERIF,
                    fontWeight: isWinner ? 700 : 500,
                    fontSize: 18,
                    color: isWinner ? BRASS : CREAM_MUTED,
                    padding: '6px 0',
                    borderBottom: idx < standings.length - 1 ? `1px solid ${SLATE}` : 'none',
                  }}
                >
                  <span>{s.name}</span>
                  <span style={{ fontFeatureSettings: '"tnum" 1' }}>
                    {s.netCents === 0 ? 'E' : fmt(s.netCents, true)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Settle Up */}
        {settlements.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 2.5,
                color: BRASS,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              SETTLE UP
            </div>
            {settlements.map((s, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontFamily: SANS,
                  fontSize: 14,
                  color: CREAM,
                  padding: '4px 0',
                }}
              >
                <span>
                  {s.fromName} <span style={{ color: BRASS }}>→</span> {s.toName}
                </span>
                <span style={{ fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>
                  {fmt(s.amountCents)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 16 }} />

        {/* Footer */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: 1, background: BRASS, opacity: 0.55, width: 80, margin: '0 auto 10px' }} />
          <div
            style={{
              fontFamily: SANS,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 5,
              color: BRASS,
            }}
          >
            THAT&apos;S GOOD.
          </div>
        </div>
      </div>
    </div>
  )
})
