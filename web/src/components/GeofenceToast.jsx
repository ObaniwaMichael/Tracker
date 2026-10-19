import { useEffect } from 'react'
import { useTracking } from '../context/TrackingContext'

const TONE_STYLES = {
  danger: 'border-rose-400/40 bg-rose-950/90 text-rose-50',
  warn: 'border-amber-400/40 bg-amber-950/90 text-amber-50',
  signal: 'border-teal-400/40 bg-teal-950/90 text-teal-50',
}

export default function GeofenceToast() {
  const { toast, dismissToast } = useTracking()

  useEffect(() => {
    if (!toast) return undefined
    const id = window.setTimeout(dismissToast, 4500)
    return () => window.clearTimeout(id)
  }, [toast, dismissToast])

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto fixed bottom-4 left-4 right-4 z-[1000] mx-auto max-w-lg rounded-xl border px-4 py-3 shadow-2xl backdrop-blur md:left-auto md:right-6 ${TONE_STYLES[toast.tone] ?? TONE_STYLES.warn}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-sm font-semibold uppercase tracking-wide opacity-80">
          Alert
        </span>
        <p className="flex-1 text-sm leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={dismissToast}
          className="rounded-md px-2 py-0.5 text-xs font-medium opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
