import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

// POST /api/players/aliases - Add alias for a player
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { playerId, alias } = body
    
    if (!playerId || !alias?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Player ID and alias are required' },
        { status: 400 }
      )
    }
    
    // Check if alias already exists
    const { data: existing } = await supabase
      .from('player_aliases')
      .select('id')
      .eq('alias', alias.trim())
      .single()
    
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This alias is already assigned to another player' },
        { status: 400 }
      )
    }
    
    // Create alias
    const { error } = await supabase
      .from('player_aliases')
      .insert({ 
        player_id: playerId, 
        alias: alias.trim() 
      })
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to add alias' },
      { status: 500 }
    )
  }
}


// DELETE /api/players/aliases?playerId=xxx&alias=xxx - Remove an alias from a player
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')
    const alias = searchParams.get('alias')

    if (!playerId || !alias) {
      return NextResponse.json(
        { success: false, error: 'Player ID and alias are required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('player_aliases')
      .delete()
      .eq('player_id', playerId)
      .eq('alias', alias)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete alias' },
      { status: 500 }
    )
  }
}
