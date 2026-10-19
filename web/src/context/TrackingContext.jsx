import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTripSocket } from '../hooks/useTripSocket'
import { distanceMeters, msToKmh, offsetByBearing } from '../utils/geo'
import { fetchIpGeolocation } from '../utils/ipGeo'
import {
  buildTrackingUrl,
  createTrip,
  fetchTripHistory,
} from '../utils/api'

const GEOFENCE_RADIUS_M = 500
const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }

const TrackingContext = createContext(null)

function createPosition({
  lat,
  lng,
  speed = 0,
  heading = null,
  accuracy = null,
  source = 'gps',
  timestamp = Date.now(),
}) {
  const speedMs = speed == null || Number.isNaN(Number(speed)) ? 0 : Number(speed)
  return {
    lat,
    lng,
    speedMs,
    speedKmh: msToKmh(speedMs),
    heading,
    accuracy,
    source,
    timestamp,
  }
}

function hasPreciseSource(pos) {
  return pos?.source === 'gps' || pos?.source === 'mock' || pos?.source === 'live'
}

export function TrackingProvider({ children, role = 'dispatcher', tripIdFromUrl = null }) {
  const isDriverRole = role === 'driver'

  const [activeTripId, setActiveTripId] = useState(tripIdFromUrl)
  const [tripActive, setTripActive] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [driverLive, setDriverLive] = useState(null)
  const [serverPosition, setServerPosition] = useState(null)
  const [trail, setTrail] = useState([])
  const [geofenceCenter, setGeofenceCenter] = useState(null)
  const [geofenceBreached, setGeofenceBreached] = useState(false)
  const [toast, setToast] = useState(null)
  const [tripStartedAt, setTripStartedAt] = useState(null)
  const [lastServerTickAt, setLastServerTickAt] = useState(null)
  const [updateCount, setUpdateCount] = useState(0)
  const [geoPermission, setGeoPermission] = useState('prompt')
  const [geoError, setGeoError] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [ipLocation, setIpLocation] = useState(null)
  const [ipStatus, setIpStatus] = useState('idle')
  const [ipError, setIpError] = useState(null)

  const [activeInvite, setActiveInvite] = useState(null)
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [locationConsentPending, setLocationConsentPending] = useState(
    Boolean(isDriverRole && tripIdFromUrl),
  )

  const watchIdRef = useRef(null)
  const wasOutsideRef = useRef(false)
  const preciseStartedRef = useRef(false)
  const sendRef = useRef(() => false)
  const pendingQueueRef = useRef([])

  const locationMode = useMemo(() => {
    if (hasPreciseSource(serverPosition) || hasPreciseSource(driverLive)) {
      return 'precise'
    }
    if (ipLocation) return 'ip'
    return 'unknown'
  }, [serverPosition, driverLive, ipLocation])

  const dismissToast = useCallback(() => setToast(null), [])

  const showToast = useCallback((message, tone = 'warn') => {
    setToast({ id: Date.now(), message, tone })
  }, [])

  const applyLivePoint = useCallback(
    (raw, source = 'live') => {
      const next = createPosition({
        lat: raw.lat,
        lng: raw.lng,
        speed: raw.speed ?? 0,
        heading: raw.heading ?? null,
        source,
        timestamp: raw.timestamp || Date.now(),
      })

      setDriverLive(next)
      setServerPosition(next)
      setLastServerTickAt(Date.now())
      setUpdateCount((n) => n + 1)
      setTrail((prev) => {
        const point = { lat: next.lat, lng: next.lng, t: next.timestamp }
        return [...prev, point].slice(-200)
      })

      setGeofenceCenter((center) => {
        if (!center) {
          return { lat: next.lat, lng: next.lng }
        }
        const dist = distanceMeters(center, next)
        const outside = dist > GEOFENCE_RADIUS_M
        setGeofenceBreached(outside)
        if (outside && !wasOutsideRef.current) {
          showToast(
            `Geofence breach — driver is ${Math.round(dist)}m from trip start (limit ${GEOFENCE_RADIUS_M}m).`,
            'danger',
          )
        }
        wasOutsideRef.current = outside
        return center
      })

      if (!tripStartedAt) setTripStartedAt(Date.now())
      setTripActive(true)
    },
    [showToast, tripStartedAt],
  )

  const onSocketMessage = useCallback(
    (msg) => {
      if (msg.type === 'location_update') {
        applyLivePoint(msg, 'live')
        return
      }
      if (msg.type === 'connected' && msg.latest) {
        applyLivePoint(msg.latest, 'live')
      }
      if (msg.type === 'error') {
        showToast(msg.message || 'WebSocket error', 'warn')
      }
    },
    [applyLivePoint, showToast],
  )

  // Dispatcher listens as soon as a trip exists; driver after consent / trip active.
  const socketEnabled = Boolean(
    activeTripId &&
      (isDriverRole ? tripActive && !locationConsentPending : Boolean(activeTripId)),
  )

  const { send } = useTripSocket({
    tripId: activeTripId,
    role: isDriverRole ? 'driver' : 'dispatcher',
    enabled: socketEnabled,
    onMessage: onSocketMessage,
    onStatusChange: setConnectionStatus,
  })

  sendRef.current = send

  useEffect(() => {
    if (connectionStatus !== 'connected') return
    if (!pendingQueueRef.current.length) return
    const queued = pendingQueueRef.current.splice(0)
    for (const payload of queued) {
      sendRef.current(payload)
    }
  }, [connectionStatus])

  const publishToServer = useCallback((coords) => {
    const payload = {
      type: 'location_update',
      lat: coords.lat,
      lng: coords.lng,
      speed: coords.speed ?? 0,
      heading: coords.heading ?? null,
      timestamp: Date.now(),
    }

    const sent = sendRef.current(payload)
    if (!sent) pendingQueueRef.current.push(payload)

    // Optimistic local update for the publishing driver.
    if (isDriverRole) {
      applyLivePoint(payload, coords.source || 'gps')
    }
    return sent
  }, [applyLivePoint, isDriverRole])

  /** IP bootstrap — map center before any live trip fix. */
  useEffect(() => {
    if (preciseStartedRef.current) return undefined
    if (hasPreciseSource(serverPosition)) return undefined

    const controller = new AbortController()
    setIpStatus('loading')

    fetchIpGeolocation(controller.signal)
      .then((approx) => {
        if (preciseStartedRef.current) return
        setIpLocation(approx)
        setIpStatus('ready')
        setServerPosition((prev) => {
          if (prev && hasPreciseSource(prev)) return prev
          return createPosition({
            lat: approx.lat,
            lng: approx.lng,
            accuracy: 5000,
            source: 'ip',
          })
        })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setIpStatus('error')
        setIpError(err.message || 'Could not resolve IP location')
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Dispatcher: load historical path when trip id is known. */
  useEffect(() => {
    if (isDriverRole || !activeTripId) return undefined

    let cancelled = false
    setHistoryLoading(true)

    fetchTripHistory(activeTripId)
      .then((data) => {
        if (cancelled) return
        const points = data.points || []
        if (!points.length) return

        setTrail(
          points.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            t: p.created_at ? Date.parse(p.created_at) : Date.now(),
          })),
        )

        const last = points[points.length - 1]
        const first = points[0]
        setGeofenceCenter({ lat: first.lat, lng: first.lng })
        wasOutsideRef.current = false
        setServerPosition(
          createPosition({
            lat: last.lat,
            lng: last.lng,
            speed: last.speed ?? 0,
            source: 'live',
            timestamp: last.created_at ? Date.parse(last.created_at) : Date.now(),
          }),
        )
        setTripActive(true)
        setTripStartedAt((t) => t ?? (Date.parse(first.created_at) || Date.now()))
      })
      .catch((err) => {
        if (!cancelled) showToast(err.message || 'Failed to load trip history', 'warn')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeTripId, isDriverRole, showToast])

  const stopWatching = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation API is not available in this browser.')
      setGeoPermission('denied')
      return
    }

    stopWatching()
    setGeoError(null)
    preciseStartedRef.current = true

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoPermission('granted')
        publishToServer({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed ?? 0,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
          source: 'gps',
        })
      },
      (err) => {
        setGeoPermission('denied')
        setGeoError(err.message || 'Unable to read device location.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      },
    )
  }, [publishToServer, stopWatching])

  const stopTrip = useCallback(() => {
    setTripActive(false)
    stopWatching()
    showToast('Trip streaming stopped.', 'warn')
  }, [showToast, stopWatching])

  const startTrip = useCallback(() => {
    if (!activeTripId) {
      showToast('Create or open a trip first.', 'warn')
      return
    }
    setLocationConsentPending(false)
    setTripActive(true)
    setTripStartedAt((t) => t ?? Date.now())
    startWatching()
    showToast('Streaming GPS to the live server.', 'signal')
  }, [activeTripId, showToast, startWatching])

  const toggleTrip = useCallback(() => {
    if (tripActive) stopTrip()
    else startTrip()
  }, [tripActive, startTrip, stopTrip])

  const simulateMovement = useCallback(
    (bearingDeg = null) => {
      if (!activeTripId) {
        showToast('Create or open a trip first.', 'warn')
        return
      }
      if (!tripActive && isDriverRole) {
        setTripActive(true)
        setLocationConsentPending(false)
      }

      preciseStartedRef.current = true
      const base =
        (driverLive && hasPreciseSource(driverLive) ? driverLive : null) ??
        (serverPosition && hasPreciseSource(serverPosition) ? serverPosition : null) ??
        (ipLocation
          ? createPosition({ lat: ipLocation.lat, lng: ipLocation.lng, source: 'mock' })
          : null) ??
        createPosition({ ...DEFAULT_CENTER, source: 'mock' })

      const bearing =
        bearingDeg ??
        (base.heading != null && !Number.isNaN(base.heading)
          ? base.heading
          : Math.random() * 360)

      const moved = offsetByBearing(
        { lat: base.lat, lng: base.lng },
        80 + Math.random() * 60,
        bearing,
      )

      publishToServer({
        lat: moved.lat,
        lng: moved.lng,
        speed: 8 + Math.random() * 6,
        heading: bearing,
        accuracy: 12,
        source: 'mock',
      })
    },
    [
      activeTripId,
      tripActive,
      isDriverRole,
      driverLive,
      serverPosition,
      ipLocation,
      publishToServer,
      showToast,
    ],
  )

  const requestPermissionPreview = useCallback(() => {
    startWatching()
  }, [startWatching])

  const generateTrackingRequest = useCallback(
    async (phoneNumber) => {
      const phone = String(phoneNumber || '').trim()
      if (!phone) {
        showToast('Enter a driver phone number first.', 'warn')
        return null
      }

      setInviteBusy(true)
      try {
        const created = await createTrip()
        const tripId = created.tripId
        const trackingUrl = buildTrackingUrl(tripId)
        const invite = {
          tripId,
          phone,
          trackingUrl,
          createdAt: Date.now(),
          status: 'sent',
          persisted: created.persisted !== false,
        }

        setActiveInvite(invite)
        setInvitePhone(phone)
        setActiveTripId(tripId)
        setTripActive(true)
        setTripStartedAt(Date.now())
        setTrail([])
        setGeofenceCenter(null)
        setGeofenceBreached(false)
        wasOutsideRef.current = false
        showToast(`SMS invitation link sent to ${phone}`, 'signal')
        return invite
      } catch (err) {
        showToast(err.message || 'Failed to create trip', 'danger')
        return null
      } finally {
        setInviteBusy(false)
      }
    },
    [showToast],
  )

  const acceptLocationRequest = useCallback(() => {
    if (!tripIdFromUrl) {
      showToast('Missing tripId on this link.', 'warn')
      return
    }
    setActiveTripId(tripIdFromUrl)
    setLocationConsentPending(false)
    setTripActive(true)
    setTripStartedAt(Date.now())
    preciseStartedRef.current = true
    startWatching()
    showToast('Exact location sharing started for this trip.', 'signal')
  }, [tripIdFromUrl, showToast, startWatching])

  useEffect(() => () => stopWatching(), [stopWatching])

  const value = useMemo(
    () => ({
      role,
      isDriverRole,
      tripIdFromUrl,
      activeTripId,
      tripActive,
      connectionStatus,
      driverLive,
      serverPosition,
      trail,
      geofenceCenter,
      geofenceRadiusM: GEOFENCE_RADIUS_M,
      geofenceBreached,
      toast,
      dismissToast,
      tripStartedAt,
      lastServerTickAt,
      updateCount,
      geoPermission,
      geoError,
      defaultCenter: DEFAULT_CENTER,
      ipLocation,
      ipStatus,
      ipError,
      locationMode,
      activeInvite,
      invitePhone,
      setInvitePhone,
      inviteBusy,
      historyLoading,
      locationConsentPending,
      startTrip,
      stopTrip,
      toggleTrip,
      simulateMovement,
      requestPermissionPreview,
      generateTrackingRequest,
      acceptLocationRequest,
    }),
    [
      role,
      isDriverRole,
      tripIdFromUrl,
      activeTripId,
      tripActive,
      connectionStatus,
      driverLive,
      serverPosition,
      trail,
      geofenceCenter,
      geofenceBreached,
      toast,
      dismissToast,
      tripStartedAt,
      lastServerTickAt,
      updateCount,
      geoPermission,
      geoError,
      ipLocation,
      ipStatus,
      ipError,
      locationMode,
      activeInvite,
      invitePhone,
      inviteBusy,
      historyLoading,
      locationConsentPending,
      startTrip,
      stopTrip,
      toggleTrip,
      simulateMovement,
      requestPermissionPreview,
      generateTrackingRequest,
      acceptLocationRequest,
    ],
  )

  return (
    <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
  )
}

export function useTracking() {
  const ctx = useContext(TrackingContext)
  if (!ctx) {
    throw new Error('useTracking must be used within TrackingProvider')
  }
  return ctx
}
