import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { 
  updatePlayerSeasonStats, 
  updateBowlingSeasonStats, 
  updateFieldingSeasonStats 
} from '@/lib/services/stats-service'

/**
 * Update performance stats (runs, balls, wickets, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      performanceId, 
      performanceType, // 'batting' | 'bowling' | 'fielding'
      updates, // Object with fields to update
      matchId,
    } = body
    
    if (!performanceId || !performanceType || !updates || !matchId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Determine the table name and allowed fields
    let tableName: string
    let allowedFields: string[]
    
    if (performanceType === 'batting') {
      tableName = 'batting_performances'
      allowedFields = ['runs', 'balls', 'fours', 'sixes', 'not_out', 'dismissal_text']
    } else if (performanceType === 'bowling') {
      tableName = 'bowling_performances'
      allowedFields = ['overs', 'balls', 'maidens', 'runs_conceded', 'wickets', 'dots', 'wides', 'no_balls', 'economy']
    } else {
      tableName = 'fielding_performances'
      allowedFields = ['catches', 'run_outs', 'stumpings']
    }
    
    // Filter updates to only allowed fields
    const safeUpdates: Record<string, any> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        safeUpdates[key] = value
      }
    }
    
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      )
    }
    
    // Get current performance for player ID
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
    
    // Update the performance
    const { error: updateError } = await supabase
      .from(tableName)
      .update(safeUpdates)
      .eq('id', performanceId)
    
    if (updateError) {
      console.error('Error updating performance:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update performance' },
        { status: 500 }
      )
    }
    
    // Recalculate season stats
    const { data: match } = await supabase
      .from('matches')
      .select('season_id')
      .eq('id', matchId)
      .single()
    
    if (match) {
      if (performanceType === 'batting') {
        await updatePlayerSeasonStats(currentPerf.player_id, match.season_id)
      } else if (performanceType === 'bowling') {
        await updateBowlingSeasonStats(currentPerf.player_id, match.season_id)
      } else {
        await updateFieldingSeasonStats(currentPerf.player_id, match.season_id)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Performance updated successfully',
      updates: safeUpdates,
    })
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    )
  }
}

