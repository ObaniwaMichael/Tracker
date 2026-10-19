/**
 * Approximate location from the client's public IP.
 * Uses ipapi.co (CORS-friendly JSON). Falls back to null on failure.
 */
export async function fetchIpGeolocation(signal) {
  const res = await fetch('https://ipapi.co/json/', {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!res.ok) {
    throw new Error(`IP geolocation failed (${res.status})`)
  }

  const data = await res.json()
  if (data.error || data.latitude == null || data.longitude == null) {
    throw new Error(data.reason || 'IP geolocation unavailable')
  }

  return {
    lat: Number(data.latitude),
    lng: Number(data.longitude),
    city: data.city || null,
    region: data.region || data.region_code || null,
    country: data.country_name || data.country || null,
    accuracyLabel: 'city',
    source: 'ip',
  }
}
