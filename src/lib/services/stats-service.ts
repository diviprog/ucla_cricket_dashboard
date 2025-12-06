import { supabase } from '@/lib/supabase/client'
import type { 
  CalculatedBattingStats, 
  CalculatedBowlingStats, 
  CalculatedFieldingStats,
  BattingPerformance,
  BowlingPerformance,
  FieldingPerformance,
} from '@/types/models'

/**
 * Calculate stats from an array of batting performances
 */
export function calculateBattingStats(performances: BattingPerformance[]): CalculatedBattingStats {
  const matchesPlayed = new Set(performances.map(p => p.match_id)).size
  const totalRuns = performances.reduce((sum, p) => sum + p.runs, 0)
  const totalBalls = performances.reduce((sum, p) => sum + p.balls, 0)
  const fours = performances.reduce((sum, p) => sum + p.fours, 0)
  const sixes = performances.reduce((sum, p) => sum + p.sixes, 0)
  const notOuts = performances.filter(p => p.not_out).length
  const dismissals = performances.length - notOuts
  const bowledLbw = performances.filter(p => p.bowled_lbw && !p.not_out).length
  
  // Average = Total Runs / Dismissals
  const average = dismissals > 0 ? totalRuns / dismissals : 0
  
  // Strike Rate = (Runs / Balls) × 100
  const strikeRate = totalBalls > 0 ? (totalRuns / totalBalls) * 100 : 0
  
  // Boundary Rate = Balls per Boundary
  const totalBoundaries = fours + sixes
  const boundaryRate = totalBoundaries > 0 ? totalBalls / totalBoundaries : Infinity
  
  // Boundary Percentage = (Boundaries / Total Balls) × 100
  const boundaryPercentage = totalBalls > 0 ? (totalBoundaries / totalBalls) * 100 : 0
  
  // Bowled/LBW Percentage = (Bowled+LBW Dismissals / Total Dismissals) × 100
  const bowledLbwPercentage = dismissals > 0 ? (bowledLbw / dismissals) * 100 : 0
  
  return {
    matchesPlayed,
    totalRuns,
    totalBalls,
    dismissals,
    notOuts,
    fours,
    sixes,
    bowledLbw,
    average,
    strikeRate,
    boundaryRate: boundaryRate === Infinity ? 0 : boundaryRate,
    boundaryPercentage,
    bowledLbwPercentage,
  }
}

/**
 * Calculate stats from an array of bowling performances
 */
export function calculateBowlingStats(performances: BowlingPerformance[]): CalculatedBowlingStats {
  const matchesBowled = new Set(performances.map(p => p.match_id)).size
  const totalOvers = performances.reduce((sum, p) => sum + p.overs, 0)
  const totalBalls = performances.reduce((sum, p) => sum + p.balls, 0)
  const totalRuns = performances.reduce((sum, p) => sum + p.runs_conceded, 0)
  const totalWickets = performances.reduce((sum, p) => sum + p.wickets, 0)
  const totalMaidens = performances.reduce((sum, p) => sum + p.maidens, 0)
  const totalDots = performances.reduce((sum, p) => sum + p.dots, 0)
  const totalWides = performances.reduce((sum, p) => sum + p.wides, 0)
  const totalNoBalls = performances.reduce((sum, p) => sum + p.no_balls, 0)
  
  // Average = Runs / Wickets (runs per wicket)
  const average = totalWickets > 0 ? totalRuns / totalWickets : 0
  
  // Strike Rate = Balls / Wickets (balls per wicket)
  const strikeRate = totalWickets > 0 ? totalBalls / totalWickets : 0
  
  // Economy = Runs / Overs (runs per over)
  const economy = totalOvers > 0 ? totalRuns / totalOvers : 0
  
  // Dot Percentage = (Dots / Balls) × 100
  const dotPercentage = totalBalls > 0 ? (totalDots / totalBalls) * 100 : 0
  
  return {
    matchesBowled,
    totalOvers,
    totalBalls,
    totalRuns,
    totalWickets,
    totalMaidens,
    totalDots,
    totalWides,
    totalNoBalls,
    average,
    strikeRate,
    economy,
    dotPercentage,
  }
}

/**
 * Calculate stats from an array of fielding performances
 */
