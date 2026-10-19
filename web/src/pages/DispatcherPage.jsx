import DriverControls from '../components/DriverControls'
import GeofenceToast from '../components/GeofenceToast'
import MapDashboard from '../components/MapDashboard'
import ShareTrackingLink from '../components/ShareTrackingLink'
import TelemetrySidebar from '../components/TelemetrySidebar'
import { TrackingProvider } from '../context/TrackingContext'

export default function DispatcherPage() {
  return (
    <TrackingProvider role="dispatcher">
      <div className="flex min-h-full flex-col">
        <header className="border-b border-[var(--color-line)] bg-[var(--color-panel)]/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 shadow-lg shadow-teal-900/40">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-200 ring-4 ring-teal-400/30" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-slate-50 md:text-lg">
                  PulseTrack
                </h1>
                <p className="text-xs text-[var(--color-muted)]">
                  Dispatcher dashboard · live Node/WebSocket + Supabase
                </p>
              </div>
            </div>
            <p className="hidden max-w-xs text-right text-[0.7rem] text-[var(--color-muted)] sm:block">
              Creates real trips via the API, loads history from Postgres, and
              listens for live driver GPS over WebSockets.
            </p>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 md:grid-cols-[minmax(280px,380px)_1fr] md:gap-5 md:p-6">
          <aside className="flex flex-col gap-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto">
            <ShareTrackingLink />
            <div className="h-px bg-[var(--color-line)]" />
            <DriverControls />
            <div className="h-px bg-[var(--color-line)]" />
            <TelemetrySidebar />
          </aside>

          <section className="min-h-[50vh] md:min-h-[calc(100vh-7rem)]">
            <MapDashboard />
          </section>
        </main>

        <GeofenceToast />
      </div>
    </TrackingProvider>
  )
}
