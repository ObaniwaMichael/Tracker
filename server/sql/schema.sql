-- PulseTrack Supabase / PostgreSQL schema
-- Run this in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.location_logs (
  id bigserial primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  latitude numeric not null,
  longitude numeric not null,
  speed numeric,
  created_at timestamptz not null default now()
);

create index if not exists location_logs_trip_id_created_at_idx
  on public.location_logs (trip_id, created_at asc);

-- Optional: allow the service role key full access (default for server-side).
-- If you use the anon key from the browser later, tighten these policies.
alter table public.trips enable row level security;
alter table public.location_logs enable row level security;

-- Service role bypasses RLS; these policies help if querying with anon key.
create policy "Service can manage trips"
  on public.trips
  for all
  using (true)
  with check (true);

create policy "Service can manage location_logs"
  on public.location_logs
  for all
  using (true)
  with check (true);
