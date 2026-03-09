import { useEffect, useMemo, useState } from 'react'
import { supabase, rowToRound, rowToRoundPlayer, rowToHoleScore, rowToBuyIn, rowToBBBPoint } from '../../lib/supabase'
import {
  buildCourseHandicaps,
  calculateSkins,
  calculateBestBall,
  calculateNassau,
  calculateWolf,
  calculateBBB,
  calculateSkinsPayouts,
  calculateBestBallPayouts,
  calculateNassauPayouts,
  calculateWolfPayouts,
  calculateBBBPayouts,
  buildSettlements,
  venmoLink,
  venmoWebLink,
  zelleLink,
  cashAppLink,
  paypalLink,
  fmtMoney,
} from '../../lib/gameLogic'
import type { PlayerPayout, Settlement } from '../../lib/gameLogic'
import type {
  Round,
  RoundPlayer,
  HoleScore,
  BuyIn,
  BBBPoint,
  Player,
  SkinsConfig,
  BestBallConfig,
  NassauConfig,
  WolfConfig,
  GameType,
} from '../../types'

interface Props {
  roundId: string
  onDone: () => void
  onContinue: () => void
}

const GAME_LABELS: Record<GameType, string> = {
  skins: 'Skins',
  best_ball: 'Best Ball',
  nassau: 'Nassau',
  wolf: 'Wolf',
  bingo_bango_bongo: 'Bingo Bango Bongo',
}

