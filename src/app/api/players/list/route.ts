import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

/**
 * Get all players for dropdown selection
 */
export async function GET() {
  try {
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