export function calculateFieldingStats(performances: FieldingPerformance[]): CalculatedFieldingStats {
  const matchesPlayed = new Set(performances.map(p => p.match_id)).size
  const totalCatches = performances.reduce((sum, p) => sum + p.catches, 0)
  const totalRunOuts = performances.reduce((sum, p) => sum + p.run_outs, 0)
  const totalStumpings = performances.reduce((sum, p) => sum + p.stumpings, 0)
  const totalDismissals = totalCatches + totalRunOuts + totalStumpings
  
  // Dismissals per match
  const dismissalsPerMatch = matchesPlayed > 0 ? totalDismissals / matchesPlayed : 0
  
  return {
    matchesPlayed,
    totalCatches,
    totalRunOuts,
    totalStumpings,
    totalDismissals,
    dismissalsPerMatch,
  }
}

/**
 * Update cached batting season stats for a player
 */
export async function updatePlayerSeasonStats(
  playerId: string,
  seasonId: string
): Promise<void> {
  // Get all performances for this player in this season
  const { data: performances, error } = await supabase
    .from('batting_performances')
    .select(`
      *,
      matches!inner(season_id)
    `)
    .eq('player_id', playerId)
    .eq('matches.season_id', seasonId)
  
  if (error) {
    console.error('Error fetching batting performances:', error)
    return
  }
  
  const stats = calculateBattingStats(performances || [])
  
  // Upsert the stats
  const { error: upsertError } = await supabase
    .from('player_season_stats')
    .upsert({
      player_id: playerId,
      season_id: seasonId,
      matches_played: stats.matchesPlayed,
      total_runs: stats.totalRuns,
      total_balls: stats.totalBalls,
      dismissals: stats.dismissals,
      not_outs: stats.notOuts,
      fours: stats.fours,
      sixes: stats.sixes,
      bowled_lbw: stats.bowledLbw,
      average: stats.average,
      strike_rate: stats.strikeRate,
      boundary_rate: stats.boundaryRate,
      boundary_percentage: stats.boundaryPercentage,
      bowled_lbw_percentage: stats.bowledLbwPercentage,
    }, {
      onConflict: 'player_id,season_id',
    })
  
  if (upsertError) {
    console.error('Error upserting batting stats:', upsertError)
  }
}

/**
 * Update cached bowling season stats for a player
 */
export async function updateBowlingSeasonStats(
  playerId: string,
  seasonId: string
): Promise<void> {
  // Get all bowling performances for this player in this season
  const { data: performances, error } = await supabase
    .from('bowling_performances')
    .select(`
      *,
      matches!inner(season_id)
    `)
    .eq('player_id', playerId)
    .eq('matches.season_id', seasonId)
  
  if (error) {
    console.error('Error fetching bowling performances:', error)
    return
  }
  
  const stats = calculateBowlingStats(performances || [])
  
  // Upsert the stats
  const { error: upsertError } = await supabase
    .from('bowling_season_stats')
    .upsert({
      player_id: playerId,
      season_id: seasonId,
      matches_bowled: stats.matchesBowled,
      total_overs: stats.totalOvers,
      total_balls: stats.totalBalls,
      total_runs: stats.totalRuns,
      total_wickets: stats.totalWickets,
      total_maidens: stats.totalMaidens,
      total_dots: stats.totalDots,
      total_wides: stats.totalWides,
      total_no_balls: stats.totalNoBalls,
      average: stats.average,
      strike_rate: stats.strikeRate,
      economy: stats.economy,
      dot_percentage: stats.dotPercentage,
    }, {
      onConflict: 'player_id,season_id',
    })
  
  if (upsertError) {
    console.error('Error upserting bowling stats:', upsertError)
  }
}

/**
 * Update cached fielding season stats for a player
 */
export async function updateFieldingSeasonStats(
  playerId: string,
  seasonId: string
): Promise<void> {
  // Get all fielding performances for this player in this season
  const { data: performances, error } = await supabase
    .from('fielding_performances')
    .select(`
      *,
      matches!inner(season_id)
    `)
    .eq('player_id', playerId)
    .eq('matches.season_id', seasonId)
  
  if (error) {
    console.error('Error fetching fielding performances:', error)
    return
  }
  
  const stats = calculateFieldingStats(performances || [])
  
  // Upsert the stats
  const { error: upsertError } = await supabase
    .from('fielding_season_stats')
    .upsert({
      player_id: playerId,
      season_id: seasonId,
      matches_played: stats.matchesPlayed,
      total_catches: stats.totalCatches,
      total_run_outs: stats.totalRunOuts,
      total_stumpings: stats.totalStumpings,
      total_dismissals: stats.totalDismissals,
      dismissals_per_match: stats.dismissalsPerMatch,
    }, {
      onConflict: 'player_id,season_id',
    })
  
  if (upsertError) {
    console.error('Error upserting fielding stats:', upsertError)
  }
}

