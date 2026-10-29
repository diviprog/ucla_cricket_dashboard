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
  assertSecretKey(serviceKey)

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return adminClient
}

// A public key here makes every write fail RLS, and blocked UPDATE/DELETE fail
// silently (0 rows), so refuse publishable/anon keys up front.
export function assertSecretKey(key: string): void {
  if (key.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is a publishable (public) key. Use the secret key (sb_secret_...) from Supabase → Project Settings → API Keys.')
  }
  if (key.startsWith('eyJ')) {
    let role: unknown
    try {
      role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role
    } catch {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not a valid key.')
    }
    if (role !== 'service_role') {
      throw new Error(`SUPABASE_SERVICE_ROLE_KEY has role "${role}", expected "service_role". Use the service_role or secret key, not the anon key.`)
    }
  }
}
