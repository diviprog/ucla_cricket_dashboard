import { NextResponse } from 'next/server'
import { getBowlingWicketStatsForLeaderboard } from '@/lib/services/stats-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const wicketStats = await getBowlingWicketStatsForLeaderboard()
    
    // Convert Map to object for JSON serialization
    const statsObject: Record<string, { type: string; percentage: number; label: string }> = {}
    for (const [playerId, stats] of wicketStats) {
      statsObject[playerId] = stats
    }
    
    return NextResponse.json({ success: true, data: statsObject })
  } catch (error) {
    console.error('Error fetching wicket stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wicket stats' },
      { status: 500 }
    )
  }
}

