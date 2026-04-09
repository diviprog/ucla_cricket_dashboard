import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

/**
 * Update match metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { matchId, updates } = body
    
    if (!matchId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Allowed fields to update
    const allowedFields = [
      'competition_name',
      'match_type',
      'venue',
      'result',
      'notes',
      'our_extras_total',
      'our_extras_wides',
      'our_extras_no_balls',
      'our_extras_byes',
      'our_extras_leg_byes',
    ]
    
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
    
    // Update the match
    const { error: updateError } = await supabase
      .from('matches')
      .update(safeUpdates)
      .eq('id', matchId)
    
    if (updateError) {
      console.error('Error updating match:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update match' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Match updated successfully',
      updates: safeUpdates,
    })
  } catch (error) {
    console.error('Update match error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    )
  }
}

