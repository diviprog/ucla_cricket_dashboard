// Database Models

export interface Season {
  id: string
  name: string // "2024-2025"
  start_date: string
  end_date: string
  created_at: string
}

export interface Player {
  id: string
  name: string // Canonical name
  photo_url?: string
  contact_info?: Record<string, unknown>
  year?: string
  major?: string
  created_at: string
}

export interface PlayerAlias {
  id: string
  player_id: string
  alias: string // "Devansh M", "Naman S"
  created_at: string
}

export interface Match {
  id: string
  season_id: string
  date: string
  opponent: string
  venue?: string
  match_type: 'league' | 'playoff' | 'friendly' | 'tournament'
  competition_name?: string
  result: 'win' | 'loss' | 'tie' | 'no_result'
  our_team_name?: string // The team name UCLA played under
  our_score?: string
  opponent_score?: string
  our_extras_wides?: number
  our_extras_no_balls?: number
  our_extras_byes?: number
  our_extras_leg_byes?: number
  our_extras_total?: number
  home_away?: 'home' | 'away' | 'neutral'
  weather?: string
  pitch_type?: string
  importance?: number // 1-5 scale
  notes?: string
  raw_html_hash?: string
  created_at: string
}

export interface ImportHistory {
  id: string
  match_id: string
  filename: string
  content_hash: string
  imported_at: string
}

export interface BattingPerformance {
  id: string
  match_id: string
  player_id: string
  runs: number
  balls: number
  fours: number
  sixes: number
  not_out: boolean
  bowled_lbw: boolean
  dismissal_text?: string // "c Naman S b Tanmay D"
  batting_position: number
  created_at: string
}

export interface PlayerSeasonStats {
  id: string
  player_id: string
  season_id: string
  matches_played: number
  total_runs: number
  total_balls: number
  dismissals: number
  not_outs: number
  fours: number
  sixes: number
  bowled_lbw: number
  average: number
  strike_rate: number
  boundary_rate: number
  boundary_percentage: number
  bowled_lbw_percentage: number
  last_updated: string
}

// Match-specific player override for name swaps
export interface MatchPlayerOverride {
  id: string
  match_id: string
  displayed_name: string // Name shown in scorecard (e.g., "Devansh M")
  actual_player_id: string // The player who actually played
  notes?: string
  created_at: string
}

// Bowling performance
export interface BowlingPerformance {
  id: string
  match_id: string
  player_id: string
  overs: number // e.g., 4.0, 3.2
  balls: number // legal balls bowled
  maidens: number
  runs_conceded: number
  wickets: number
  dots: number
  wides: number
  no_balls: number
  economy: number
  created_at: string
}

// Bowling season stats
export interface BowlingSeasonStats {
  id: string
  player_id: string
  season_id: string
  matches_bowled: number
  total_overs: number
  total_balls: number
  total_runs: number
  total_wickets: number
  total_maidens: number
  total_dots: number
  total_wides: number
  total_no_balls: number
  average: number // runs per wicket
  strike_rate: number // balls per wicket
  economy: number // runs per over
  dot_percentage: number
  last_updated: string
}

// Fielding performance
export interface FieldingPerformance {
  id: string
  match_id: string
  player_id: string
  catches: number
  run_outs: number
  stumpings: number
  created_at: string
}

// Fielding season stats
export interface FieldingSeasonStats {
  id: string
  player_id: string
  season_id: string
  matches_played: number
  total_catches: number
  total_run_outs: number
  total_stumpings: number
  total_dismissals: number
  dismissals_per_match: number
  last_updated: string
}

// Parsed data from HTML
export interface ParsedBattingEntry {
  playerName: string
  runs: number
  balls: number
  fours: number
  sixes: number
  notOut: boolean
  dismissalText: string
  battingPosition: number
  isBowledOrLBW: boolean
}

export interface ParsedBowlingEntry {
  playerName: string
  overs: number
  balls: number // legal balls
  maidens: number
  runs: number
  wickets: number
  dots: number
  wides: number
  noBalls: number
  economy: number
}

export interface ParsedFieldingEntry {
  playerName: string
  catches: number
  runOuts: number
  stumpings: number
}

export interface ExtrasBreakdown {
  total: number
  wides: number
  noBalls: number
  byes: number
  legByes: number
}

export interface ParsedMatchData {
  date: string
  teams: [string, string]
  venue?: string
  competition?: string
  matchType?: string
  result?: string
  innings: {
    team: string
    battingEntries: ParsedBattingEntry[]
    bowlingEntries: ParsedBowlingEntry[]
    fieldingEntries: ParsedFieldingEntry[]
    total: number
    wickets: number
    overs: number
    extras: number
    extrasBreakdown?: ExtrasBreakdown
  }[]
}

// API Response types
export interface PlayerWithStats extends Player {
  battingStats?: PlayerSeasonStats
  bowlingStats?: BowlingSeasonStats
  fieldingStats?: FieldingSeasonStats
  battingPerformances?: BattingPerformance[]
  bowlingPerformances?: BowlingPerformance[]
  fieldingPerformances?: FieldingPerformance[]
}

export interface MatchWithPerformances extends Match {
  battingPerformances?: (BattingPerformance & { player: Player })[]
  bowlingPerformances?: (BowlingPerformance & { player: Player })[]
  fieldingPerformances?: (FieldingPerformance & { player: Player })[]
  season?: Season
}

// Stats calculation results
export interface CalculatedBattingStats {
  matchesPlayed: number
  totalRuns: number
  totalBalls: number
  dismissals: number
  notOuts: number
  fours: number
  sixes: number
  bowledLbw: number
  average: number
  strikeRate: number
  boundaryRate: number
  boundaryPercentage: number
  bowledLbwPercentage: number
}

export interface CalculatedBowlingStats {
  matchesBowled: number
  totalOvers: number
  totalBalls: number
  totalRuns: number
  totalWickets: number
  totalMaidens: number
  totalDots: number
  totalWides: number
  totalNoBalls: number
  average: number // runs per wicket
  strikeRate: number // balls per wicket
  economy: number // runs per over
  dotPercentage: number
}

export interface CalculatedFieldingStats {
  matchesPlayed: number
  totalCatches: number
  totalRunOuts: number
  totalStumpings: number
  totalDismissals: number
  dismissalsPerMatch: number
}

