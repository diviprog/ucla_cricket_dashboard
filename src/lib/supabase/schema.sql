-- UCLA Cricket Stats Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(20) NOT NULL UNIQUE, -- "2024-2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  photo_url TEXT,
  contact_info JSONB,
  year VARCHAR(20),
  major VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player aliases table
CREATE TABLE IF NOT EXISTS player_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(alias)
);

-- Index for faster alias lookups
CREATE INDEX IF NOT EXISTS idx_player_aliases_alias ON player_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_player_aliases_player_id ON player_aliases(player_id);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  opponent VARCHAR(100) NOT NULL,
  venue VARCHAR(200),
  match_type VARCHAR(20) NOT NULL DEFAULT 'league', -- league, playoff, friendly, tournament
  competition_name VARCHAR(200),
  result VARCHAR(20) NOT NULL DEFAULT 'no_result', -- win, loss, tie, no_result
  our_team_name VARCHAR(100), -- The team name UCLA played under
  our_score VARCHAR(20),
  opponent_score VARCHAR(20),
  our_extras_wides INTEGER DEFAULT 0,
  our_extras_no_balls INTEGER DEFAULT 0,
  our_extras_byes INTEGER DEFAULT 0,
  our_extras_leg_byes INTEGER DEFAULT 0,
  our_extras_total INTEGER DEFAULT 0,
  home_away VARCHAR(10), -- home, away, neutral
  weather VARCHAR(50),
  pitch_type VARCHAR(50),
  importance INTEGER CHECK (importance >= 1 AND importance <= 5),
  notes TEXT,
  raw_html_hash VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster match lookups
CREATE INDEX IF NOT EXISTS idx_matches_season_id ON matches(season_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);

-- Import history for duplicate detection
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  filename VARCHAR(500),
  content_hash VARCHAR(64) NOT NULL UNIQUE,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batting performances table
CREATE TABLE IF NOT EXISTS batting_performances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  runs INTEGER NOT NULL DEFAULT 0,
  balls INTEGER NOT NULL DEFAULT 0,
  fours INTEGER NOT NULL DEFAULT 0,
  sixes INTEGER NOT NULL DEFAULT 0,
  not_out BOOLEAN NOT NULL DEFAULT FALSE,
  bowled_lbw BOOLEAN NOT NULL DEFAULT FALSE,
  dismissal_text VARCHAR(200),
  batting_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- Index for faster performance lookups
CREATE INDEX IF NOT EXISTS idx_batting_performances_match_id ON batting_performances(match_id);
CREATE INDEX IF NOT EXISTS idx_batting_performances_player_id ON batting_performances(player_id);

-- Player season stats (pre-computed/cached)
CREATE TABLE IF NOT EXISTS player_season_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_balls INTEGER NOT NULL DEFAULT 0,
  dismissals INTEGER NOT NULL DEFAULT 0,
  not_outs INTEGER NOT NULL DEFAULT 0,
  fours INTEGER NOT NULL DEFAULT 0,
  sixes INTEGER NOT NULL DEFAULT 0,
  bowled_lbw INTEGER NOT NULL DEFAULT 0,
  average DECIMAL(10, 2) NOT NULL DEFAULT 0,
  strike_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  boundary_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  boundary_percentage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  bowled_lbw_percentage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, season_id)
);

-- Index for faster stats lookups
CREATE INDEX IF NOT EXISTS idx_player_season_stats_player_id ON player_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_season_id ON player_season_stats(season_id);

-- Match player overrides (for when Player A played under Player B's name)
CREATE TABLE IF NOT EXISTS match_player_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  displayed_name VARCHAR(100) NOT NULL, -- Name shown in scorecard
  actual_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, displayed_name)
);

-- Index for faster override lookups
CREATE INDEX IF NOT EXISTS idx_match_player_overrides_match_id ON match_player_overrides(match_id);

