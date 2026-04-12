import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET() {
  try {
    // Get all seasons
    const { data: seasons, error: seasonsError } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })

    if (seasonsError) {
      throw seasonsError
    }

    // Get all unique competition names from matches
    const { data: competitions, error: competitionsError } = await supabase
      .from('matches')
      .select('competition_name')
      .not('competition_name', 'is', null)

    if (competitionsError) {
      throw competitionsError
    }

    // Get unique competition names
    const uniqueCompetitions = [...new Set(
      competitions
        .map(m => m.competition_name)
        .filter(Boolean)
    )].sort()

    return NextResponse.json({
      success: true,
      seasons: seasons || [],
      competitions: uniqueCompetitions,
    })
  } catch (error) {
    console.error('Error fetching seasons:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch seasons' },
      { status: 500 }
    )
  }
}

