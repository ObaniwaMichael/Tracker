import { useTracking } from '../context/TrackingContext'

export default function DriverInviteCard() {
  const {
    locationConsentPending,
    acceptLocationRequest,
    tripIdFromUrl,
    geoError,
    geoPermission,
    tripActive,
  } = useTracking()

  if (!locationConsentPending && (tripActive || geoPermission === 'granted')) {
    return null
  }

  if (!locationConsentPending) return null

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-invite-title"
        className="w-full max-w-md rounded-2xl border border-teal-400/30 bg-[var(--color-panel)] p-5 shadow-2xl shadow-teal-950/50"
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-amber-200">
          Location request
        </div>
        <h2
          id="driver-invite-title"
          className="text-lg font-semibold tracking-tight text-slate-50"
        >
          Dispatcher is requesting your exact location for this trip
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Please click allow so PulseTrack can use the HTML5 Geolocation API and
          stream high-accuracy GPS to the live map. Approximate IP location is
          only used until you grant permission.
        </p>
        {tripIdFromUrl && (
          <p className="mt-3 font-mono text-xs text-slate-400">
            tripId={tripIdFromUrl}
          </p>
        )}
        {geoError && (
          <p className="mt-3 text-sm text-rose-300">{geoError}</p>
        )}
        <button
          type="button"
          onClick={acceptLocationRequest}
          className="mt-5 w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-teal-400"
        >
          Allow exact location
        </button>
        <p className="mt-3 text-center text-[0.7rem] text-[var(--color-muted)]">
          Your browser will show the native permission prompt next.
        </p>
      </div>
    </div>
  )
}
