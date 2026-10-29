import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Get all players for dropdown selection
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data: players, error } = await supabase
      .from('players')
      .select('*') // includes is_ucla once migration 001 has run
      .order('name')
    
    if (error) {
      console.error('Error fetching players:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch players' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      players: (players || []).map(p => ({ id: p.id, name: p.name, is_ucla: p.is_ucla !== false })),
    })
  } catch (error) {
    console.error('List players error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch players' },
      { status: 500 }
    )
  }
}

