import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Verify the caller is an admin.
 * Expects `Authorization: Bearer <supabase access token>` and checks the user's
 * email against the comma-separated ADMIN_EMAILS env var.
 * Returns null when allowed, otherwise an error response to return directly.
 * Fails closed: an empty or unset ADMIN_EMAILS denies everyone.
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const authHeader = request.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token)

    if (error || !data?.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)

    const email = data.user.email?.toLowerCase()

    if (!email || !adminEmails.includes(email)) {
      return NextResponse.json(
        { success: false, error: 'Not authorized' },
        { status: 403 }
      )
    }

    return null
  } catch (error) {
    console.error('Admin check failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify admin access' },
      { status: 500 }
    )
  }
}
