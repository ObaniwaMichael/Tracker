/** Earth radius in meters (mean). */
const EARTH_RADIUS_M = 6371000

/**
 * Haversine distance between two WGS84 points, in meters.
 */
export function distanceMeters(a, b) {
  if (!a || !b) return 0
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Convert m/s → km/h. Geolocation API speed is meters/second.
 */
export function msToKmh(speedMs) {
  if (speedMs == null || Number.isNaN(speedMs) || speedMs < 0) return 0
  return speedMs * 3.6
}

/**
 * Offset a point by distance (m) along a bearing (degrees clockwise from north).
 */
export function offsetByBearing(origin, distanceM, bearingDeg) {
  const δ = distanceM / EARTH_RADIUS_M
  const θ = (bearingDeg * Math.PI) / 180
  const φ1 = (origin.lat * Math.PI) / 180
  const λ1 = (origin.lng * Math.PI) / 180

  const sinφ1 = Math.sin(φ1)
  const cosφ1 = Math.cos(φ1)
  const sinδ = Math.sin(δ)
  const cosδ = Math.cos(δ)

  const φ2 = Math.asin(sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ))
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * Math.sin(φ2))

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  }
}

export function formatCoord(value, digits = 5) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(digits)
}

export function formatDuration(ms) {
  if (ms == null || ms < 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
