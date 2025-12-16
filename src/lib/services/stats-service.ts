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
 * Helper to check if a player is an "Unclaimed" placeholder
 */
function isUnclaimedPlayer(playerName?: string): boolean {
  if (!playerName) return false
  return playerName.startsWith('Unclaimed')
}

/**
 * Get batting season stats with player info
 * Excludes "Unclaimed" players from the leaderboard
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
  
  // Filter out Unclaimed players
  const filtered = (data || []).filter(stat => !isUnclaimedPlayer(stat.player?.name))
  return filtered
}

/**
 * Get bowling season stats with player info
 * Excludes "Unclaimed" players from the leaderboard
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
  
  // Filter out Unclaimed players
  const filtered = (data || []).filter(stat => !isUnclaimedPlayer(stat.player?.name))
  return filtered
}

/**
 * Get fielding season stats with player info
 * Excludes "Unclaimed" players from the leaderboard
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
  
  // Filter out Unclaimed players
  const filtered = (data || []).filter(stat => !isUnclaimedPlayer(stat.player?.name))
  return filtered
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
  
  // Top run scorer (fetch multiple to filter out Unclaimed)
  const { data: topRunScorerList } = await supabase
    .from('player_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .order('total_runs', { ascending: false })
    .limit(10)
  const topRunScorer = (topRunScorerList || []).find(s => !isUnclaimedPlayer(s.player?.name))
  
  // Best average (min 1 innings with at least 1 dismissal)
  const { data: bestAverageList } = await supabase
    .from('player_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gte('matches_played', 1)
    .gt('dismissals', 0)
    .order('average', { ascending: false })
    .limit(10)
  const bestAverage = (bestAverageList || []).find(s => !isUnclaimedPlayer(s.player?.name))
  
  // Best strike rate (min 10 balls)
  const { data: bestStrikeRateList } = await supabase
    .from('player_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gte('total_balls', 10)
    .order('strike_rate', { ascending: false })
    .limit(10)
  const bestStrikeRate = (bestStrikeRateList || []).find(s => !isUnclaimedPlayer(s.player?.name))
  
  // Top wicket taker
  const { data: topWicketTakerList } = await supabase
    .from('bowling_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gt('total_wickets', 0)
    .order('total_wickets', { ascending: false })
    .limit(10)
  const topWicketTaker = (topWicketTakerList || []).find(s => !isUnclaimedPlayer(s.player?.name))
  
  // Best bowling average (min 1 match, at least 1 wicket)
  const { data: bestBowlingAverageList } = await supabase
    .from('bowling_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gte('matches_bowled', 1)
    .gt('total_wickets', 0)
    .order('average', { ascending: true }) // Lower is better for bowling
    .limit(10)
  const bestBowlingAverage = (bestBowlingAverageList || []).find(s => !isUnclaimedPlayer(s.player?.name))
  
  // Best economy (min 2 overs)
  const { data: bestEconomyList } = await supabase
    .from('bowling_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gte('total_overs', 2)
    .order('economy', { ascending: true }) // Lower is better
    .limit(10)
  const bestEconomy = (bestEconomyList || []).find(s => !isUnclaimedPlayer(s.player?.name))
  
  // Top fielder
  const { data: topFielderList } = await supabase
    .from('fielding_season_stats')
    .select(`
      *,
      player:players(name)
    `)
    .eq('season_id', seasonId)
    .gt('total_dismissals', 0)
    .order('total_dismissals', { ascending: false })
    .limit(10)
  const topFielder = (topFielderList || []).find(s => !isUnclaimedPlayer(s.player?.name))
  
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

// ============================================
// DISMISSAL ANALYSIS FUNCTIONS
// ============================================

export type DismissalType = 'caught' | 'bowled' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket' | 'other'

export interface DismissalBreakdown {
  type: DismissalType
  count: number
  percentage: number
  label: string
  emoji: string
}

/**
 * Categorize dismissal text into a type
 */