-- Bowling performances table
CREATE TABLE IF NOT EXISTS bowling_performances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  overs DECIMAL(4, 1) NOT NULL DEFAULT 0, -- e.g., 4.0, 3.2
  balls INTEGER NOT NULL DEFAULT 0, -- Legal balls bowled
  maidens INTEGER NOT NULL DEFAULT 0,
  runs_conceded INTEGER NOT NULL DEFAULT 0,
  wickets INTEGER NOT NULL DEFAULT 0,
  dots INTEGER NOT NULL DEFAULT 0,
  wides INTEGER NOT NULL DEFAULT 0,
  no_balls INTEGER NOT NULL DEFAULT 0,
  economy DECIMAL(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- Index for faster bowling lookups
CREATE INDEX IF NOT EXISTS idx_bowling_performances_match_id ON bowling_performances(match_id);
CREATE INDEX IF NOT EXISTS idx_bowling_performances_player_id ON bowling_performances(player_id);

-- Bowling season stats (pre-computed/cached)
CREATE TABLE IF NOT EXISTS bowling_season_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  matches_bowled INTEGER NOT NULL DEFAULT 0,
  total_overs DECIMAL(6, 1) NOT NULL DEFAULT 0,
  total_balls INTEGER NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_wickets INTEGER NOT NULL DEFAULT 0,
  total_maidens INTEGER NOT NULL DEFAULT 0,
  total_dots INTEGER NOT NULL DEFAULT 0,
  total_wides INTEGER NOT NULL DEFAULT 0,
  total_no_balls INTEGER NOT NULL DEFAULT 0,
  average DECIMAL(10, 2) NOT NULL DEFAULT 0, -- runs per wicket
  strike_rate DECIMAL(10, 2) NOT NULL DEFAULT 0, -- balls per wicket
  economy DECIMAL(10, 2) NOT NULL DEFAULT 0, -- runs per over
  dot_percentage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, season_id)
);

-- Index for bowling stats
CREATE INDEX IF NOT EXISTS idx_bowling_season_stats_player_id ON bowling_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_bowling_season_stats_season_id ON bowling_season_stats(season_id);

-- Fielding performances table
CREATE TABLE IF NOT EXISTS fielding_performances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  catches INTEGER NOT NULL DEFAULT 0,
  run_outs INTEGER NOT NULL DEFAULT 0,
  stumpings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- Index for fielding lookups
CREATE INDEX IF NOT EXISTS idx_fielding_performances_match_id ON fielding_performances(match_id);
CREATE INDEX IF NOT EXISTS idx_fielding_performances_player_id ON fielding_performances(player_id);

-- Fielding season stats (pre-computed/cached)
CREATE TABLE IF NOT EXISTS fielding_season_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0,
  total_catches INTEGER NOT NULL DEFAULT 0,
  total_run_outs INTEGER NOT NULL DEFAULT 0,
  total_stumpings INTEGER NOT NULL DEFAULT 0,
  total_dismissals INTEGER NOT NULL DEFAULT 0, -- catches + run_outs + stumpings
  dismissals_per_match DECIMAL(10, 2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, season_id)
);

-- Index for fielding stats
CREATE INDEX IF NOT EXISTS idx_fielding_season_stats_player_id ON fielding_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_fielding_season_stats_season_id ON fielding_season_stats(season_id);

-- Insert default seasons
INSERT INTO seasons (name, start_date, end_date) VALUES
  ('2024-2025', '2024-09-01', '2025-06-30'),
  ('2025-2026', '2025-09-01', '2026-06-30')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security (optional, for future auth)
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE batting_performances ENABLE ROW LEVEL SECURITY;

-- Create policies (for public access without auth for MVP)
-- CREATE POLICY "Public read access" ON players FOR SELECT USING (true);
-- CREATE POLICY "Public read access" ON matches FOR SELECT USING (true);
-- CREATE POLICY "Public read access" ON batting_performances FOR SELECT USING (true);

