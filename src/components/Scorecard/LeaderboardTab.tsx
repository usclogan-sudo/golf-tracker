import type { RefObject } from 'react'
import { Tooltip } from '../ui/Tooltip'
import { ShareCard } from '../ShareCard'
import type { ShareCardLeaderboardEntry } from '../ShareCard'
import { strokesOnHole, fmtMoney } from '../../lib/gameLogic'
import type {
  SkinsResult, BestBallResult, NassauResult, WolfResult, BBBResult,
  HammerResult, VegasResult, StablefordResult, BankerResult, QuotaResult,
} from '../../lib/gameLogic'
import type { Player, HoleScore, CourseSnapshot, Round, Game, StakesMode } from '../../types'

interface Props {
  snapshot: CourseSnapshot
  players: Player[]
  holeScores: HoleScore[]
  courseHcps: Record<string, number>
  game: Game | null
  round: Round | null
  skinsResult: SkinsResult | null
  bestBallResult: BestBallResult | null
  nassauResult: NassauResult | null
  wolfResult: WolfResult | null
  bbbResult: BBBResult | null
  hammerResult: HammerResult | null
  vegasResult: VegasResult | null
  stablefordResult: StablefordResult | null
  bankerResult: BankerResult | null
  quotaResult: QuotaResult | null
  shareRef: RefObject<HTMLDivElement | null>
  sharing: boolean
  shareImage: () => void
}

const GAME_LABELS: Record<string, string> = {
  skins: 'Skins', best_ball: 'Best Ball', nassau: 'Nassau', wolf: 'Wolf',
  bingo_bango_bongo: 'Bingo Bango Bongo', hammer: 'Hammer', vegas: 'Vegas',
  stableford: 'Stableford', dots: 'Dots', banker: 'Banker', quota: 'Quota',
}