export function categorizeDismisal(dismissalText: string | null): DismissalType | null {
  if (!dismissalText) return null
  
  const text = dismissalText.toLowerCase().trim()
  
  // Not out - not a dismissal
  if (text === 'not out' || text === 'dnb' || text === 'did not bat') {
    return null
  }
  
  // Check for specific dismissal types
  if (text.startsWith('c ') || text.startsWith('c&b') || text.includes('c & b') || text.match(/^c\s+/)) {
    return 'caught'
  }
  if (text === 'bowled' || text.startsWith('b ')) {
    return 'bowled'
  }
  if (text === 'lbw' || text.startsWith('lbw ')) {
    return 'lbw'
  }
  if (text.includes('run out') || text.includes('runout')) {
    return 'run_out'
  }
  if (text.startsWith('st ') || text.includes('stumped')) {
    return 'stumped'
  }
  if (text.includes('hit wicket')) {
    return 'hit_wicket'
  }
  
  return 'other'
}

/**
 * Get display properties for dismissal type
 */
function getDismissalDisplay(type: DismissalType): { label: string; emoji: string } {
  switch (type) {
    case 'caught':
      return { label: 'Caught', emoji: '🧤' }
    case 'bowled':
      return { label: 'Bowled', emoji: '📍' }
    case 'lbw':
      return { label: 'LBW', emoji: '🦵' }
    case 'run_out':
      return { label: 'Run Out', emoji: '🏃' }
    case 'stumped':
      return { label: 'Stumped', emoji: '🎯' }
    case 'hit_wicket':
      return { label: 'Hit Wicket', emoji: '💥' }
    default:
      return { label: 'Other', emoji: '❓' }
  }
}

/**
 * Get batting dismissal breakdown for a player
 */
export async function getBattingDismissalBreakdown(playerId: string): Promise<DismissalBreakdown[]> {
  const { data: performances, error } = await supabase
    .from('batting_performances')
    .select('dismissal_text, not_out')
    .eq('player_id', playerId)
  
  if (error || !performances) {
    console.error('Error fetching batting performances for dismissal breakdown:', error)
    return []
  }
  
  // Count dismissals by type
  const dismissalCounts: Record<DismissalType, number> = {
    caught: 0,
    bowled: 0,
    lbw: 0,
    run_out: 0,
    stumped: 0,
    hit_wicket: 0,
    other: 0,
  }
  
  let totalDismissals = 0
  
  for (const perf of performances) {
    if (perf.not_out) continue
    
    const type = categorizeDismisal(perf.dismissal_text)
    if (type) {
      dismissalCounts[type]++
      totalDismissals++
    }
  }
  
  // Convert to breakdown array
  const breakdown: DismissalBreakdown[] = []
  
  for (const [type, count] of Object.entries(dismissalCounts)) {
    if (count > 0) {
      const display = getDismissalDisplay(type as DismissalType)
      breakdown.push({
        type: type as DismissalType,
        count,
        percentage: totalDismissals > 0 ? (count / totalDismissals) * 100 : 0,
        ...display,
      })
    }
  }
  
  // Sort by count descending
  return breakdown.sort((a, b) => b.count - a.count)
}

/**
 * Extract bowler name from dismissal text
 */
function extractBowlerFromDismissal(dismissalText: string): string | null {
  if (!dismissalText) return null
  
  const text = dismissalText.toLowerCase().trim()
  
  // Patterns: "c X b Y", "b Y", "lbw b Y", "st X b Y", "c&b Y"
  // The bowler is after "b " in most cases
  
  // c & b pattern - bowler is same as catcher
  if (text.includes('c&b') || text.includes('c & b')) {
    const match = text.match(/c\s*&\s*b\s+(.+)/i)
    return match ? match[1].trim() : null
  }
  
  // Standard "b BowlerName" pattern
  const bMatch = text.match(/\bb\s+([a-z][a-z\s]+?)$/i)
  if (bMatch) {
    return bMatch[1].trim()
  }
  
  // Just "bowled" or "lbw" without name
  if (text === 'bowled' || text === 'lbw') {
    return null
  }
  
  return null
}

/**
 * Get bowling wicket breakdown for a player
 * This analyzes HOW the bowler takes their wickets
 */