function PaymentButtons({ toPlayer, amountCents, note }: { toPlayer: Player; amountCents: number; note: string }) {
  const [copied, setCopied] = useState(false)
  const fullNote = `Fore Skins Golf — ${note}`
  const copyText = `Pay ${toPlayer.name} ${fmtMoney(amountCents)} for ${fullNote}`
  const handleCopy = () => {
    navigator.clipboard.writeText(copyText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const hasVenmo = !!toPlayer.venmoUsername
  const hasZelle = !!toPlayer.zelleIdentifier
  const hasCashApp = !!toPlayer.cashAppUsername
  const hasPaypal = !!toPlayer.paypalEmail
  const hasAny = hasVenmo || hasZelle || hasCashApp || hasPaypal

  return (
    <div className="space-y-2">
      {hasAny ? (
        <div className="flex flex-wrap gap-2">
          {hasVenmo && (
            <a href={venmoLink(toPlayer.venmoUsername!, amountCents, fullNote)}
              onClick={() => { setTimeout(() => { window.open(venmoWebLink(toPlayer.venmoUsername!, amountCents, fullNote), '_blank') }, 1500) }}
              className="flex-1 min-w-[120px] h-11 bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 active:bg-blue-700 text-sm">
              Venmo
            </a>
          )}
          {hasZelle && (
            <a href={zelleLink(toPlayer.zelleIdentifier!)} target="_blank" rel="noopener noreferrer"
              className="flex-1 min-w-[120px] h-11 bg-purple-600 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 active:bg-purple-700 text-sm">
              Zelle
            </a>
          )}
          {hasCashApp && (
            <a href={cashAppLink(toPlayer.cashAppUsername!, amountCents, fullNote)} target="_blank" rel="noopener noreferrer"
              className="flex-1 min-w-[120px] h-11 bg-green-600 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 active:bg-green-700 text-sm">
              Cash App
            </a>
          )}
          {hasPaypal && (
            <a href={paypalLink(toPlayer.paypalEmail!, amountCents)} target="_blank" rel="noopener noreferrer"
              className="flex-1 min-w-[120px] h-11 bg-yellow-500 text-black font-semibold rounded-xl flex items-center justify-center gap-1.5 active:bg-yellow-600 text-sm">
              PayPal
            </a>
          )}
        </div>
      ) : (
        <button onClick={handleCopy}
          className={`w-full h-11 font-semibold rounded-xl transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 active:bg-gray-200'}`}>
          {copied ? 'Copied!' : 'Copy Payment Text'}
        </button>
      )}
      <button onClick={handleCopy} className={`w-full h-9 text-sm rounded-xl transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-500 active:bg-gray-100'}`}>
        {copied ? 'Copied!' : 'Copy payment text'}
      </button>
    </div>
  )
}

export function SettleUp({ roundId, onDone, onContinue }: Props) {
  const [round, setRound] = useState<Round | null>(null)
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([])
  const [holeScores, setHoleScores] = useState<HoleScore[]>([])
  const [buyIns, setBuyIns] = useState<BuyIn[]>([])
  const [bbbPoints, setBbbPoints] = useState<BBBPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('rounds').select('*').eq('id', roundId).single(),
      supabase.from('round_players').select('*').eq('round_id', roundId),
      supabase.from('hole_scores').select('*').eq('round_id', roundId),
      supabase.from('buy_ins').select('*').eq('round_id', roundId),
      supabase.from('bbb_points').select('*').eq('round_id', roundId),
    ]).then(([roundRes, rpRes, hsRes, biRes, bbbRes]) => {
      if (roundRes.data) setRound(rowToRound(roundRes.data))
      if (rpRes.data) setRoundPlayers(rpRes.data.map(rowToRoundPlayer))
      if (hsRes.data) setHoleScores(hsRes.data.map(rowToHoleScore))
      if (biRes.data) setBuyIns(biRes.data.map(rowToBuyIn))
      if (bbbRes.data) setBbbPoints(bbbRes.data.map(rowToBBBPoint))
      setLoading(false)
    })
  }, [roundId])

  const players = round?.players ?? []
  const snapshot = round?.courseSnapshot
  const game = round?.game
  const treasurerId = round?.treasurerPlayerId
  const treasurer = players.find(p => p.id === treasurerId)

  const courseHcps = useMemo(() => {
    if (!snapshot || !roundPlayers) return {}
    return buildCourseHandicaps(players, roundPlayers, snapshot)
  }, [players, roundPlayers, snapshot])

  const skinsResult = useMemo(() => {
    if (!game || game.type !== 'skins' || !snapshot) return null
    return calculateSkins(players, holeScores, snapshot, game.config as SkinsConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const bestBallResult = useMemo(() => {
    if (!game || game.type !== 'best_ball' || !snapshot) return null
    return calculateBestBall(players, holeScores, snapshot, game.config as BestBallConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const nassauResult = useMemo(() => {
    if (!game || game.type !== 'nassau' || !snapshot) return null
    return calculateNassau(players, holeScores, snapshot, game.config as NassauConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const wolfResult = useMemo(() => {
    if (!game || game.type !== 'wolf' || !snapshot) return null
    return calculateWolf(players, holeScores, snapshot, game.config as WolfConfig, courseHcps)
  }, [game, players, holeScores, snapshot, courseHcps])

  const bbbResult = useMemo(() => {
    if (!game || game.type !== 'bingo_bango_bongo') return null
    return calculateBBB(players, bbbPoints)
  }, [game, players, bbbPoints])

  const payouts = useMemo((): PlayerPayout[] => {
    if (!game || !snapshot) return []
    if (game.type === 'skins' && skinsResult) {
      return calculateSkinsPayouts(skinsResult, game, players.length)
    }
    if (game.type === 'best_ball' && bestBallResult) {
      return calculateBestBallPayouts(bestBallResult, game.config as BestBallConfig, game, players)
    }
    if (game.type === 'nassau' && nassauResult) {
      return calculateNassauPayouts(nassauResult, game, players)
    }
    if (game.type === 'wolf' && wolfResult) {
      return calculateWolfPayouts(wolfResult, game, players)
    }
    if (game.type === 'bingo_bango_bongo' && bbbResult) {
      return calculateBBBPayouts(bbbResult, game, players)
    }
    return []
  }, [game, players, snapshot, skinsResult, bestBallResult, nassauResult, wolfResult, bbbResult])

  const settlements = useMemo((): Settlement[] => {
    if (!treasurerId || payouts.length === 0) return []
    return buildSettlements(payouts, treasurerId)
  }, [payouts, treasurerId])

  const potCents = game ? game.buyInCents * players.length : 0
  const unpaidBuyIns = buyIns.filter(b => b.status === 'unpaid')
  const playerById = (id: string) => players.find(p => p.id === id)

  const togglePaid = async (buyIn: BuyIn) => {
    const newStatus = buyIn.status === 'unpaid' ? 'marked_paid' : 'unpaid'
    const newPaidAt = newStatus === 'marked_paid' ? new Date().toISOString() : null
    setBuyIns(prev => prev.map(b =>
      b.id === buyIn.id
        ? { ...b, status: newStatus as BuyIn['status'], paidAt: newPaidAt ? new Date(newPaidAt) : undefined }
        : b
    ))
    await supabase.from('buy_ins').update({ status: newStatus, paid_at: newPaidAt }).eq('id', buyIn.id)
  }

  if (loading || !round || !game || !snapshot) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }

  const gameLabel = GAME_LABELS[game.type] ?? game.type
  const isHighRoller = game.stakesMode === 'high_roller'
  const headerClass = isHighRoller ? 'hr-header' : 'app-header'

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className={`${headerClass} text-white px-4 py-5 sticky top-0 z-10 shadow-xl`}>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Settle Up 💰
            {isHighRoller && (
              <span className="text-sm font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'linear-gradient(135deg,#d97706,#fbbf24)', color: '#000' }}>
                💎 HIGH ROLLER
              </span>
            )}
          </h1>
          <p className="text-green-300 text-sm mt-0.5">{snapshot.courseName} · {gameLabel}</p>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {buyIns.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buy-In Status</p>
            {unpaidBuyIns.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-700 text-sm font-semibold">
                  {unpaidBuyIns.length} unpaid — collect {fmtMoney(unpaidBuyIns.length * game.buyInCents)} before distributing
                </p>
              </div>
            )}
            <div className="space-y-2">
              {buyIns.map(b => {
                const p = playerById(b.playerId)
                const isPaid = b.status === 'marked_paid'
                return (
                  <div key={b.id} className={`flex items-center justify-between p-3 rounded-xl ${isPaid ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{p?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{fmtMoney(b.amountCents)}</p>
                    </div>
                    <button
                      onClick={() => togglePaid(b)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        isPaid
                          ? 'bg-green-600 text-white active:bg-green-700'
                          : 'bg-red-100 text-red-700 active:bg-red-200'
                      }`}
                    >
                      {isPaid ? 'Paid' : 'Mark Paid'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Summary */}
        <section className={`rounded-2xl shadow-sm p-4 ${isHighRoller ? 'border-2' : 'bg-white'}`}
          style={isHighRoller ? { background: '#1a0e00', borderColor: '#d97706' } : undefined}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isHighRoller ? 'text-amber-400' : 'text-gray-500'}`}>Summary</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className={`rounded-xl p-3 ${isHighRoller ? 'bg-black/30' : 'bg-gray-50'}`}>
              <p className={`text-xs ${isHighRoller ? 'text-amber-400' : 'text-gray-500'}`}>Players</p>
              <p className={`text-xl font-bold ${isHighRoller ? 'text-white' : 'text-gray-800'}`}>{players.length}</p>
            </div>
            <div className={`rounded-xl p-3 ${isHighRoller ? 'bg-black/30' : 'bg-gray-50'}`}>
              <p className={`text-xs ${isHighRoller ? 'text-amber-400' : 'text-gray-500'}`}>Buy-in</p>
              <p className={`text-xl font-bold ${isHighRoller ? 'text-white' : 'text-gray-800'}`}>{fmtMoney(game.buyInCents)}</p>
            </div>
            <div className={`rounded-xl p-3 ${isHighRoller ? 'bg-amber-900/40' : 'bg-green-50'}`}>
              <p className={`text-xs ${isHighRoller ? 'text-amber-400' : 'text-gray-500'}`}>Total pot</p>
              <p className={`text-xl font-bold ${isHighRoller ? 'text-amber-400' : 'text-green-800'}`}>{fmtMoney(potCents)}</p>
            </div>
          </div>
          <p className={`text-sm mt-3 ${isHighRoller ? 'text-amber-200' : 'text-gray-500'}`}>
            Treasurer: <strong>{treasurer?.name ?? 'Not assigned'}</strong>
          </p>
        </section>

        {/* ── Skins Results ── */}
        {skinsResult && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Skins Results · {skinsResult.totalSkins} skin{skinsResult.totalSkins !== 1 ? 's' : ''} won
            </p>
            {skinsResult.totalSkins === 0 ? (
              <p className="text-gray-500 text-sm">No skins won — all holes tied. Pot refunded.</p>
            ) : (
              <div className="space-y-2">
                {players.map(p => {
                  const skins = skinsResult.skinsWon[p.id] ?? 0
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${skins > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      <span className={`font-bold ${skins > 0 ? 'text-green-700' : 'text-gray-400'}`}>{skins} skin{skins !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Best Ball Results ── */}
        {bestBallResult && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Best Ball Results</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-600 font-medium">Team A</p><p className="text-2xl font-bold text-blue-800">{bestBallResult.holesWon.A}</p><p className="text-xs text-blue-500">holes</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 font-medium">Tied</p><p className="text-2xl font-bold text-gray-600">{bestBallResult.holesWon.tied}</p><p className="text-xs text-gray-400">holes</p></div>
              <div className="bg-orange-50 rounded-xl p-3"><p className="text-xs text-orange-600 font-medium">Team B</p><p className="text-2xl font-bold text-orange-800">{bestBallResult.holesWon.B}</p><p className="text-xs text-orange-500">holes</p></div>
            </div>
            <div className={`rounded-xl p-3 text-center font-bold text-lg ${bestBallResult.winner === 'tie' ? 'bg-gray-100 text-gray-700' : bestBallResult.winner === 'A' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
              {bestBallResult.winner === 'tie' ? '🤝 All Square — Pot Split' : `🏆 Team ${bestBallResult.winner} Wins`}
            </div>
            {(() => {
              const config = game.config as BestBallConfig
              return (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(['A', 'B'] as const).map(team => (
                    <div key={team} className={`rounded-xl p-3 ${team === 'A' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                      <p className={`text-xs font-bold mb-1 ${team === 'A' ? 'text-blue-700' : 'text-orange-700'}`}>Team {team}</p>
                      {players.filter(p => config.teams[p.id] === team).map(p => (<p key={p.id} className="text-gray-700">{p.name}</p>))}
                    </div>
                  ))}
                </div>
              )
            })()}
          </section>
        )}

        {/* ── Nassau Results ── */}
        {nassauResult && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nassau Results</p>
            {[
              { label: 'Front 9 (1–9)', seg: nassauResult.front },
              { label: 'Back 9 (10–18)', seg: nassauResult.back },
              { label: 'Full 18', seg: nassauResult.total },
            ].map(({ label, seg }) => {
              const winner = seg.winner ? playerById(seg.winner) : null
              const tiedNames = seg.tiedPlayers.map(id => playerById(id)?.name).filter(Boolean).join(', ')
              return (
                <div key={label} className={`rounded-xl p-3 ${seg.winner ? 'bg-teal-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-700 text-sm">{label}</p>
                    <p className={`font-bold text-sm ${seg.winner ? 'text-teal-700' : 'text-gray-400'}`}>
                      {seg.incomplete ? 'Incomplete' : seg.winner ? `🏆 ${winner?.name}` : tiedNames ? `Tied: ${tiedNames}` : '—'}
                    </p>
                  </div>
                  {!seg.incomplete && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {players.map(p => (
                        <span key={p.id} className="text-xs text-gray-500">
                          {p.name}: {seg.scores[p.id] ?? '—'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {/* ── Wolf Results ── */}
        {wolfResult && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wolf Results — Net Units</p>
            <div className="space-y-2">
              {players
                .slice()
                .sort((a, b) => (wolfResult.netUnits[b.id] ?? 0) - (wolfResult.netUnits[a.id] ?? 0))
                .map(p => {
                  const units = wolfResult.netUnits[p.id] ?? 0
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${units > 0 ? 'bg-purple-50' : units < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      <span className={`font-bold ${units > 0 ? 'text-purple-700' : units < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {units > 0 ? `+${units}` : units} unit{Math.abs(units) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* ── BBB Results ── */}
        {bbbResult && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Bingo Bango Bongo — {bbbResult.totalPoints} total points
            </p>
            <div className="space-y-2">
              {players
                .slice()
                .sort((a, b) => (bbbResult.pointsWon[b.id] ?? 0) - (bbbResult.pointsWon[a.id] ?? 0))
                .map(p => {
                  const pts = bbbResult.pointsWon[p.id] ?? 0
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${pts > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      <span className={`font-bold ${pts > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                        {pts} point{pts !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* ── Winners / Payouts ── */}
        {payouts.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Winners</p>
            <div className="space-y-2">
              {payouts.map(payout => {
                const winner = playerById(payout.playerId)
                return (
                  <div key={payout.playerId} className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
                    <div><p className="font-bold text-gray-800">{winner?.name}</p><p className="text-xs text-gray-500">{payout.reason}</p></div>
                    <p className="text-xl font-bold text-green-700">{fmtMoney(payout.amountCents)}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Settlement instructions ── */}
        {settlements.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pay Out</p>
              <p className="text-sm text-gray-500 mt-1"><strong>{treasurer?.name}</strong> pays each winner from the pot.</p>
            </div>
            {settlements.map((s, i) => {
              const toPlayer = playerById(s.toId)
              if (!toPlayer) return null
              return (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div><p className="font-bold text-gray-800">{treasurer?.name} → {toPlayer.name}</p><p className="text-xs text-gray-500">{s.note}</p></div>
                    <p className="text-xl font-bold text-green-700">{fmtMoney(s.amountCents)}</p>
                  </div>
                  <PaymentButtons toPlayer={toPlayer} amountCents={s.amountCents} note={s.note} />
                </div>
              )
            })}
          </section>
        )}

        {treasurerId && payouts.some(p => p.playerId === treasurerId) && (() => {
          const keep = payouts.find(p => p.playerId === treasurerId)!
          return (
            <section className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="font-bold text-green-800">{treasurer?.name} keeps {fmtMoney(keep.amountCents)}</p>
              <p className="text-sm text-green-700">{keep.reason} — taken from the pot directly</p>
            </section>
          )
        })()}

        {payouts.length === 0 && (
          <section className="bg-gray-50 rounded-2xl p-4 text-center">
            <p className="text-gray-600 font-semibold">No winners calculated yet</p>
            <p className="text-gray-500 text-sm mt-1">Each player gets {fmtMoney(game.buyInCents)} back from the treasurer.</p>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button onClick={onContinue} className="flex-1 h-14 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl active:bg-gray-50">← Back to Scores</button>
          <button onClick={onDone} className="flex-1 h-14 bg-green-700 text-white text-lg font-bold rounded-2xl active:bg-green-800 transition-colors">✓ Done</button>
        </div>
      </div>
    </div>
  )
}
