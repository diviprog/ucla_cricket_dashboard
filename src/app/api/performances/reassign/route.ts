import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { 
  updatePlayerSeasonStats, 
  updateBowlingSeasonStats, 
  updateFieldingSeasonStats 
} from '@/lib/services/stats-service'

// Special ID for unclaimed performances
const UNCLAIMED_PLAYER_ID = 'unclaimed'

/**
 * Get or create a unique "Unclaimed" player for misc performances
 * Since a match can have multiple unclaimed performances, we create unique unclaimed players
 * named "Unclaimed #1", "Unclaimed #2", etc.
 */
async function getOrCreateUnclaimedPlayer(matchId: string, performanceType: string): Promise<string> {
  // Find the next available unclaimed number for this match
  // Get all unclaimed players already used in this match
  const tableName = performanceType === 'batting' 
    ? 'batting_performances'
    : performanceType === 'bowling'
    ? 'bowling_performances'
    : 'fielding_performances'
  
  // Get existing unclaimed players in this match
  const { data: existingPerfs } = await supabase
    .from(tableName)
    .select(`
      player_id,
      player:players(name)
    `)
    .eq('match_id', matchId)
  
  const usedUnclaimedIds = new Set(
    existingPerfs
      ?.filter((p: any) => p.player?.name?.startsWith('Unclaimed'))
      ?.map((p: any) => p.player_id) || []
  )
  
  // Try to find an existing Unclaimed player not used in this match
  const { data: allUnclaimed } = await supabase
    .from('players')
    .select('id, name')
    .like('name', 'Unclaimed%')
    .order('name')
  
  for (const unclaimed of allUnclaimed || []) {
    if (!usedUnclaimedIds.has(unclaimed.id)) {
      return unclaimed.id
    }
  }
  
  // Create a new Unclaimed player with a unique number
  const maxNumber = (allUnclaimed || []).reduce((max, p) => {
    const match = p.name.match(/Unclaimed #?(\d+)?/)
    if (match) {
      const num = parseInt(match[1]) || 1
      return Math.max(max, num)
    }
    return max
  }, 0)
  
  const newName = maxNumber === 0 ? 'Unclaimed #1' : `Unclaimed #${maxNumber + 1}`
  
  const { data: newPlayer, error } = await supabase
    .from('players')
    .insert({ name: newName })
    .select('id')
    .single()
  
  if (error) {
    throw new Error('Failed to create Unclaimed player')
  }
  
  return newPlayer.id
}

/**
 * Reassign a performance from one player to another
 * This updates the performance record and recalculates season stats for both players
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { 
      performanceId, 
      performanceType, // 'batting' | 'bowling' | 'fielding'
      newPlayerId,
      matchId,
    } = body
    
    if (!performanceId || !performanceType || !newPlayerId || !matchId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Handle unclaimed/misc player
    if (newPlayerId === UNCLAIMED_PLAYER_ID) {
      newPlayerId = await getOrCreateUnclaimedPlayer(matchId, performanceType)
    }
    
    // Determine the table name
    const tableName = performanceType === 'batting' 
      ? 'batting_performances'
      : performanceType === 'bowling'
      ? 'bowling_performances'
      : 'fielding_performances'
    
    // Get the current performance to find the old player
    const { data: currentPerf, error: fetchError } = await supabase
      .from(tableName)
      .select('player_id')
      .eq('id', performanceId)
      .single()
    
    if (fetchError || !currentPerf) {
      return NextResponse.json(
        { success: false, error: 'Performance not found' },
        { status: 404 }
      )
    }
    
    const oldPlayerId = currentPerf.player_id
    
    // Check if the new player already has a performance in this match
    const { data: existingPerf } = await supabase
      .from(tableName)
      .select('id')
      .eq('match_id', matchId)
      .eq('player_id', newPlayerId)
      .single()
    
    if (existingPerf) {
      return NextResponse.json(
        { success: false, error: 'New player already has a performance in this match. Consider merging or editing instead.' },
        { status: 400 }
      )
    }
    
    // Update the performance with the new player
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ player_id: newPlayerId })
      .eq('id', performanceId)
    
    if (updateError) {
      console.error('Error updating performance:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update performance' },
        { status: 500 }
      )
    }
    
    // Get the match's season for stats recalculation
    const { data: match } = await supabase
      .from('matches')
      .select('season_id')
      .eq('id', matchId)
      .single()
    
    if (match) {
      // Recalculate stats for both players
      if (performanceType === 'batting') {
        await updatePlayerSeasonStats(oldPlayerId, match.season_id)
        await updatePlayerSeasonStats(newPlayerId, match.season_id)
      } else if (performanceType === 'bowling') {
        await updateBowlingSeasonStats(oldPlayerId, match.season_id)
        await updateBowlingSeasonStats(newPlayerId, match.season_id)
      } else {
        await updateFieldingSeasonStats(oldPlayerId, match.season_id)
        await updateFieldingSeasonStats(newPlayerId, match.season_id)
      }
    }
    
    // Get new player info for response
    const { data: newPlayer } = await supabase
      .from('players')
      .select('id, name')
      .eq('id', newPlayerId)
      .single()
    
    return NextResponse.json({
      success: true,
      message: 'Performance reassigned successfully',
      newPlayer,
    })
  } catch (error) {
    console.error('Reassign error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Reassign failed' },
      { status: 500 }
    )
  }
}

