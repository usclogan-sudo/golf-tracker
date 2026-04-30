import { QRCodeSVG } from 'qrcode.react'

interface Props {
  url: string
  code: string
  size?: number
}

export function InviteQR({ url, code, size = 180 }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="bg-white rounded-2xl p-4">
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          marginSize={0}
        />
      </div>
      <p className="text-xs text-gray-500">Scan to join · Code: <span className="font-mono font-bold">{code}</span></p>
    </div>
  )
}

interface ModalProps {
  url: string
  code: string
  eventName?: string
  onClose: () => void
}

export function InviteQRModal({ url, code, eventName, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 text-center" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-lg text-gray-900 dark:text-gray-100">
          {eventName ? `Join ${eventName}` : 'Join Round'}
        </h3>
        <InviteQR url={url} code={code} size={200} />
        <p className="text-sm text-gray-500">Players scan this QR code to join instantly</p>
        <button
          onClick={onClose}
          className="w-full h-12 bg-gray-800 dark:bg-gray-700 text-white font-bold rounded-xl active:bg-gray-900"
        >
          Done
        </button>
      </div>
    </div>
  )
}
