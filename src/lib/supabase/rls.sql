-- Row Level Security for UCLA Cricket Stats
--
-- BEFORE RUNNING: deploy the new app code with SUPABASE_SERVICE_ROLE_KEY and
-- ADMIN_EMAILS set in the environment. Once this runs, the anon key can only
-- read, so the old client-side writes on the live site (imports, edits) will fail.
--
-- Model: public read-only via anon/authenticated; all writes go through server
-- routes using the service role, which bypasses RLS. No insert/update/delete
-- policies exist on purpose. Safe to re-run.

-- Publicly readable tables

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON seasons;
CREATE POLICY "Public read" ON seasons FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON players;
CREATE POLICY "Public read" ON players FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE player_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON player_aliases;
CREATE POLICY "Public read" ON player_aliases FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON matches;
CREATE POLICY "Public read" ON matches FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE batting_performances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON batting_performances;
CREATE POLICY "Public read" ON batting_performances FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON player_season_stats;
CREATE POLICY "Public read" ON player_season_stats FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE bowling_performances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON bowling_performances;
CREATE POLICY "Public read" ON bowling_performances FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE bowling_season_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON bowling_season_stats;
CREATE POLICY "Public read" ON bowling_season_stats FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE fielding_performances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON fielding_performances;
CREATE POLICY "Public read" ON fielding_performances FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE fielding_season_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON fielding_season_stats;
CREATE POLICY "Public read" ON fielding_season_stats FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE bowler_wicket_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON bowler_wicket_types;
CREATE POLICY "Public read" ON bowler_wicket_types FOR SELECT TO anon, authenticated USING (true);

-- Server-only tables (no policies: only the service role can access)

ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE match_player_overrides ENABLE ROW LEVEL SECURITY;


-- Verify: every table should show relrowsecurity = true
SELECT c.relname AS table_name, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
