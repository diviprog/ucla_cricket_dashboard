import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { describeDbError } from '@/lib/supabase/migration-guard'

// POST /api/players/update - Update player info
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { playerId, name, isUcla } = body
    
    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'Player ID is required' },
        { status: 400 }
      )
    }

    if (isUcla !== undefined && typeof isUcla !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isUcla must be true or false' },
        { status: 400 }
      )
    }

    if (name === undefined && isUcla === undefined) {
      return NextResponse.json(
        { success: false, error: 'Nothing to update' },
        { status: 400 }
      )
    }

    const updates: { name?: string; is_ucla?: boolean } = {}
    if (isUcla !== undefined) updates.is_ucla = isUcla

    if (name !== undefined) {
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
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Another player already has this name' },
          { status: 400 }
        )
      }
      updates.name = name.trim()
    }
    
    // Update the player (is_ucla is read at query time, so stats views update immediately)
    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', playerId)
    
    if (error) {
      return NextResponse.json(
        { success: false, error: describeDbError(error) },
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

