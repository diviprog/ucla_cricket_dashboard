-- 001: guests + intrasquad matches
-- Run once in the Supabase SQL Editor BEFORE deploying the code that uses it.
-- Safe to re-run, and harmless to the currently deployed code (it ignores new columns).

-- Guests: players who played on our side but are not UCLA players.
-- Their performances are stored but hidden from individual stats views.
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_ucla BOOLEAN NOT NULL DEFAULT TRUE;

-- Which side a performance was for: 0 = matches.our_team_name, 1 = matches.opponent.
-- Used to label the two sides of an intrasquad match. NULL on rows imported before this.
ALTER TABLE batting_performances ADD COLUMN IF NOT EXISTS team_side SMALLINT;
ALTER TABLE bowling_performances ADD COLUMN IF NOT EXISTS team_side SMALLINT;
ALTER TABLE fielding_performances ADD COLUMN IF NOT EXISTS team_side SMALLINT;

-- matches.match_type is a free VARCHAR(20) with no CHECK constraint,
-- so 'intrasquad' needs no DDL.