export async function getBowlingWicketBreakdown(playerId: string): Promise<DismissalBreakdown[]> {
  // First get the player's name and aliases
  const { data: player } = await supabase
    .from('players')
    .select('name')
    .eq('id', playerId)
    .single()
  
  const { data: aliases } = await supabase
    .from('player_aliases')
    .select('alias')
    .eq('player_id', playerId)
  
  if (!player) return []
  
  const playerNames = [player.name.toLowerCase()]
  if (aliases) {
    playerNames.push(...aliases.map(a => a.alias.toLowerCase()))
  }
  
  // Get all batting performances from matches where this player bowled
  const { data: bowlingMatches } = await supabase
    .from('bowling_performances')
    .select('match_id')
    .eq('player_id', playerId)
  
  if (!bowlingMatches || bowlingMatches.length === 0) return []
  
  const matchIds = bowlingMatches.map(m => m.match_id)
  
  // Get all batting performances from those matches where the batter was dismissed
  const { data: battingPerformances, error } = await supabase
    .from('batting_performances')
    .select('dismissal_text, not_out')
    .in('match_id', matchIds)
    .eq('not_out', false)
  
  if (error || !battingPerformances) {
    console.error('Error fetching batting performances for wicket breakdown:', error)
    return []
  }
  
  // Count wickets by type for this bowler
  const wicketCounts: Record<DismissalType, number> = {
    caught: 0,
    bowled: 0,
    lbw: 0,
    run_out: 0,
    stumped: 0,
    hit_wicket: 0,
    other: 0,
  }
  
  let totalWickets = 0
  
  for (const perf of battingPerformances) {
    if (!perf.dismissal_text) continue
    
    const bowlerName = extractBowlerFromDismissal(perf.dismissal_text)
    if (!bowlerName) continue
    
    // Check if this bowler matches our player
    const bowlerLower = bowlerName.toLowerCase()
    const isSameBowler = playerNames.some(name => 
      bowlerLower.includes(name) || name.includes(bowlerLower) ||
      // Check partial name match (at least 3 chars)
      (bowlerLower.length >= 3 && name.includes(bowlerLower)) ||
      (name.length >= 3 && bowlerLower.includes(name))
    )
    
    if (isSameBowler) {
      const type = categorizeDismisal(perf.dismissal_text)
      if (type && type !== 'run_out') { // Run outs don't count as bowler's wicket
        wicketCounts[type]++
        totalWickets++
      }
    }
  }
  
  // Convert to breakdown array
  const breakdown: DismissalBreakdown[] = []
  
  for (const [type, count] of Object.entries(wicketCounts)) {
    if (count > 0) {
      const display = getDismissalDisplay(type as DismissalType)
      breakdown.push({
        type: type as DismissalType,
        count,
        percentage: totalWickets > 0 ? (count / totalWickets) * 100 : 0,
        ...display,
      })
    }
  }
  
  // Sort by count descending
  return breakdown.sort((a, b) => b.count - a.count)
}

/**
 * Get most common dismissal type for a batter (for leaderboards)
 */
export async function getMostCommonDismissal(playerId: string): Promise<{ type: DismissalType; percentage: number } | null> {
  const breakdown = await getBattingDismissalBreakdown(playerId)
  if (breakdown.length === 0) return null
  return { type: breakdown[0].type, percentage: breakdown[0].percentage }
}

/**
 * Get most common wicket type for a bowler (for leaderboards)
 */
export async function getMostCommonWicketType(playerId: string): Promise<{ type: DismissalType; percentage: number } | null> {
  const breakdown = await getBowlingWicketBreakdown(playerId)
  if (breakdown.length === 0) return null
  return { type: breakdown[0].type, percentage: breakdown[0].percentage }
}

/**
 * Get batting dismissal stats for all players (batch query for leaderboard)
 */
export async function getBattingDismissalStatsForLeaderboard(): Promise<Map<string, { type: DismissalType; percentage: number; label: string }>> {
  // Get all batting performances with dismissals
  const { data: performances, error } = await supabase
    .from('batting_performances')
    .select('player_id, dismissal_text, not_out')
    .eq('not_out', false)
  
  if (error || !performances) {
    console.error('Error fetching dismissal stats:', error)
    return new Map()
  }
  
  // Group by player and count dismissal types
  const playerDismissals: Map<string, Record<DismissalType, number>> = new Map()
  
  for (const perf of performances) {
    const type = categorizeDismisal(perf.dismissal_text)
    if (!type) continue
    
    if (!playerDismissals.has(perf.player_id)) {
      playerDismissals.set(perf.player_id, {
        caught: 0, bowled: 0, lbw: 0, run_out: 0, stumped: 0, hit_wicket: 0, other: 0
      })
    }
    
    playerDismissals.get(perf.player_id)![type]++
  }
  
  // Find most common dismissal for each player
  const result: Map<string, { type: DismissalType; percentage: number; label: string }> = new Map()
  
  for (const [playerId, counts] of playerDismissals) {
    let maxType: DismissalType = 'caught'
    let maxCount = 0
    let total = 0
    
    for (const [type, count] of Object.entries(counts)) {
      total += count
      if (count > maxCount) {
        maxCount = count
        maxType = type as DismissalType
      }
    }
    
    if (maxCount > 0) {
      const display = getDismissalDisplay(maxType)
      result.set(playerId, {
        type: maxType,
        percentage: (maxCount / total) * 100,
        label: display.label,
      })
    }
  }
  
  return result
}

