import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service role key (bypasses RLS).
// Created lazily so modules that import this file can still be bundled for the browser
// without touching the service key. Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Server-side database writes require the service role key.')
  }
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.')
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return adminClient
}
