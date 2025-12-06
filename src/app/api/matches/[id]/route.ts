import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { 
  updatePlayerSeasonStats, 
  updateBowlingSeasonStats, 
  updateFieldingSeasonStats 
} from '@/lib/services/stats-service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const matchId = params.id

  try {
    // First, get the match to find its season
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, season_id')
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404 }
      )
    }

    const seasonId = match.season_id

    // Get all player IDs affected by this match deletion
    const { data: battingPerfs } = await supabase
      .from('batting_performances')
      .select('player_id')
      .eq('match_id', matchId)

    const { data: bowlingPerfs } = await supabase
      .from('bowling_performances')
      .select('player_id')
      .eq('match_id', matchId)

    const { data: fieldingPerfs } = await supabase
      .from('fielding_performances')
      .select('player_id')
      .eq('match_id', matchId)

    const battingPlayerIds = [...new Set(battingPerfs?.map(p => p.player_id) || [])]
    const bowlingPlayerIds = [...new Set(bowlingPerfs?.map(p => p.player_id) || [])]
    const fieldingPlayerIds = [...new Set(fieldingPerfs?.map(p => p.player_id) || [])]

    // Delete all related records in order (due to foreign key constraints)
    
    // 1. Delete batting performances
    const { error: battingError } = await supabase
      .from('batting_performances')
      .delete()
      .eq('match_id', matchId)

    if (battingError) {
      console.error('Error deleting batting performances:', battingError)
    }

    // 2. Delete bowling performances
    const { error: bowlingError } = await supabase
      .from('bowling_performances')
      .delete()
      .eq('match_id', matchId)

    if (bowlingError) {
      console.error('Error deleting bowling performances:', bowlingError)
    }

    // 3. Delete fielding performances
    const { error: fieldingError } = await supabase
      .from('fielding_performances')
      .delete()
      .eq('match_id', matchId)

    if (fieldingError) {
      console.error('Error deleting fielding performances:', fieldingError)
    }

    // 4. Delete import history
    const { error: historyError } = await supabase
      .from('import_history')
      .delete()
      .eq('match_id', matchId)

    if (historyError) {
      console.error('Error deleting import history:', historyError)
    }

    // 5. Delete the match itself
    const { error: deleteMatchError } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId)

    if (deleteMatchError) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete match' },
        { status: 500 }
      )
    }

    // 6. Recalculate season stats for all affected players
    for (const playerId of battingPlayerIds) {
      await updatePlayerSeasonStats(playerId, seasonId)
    }

    for (const playerId of bowlingPlayerIds) {
      await updateBowlingSeasonStats(playerId, seasonId)
    }

    for (const playerId of fieldingPlayerIds) {
      await updateFieldingSeasonStats(playerId, seasonId)
    }

    return NextResponse.json({
      success: true,
      message: 'Match and all related records deleted successfully',
      deleted: {
        battingPerformances: battingPlayerIds.length,
        bowlingPerformances: bowlingPlayerIds.length,
        fieldingPerformances: fieldingPlayerIds.length,
      },
    })
  } catch (error) {
    console.error('Error deleting match:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    )
  }
}

