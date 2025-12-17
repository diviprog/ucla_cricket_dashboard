import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

// GET /api/players - List all players with aliases
export async function GET() {
  try {
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('name')
    
    if (playersError) {
      return NextResponse.json(
        { success: false, error: playersError.message },
        { status: 500 }
      )
    }
    
    const { data: aliases } = await supabase
      .from('player_aliases')
      .select('*')
    
    // Group aliases by player
    const aliasMap = new Map<string, string[]>()
    aliases?.forEach(alias => {
      if (!aliasMap.has(alias.player_id)) {
        aliasMap.set(alias.player_id, [])
      }
      aliasMap.get(alias.player_id)!.push(alias.alias)
    })
    
    const playersWithAliases = players?.map(player => ({
      ...player,
      aliases: aliasMap.get(player.id) || [],
    }))
    
    return NextResponse.json({
      success: true,
      players: playersWithAliases,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch players' },
      { status: 500 }
    )
  }
}

// POST /api/players - Create new player
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body
    
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Player name is required' },
        { status: 400 }
      )
    }
    
    // Check if player already exists
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('name', name.trim())
      .single()
    
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Player already exists' },
        { status: 400 }
      )
    }
    
    // Create player
    const { data: player, error } = await supabase
      .from('players')
      .insert({ name: name.trim() })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      player,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create player' },
      { status: 500 }
    )
  }
}

// DELETE /api/players - Delete a player
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('id')
    
    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID is required' },
        { status: 400 }
      )
    }
    
    // Check if player has any performances
    const { data: battingPerfs } = await supabase
      .from('batting_performances')
      .select('id')
      .eq('player_id', playerId)
      .limit(1)
    
    const { data: bowlingPerfs } = await supabase
      .from('bowling_performances')
      .select('id')
      .eq('player_id', playerId)
      .limit(1)
    
    const { data: fieldingPerfs } = await supabase
      .from('fielding_performances')
      .select('id')
      .eq('player_id', playerId)
      .limit(1)
    
    const hasPerformances = 
      (battingPerfs && battingPerfs.length > 0) ||
      (bowlingPerfs && bowlingPerfs.length > 0) ||
      (fieldingPerfs && fieldingPerfs.length > 0)
    
    if (hasPerformances) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete player with match performances. Remove their performances first or reassign them to another player.' 
        },
        { status: 400 }
      )
    }
    
    // Delete player aliases first (due to foreign key constraint)
    await supabase
      .from('player_aliases')
      .delete()
      .eq('player_id', playerId)
    
    // Delete player season stats
    await supabase
      .from('player_season_stats')
      .delete()
      .eq('player_id', playerId)
    
    await supabase
      .from('bowling_season_stats')
      .delete()
      .eq('player_id', playerId)
    
    await supabase
      .from('fielding_season_stats')
      .delete()
      .eq('player_id', playerId)
    
    // Delete the player
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Player deleted successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete player' },
      { status: 500 }
    )
  }
}

