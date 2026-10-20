import 'dotenv/config'
import http from 'node:http'
import { URL } from 'node:url'
import cors from 'cors'
import express from 'express'
import { WebSocketServer } from 'ws'
import { supabase, supabaseConfigured } from './lib/supabase.js'

const PORT = Number(process.env.PORT || 4000)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: CORS_ORIGIN.split(',').map((s) => s.trim()),
  }),
)
app.use(express.json())

/** @type {Map<string, { lat: number, lng: number, speed: number|null, heading: number|null, timestamp: number }>} */
const latestByTrip = new Map()

/**
 * tripId → { drivers: Set<WebSocket>, dispatchers: Set<WebSocket> }
 * @type {Map<string, { drivers: Set<import('ws').WebSocket>, dispatchers: Set<import('ws').WebSocket> }>}
 */
const rooms = new Map()

function getRoom(tripId) {
  let room = rooms.get(tripId)
  if (!room) {
    room = { drivers: new Set(), dispatchers: new Set() }
    rooms.set(tripId, room)
  }
  return room
}

function leaveRoom(tripId, role, socket) {
  const room = rooms.get(tripId)
  if (!room) return
  if (role === 'driver') room.drivers.delete(socket)
  else room.dispatchers.delete(socket)
  if (room.drivers.size === 0 && room.dispatchers.size === 0) {
    rooms.delete(tripId)
  }
}

function safeSend(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

function broadcastToDispatchers(tripId, payload, except = null) {
  const room = rooms.get(tripId)
  if (!room) return
  for (const client of room.dispatchers) {
    if (client !== except) safeSend(client, payload)
  }
}

async function persistLocationLog(tripId, point) {
  if (!supabaseConfigured || !supabase) return

  const { error } = await supabase.from('location_logs').insert({
    trip_id: tripId,
    latitude: point.lat,
    longitude: point.lng,
    speed: point.speed,
  })

  if (error) {
    console.error('[supabase] location_logs insert failed:', error.message)
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    supabase: supabaseConfigured,
    activeTrips: rooms.size,
  })
})

/** Create an active trip; returns generated UUID tripId. */
app.post('/api/trips/new', async (_req, res) => {
  if (!supabaseConfigured || !supabase) {
    // Dev fallback when Supabase is not configured yet.
    const tripId = crypto.randomUUID()
    return res.status(201).json({
      tripId,
      status: 'active',
      created_at: new Date().toISOString(),
      persisted: false,
      warning: 'Supabase not configured — trip exists only for this server process.',
    })
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({ status: 'active' })
    .select('id, status, created_at')
    .single()

  if (error) {
    console.error('[supabase] create trip failed:', error.message)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({
    tripId: data.id,
    status: data.status,
    created_at: data.created_at,
    persisted: true,
  })
})

/** Chronological location history for a trip (dispatcher trail bootstrap). */
app.get('/api/trips/:tripId/history', async (req, res) => {
  const { tripId } = req.params

  if (!supabaseConfigured || !supabase) {
    const latest = latestByTrip.get(tripId)
    return res.json({
      tripId,
      points: latest
        ? [
            {
              lat: latest.lat,
              lng: latest.lng,
              speed: latest.speed,
              created_at: new Date(latest.timestamp).toISOString(),
            },
          ]
        : [],
      persisted: false,
    })
  }

  const { data, error } = await supabase
    .from('location_logs')
    .select('latitude, longitude, speed, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[supabase] history fetch failed:', error.message)
    return res.status(500).json({ error: error.message })
  }

  const points = (data || []).map((row) => ({
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    speed: row.speed == null ? null : Number(row.speed),
    created_at: row.created_at,
  }))

  return res.json({ tripId, points, persisted: true })
})

const server = http.createServer(app)

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (socket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const tripId = url.searchParams.get('tripId')
  const role = (url.searchParams.get('role') || 'dispatcher').toLowerCase()

  if (!tripId) {
    safeSend(socket, { type: 'error', message: 'tripId query parameter is required' })
    socket.close(1008, 'tripId required')
    return
  }

  if (role !== 'driver' && role !== 'dispatcher') {
    safeSend(socket, { type: 'error', message: 'role must be driver or dispatcher' })
    socket.close(1008, 'invalid role')
    return
  }

  const room = getRoom(tripId)
  if (role === 'driver') room.drivers.add(socket)
  else room.dispatchers.add(socket)

  socket.tripId = tripId
  socket.role = role

  safeSend(socket, {
    type: 'connected',
    tripId,
    role,
    latest: latestByTrip.get(tripId) || null,
  })

  // Late-joining dispatchers get an immediate catch-up snapshot.
  if (role === 'dispatcher') {
    const latest = latestByTrip.get(tripId)
    if (latest) {
      safeSend(socket, { type: 'location_update', tripId, ...latest })
    }
  }

  socket.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(String(raw))
    } catch {
      safeSend(socket, { type: 'error', message: 'Invalid JSON payload' })
      return
    }

    if (msg.type !== 'location_update') {
      safeSend(socket, { type: 'error', message: `Unsupported message type: ${msg.type}` })
      return
    }

    if (socket.role !== 'driver') {
      safeSend(socket, { type: 'error', message: 'Only drivers may publish location_update' })
      return
    }

    const lat = Number(msg.lat)
    const lng = Number(msg.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      safeSend(socket, { type: 'error', message: 'lat/lng must be numbers' })
      return
    }

    const point = {
      lat,
      lng,
      speed: msg.speed == null || Number.isNaN(Number(msg.speed)) ? null : Number(msg.speed),
      heading:
        msg.heading == null || Number.isNaN(Number(msg.heading))
          ? null
          : Number(msg.heading),
      timestamp: Number(msg.timestamp) || Date.now(),
    }

    latestByTrip.set(tripId, point)

    const outbound = { type: 'location_update', tripId, ...point }
    broadcastToDispatchers(tripId, outbound)

    // Fire-and-forget Supabase write
    void persistLocationLog(tripId, point)
  })

  socket.on('close', () => {
    leaveRoom(socket.tripId, socket.role, socket)
  })

  socket.on('error', () => {
    leaveRoom(socket.tripId, socket.role, socket)
  })
})

// Vercel Fluid + WebSockets need the HTTP server as the default export.
// Locally we still bind a port ourselves.
export default server

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`[pulsetrack] API + WS listening on http://localhost:${PORT}`)
    console.log(
      `[pulsetrack] WebSocket path ws://localhost:${PORT}/ws?tripId=...&role=driver|dispatcher`,
    )
    console.log(`[pulsetrack] CORS origin: ${CORS_ORIGIN}`)
  })
}
