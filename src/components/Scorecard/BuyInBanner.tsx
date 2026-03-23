import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PaymentButtons } from '../PaymentButtons'
import { fmtMoney } from '../../lib/gameLogic'
import type { BuyIn, Player } from '../../types'

interface Props {
  buyIn: BuyIn
  treasurerPlayer: Player
  roundId: string
  playerId: string
  onReported: (method: string) => void
}

export function BuyInBanner({ buyIn, treasurerPlayer, roundId, playerId, onReported }: Props) {
  const [reporting, setReporting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Already marked paid by treasurer — hide
  if (buyIn.status === 'marked_paid') return null

  const reportPayment = async (method: string) => {
    setReporting(true)
    const { error } = await supabase.rpc('player_report_buyin', {
      p_round_id: roundId,
      p_player_id: playerId,
      p_method: method,
    })
    setReporting(false)
    if (!error) {
      onReported(method)
    }
  }

  // Player already reported — show waiting state
  if (buyIn.playerReportedAt) {
    return (
      <div className="mx-4 mt-2 bg-green-50 border border-green-200 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-lg">&#10003;</span>
          <div>
            <p className="text-green-700 font-semibold text-sm">
              Reported: paid via {buyIn.method ?? 'cash'}
            </p>
            <p className="text-green-600 text-xs">Waiting for treasurer to confirm</p>
          </div>
        </div>
      </div>
    )
  }

  // Show "I've Paid" confirmation after tapping a digital payment link
  if (showConfirm) {
    return (
      <div className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
        <p className="text-amber-800 font-semibold text-sm">
          Did you complete the payment?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => reportPayment(treasurerPlayer.venmoUsername ? 'venmo' : treasurerPlayer.zelleIdentifier ? 'zelle' : treasurerPlayer.cashAppUsername ? 'other' : 'other')}
            disabled={reporting}
            className="flex-1 h-10 bg-green-600 text-white font-semibold rounded-xl text-sm active:bg-green-700 disabled:opacity-50"
          >
            {reporting ? 'Reporting...' : "Yes, I've Paid"}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="px-4 h-10 bg-gray-100 text-gray-600 font-semibold rounded-xl text-sm active:bg-gray-200"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  // Unpaid + not reported — show payment options
  const hasDigitalPayment = !!(treasurerPlayer.venmoUsername || treasurerPlayer.zelleIdentifier || treasurerPlayer.cashAppUsername || treasurerPlayer.paypalEmail)

  return (
    <div className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <p className="text-amber-800 font-semibold text-sm">
        Buy-in: {fmtMoney(buyIn.amountCents)} to {treasurerPlayer.name}
      </p>
      {hasDigitalPayment && (
        <div onClick={() => setShowConfirm(true)}>
          <PaymentButtons
            toPlayer={treasurerPlayer}
            amountCents={buyIn.amountCents}
            note="buy-in"
            compact
          />
        </div>
      )}
      <button
        onClick={() => reportPayment('cash')}
        disabled={reporting}
        className="w-full h-10 bg-gray-700 text-white font-semibold rounded-xl text-sm active:bg-gray-800 disabled:opacity-50"
      >
        {reporting ? 'Reporting...' : 'Pay Cash'}
      </button>
    </div>
  )
}