/**
 * Recalculate all season stats (use after match import)
 */
export async function recalculateAllSeasonStats(seasonId: string): Promise<void> {
  // Get all players who have performances in this season
  const { data: performances } = await supabase
    .from('batting_performances')
    .select(`
      player_id,
      matches!inner(season_id)
    `)
    .eq('matches.season_id', seasonId)
  
  if (!performances) return
  
  const playerIds = Array.from(new Set(performances.map(p => p.player_id)))
  
  for (const playerId of playerIds) {
    await updatePlayerSeasonStats(playerId, seasonId)
  }
}

/**
 * Get batting season stats with player info
 */
export async function getSeasonLeaderboard(seasonId?: string) {
  let query = supabase
    .from('player_season_stats')
    .select(`
      *,
      player:players(*),
      season:seasons(*)
    `)
    .gt('total_runs', 0)
    .order('total_runs', { ascending: false })
  
  if (seasonId) {
    query = query.eq('season_id', seasonId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching batting leaderboard:', error)
    return []
  }
  
  return data || []
}

/**
 * Get bowling season stats with player info
 */
export async function getBowlingLeaderboard(seasonId?: string) {
  let query = supabase
    .from('bowling_season_stats')
    .select(`
      *,
      player:players(*),
      season:seasons(*)
    `)
    .gt('total_wickets', 0)
    .order('total_wickets', { ascending: false })
  
  if (seasonId) {
    query = query.eq('season_id', seasonId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching bowling leaderboard:', error)
    return []
  }
  
  return data || []
}

/**
 * Get fielding season stats with player info
 */
export async function getFieldingLeaderboard(seasonId?: string) {
  let query = supabase
    .from('fielding_season_stats')
    .select(`
      *,
      player:players(*),
      season:seasons(*)
    `)
    .gt('total_dismissals', 0)
    .order('total_dismissals', { ascending: false })
  
  if (seasonId) {
    query = query.eq('season_id', seasonId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching fielding leaderboard:', error)
    return []
  }
  
  return data || []
}

/**
 * Get overall season statistics
 */
export async function getSeasonStats(seasonId?: string) {
  // Get current season if not specified
  if (!seasonId) {
    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .order('start_date', { ascending: false })
      .limit(1)
      .single()
    
    seasonId = season?.id
  }
  
  // Get all batting stats for the season
  const { data: battingStats } = await supabase
    .from('player_season_stats')
    .select('*')
    .eq('season_id', seasonId)
  
  // Get all bowling stats for the season
  const { data: bowlingStats } = await supabase
    .from('bowling_season_stats')
    .select('*')
    .eq('season_id', seasonId)
  
  // Get all fielding stats for the season
  const { data: fieldingStats } = await supabase
    .from('fielding_season_stats')
    .select('*')
    .eq('season_id', seasonId)
  
  // Get matches with results
  const { data: matches } = await supabase
    .from('matches')
    .select('id, result')
    .eq('season_id', seasonId)
  
  const totalMatches = matches?.length || 0
  const wins = matches?.filter(m => m.result === 'win').length || 0
  const losses = matches?.filter(m => m.result === 'loss').length || 0
  const ties = matches?.filter(m => m.result === 'tie').length || 0
  const noResults = matches?.filter(m => !m.result || m.result === 'no_result').length || 0
  
  const totalRuns = battingStats?.reduce((sum, s) => sum + s.total_runs, 0) || 0
  const totalWickets = bowlingStats?.reduce((sum, s) => sum + s.total_wickets, 0) || 0
  const totalCatches = fieldingStats?.reduce((sum, s) => sum + s.total_catches, 0) || 0
  const totalRunOuts = fieldingStats?.reduce((sum, s) => sum + s.total_run_outs, 0) || 0
  const totalStumpings = fieldingStats?.reduce((sum, s) => sum + s.total_stumpings, 0) || 0
  const totalFours = battingStats?.reduce((sum, s) => sum + s.fours, 0) || 0
  const totalSixes = battingStats?.reduce((sum, s) => sum + s.sixes, 0) || 0
  const totalPlayers = battingStats?.filter(s => s.total_runs > 0).length || 0
  const avgTeamScore = totalMatches > 0 ? totalRuns / totalMatches : 0
  
  return {
    totalMatches,
    wins,
    losses,
    ties,
    noResults,
    winPercentage: totalMatches > 0 ? (wins / totalMatches) * 100 : 0,
    totalRuns,
    totalWickets,
    totalCatches,
    totalRunOuts,
    totalStumpings,
    totalFieldingDismissals: totalCatches + totalRunOuts + totalStumpings,
    totalFours,
    totalSixes,
    totalBoundaries: totalFours + totalSixes,
    totalPlayers,
    avgTeamScore,
  }
}

/**
 * Get top performers
 */
export async function getTopPerformers(seasonId?: string) {
  // Get current season if not specified
  if (!seasonId) {
    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .order('start_date', { ascending: false })
      .limit(1)
      .single()
    
    seasonId = season?.id
  }
  
  if (!seasonId) {
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
  
  // Top run scorer
  const { data: topRunScorer } = await supabase
    .from('player_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .order('total_runs', { ascending: false })
    .limit(1)
    .single()
  
  // Best average (min 1 innings with at least 1 dismissal)
  const { data: bestAverage } = await supabase
    .from('player_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gte('matches_played', 1)
    .gt('dismissals', 0)
    .order('average', { ascending: false })
    .limit(1)
    .single()
  
  // Best strike rate (min 10 balls)
  const { data: bestStrikeRate } = await supabase
    .from('player_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gte('total_balls', 10)
    .order('strike_rate', { ascending: false })
    .limit(1)
    .single()
  
  // Top wicket taker
  const { data: topWicketTaker } = await supabase
    .from('bowling_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gt('total_wickets', 0)
    .order('total_wickets', { ascending: false })
    .limit(1)
    .single()
  
  // Best bowling average (min 1 match, at least 1 wicket)
  const { data: bestBowlingAverage } = await supabase
    .from('bowling_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gte('matches_bowled', 1)
    .gt('total_wickets', 0)
    .order('average', { ascending: true }) // Lower is better for bowling
    .limit(1)
    .single()
  
  // Best economy (min 2 overs)
  const { data: bestEconomy } = await supabase
    .from('bowling_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gte('total_overs', 2)
    .order('economy', { ascending: true }) // Lower is better
    .limit(1)
    .single()
  
  // Top fielder
  const { data: topFielder } = await supabase
    .from('fielding_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gt('total_dismissals', 0)
    .order('total_dismissals', { ascending: false })
    .limit(1)
    .single()
  
  return {
    topRunScorer: topRunScorer ? {
      name: topRunScorer.player?.name || 'Unknown',
      runs: topRunScorer.total_runs,
      average: topRunScorer.average,
      strikeRate: topRunScorer.strike_rate,
      matches: topRunScorer.matches_played,
    } : null,
    bestAverage: bestAverage ? {
      name: bestAverage.player?.name || 'Unknown',
      average: bestAverage.average,
      runs: bestAverage.total_runs,
      matches: bestAverage.matches_played,
    } : null,
    bestStrikeRate: bestStrikeRate ? {
      name: bestStrikeRate.player?.name || 'Unknown',
      strikeRate: bestStrikeRate.strike_rate,
      runs: bestStrikeRate.total_runs,
      balls: bestStrikeRate.total_balls,
    } : null,
    topWicketTaker: topWicketTaker ? {
      name: topWicketTaker.player?.name || 'Unknown',
      wickets: topWicketTaker.total_wickets,
      average: topWicketTaker.average,
      economy: topWicketTaker.economy,
      matches: topWicketTaker.matches_bowled,
    } : null,
    bestBowlingAverage: bestBowlingAverage ? {
      name: bestBowlingAverage.player?.name || 'Unknown',
      average: bestBowlingAverage.average,
      wickets: bestBowlingAverage.total_wickets,
      matches: bestBowlingAverage.matches_bowled,
    } : null,
    bestEconomy: bestEconomy ? {
      name: bestEconomy.player?.name || 'Unknown',
      economy: bestEconomy.economy,
      overs: bestEconomy.total_overs,
      wickets: bestEconomy.total_wickets,
    } : null,
    topFielder: topFielder ? {
      name: topFielder.player?.name || 'Unknown',
      dismissals: topFielder.total_dismissals,
      catches: topFielder.total_catches,
      runOuts: topFielder.total_run_outs,
      matches: topFielder.matches_played,
    } : null,
  }
}

/**
 * Get player profile with all stats
 */
export async function getPlayerProfile(playerId: string) {
  // Get player info
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()
  
  if (!player) return null
  
  // Get all batting performances
  const { data: battingPerformances } = await supabase
    .from('batting_performances')
    .select(`
      *,
      match:matches(*)
    `)
    .eq('player_id', playerId)
    .order('match(date)', { ascending: false })
  
  // Get all bowling performances
  const { data: bowlingPerformances } = await supabase
    .from('bowling_performances')
    .select(`
      *,
      match:matches(*)
    `)
    .eq('player_id', playerId)
    .order('match(date)', { ascending: false })
  
  // Get all fielding performances
  const { data: fieldingPerformances } = await supabase
    .from('fielding_performances')
    .select(`
      *,
      match:matches(*)
    `)
    .eq('player_id', playerId)
    .order('match(date)', { ascending: false })
  
  // Get batting season stats
  const { data: battingSeasonStats } = await supabase
    .from('player_season_stats')
    .select(`
      *,
      season:seasons(*)
    `)
    .eq('player_id', playerId)
  
  // Get bowling season stats
  const { data: bowlingSeasonStats } = await supabase
    .from('bowling_season_stats')
    .select(`
      *,
      season:seasons(*)
    `)
    .eq('player_id', playerId)
  
  // Get fielding season stats
  const { data: fieldingSeasonStats } = await supabase
    .from('fielding_season_stats')
    .select(`
      *,
      season:seasons(*)
    `)
    .eq('player_id', playerId)
  
  // Get aliases
  const { data: aliases } = await supabase
    .from('player_aliases')
    .select('alias')
    .eq('player_id', playerId)
  
  return {
    ...player,
    battingPerformances: battingPerformances || [],
    bowlingPerformances: bowlingPerformances || [],
    fieldingPerformances: fieldingPerformances || [],
    battingSeasonStats: battingSeasonStats || [],
    bowlingSeasonStats: bowlingSeasonStats || [],
    fieldingSeasonStats: fieldingSeasonStats || [],
    aliases: aliases?.map(a => a.alias) || [],
  }
}

/**
 * Get recent matches for dashboard
 */
export async function getRecentMatches(limit: number = 5, seasonId?: string) {
  // Get current season if not specified
  if (!seasonId) {
    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .order('start_date', { ascending: false })
      .limit(1)
      .single()
    
    seasonId = season?.id
  }
  
  let query = supabase
    .from('matches')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)
  
  if (seasonId) {
    query = query.eq('season_id', seasonId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching recent matches:', error)
    return []
  }
  
  return data || []
}

/**
 * Get season selector options
 */
export async function getSeasons() {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .order('start_date', { ascending: false })
  
  if (error) {
    console.error('Error fetching seasons:', error)
    return []
  }
  
  return data || []
}

/**
 * Detect season from a date
 */
export function detectSeasonFromDate(date: Date | string): string {
  const d = new Date(date)
  const month = d.getMonth() + 1 // 1-12
  const year = d.getFullYear()
  
  // Season runs Sept-June
  // If month is Sept-Dec, it's the start of the season
  // If month is Jan-June, it's the end of the season
  if (month >= 9) {
    return `${year}-${year + 1}`
  } else {
    return `${year - 1}-${year}`
  }
}

/**
 * Get or create season by name
 */
export async function getOrCreateSeason(seasonName: string): Promise<string> {
  // Try to find existing season
  const { data: existing } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', seasonName)
    .single()
  
  if (existing) {
    return existing.id
  }
  
  // Create new season
  const [startYear, endYear] = seasonName.split('-').map(Number)
  
  const { data: newSeason, error } = await supabase
    .from('seasons')
    .insert({
      name: seasonName,
      start_date: `${startYear}-09-01`,
      end_date: `${endYear}-06-30`,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating season:', error)
    throw error
  }
  
  return newSeason.id
}

