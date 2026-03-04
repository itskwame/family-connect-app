import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export function isSupabaseConfigured() {
  return supabaseUrl !== '' && supabaseAnonKey !== ''
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey)
  }

  return cachedClient
}
