import { supabase } from '@/lib/supabase/client'

export const ADMIN_AUTH_ERROR =
  "Your session has expired or you don't have admin access. Please log in again."

// True when the server rejected the request for missing/invalid admin credentials
export function isAuthError(response: Response): boolean {
  return response.status === 401 || response.status === 403
}

// fetch wrapper that attaches the current Supabase access token for admin API routes.
// Never sets Content-Type, so FormData bodies keep their multipart boundary.
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(input, { ...init, headers })
}
