import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

// POST /api/players/update - Update player info
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { playerId, name } = body
    
    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID is required' },
        { status: 400 }
      )
    }
    
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Player name is required' },
        { status: 400 }
      )
    }
    
    // Check if another player already has this name
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('name', name.trim())
      .neq('id', playerId)
      .single()
    
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Another player already has this name' },
        { status: 400 }
      )
    }
    
    // Update the player
    const { error } = await supabase
      .from('players')
      .update({ name: name.trim() })
      .eq('id', playerId)
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Player updated successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update player' },
      { status: 500 }
    )
  }
}

