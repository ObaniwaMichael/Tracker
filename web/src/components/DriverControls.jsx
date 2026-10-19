import { useTracking } from '../context/TrackingContext'
import { formatCoord } from '../utils/geo'

const BEARINGS = [
  { label: 'N', deg: 0 },
  { label: 'E', deg: 90 },
  { label: 'S', deg: 180 },
  { label: 'W', deg: 270 },
]

export default function DriverControls() {
  const {
    isDriverRole,
    tripActive,
    toggleTrip,
    simulateMovement,
    requestPermissionPreview,
    driverLive,
    geoPermission,
    geoError,
    connectionStatus,
    activeTripId,
  } = useTracking()

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">
          {isDriverRole ? 'Driver broadcaster' : 'Local driver tools'}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
          {isDriverRole
            ? 'Streams GPS over a live WebSocket to the Node server for this tripId.'
            : 'Generate a trip first, then open the driver link in another tab to stream live GPS. Mock moves work from the driver page.'}
        </p>
      </div>

      {isDriverRole && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleTrip}
            disabled={!activeTripId}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              tripActive
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
            }`}
          >
            {tripActive ? 'Stop Trip' : 'Start Trip'}
          </button>

          <button
            type="button"
            onClick={requestPermissionPreview}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-teal-500/40"
          >
            Enable GPS
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2.5 text-xs text-[var(--color-muted)]">
        <div className="flex justify-between gap-2">
          <span>Trip ID</span>
          <span className="max-w-[55%] truncate font-mono text-slate-300">
            {activeTripId || '—'}
          </span>
        </div>
        <div className="mt-1.5 flex justify-between gap-2">
          <span>Permission</span>
          <span className="font-mono uppercase text-slate-300">{geoPermission}</span>
        </div>
        <div className="mt-1.5 flex justify-between gap-2">
          <span>WebSocket</span>
          <span className="font-mono uppercase text-slate-300">{connectionStatus}</span>
        </div>
        <div className="mt-1.5 flex justify-between gap-2">
          <span>Live buffer</span>
          <span className="font-mono text-slate-300">
            {driverLive
              ? `${formatCoord(driverLive.lat)}, ${formatCoord(driverLive.lng)}`
              : 'no fix yet'}
          </span>
        </div>
        {geoError && <p className="mt-2 text-rose-300">{geoError}</p>}
      </div>

      {isDriverRole && (
        <div className="rounded-xl border border-dashed border-teal-500/30 bg-teal-500/5 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-200/90">
            Mock movement simulator
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Publishes fake GPS points over the live WebSocket (laptop-friendly).
          </p>

          <button
            type="button"
            onClick={() => simulateMovement()}
            disabled={!activeTripId}
            className="mt-3 w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-50"
          >
            Simulate random move
          </button>

          <div className="mt-2 grid grid-cols-4 gap-2">
            {BEARINGS.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => simulateMovement(b.deg)}
                disabled={!activeTripId}
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] py-2 text-xs font-semibold text-slate-200 hover:border-teal-400/50 disabled:opacity-50"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
