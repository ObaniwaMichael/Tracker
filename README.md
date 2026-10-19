# PulseTrack

Live mobility tracking MVP: React client + Express/WebSocket API + Supabase Postgres.

```
tracker/
├── web/       # Vite React app (port 3000)
├── server/    # Express + ws API (port 4000)
└── ...        # legacy Python caller-ID prototype (unrelated)
```

## Quick start

1. **Database** — in Supabase SQL Editor, run `server/sql/schema.sql`.
2. **Server**
   ```bash
   cd server
   cp .env.example .env   # set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   npm install
   npm run dev
   ```
3. **Web**
   ```bash
   cd web
   npm install
   npm run dev
   ```
4. Open `http://localhost:3000` → Generate Tracking Request → open driver link → Allow GPS.
