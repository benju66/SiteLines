// Supabase browser client (Data Seam Phase 3). Reads the publishable key + URL
// from Vite env. The key is public-in-bundle by design; what the browser can
// actually read is governed server-side by RLS (see the Phase 3 read policy).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (see .env.local)')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}
