import { useState, useRef } from 'react'
import { ShareCard, useShareImage } from './index'
import type { ShareCardStanding, ShareCardSettlement } from './ShareCard'

type Scenario = {
  key: string
  label: string
  description: string
  courseName: string
  date: Date
  gameLabel: string | null
  standings: ShareCardStanding[]
  settlements: ShareCardSettlement[]
}

const SCENARIOS: Scenario[] = [
  {
    key: 'four-player-typical',
    label: '4 players, typical $20 round',
    description: 'The most common case — Skins, four golfers, one clear winner, three settlement lines.',
    courseName: 'Las Posas',
    date: new Date('2026-06-15T17:00:00'),
    gameLabel: 'Skins',
    standings: [
      { name: 'Connor', netCents: 2400 },
      { name: 'Dave',    netCents:  800 },
      { name: 'Maya',    netCents: -1000 },
      { name: 'Tom',     netCents: -2200 },
    ],
    settlements: [
      { fromName: 'Tom',  toName: 'Connor', amountCents: 1200 },
      { fromName: 'Tom',  toName: 'Dave',   amountCents: 1000 },
      { fromName: 'Maya', toName: 'Connor', amountCents: 1000 },
    ],
  },
  {
    key: 'two-player-no-lastplace',
    label: '2 players (no "lastPlace" sub-lines)',
    description: 'Hammer or one-on-one. lastPlace is null, so the rotator must filter out "Lunch is on {lastPlace}" templates.',
    courseName: 'Pelican Hill',
    date: new Date('2026-06-12T09:00:00'),
    gameLabel: 'Hammer',
    standings: [
      { name: 'Pat',  netCents: 4000 },
      { name: 'Rick', netCents: -4000 },
    ],
    settlements: [
      { fromName: 'Rick', toName: 'Pat', amountCents: 4000 },
    ],
  },
  {
    key: 'all-square',
    label: 'All square (no winner, no settlements)',
    description: 'Every player ties at zero net. Headline collapses to "All square."; sub-line uses the fallback.',
    courseName: 'Ventura CC',
    date: new Date('2026-05-30T13:00:00'),
    gameLabel: 'Best Ball',
    standings: [
      { name: 'Jess',   netCents: 0 },
      { name: 'Tomoko', netCents: 0 },
      { name: 'Stan',   netCents: 0 },
      { name: 'Maya',   netCents: 0 },
    ],
    settlements: [],
  },
  {
    key: 'large-stakes',
    label: 'Large stakes ($1,000+ buy-in)',
    description: 'Tests thousands-separator formatting and serif numeral width.',
    courseName: 'Pebble Beach',
    date: new Date('2026-06-20T08:30:00'),
    gameLabel: 'Nassau',
    standings: [
      { name: 'Connor', netCents: 250000 },
      { name: 'Dave',   netCents:  50000 },
      { name: 'Pat',    netCents: -100000 },
      { name: 'Maya',   netCents: -200000 },
    ],
    settlements: [
      { fromName: 'Maya', toName: 'Connor', amountCents: 200000 },
      { fromName: 'Pat',  toName: 'Connor', amountCents:  50000 },
      { fromName: 'Pat',  toName: 'Dave',   amountCents:  50000 },
    ],
  },
  {
    key: 'eight-players',
    label: '8 players (max roster)',
    description: 'Visual density check — verify the standings + settlements fit inside 540×960 without clipping.',
    courseName: 'Riviera CC',
    date: new Date('2026-06-08T07:30:00'),
    gameLabel: 'Skins · Junk',
    standings: [
      { name: 'Connor', netCents: 4000 },
      { name: 'Dave',   netCents: 2400 },
      { name: 'Rick',   netCents: 1000 },
      { name: 'Pat',    netCents:  600 },
      { name: 'Stan',   netCents:  -400 },
      { name: 'Maya',   netCents: -1200 },
      { name: 'Tomoko', netCents: -2400 },
      { name: 'Tom',    netCents: -4000 },
    ],
    settlements: [
      { fromName: 'Tom',    toName: 'Connor', amountCents: 4000 },
      { fromName: 'Tomoko', toName: 'Dave',   amountCents: 2400 },
      { fromName: 'Maya',   toName: 'Rick',   amountCents: 1000 },
      { fromName: 'Stan',   toName: 'Pat',    amountCents:  600 },
      { fromName: 'Maya',   toName: 'Pat',    amountCents:  200 },
    ],
  },
  {
    key: 'long-name',
    label: 'Long player name',
    description: 'Tests name truncation behavior. "Jonathan-Christopher" is 21 chars and should not push the amount off the right edge.',
    courseName: 'Olympic Club',
    date: new Date('2026-06-18T10:00:00'),
    gameLabel: 'Skins',
    standings: [
      { name: 'Jonathan-Christopher', netCents: 3000 },
      { name: 'Dave',                 netCents: 1000 },
      { name: 'Maya',                 netCents: -2000 },
      { name: 'Pat',                  netCents: -2000 },
    ],
    settlements: [
      { fromName: 'Maya', toName: 'Jonathan-Christopher', amountCents: 2000 },
      { fromName: 'Pat',  toName: 'Jonathan-Christopher', amountCents: 1000 },
      { fromName: 'Pat',  toName: 'Dave',                 amountCents: 1000 },
    ],
  },
  {
    key: 'no-game-label',
    label: 'No game label',
    description: 'Context line should drop the missing segment gracefully.',
    courseName: 'Soule Park',
    date: new Date('2026-06-22T11:00:00'),
    gameLabel: null,
    standings: [
      { name: 'Connor', netCents: 1500 },
      { name: 'Dave',   netCents: -1500 },
    ],
    settlements: [
      { fromName: 'Dave', toName: 'Connor', amountCents: 1500 },
    ],
  },
  {
    key: 'no-settlements',
    label: 'Standings without settlement graph',
    description: 'When SettleUp hasn\'t computed yet but standings exist. Settle Up section should hide.',
    courseName: 'Buenaventura',
    date: new Date('2026-06-25T14:00:00'),
    gameLabel: 'Best Ball',
    standings: [
      { name: 'Pat',  netCents: 2000 },
      { name: 'Rick', netCents: -2000 },
    ],
    settlements: [],
  },
]

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const { shareRef, sharing, shareImage } = useShareImage(`gimme-result-${scenario.key}`)
  const localRef = useRef<HTMLDivElement>(null)
  return (
    <div className="space-y-3 mb-12">
      <div>
        <h3 className="font-display text-xl font-bold text-cream">{scenario.label}</h3>
        <p className="text-xs text-cream/70 max-w-md leading-snug mt-1">{scenario.description}</p>
        <button
          onClick={shareImage}
          disabled={sharing}
          className="mt-2 px-3 py-1.5 bg-brass text-navy text-xs font-bold rounded-lg disabled:opacity-50"
        >
          {sharing ? 'Rendering…' : 'Render & share PNG'}
        </button>
      </div>
      <div className="bg-slate-brand/30 p-4 rounded-2xl inline-block">
        {/* Render at half-scale for preview density; the actual ShareCard renders at 540×960 */}
        <div ref={localRef} style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 540, height: 480 }}>
          <ShareCard
            ref={shareRef}
            courseName={scenario.courseName}
            date={scenario.date}
            gameLabel={scenario.gameLabel}
            standings={scenario.standings}
            settlements={scenario.settlements}
          />
        </div>
      </div>
    </div>
  )
}

