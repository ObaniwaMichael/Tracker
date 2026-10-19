const API_BASE = import.meta.env.VITE_API_BASE || ''

async function parseJson(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = body.error || body.message || res.statusText || 'Request failed'
    throw new Error(message)
  }
  return body
}

export async function createTrip() {
  const res = await fetch(`${API_BASE}/api/trips/new`, { method: 'POST' })
  return parseJson(res)
}

export async function fetchTripHistory(tripId) {
  const res = await fetch(`${API_BASE}/api/trips/${encodeURIComponent(tripId)}/history`)
  return parseJson(res)
}

export function buildWsUrl(tripId, role) {
  const configured = import.meta.env.VITE_WS_URL
  if (configured) {
    const url = new URL(configured)
    url.searchParams.set('tripId', tripId)
    url.searchParams.set('role', role)
    return url.toString()
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws?tripId=${encodeURIComponent(tripId)}&role=${encodeURIComponent(role)}`
}

export function buildTrackingUrl(tripId) {
  return `${window.location.origin}/track?tripId=${encodeURIComponent(tripId)}`
}