export function LeaderboardTab({
  snapshot, players, holeScores, courseHcps, game, round,
  skinsResult, bestBallResult, nassauResult, wolfResult, bbbResult,
  hammerResult, vegasResult, stablefordResult, bankerResult, quotaResult,
  shareRef, sharing, shareImage,
}: Props) {
  const board = players.map(p => {
    const pScores = holeScores.filter(s => s.playerId === p.id)
    const gross = pScores.reduce((s, hs) => s + hs.grossScore, 0)
    const courseHcp = courseHcps[p.id] ?? 0
    const netStrokes = pScores.reduce((s, hs) => {
      const hole = snapshot.holes.find(h => h.number === hs.holeNumber)
      return s + (hole ? strokesOnHole(courseHcp, hole.strokeIndex, snapshot.holes.length) : 0)
    }, 0)
    const scoredPar = pScores.reduce((s, hs) => {
      const hole = snapshot.holes.find(h => h.number === hs.holeNumber)
      return s + (hole?.par ?? 0)
    }, 0)
    return { player: p, gross, net: gross - netStrokes, vsPar: gross - scoredPar, thru: pScores.length }
  }).sort((a, b) => a.net - b.net)

  const positions: number[] = []
  board.forEach((entry, idx) => {
    positions.push(idx === 0 ? 1 : entry.net === board[idx - 1].net ? positions[idx - 1] : idx + 1)
  })

  // Share card data
  const leaderboard: ShareCardLeaderboardEntry[] = board.map((entry, idx) => ({
    pos: positions[idx], name: entry.player.name, gross: entry.gross, net: entry.net, vsPar: entry.vsPar,
  }))

  const gameResults: string[] = []
  if (skinsResult) {
    if (skinsResult.totalSkins === 0) {
      gameResults.push('Skins: No skins won yet')
    } else {
      players.forEach(p => {
        const skins = skinsResult.skinsWon[p.id] ?? 0
        if (skins > 0) gameResults.push(`${p.name}: ${skins} skin${skins !== 1 ? 's' : ''}`)
      })
    }
  }
  if (bestBallResult) {
    gameResults.push(`Team A: ${bestBallResult.holesWon.A}W · Team B: ${bestBallResult.holesWon.B}W · Tied: ${bestBallResult.holesWon.tied}`)
  }
  if (nassauResult) {
    [{ l: 'Front', s: nassauResult.front }, { l: 'Back', s: nassauResult.back }, { l: 'Total', s: nassauResult.total }].forEach(({ l, s }) => {
      const winner = s.winner ? players.find(p => p.id === s.winner)?.name : null
      gameResults.push(`${l}: ${s.incomplete ? 'In progress' : winner ? winner : 'Tied'}`)
    })
  }
  if (wolfResult) {
    players.slice().sort((a, b) => (wolfResult.netUnits[b.id] ?? 0) - (wolfResult.netUnits[a.id] ?? 0)).forEach(p => {
      const u = wolfResult.netUnits[p.id] ?? 0
      gameResults.push(`${p.name}: ${u > 0 ? '+' : ''}${u} unit${Math.abs(u) !== 1 ? 's' : ''}`)
    })
  }
  if (bbbResult) {
    players.slice().sort((a, b) => (bbbResult.pointsWon[b.id] ?? 0) - (bbbResult.pointsWon[a.id] ?? 0)).forEach(p => {
      const pts = bbbResult.pointsWon[p.id] ?? 0
      gameResults.push(`${p.name}: ${pts} pt${pts !== 1 ? 's' : ''}`)
    })
  }
  if (hammerResult) {
    players.slice().sort((a, b) => (hammerResult.netCents[b.id] ?? 0) - (hammerResult.netCents[a.id] ?? 0)).forEach(p => {
      const net = hammerResult.netCents[p.id] ?? 0
      gameResults.push(`${p.name}: ${net > 0 ? '+' : ''}${fmtMoney(Math.abs(net))}`)
    })
  }
  if (vegasResult) {
    gameResults.push(`Team A: ${vegasResult.netPoints.A} pts · Team B: ${vegasResult.netPoints.B} pts`)
    gameResults.push(vegasResult.winner === 'tie' ? 'Result: Tied' : `Winner: Team ${vegasResult.winner}`)
  }
  if (stablefordResult) {
    players.slice().sort((a, b) => (stablefordResult.points[b.id] ?? 0) - (stablefordResult.points[a.id] ?? 0)).forEach(p => {
      gameResults.push(`${p.name}: ${stablefordResult.points[p.id] ?? 0} pts`)
    })
  }
  if (bankerResult) {
    players.slice().sort((a, b) => (bankerResult.netCents[b.id] ?? 0) - (bankerResult.netCents[a.id] ?? 0)).forEach(p => {
      const net = bankerResult.netCents[p.id] ?? 0
      gameResults.push(`${p.name}: ${net > 0 ? '+' : ''}${fmtMoney(Math.abs(net))}`)
    })
  }
  if (quotaResult) {
    players.slice().sort((a, b) => (quotaResult.netPoints[b.id] ?? 0) - (quotaResult.netPoints[a.id] ?? 0)).forEach(p => {
      const net = quotaResult.netPoints[p.id] ?? 0
      gameResults.push(`${p.name}: ${net > 0 ? '+' : ''}${net} (quota ${quotaResult.quotas[p.id] ?? 0})`)
    })
  }

  const gameLabel = game ? (GAME_LABELS[game.type] ?? game.type) : null

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
              <th className="text-left py-2 px-1 font-medium w-8">Pos</th>
              <th className="text-left py-2 px-1 font-medium">Player</th>
              <th className="text-center py-2 px-1 font-medium">Thru</th>
              <th className="text-center py-2 px-1 font-medium"><Tooltip term="Gross">Gross</Tooltip></th>
              <th className="text-center py-2 px-1 font-medium"><Tooltip term="Net">Net</Tooltip></th>
              <th className="text-center py-2 px-1 font-medium">vs Par</th>
            </tr>
          </thead>
          <tbody>
            {board.map((entry, idx) => (
              <tr key={entry.player.id} className={`border-b border-gray-50 ${positions[idx] === 1 ? 'bg-amber-50' : ''}`}>
                <td className={`py-2.5 px-1 font-bold ${positions[idx] === 1 ? 'text-amber-600' : 'text-gray-500'}`}>{positions[idx]}</td>
                <td className="py-2.5 px-1 font-semibold text-gray-800">{entry.player.name}</td>
                <td className="py-2.5 px-1 text-center text-gray-500">{entry.thru}</td>
                <td className="py-2.5 px-1 text-center font-semibold text-gray-700">{entry.gross || '—'}</td>
                <td className="py-2.5 px-1 text-center font-semibold text-gray-700">{entry.net || '—'}</td>
                <td className={`py-2.5 px-1 text-center font-semibold ${entry.vsPar > 0 ? 'text-red-600' : entry.vsPar < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {entry.thru > 0 ? `${entry.vsPar > 0 ? '+' : ''}${entry.vsPar}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Game-specific running totals */}
        {skinsResult && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Skins — {skinsResult.totalSkins} won{skinsResult.pendingCarry > 0 ? ` · ${skinsResult.pendingCarry} carry` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {players.filter(p => (skinsResult.skinsWon[p.id] ?? 0) > 0).map(p => (
                <span key={p.id} className="text-xs bg-amber-50 text-amber-700 font-semibold px-2 py-1 rounded-lg">
                  {p.name}: {skinsResult.skinsWon[p.id]}
                </span>
              ))}
              {skinsResult.totalSkins === 0 && (
                <span className="text-xs text-gray-400">No skins won yet</span>
              )}
            </div>
          </div>
        )}

        {bestBallResult && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Best Ball</p>
            <p className="text-sm font-semibold text-gray-700">
              Team A: {bestBallResult.holesWon.A}W · Team B: {bestBallResult.holesWon.B}W · Tied: {bestBallResult.holesWon.tied}
            </p>
          </div>
        )}

        {nassauResult && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Nassau</p>
            <div className="space-y-1">
              {[
                { label: 'Front', seg: nassauResult.front },
                { label: 'Back', seg: nassauResult.back },
                { label: 'Total', seg: nassauResult.total },
              ].map(({ label, seg }) => {
                const leader = seg.winner ? players.find(p => p.id === seg.winner)?.name : null
                const tiedNames = seg.tiedPlayers.map(id => players.find(p => p.id === id)?.name).filter(Boolean).join(', ')
                return (
                  <p key={label} className="text-sm text-gray-700">
                    <span className="font-semibold">{label}:</span>{' '}
                    {seg.incomplete ? <span className="text-gray-400">In progress</span> : leader ? <span className="text-teal-700 font-semibold">{leader}</span> : tiedNames ? <span className="text-gray-500">Tied ({tiedNames})</span> : '—'}
                  </p>
                )
              })}
            </div>
          </div>
        )}

        {wolfResult && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Wolf — Net Units</p>
            <div className="flex flex-wrap gap-2">
              {players.slice().sort((a, b) => (wolfResult.netUnits[b.id] ?? 0) - (wolfResult.netUnits[a.id] ?? 0)).map(p => {
                const u = wolfResult.netUnits[p.id] ?? 0
                return (
                  <span key={p.id} className={`text-xs font-semibold px-2 py-1 rounded-lg ${u > 0 ? 'bg-purple-50 text-purple-700' : u < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                    {p.name}: {u > 0 ? '+' : ''}{u}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {bbbResult && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Bingo Bango Bongo</p>
            <div className="flex flex-wrap gap-2">
              {players.slice().sort((a, b) => (bbbResult.pointsWon[b.id] ?? 0) - (bbbResult.pointsWon[a.id] ?? 0)).map(p => {
                const pts = bbbResult.pointsWon[p.id] ?? 0
                return (
                  <span key={p.id} className={`text-xs font-semibold px-2 py-1 rounded-lg ${pts > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                    {p.name}: {pts}pt{pts !== 1 ? 's' : ''}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Share Leaderboard */}
      <button
        onClick={shareImage}
        disabled={sharing}
        className="mt-4 w-full h-12 bg-emerald-600 text-white font-bold rounded-2xl active:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sharing ? (
          <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        )}
        {sharing ? 'Creating image…' : 'Share Leaderboard'}
      </button>
      <div style={{ position: 'absolute', left: -9999, top: 0 }}>
        <ShareCard
          ref={shareRef}
          courseName={snapshot.courseName}
          date={round!.date}
          gameLabel={gameLabel}
          stakesMode={game?.stakesMode}
          leaderboard={leaderboard}
          gameResults={gameResults}
          payouts={[]}
          totalPot={null}
        />
      </div>
    </div>
  )
}
