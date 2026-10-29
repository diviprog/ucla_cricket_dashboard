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
      .select('id, name')
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
      players: players || [],
    })
  } catch (error) {
    console.error('List players error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch players' },
      { status: 500 }
    )
  }
}

