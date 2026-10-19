# PulseTrack Server

Express HTTP API + native WebSocket rooms, with optional Supabase (PostgreSQL) persistence.

## Setup

1. Create a Supabase project and run [`sql/schema.sql`](./sql/schema.sql) in the SQL Editor.
2. Copy env vars:

```bash
cp .env.example .env
```

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Settings → API).

3. Install & run:

```bash
npm install
npm run dev
```

API: `http://localhost:4000`  
WS: `ws://localhost:4000/ws?tripId=<uuid>&role=driver|dispatcher`

Without Supabase credentials the server still broadcasts live locations in-memory and can mint ephemeral trip IDs for local demos.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness + supabase flag |
| POST | `/api/trips/new` | Create trip, return `tripId` |
| GET | `/api/trips/:tripId/history` | Chronological location logs |

## WebSocket protocol

Connect with `tripId` + `role`.

**Driver → server**
```json
{ "type": "location_update", "lat": 6.52, "lng": 3.37, "speed": 8.2, "timestamp": 1710000000000 }
```

**Server → dispatchers** (same shape, plus `tripId`). Late joiners also receive the cached latest point immediately.
