import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

// POST /api/players/aliases - Add alias for a player
export async function POST(request: NextRequest) {
  try {
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

