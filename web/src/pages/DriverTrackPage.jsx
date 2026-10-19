import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DriverControls from '../components/DriverControls'
import DriverInviteCard from '../components/DriverInviteCard'
import GeofenceToast from '../components/GeofenceToast'
import MapDashboard from '../components/MapDashboard'
import TelemetrySidebar from '../components/TelemetrySidebar'
import { TrackingProvider } from '../context/TrackingContext'

function DriverShell({ tripId }) {
  return (
    <TrackingProvider role="driver" tripIdFromUrl={tripId}>
      <div className="flex min-h-full flex-col">
        <header className="border-b border-[var(--color-line)] bg-[var(--color-panel)]/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold text-slate-50">
                PulseTrack · Driver link
              </h1>
              <p className="text-xs text-[var(--color-muted)]">
                Trip invite · GPS overrides IP approximation after you allow access
              </p>
            </div>
            <Link
              to="/"
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-teal-400/40"
            >
              Open dispatcher
            </Link>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 md:grid-cols-[minmax(280px,380px)_1fr] md:gap-5 md:p-6">
          <aside className="flex flex-col gap-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <DriverControls />
            <div className="h-px bg-[var(--color-line)]" />
            <TelemetrySidebar />
          </aside>
          <section className="min-h-[50vh] md:min-h-[calc(100vh-7rem)]">
            <MapDashboard />
          </section>
        </main>

        <DriverInviteCard />
        <GeofenceToast />
      </div>
    </TrackingProvider>
  )
}

export default function DriverTrackPage() {
  const [params] = useSearchParams()
  const tripId = useMemo(() => params.get('tripId'), [params])

  if (!tripId) {
    return (
      <div className="grid min-h-full place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-50">Invalid tracking link</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            This URL is missing a <code className="font-mono">tripId</code> query
            parameter. Generate a new invite from the dispatcher dashboard.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            Go to dispatcher
          </Link>
        </div>
      </div>
    )
  }

  return <DriverShell tripId={tripId} />
}
