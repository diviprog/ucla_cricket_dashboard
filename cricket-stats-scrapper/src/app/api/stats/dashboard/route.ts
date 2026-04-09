import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const seasonId = searchParams.get('seasonId')
    const competitionName = searchParams.get('competition')

    // Get season ID if not provided
    let targetSeasonId = seasonId
    if (!targetSeasonId) {
      const { data: season } = await supabase
        .from('seasons')
        .select('id')
        .order('start_date', { ascending: false })
        .limit(1)
        .single()
      targetSeasonId = season?.id
    }

    if (!targetSeasonId) {
      return NextResponse.json({
        success: true,
        stats: getEmptyStats(),
        topPerformers: getEmptyPerformers(),
        recentMatches: [],
      })
    }

    // Build match query with optional competition filter
    let matchQuery = supabase
      .from('matches')
      .select('id, result, date, opponent, our_score, opponent_score, competition_name')
      .eq('season_id', targetSeasonId)
      .order('date', { ascending: false })

    if (competitionName && competitionName !== 'all') {
      matchQuery = matchQuery.eq('competition_name', competitionName)
    }

    const { data: matches } = await matchQuery

    const matchIds = matches?.map(m => m.id) || []

    // If filtering by competition, we need to calculate stats from performances
    // instead of using pre-computed season stats
    if (competitionName && competitionName !== 'all' && matchIds.length > 0) {
      // Get batting performances for these matches
      const { data: battingPerfs } = await supabase
        .from('batting_performances')
        .select('*, player:players(id, name)')
        .in('match_id', matchIds)

      // Get bowling performances for these matches
      const { data: bowlingPerfs } = await supabase
        .from('bowling_performances')
        .select('*, player:players(id, name)')
        .in('match_id', matchIds)

      // Get fielding performances for these matches
      const { data: fieldingPerfs } = await supabase
        .from('fielding_performances')
        .select('*, player:players(id, name)')
        .in('match_id', matchIds)

      const stats = calculateStatsFromPerformances(
        matches || [],
        battingPerfs || [],
        bowlingPerfs || [],
        fieldingPerfs || []
      )

      const topPerformers = calculateTopPerformers(
        battingPerfs || [],
        bowlingPerfs || [],
        fieldingPerfs || []
      )

      return NextResponse.json({
        success: true,
        stats,
        topPerformers,
        recentMatches: (matches || []).slice(0, 5),
      })
    }

    // Use pre-computed season stats for full season view
    const { data: battingStats } = await supabase
      .from('player_season_stats')
      .select('*, player:players(id, name)')
      .eq('season_id', targetSeasonId)

    const { data: bowlingStats } = await supabase
      .from('bowling_season_stats')
      .select('*, player:players(id, name)')
      .eq('season_id', targetSeasonId)

    const { data: fieldingStats } = await supabase
      .from('fielding_season_stats')
      .select('*, player:players(id, name)')
      .eq('season_id', targetSeasonId)

    const totalMatches = matches?.length || 0
    const wins = matches?.filter(m => m.result === 'win').length || 0
    const losses = matches?.filter(m => m.result === 'loss').length || 0
    const ties = matches?.filter(m => m.result === 'tie').length || 0

    const totalRuns = battingStats?.reduce((sum, s) => sum + s.total_runs, 0) || 0
    const totalWickets = bowlingStats?.reduce((sum, s) => sum + s.total_wickets, 0) || 0
    const totalCatches = fieldingStats?.reduce((sum, s) => sum + s.total_catches, 0) || 0
    const totalFours = battingStats?.reduce((sum, s) => sum + s.fours, 0) || 0
    const totalSixes = battingStats?.reduce((sum, s) => sum + s.sixes, 0) || 0
    const totalPlayers = battingStats?.filter(s => s.total_runs > 0).length || 0

    const stats = {
      totalMatches,
      wins,
      losses,
      ties,
      winPercentage: totalMatches > 0 ? (wins / totalMatches) * 100 : 0,
      totalRuns,
      totalWickets,
      totalCatches,
      totalBoundaries: totalFours + totalSixes,
      totalFours,
      totalSixes,
      avgTeamScore: totalMatches > 0 ? totalRuns / totalMatches : 0,
      totalPlayers,
    }

    // Calculate top performers from season stats
    const isUnclaimed = (name?: string) => name?.toLowerCase().startsWith('unclaimed') || false
    
    const topRunScorer = [...(battingStats || [])]
      .filter(s => !isUnclaimed(s.player?.name))
      .sort((a, b) => b.total_runs - a.total_runs)[0]
    
    const bestAverage = [...(battingStats || [])]
      .filter(s => !isUnclaimed(s.player?.name) && s.dismissals > 0 && s.matches_played >= 2)
      .sort((a, b) => b.average - a.average)[0]
    
    const bestStrikeRate = [...(battingStats || [])]
      .filter(s => !isUnclaimed(s.player?.name) && s.total_balls >= 20)
      .sort((a, b) => b.strike_rate - a.strike_rate)[0]

    const topWicketTaker = [...(bowlingStats || [])]
      .filter(s => !isUnclaimed(s.player?.name))
      .sort((a, b) => b.total_wickets - a.total_wickets)[0]
    
    const bestBowlingAverage = [...(bowlingStats || [])]
      .filter(s => !isUnclaimed(s.player?.name) && s.total_wickets >= 3)
      .sort((a, b) => a.average - b.average)[0]
    
    const bestEconomy = [...(bowlingStats || [])]
      .filter(s => !isUnclaimed(s.player?.name) && s.total_overs >= 5)
      .sort((a, b) => a.economy - b.economy)[0]

    const topFielder = [...(fieldingStats || [])]
      .filter(s => !isUnclaimed(s.player?.name))
      .sort((a, b) => b.total_dismissals - a.total_dismissals)[0]

    const topPerformers = {
      topRunScorer: topRunScorer ? {
        id: topRunScorer.player?.id,
        name: topRunScorer.player?.name || 'Unknown',
        runs: topRunScorer.total_runs,
        average: topRunScorer.average,
        strikeRate: topRunScorer.strike_rate,
      } : null,
      bestAverage: bestAverage ? {
        id: bestAverage.player?.id,
        name: bestAverage.player?.name || 'Unknown',
        average: bestAverage.average,
        runs: bestAverage.total_runs,
        matches: bestAverage.matches_played,
      } : null,
      bestStrikeRate: bestStrikeRate ? {
        id: bestStrikeRate.player?.id,
        name: bestStrikeRate.player?.name || 'Unknown',
        strikeRate: bestStrikeRate.strike_rate,
        runs: bestStrikeRate.total_runs,
        balls: bestStrikeRate.total_balls,
      } : null,
      topWicketTaker: topWicketTaker ? {
        id: topWicketTaker.player?.id,
        name: topWicketTaker.player?.name || 'Unknown',
        wickets: topWicketTaker.total_wickets,
        average: topWicketTaker.average,
        economy: topWicketTaker.economy,
      } : null,
      bestBowlingAverage: bestBowlingAverage ? {
        id: bestBowlingAverage.player?.id,
        name: bestBowlingAverage.player?.name || 'Unknown',
        average: bestBowlingAverage.average,
        wickets: bestBowlingAverage.total_wickets,
        matches: bestBowlingAverage.matches_bowled,
      } : null,
      bestEconomy: bestEconomy ? {
        id: bestEconomy.player?.id,
        name: bestEconomy.player?.name || 'Unknown',
        economy: bestEconomy.economy,
        overs: bestEconomy.total_overs,
        wickets: bestEconomy.total_wickets,
      } : null,
      topFielder: topFielder ? {
        id: topFielder.player?.id,
        name: topFielder.player?.name || 'Unknown',
        dismissals: topFielder.total_dismissals,
        catches: topFielder.total_catches,
        runOuts: topFielder.total_run_outs,
        matches: topFielder.matches_played,
      } : null,
    }

    return NextResponse.json({
      success: true,
      stats,
      topPerformers,
      recentMatches: (matches || []).slice(0, 5),
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

function getEmptyStats() {
  return {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    winPercentage: 0,
    totalRuns: 0,
    totalWickets: 0,
    totalCatches: 0,
    totalBoundaries: 0,
    totalFours: 0,
    totalSixes: 0,
    avgTeamScore: 0,
    totalPlayers: 0,
  }
}

function getEmptyPerformers() {
  return {
    topRunScorer: null,
    bestAverage: null,
    bestStrikeRate: null,
    topWicketTaker: null,
    bestBowlingAverage: null,
    bestEconomy: null,
    topFielder: null,
  }
}

function calculateStatsFromPerformances(
  matches: any[],
  battingPerfs: any[],
  bowlingPerfs: any[],
  fieldingPerfs: any[]
) {
  const totalMatches = matches.length
  const wins = matches.filter(m => m.result === 'win').length
  const losses = matches.filter(m => m.result === 'loss').length
  const ties = matches.filter(m => m.result === 'tie').length

  const totalRuns = battingPerfs.reduce((sum, p) => sum + p.runs, 0)
  const totalWickets = bowlingPerfs.reduce((sum, p) => sum + p.wickets, 0)
  const totalCatches = fieldingPerfs.reduce((sum, p) => sum + p.catches, 0)
  const totalFours = battingPerfs.reduce((sum, p) => sum + p.fours, 0)
  const totalSixes = battingPerfs.reduce((sum, p) => sum + p.sixes, 0)
  const playerIds = new Set(battingPerfs.map(p => p.player_id))

  return {
    totalMatches,
    wins,
    losses,
    ties,
    winPercentage: totalMatches > 0 ? (wins / totalMatches) * 100 : 0,
    totalRuns,
    totalWickets,
    totalCatches,
    totalBoundaries: totalFours + totalSixes,
    totalFours,
    totalSixes,
    avgTeamScore: totalMatches > 0 ? totalRuns / totalMatches : 0,
    totalPlayers: playerIds.size,
  }
}

function calculateTopPerformers(
  battingPerfs: any[],
  bowlingPerfs: any[],
  fieldingPerfs: any[]
) {
  const isUnclaimed = (name?: string) => name?.toLowerCase().startsWith('unclaimed') || false

  // Aggregate batting by player
  const battingByPlayer = new Map<string, any>()
  for (const perf of battingPerfs) {
    if (isUnclaimed(perf.player?.name)) continue
    const pid = perf.player_id
    if (!battingByPlayer.has(pid)) {
      battingByPlayer.set(pid, {
        id: pid,
        name: perf.player?.name || 'Unknown',
        runs: 0,
        balls: 0,
        matches: new Set(),
        dismissals: 0,
      })
    }
    const agg = battingByPlayer.get(pid)!
    agg.runs += perf.runs
    agg.balls += perf.balls
    agg.matches.add(perf.match_id)
    if (!perf.not_out) agg.dismissals++
  }

  const battingAgg = Array.from(battingByPlayer.values()).map(p => ({
    ...p,
    matches: p.matches.size,
    average: p.dismissals > 0 ? p.runs / p.dismissals : p.runs,
    strikeRate: p.balls > 0 ? (p.runs / p.balls) * 100 : 0,
  }))

  // Aggregate bowling by player
  const bowlingByPlayer = new Map<string, any>()
  for (const perf of bowlingPerfs) {
    if (isUnclaimed(perf.player?.name)) continue
    const pid = perf.player_id
    if (!bowlingByPlayer.has(pid)) {
      bowlingByPlayer.set(pid, {
        id: pid,
        name: perf.player?.name || 'Unknown',
        overs: 0,
        runs: 0,
        wickets: 0,
        matches: new Set(),
      })
    }
    const agg = bowlingByPlayer.get(pid)!
    agg.overs += perf.overs
    agg.runs += perf.runs_conceded
    agg.wickets += perf.wickets
    agg.matches.add(perf.match_id)
  }

  const bowlingAgg = Array.from(bowlingByPlayer.values()).map(p => ({
    ...p,
    matches: p.matches.size,
    average: p.wickets > 0 ? p.runs / p.wickets : 0,
    economy: p.overs > 0 ? p.runs / p.overs : 0,
  }))

  // Aggregate fielding by player
  const fieldingByPlayer = new Map<string, any>()
  for (const perf of fieldingPerfs) {
    if (isUnclaimed(perf.player?.name)) continue
    const pid = perf.player_id
    if (!fieldingByPlayer.has(pid)) {
      fieldingByPlayer.set(pid, {
        id: pid,
        name: perf.player?.name || 'Unknown',
        catches: 0,
        runOuts: 0,
        matches: new Set(),
      })
    }
    const agg = fieldingByPlayer.get(pid)!
    agg.catches += perf.catches
    agg.runOuts += perf.run_outs
    agg.matches.add(perf.match_id)
  }

  const fieldingAgg = Array.from(fieldingByPlayer.values()).map(p => ({
    ...p,
    matches: p.matches.size,
    dismissals: p.catches + p.runOuts,
  }))

  const topRunScorer = [...battingAgg].sort((a, b) => b.runs - a.runs)[0]
  const bestAverage = battingAgg.filter(p => p.dismissals > 0).sort((a, b) => b.average - a.average)[0]
  const bestStrikeRate = battingAgg.filter(p => p.balls >= 10).sort((a, b) => b.strikeRate - a.strikeRate)[0]
  const topWicketTaker = [...bowlingAgg].sort((a, b) => b.wickets - a.wickets)[0]
  const bestBowlingAverage = bowlingAgg.filter(p => p.wickets >= 1).sort((a, b) => a.average - b.average)[0]
  const bestEconomy = bowlingAgg.filter(p => p.overs >= 2).sort((a, b) => a.economy - b.economy)[0]
  const topFielder = [...fieldingAgg].sort((a, b) => b.dismissals - a.dismissals)[0]

  return {
    topRunScorer: topRunScorer ? {
      id: topRunScorer.id,
      name: topRunScorer.name,
      runs: topRunScorer.runs,
      average: topRunScorer.average,
      strikeRate: topRunScorer.strikeRate,
    } : null,
    bestAverage: bestAverage ? {
      id: bestAverage.id,
      name: bestAverage.name,
      average: bestAverage.average,
      runs: bestAverage.runs,
      matches: bestAverage.matches,
    } : null,
    bestStrikeRate: bestStrikeRate ? {
      id: bestStrikeRate.id,
      name: bestStrikeRate.name,
      strikeRate: bestStrikeRate.strikeRate,
      runs: bestStrikeRate.runs,
      balls: bestStrikeRate.balls,
    } : null,
    topWicketTaker: topWicketTaker ? {
      id: topWicketTaker.id,
      name: topWicketTaker.name,
      wickets: topWicketTaker.wickets,
      average: topWicketTaker.average,
      economy: topWicketTaker.economy,
    } : null,
    bestBowlingAverage: bestBowlingAverage ? {
      id: bestBowlingAverage.id,
      name: bestBowlingAverage.name,
      average: bestBowlingAverage.average,
      wickets: bestBowlingAverage.wickets,
      matches: bestBowlingAverage.matches,
    } : null,
    bestEconomy: bestEconomy ? {
      id: bestEconomy.id,
      name: bestEconomy.name,
      economy: bestEconomy.economy,
      overs: bestEconomy.overs,
      wickets: bestEconomy.wickets,
    } : null,
    topFielder: topFielder ? {
      id: topFielder.id,
      name: topFielder.name,
      dismissals: topFielder.dismissals,
      catches: topFielder.catches,
      runOuts: topFielder.runOuts,
      matches: topFielder.matches,
    } : null,
  }
}

