import { forwardRef } from 'react'
import type { StakesMode } from '../../types'

export interface ShareCardLeaderboardEntry {
  pos: number
  name: string
  gross: number
  net: number
  vsPar: number
}

export interface ShareCardPayout {
  name: string
  amountCents: number
  reason: string
}

export interface ShareCardProps {
  courseName: string
  date: Date
  gameLabel: string | null
  stakesMode?: StakesMode
  leaderboard: ShareCardLeaderboardEntry[]
  gameResults: string[]
  payouts: ShareCardPayout[]
  totalPot: number | null
}

function fmtShareMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function fmtVsPar(n: number): string {
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { courseName, date, gameLabel, stakesMode, leaderboard, gameResults, payouts, totalPot },
  ref
) {
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const isHighRoller = stakesMode === 'high_roller'

  return (
    <div
      ref={ref}
      style={{
        width: 390,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        backgroundColor: '#ffffff',
        color: '#1f2937',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: isHighRoller
            ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
            : 'linear-gradient(135deg, #1f2937, #374151)',
          padding: '20px 24px 16px',
          color: '#ffffff',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, opacity: 0.7, marginBottom: 4 }}>
          FORE SKINS
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{courseName}</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          {dateStr}{gameLabel ? ` · ${gameLabel}` : ''}{isHighRoller ? ' · HIGH ROLLER' : ''}
        </div>
        {totalPot !== null && totalPot > 0 && (
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
            Pot: {fmtShareMoney(totalPot)}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{ padding: '12px 24px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
            Leaderboard
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 10, textTransform: 'uppercase' }}>#</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 10, textTransform: 'uppercase' }}>Player</th>
                <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 10, textTransform: 'uppercase' }}>Gross</th>
                <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 10, textTransform: 'uppercase' }}>Net</th>
                <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600, color: '#9ca3af', fontSize: 10, textTransform: 'uppercase' }}>vs Par</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => {
                const isLeader = entry.pos === 1
                return (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: isLeader ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <td style={{ padding: '8px 4px', fontWeight: 700, color: isLeader ? '#d97706' : '#6b7280' }}>
                      {entry.pos}
                    </td>
                    <td style={{ padding: '8px 4px', fontWeight: isLeader ? 700 : 500 }}>
                      {entry.name}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center', color: '#6b7280' }}>
                      {entry.gross}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 600 }}>
                      {entry.net}
                    </td>
                    <td style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: 600,
                      color: entry.vsPar < 0 ? '#dc2626' : entry.vsPar > 0 ? '#6b7280' : '#059669',
                    }}>
                      {fmtVsPar(entry.vsPar)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Game Results */}
      {gameResults.length > 0 && (
        <div style={{ padding: '8px 24px 12px', backgroundColor: '#f9fafb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
            Game Results
          </div>
          {gameResults.map((line, idx) => (
            <div key={idx} style={{ fontSize: 13, color: '#374151', padding: '3px 0', lineHeight: 1.4 }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Payouts */}
      {payouts.length > 0 && (
        <div style={{ padding: '8px 24px 12px', backgroundColor: '#f0fdf4' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
            Payouts
          </div>
          {payouts.map((p, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>{p.name}</span>
                <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{p.reason}</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#166534' }}>{fmtShareMoney(p.amountCents)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '10px 24px 14px', textAlign: 'center' }}>
        <span style={{ fontSize: 10, color: '#d1d5db', fontWeight: 600, letterSpacing: 1 }}>
          FORE SKINS GOLF TRACKER
        </span>
        <br />
        <span style={{ fontSize: 8, color: '#e5e7eb', fontWeight: 400, letterSpacing: 0.5 }}>
          usclogan-sudo.github.io/golf-tracker
        </span>
      </div>
    </div>
  )
})
