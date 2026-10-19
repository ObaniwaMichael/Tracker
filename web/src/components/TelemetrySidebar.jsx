import { useEffect, useState } from 'react'
import { useTracking } from '../context/TrackingContext'
import { formatCoord, formatDuration } from '../utils/geo'

function Stat({ label, value, mono = false }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2.5">
      <div className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 text-[0.95rem] font-semibold text-slate-100 ${mono ? 'font-mono tabular-nums' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}

export default function TelemetrySidebar() {
  const {
    serverPosition,
    driverLive,
    connectionStatus,
    tripActive,
    tripStartedAt,
    lastServerTickAt,
    updateCount,
    geofenceBreached,
    geofenceRadiusM,
    locationMode,
    ipLocation,
    historyLoading,
    activeTripId,
  } = useTracking()

  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const elapsed = tripActive && tripStartedAt ? now - tripStartedAt : 0
  const pos = serverPosition
  const connected = connectionStatus === 'connected'

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Live telemetry</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${
            connected
              ? 'border-teal-400/30 bg-teal-400/10 text-teal-300'
              : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-teal-300' : 'bg-slate-500'}`}
          />
          {connected ? 'Connected' : connectionStatus}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Latitude" value={formatCoord(pos?.lat)} mono />
        <Stat label="Longitude" value={formatCoord(pos?.lng)} mono />
        <Stat
          label="Speed"
          value={`${(pos?.speedKmh ?? 0).toFixed(1)} km/h`}
          mono
        />
        <Stat label="Time elapsed" value={formatDuration(elapsed)} mono />
        <Stat
          label="Heading"
          value={
            pos?.heading != null && !Number.isNaN(pos.heading)
              ? `${Math.round(pos.heading)}°`
              : '—'
          }
          mono
        />
        <Stat label="Live updates" value={String(updateCount)} mono />
      </div>

      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2.5 text-xs text-[var(--color-muted)]">
        <div className="flex justify-between gap-2">
          <span>Active trip</span>
          <span className="max-w-[55%] truncate font-mono text-slate-300">
            {activeTripId || '—'}
          </span>
        </div>
        <div className="mt-1.5 flex justify-between gap-2">
          <span>Last server push</span>
          <span className="font-mono text-slate-300">
            {lastServerTickAt
              ? new Date(lastServerTickAt).toLocaleTimeString()
              : '—'}
          </span>
        </div>
        <div className="mt-1.5 flex justify-between gap-2">
          <span>History</span>
          <span className="text-slate-300">
            {historyLoading ? 'Loading…' : 'Ready'}
          </span>
        </div>
        <div className="mt-1.5 flex justify-between gap-2">
          <span>Location mode</span>
          <span
            className={`font-semibold uppercase ${
              locationMode === 'precise'
                ? 'text-teal-300'
                : locationMode === 'ip'
                  ? 'text-amber-300'
                  : 'text-slate-300'
            }`}
          >
            {locationMode === 'ip'
              ? 'Approximate IP'
              : locationMode === 'precise'
                ? 'Exact GPS'
                : 'Unknown'}
          </span>
        </div>
        <div className="mt-1.5 flex justify-between gap-2">
          <span>Source</span>
          <span className="font-mono uppercase text-slate-300">
            {driverLive?.source ?? serverPosition?.source ?? '—'}
          </span>
        </div>
        {ipLocation && (
          <div className="mt-1.5 flex justify-between gap-2">
            <span>IP city</span>
            <span className="truncate text-right text-slate-300">
              {[ipLocation.city, ipLocation.country].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
        )}
        <div className="mt-1.5 flex justify-between gap-2">
          <span>Geofence ({geofenceRadiusM}m)</span>
          <span
            className={`font-semibold ${geofenceBreached ? 'text-rose-300' : 'text-teal-300'}`}
          >
            {geofenceBreached ? 'OUTSIDE' : 'INSIDE'}
          </span>
        </div>
      </div>
    </section>
  )
}
