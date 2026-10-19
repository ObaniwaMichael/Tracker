# PulseTrack Web

React + Vite + Tailwind + Leaflet client for live trip tracking.

## Run (with API)

```bash
# terminal 1 — backend
cd ../server
cp .env.example .env   # add Supabase keys
npm run dev

# terminal 2 — frontend
cd ../web
npm run dev
```

Vite (`http://localhost:3000`) proxies `/api` and `/ws` → `http://localhost:4000`.

## Flow

1. Dispatcher: **Generate Tracking Request** → `POST /api/trips/new`
2. Open the returned `/track?tripId=` link as the driver → allow GPS
3. Driver streams `location_update` over WebSocket; dispatcher map updates live
4. On mount, dispatcher loads `/api/trips/:tripId/history` for the trail
