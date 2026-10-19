import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseConfigured = Boolean(url && serviceKey)

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = supabaseConfigured
  ? createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

if (!supabaseConfigured) {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — ' +
      'live broadcast still works; DB writes/history will be unavailable.',
  )
}
