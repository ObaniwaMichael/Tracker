import { useEffect, useMemo } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet'
import { useTracking } from '../context/TrackingContext'
import AnimatedMarker from './AnimatedMarker'

function FollowDriver({ position, locationMode }) {
  const map = useMap()

  useEffect(() => {
    if (!position) return
    map.panTo([position.lat, position.lng], {
      animate: true,
      duration: locationMode === 'ip' ? 0.6 : 1.1,
    })
  }, [map, position, locationMode])

  return null
}

function RecenterOnIp({ ipLocation, locationMode }) {
  const map = useMap()

  useEffect(() => {
    if (!ipLocation || locationMode !== 'ip') return
    map.setView([ipLocation.lat, ipLocation.lng], 11, { animate: true })
  }, [map, ipLocation, locationMode])

  return null
}

export default function MapDashboard() {
  const {
    serverPosition,
    geofenceCenter,
    geofenceRadiusM,
    geofenceBreached,
    trail,
    defaultCenter,
    connectionStatus,
    ipLocation,
    ipStatus,
    locationMode,
  } = useTracking()

  const center = useMemo(() => {
    if (serverPosition) return [serverPosition.lat, serverPosition.lng]
    if (ipLocation) return [ipLocation.lat, ipLocation.lng]
    if (geofenceCenter) return [geofenceCenter.lat, geofenceCenter.lng]
    return [defaultCenter.lat, defaultCenter.lng]
  }, [serverPosition, ipLocation, geofenceCenter, defaultCenter])

  const initialZoom = locationMode === 'ip' || (!serverPosition && ipLocation) ? 11 : 15

  const trailPositions = useMemo(
    () => trail.map((p) => [p.lat, p.lng]),
    [trail],
  )

  const showIpMarker =
    ipLocation &&
    (locationMode === 'ip' || serverPosition?.source === 'ip')

  const showPreciseMarker =
    serverPosition && serverPosition.source !== 'ip'

  const ipLabel = ipLocation
    ? [ipLocation.city, ipLocation.region, ipLocation.country]
        .filter(Boolean)
        .join(', ')
    : null

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-[var(--color-line)]">
      <MapContainer
        center={center}
        zoom={initialZoom}
        className="h-full w-full"
        zoomControl={false}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geofenceCenter && locationMode === 'precise' && (
          <Circle
            center={[geofenceCenter.lat, geofenceCenter.lng]}
            radius={geofenceRadiusM}
            pathOptions={{
              color: geofenceBreached ? '#f43f5e' : '#14b8a6',
              fillColor: geofenceBreached ? '#f43f5e' : '#14b8a6',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '6 8',
            }}
          />
        )}

        {trailPositions.length > 1 && locationMode === 'precise' && (
          <Polyline
            positions={trailPositions}
            pathOptions={{
              color: '#5eead4',
              weight: 3,
              opacity: 0.75,
            }}
          />
        )}

        {showIpMarker && (
          <CircleMarker
            center={[ipLocation.lat, ipLocation.lng]}
            radius={14}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.25,
              weight: 2,
            }}
          />
        )}

        {showPreciseMarker && <AnimatedMarker position={serverPosition} />}
        <FollowDriver
          position={showPreciseMarker ? serverPosition : null}
          locationMode={locationMode}
        />
        <RecenterOnIp ipLocation={ipLocation} locationMode={locationMode} />
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-col gap-2">
        <div className="rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-1.5 text-[0.7rem] font-medium text-slate-200 backdrop-blur">
          Live map · feed{' '}
          <span
            className={
              connectionStatus === 'connected' ? 'text-teal-300' : 'text-slate-400'
            }
          >
            {connectionStatus}
          </span>
        </div>

        {(locationMode === 'ip' || ipStatus === 'loading') && (
          <div className="max-w-xs rounded-lg border border-amber-400/35 bg-amber-950/80 px-2.5 py-1.5 text-[0.7rem] font-semibold text-amber-100 backdrop-blur">
            {ipStatus === 'loading'
              ? 'Resolving approximate IP location…'
              : `Approximate IP Location${ipLabel ? ` · ${ipLabel}` : ''}`}
          </div>
        )}

        {locationMode === 'precise' && (
          <div className="rounded-lg border border-teal-400/30 bg-teal-950/75 px-2.5 py-1.5 text-[0.7rem] font-semibold text-teal-100 backdrop-blur">
            Exact device GPS / mock stream
          </div>
        )}
      </div>
    </div>
  )
}
