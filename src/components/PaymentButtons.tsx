import { useState } from 'react'
import {
  venmoLink,
  venmoWebLink,
  zelleLink,
  cashAppLink,
  paypalLink,
  fmtMoney,
} from '../lib/gameLogic'
import type { Player } from '../types'

function smartVenmoLink(username: string, amountCents: number, note: string): string {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
  if (isMobile) return venmoLink(username, amountCents, note)
  return venmoWebLink(username, amountCents, note)
}

export function PaymentButtons({ toPlayer, amountCents, note }: { toPlayer: Player; amountCents: number; note: string }) {
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
        <>
          <div className="flex flex-wrap gap-2">
            {hasVenmo && (
              <a href={smartVenmoLink(toPlayer.venmoUsername!, amountCents, fullNote)} target="_blank" rel="noopener noreferrer"
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
                className="flex-1 min-w-[120px] h-11 bg-green-600 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 active:bg-gray-800 text-sm">
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
          <button onClick={handleCopy} className={`w-full text-center text-xs transition-colors ${copied ? 'text-green-600 font-semibold' : 'text-gray-400 underline'}`}>
            {copied ? 'Copied!' : 'Or copy payment details'}
          </button>
        </>
      ) : (
        <button onClick={handleCopy}
          className={`w-full h-11 font-semibold rounded-xl transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 active:bg-gray-200'}`}>
          {copied ? 'Copied!' : 'Copy Payment Text'}
        </button>
      )}
    </div>
  )
}
