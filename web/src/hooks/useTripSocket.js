import { useEffect, useRef } from 'react'
import { buildWsUrl } from '../utils/api'

/**
 * Opens a live WebSocket for a trip room.
 * onMessage receives parsed JSON payloads from the server.
 */
export function useTripSocket({
  tripId,
  role,
  enabled,
  onMessage,
  onStatusChange,
}) {
  const onMessageRef = useRef(onMessage)
  const onStatusRef = useRef(onStatusChange)
  onMessageRef.current = onMessage
  onStatusRef.current = onStatusChange

  const socketRef = useRef(null)

  useEffect(() => {
    if (!enabled || !tripId) {
      onStatusRef.current?.('disconnected')
      return undefined
    }

    let closed = false
    let retryTimer = null
    let attempt = 0

    const connect = () => {
      if (closed) return
      const url = buildWsUrl(tripId, role)
      const ws = new WebSocket(url)
      socketRef.current = ws
      onStatusRef.current?.('connecting')

      ws.onopen = () => {
        attempt = 0
        onStatusRef.current?.('connected')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessageRef.current?.(data)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onerror = () => {
        onStatusRef.current?.('disconnected')
      }

      ws.onclose = () => {
        onStatusRef.current?.('disconnected')
        socketRef.current = null
        if (closed) return
        attempt += 1
        const delay = Math.min(8000, 500 * 2 ** Math.min(attempt, 4))
        retryTimer = window.setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closed = true
      if (retryTimer) window.clearTimeout(retryTimer)
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [tripId, role, enabled])

  const send = (payload) => {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(payload))
    return true
  }

  return { send, socketRef }
}
