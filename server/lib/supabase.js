import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
// New sb_secret_… key, or legacy service_role JWT (eyJ…).
const serviceKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseConfigured = Boolean(url && serviceKey)

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = supabaseConfigured
  ? createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

if (!supabaseConfigured) {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) missing — ' +
      'live broadcast still works; DB writes/history will be unavailable.',
  )
}
