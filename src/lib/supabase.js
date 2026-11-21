import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
// Kunci publik: boleh berupa publishable key (sb_publishable_...) atau anon key lama.
const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()

export const isSupabaseConfigured = Boolean(
  url
  && anonKey
  && !url.includes('YOUR_PROJECT_REF')
  && !anonKey.includes('your-anon-key')
  && !anonKey.includes('your-publishable-key'),
)

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null
