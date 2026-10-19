import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

function buildDriverIcon(heading) {
  const rotation =
    heading != null && !Number.isNaN(heading) ? Number(heading) : 0

  return L.divIcon({
    className: 'pulse-marker-wrap',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        transform: rotate(${rotation}deg);
        filter: drop-shadow(0 2px 6px rgba(0,0,0,.45));
      ">
        <div style="
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 35%, #5eead4, #0f766e);
          border: 2px solid #ecfdf5;
          position: relative;
        ">
          <div style="
            position: absolute;
            top: -7px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-bottom: 8px solid #ecfdf5;
          "></div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -16],
  })
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Interpolates marker lat/lng over ~1.2s whenever the mock WebSocket
 * publishes a new server position — smoother than a hard jump.
 */
export default function AnimatedMarker({ position }) {
  const [display, setDisplay] = useState(position)
  const fromRef = useRef(position)
  const toRef = useRef(position)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!position) {
      setDisplay(null)
      return undefined
    }

    if (!fromRef.current) {
      fromRef.current = position
      toRef.current = position
      setDisplay(position)
      return undefined
    }

    fromRef.current = display ?? position
    toRef.current = position
    const start = performance.now()
    const duration = 1200

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic
      const e = 1 - (1 - t) ** 3
      const next = {
        ...toRef.current,
        lat: lerp(fromRef.current.lat, toRef.current.lat, e),
        lng: lerp(fromRef.current.lng, toRef.current.lng, e),
      }
      setDisplay(next)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = toRef.current
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // Intentionally depend only on target position identity fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, position?.timestamp])

  const icon = useMemo(
    () => buildDriverIcon(display?.heading ?? position?.heading),
    [display?.heading, position?.heading],
  )

  if (!display) return null

  return (
    <Marker position={[display.lat, display.lng]} icon={icon}>
      <Popup>
        <div className="text-xs">
          <strong>Driver</strong>
          <br />
          {display.lat.toFixed(5)}, {display.lng.toFixed(5)}
          <br />
          {(position?.speedKmh ?? 0).toFixed(1)} km/h
        </div>
      </Popup>
    </Marker>
  )
}