/**
 * Get bowling wicket type stats for all players (batch query for leaderboard)
 * This analyzes HOW bowlers take their wickets by matching names in dismissal texts
 */
export async function getBowlingWicketStatsForLeaderboard(): Promise<Map<string, { type: DismissalType; percentage: number; label: string }>> {
  // Get all players with their names and aliases
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name')
  
  const { data: aliases, error: aliasesError } = await supabase
    .from('player_aliases')
    .select('player_id, alias')
  
  // Get all batting performances with dismissals (excluding not outs and run outs)
  const { data: battingPerfs, error: battingError } = await supabase
    .from('batting_performances')
    .select('dismissal_text')
    .eq('not_out', false)
  
  if (playersError || battingError || !players || !battingPerfs) {
    console.error('Error fetching data for bowling wicket stats')
    return new Map()
  }
  
  // Build a map of player names/aliases to player IDs
  const nameToPlayerId: Map<string, string> = new Map()
  
  for (const player of players) {
    const nameLower = player.name.toLowerCase()
    nameToPlayerId.set(nameLower, player.id)
    
    // Also add partial names (split by space)
    const nameParts = nameLower.split(' ')
    if (nameParts.length > 1) {
      // Add first name if it's unique enough (3+ chars)
      for (const part of nameParts) {
        if (part.length >= 3) {
          // Don't overwrite if already exists (to avoid conflicts)
          if (!nameToPlayerId.has(part)) {
            nameToPlayerId.set(part, player.id)
          }
        }
      }
    }
  }
  
  // Add aliases
  if (aliases) {
    for (const alias of aliases) {
      nameToPlayerId.set(alias.alias.toLowerCase(), alias.player_id)
    }
  }
  
  // Count wickets by type for each bowler
  const bowlerWickets: Map<string, Record<DismissalType, number>> = new Map()
  
  for (const perf of battingPerfs) {
    if (!perf.dismissal_text) continue
    
    const dismissalType = categorizeDismisal(perf.dismissal_text)
    if (!dismissalType || dismissalType === 'run_out') continue // Run outs don't count for bowlers
    
    const bowlerName = extractBowlerFromDismissal(perf.dismissal_text)
    if (!bowlerName) continue
    
    const bowlerLower = bowlerName.toLowerCase().trim()
    
    // Try to match the bowler name to a player
    let matchedPlayerId: string | undefined
    
    // Try exact match first
    matchedPlayerId = nameToPlayerId.get(bowlerLower)
    
    // Try partial match if no exact match
    if (!matchedPlayerId) {
      for (const [name, playerId] of nameToPlayerId) {
        if (bowlerLower.includes(name) || name.includes(bowlerLower)) {
          matchedPlayerId = playerId
          break
        }
      }
    }
    
    if (matchedPlayerId) {
      if (!bowlerWickets.has(matchedPlayerId)) {
        bowlerWickets.set(matchedPlayerId, {
          caught: 0, bowled: 0, lbw: 0, run_out: 0, stumped: 0, hit_wicket: 0, other: 0
        })
      }
      bowlerWickets.get(matchedPlayerId)![dismissalType]++
    }
  }
  
  // Find most common wicket type for each bowler
  const result: Map<string, { type: DismissalType; percentage: number; label: string }> = new Map()
  
  for (const [playerId, counts] of bowlerWickets) {
    let maxType: DismissalType = 'caught'
    let maxCount = 0
    let total = 0
    
    for (const [type, count] of Object.entries(counts)) {
      total += count
      if (count > maxCount) {
        maxCount = count
        maxType = type as DismissalType
      }
    }
    
    if (maxCount > 0) {
      const display = getDismissalDisplay(maxType)
      result.set(playerId, {
        type: maxType,
        percentage: (maxCount / total) * 100,
        label: display.label,
      })
    }
  }
  
  return result
}