export function ShareCardPreview() {
  const [activeKey, setActiveKey] = useState<string>('all')

  const visible = activeKey === 'all' ? SCENARIOS : SCENARIOS.filter(s => s.key === activeKey)

  return (
    <div className="min-h-screen bg-navy text-cream p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold">Result Card — Preview Harness</h1>
          <p className="text-cream/70 mt-1 text-sm">
            Visual QA for the brand v1.0 result card. Each scenario renders at half-scale (real card is 540×960).
            Click "Render &amp; share PNG" to test html2canvas capture + native share sheet end-to-end.
          </p>
        </header>

        <div className="mb-8 flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveKey('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeKey === 'all' ? 'bg-brass text-navy' : 'bg-slate-brand/50 text-cream'}`}
          >
            All ({SCENARIOS.length})
          </button>
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveKey(s.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeKey === s.key ? 'bg-brass text-navy' : 'bg-slate-brand/50 text-cream'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="space-y-12">
          {visible.map(s => (
            <ScenarioCard key={s.key} scenario={s} />
          ))}
        </div>

        <footer className="mt-12 pt-6 border-t border-cream/20 text-xs text-cream/60">
          <p>
            Visit <code className="font-mono bg-slate-brand/50 px-1.5 py-0.5 rounded">?preview=share-card</code> to
            see this page. Removing the query param returns to the app.
          </p>
        </footer>
      </div>
    </div>
  )
}
