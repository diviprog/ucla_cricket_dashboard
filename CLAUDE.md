# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UCLA Cricket Stats Platform - A comprehensive cricket statistics platform that parses CricClubs HTML scorecards, manages player rosters with aliases, calculates batting/bowling/fielding statistics, and displays them in a dashboard.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (PostgreSQL), Tailwind CSS, Cheerio (HTML parsing), ExcelJS (Excel export)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Seed database with players and seasons
npx tsx --env-file=.env.local src/scripts/seed-players.ts
```

## Environment Setup

Copy `.env.example` to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server only, never NEXT_PUBLIC_
ADMIN_EMAILS=admin1@example.com,admin2@example.com # comma-separated admin allowlist
```

Database: run `src/lib/supabase/schema.sql`, then `src/lib/supabase/rls.sql`, in the Supabase SQL Editor.

## Architecture

### Data Flow

**Match Import:** HTML Upload → `/api/matches/import` → Parse CricClubs HTML → Generate content hash → Check for duplicates → Resolve/create players via aliases → Write match + performances to Supabase → Update season stats

**Dashboard:** Load season filters → Fetch team stats, top performers, recent matches → Display leaderboards

**Editable Scorecard:** Load match + performances → Render tables with reassign dropdowns + inline stat editing → Call reassign/update APIs → Refresh match data

### Key Components

**Authentication (`src/lib/auth/auth-context.tsx`):**
- Uses Supabase auth session management (client-side UI state only)
- Provides `useAuth()` and `useRequireAdmin()` hooks
- `AdminGuard` component redirects to `/admin/login` if not authenticated
- Real enforcement is server-side; see Important Notes → Authentication

**Player Resolution System:**
- Players have canonical names in `players` table
- `player_aliases` maps name variations to canonical player IDs
- Parser resolves player names via alias lookup during import
- Import route calls `resolvePlayerName()` → checks aliases → returns playerId
- New players created via `createPlayerIfNotExists()`
- Player cache initialized via `initializePlayerCache()` for performance

**Season Detection:**
- `detectSeasonFromDate()` determines season (e.g., "2024-2025") from match date
- Seasons created automatically if missing via `getOrCreateSeason()`
- Season stats tracked separately in `player_season_stats`, `bowling_season_stats`, `fielding_season_stats`

**Stats Calculation:**
- After importing performances, `updatePlayerSeasonStats()`, `updateBowlingSeasonStats()`, `updateFieldingSeasonStats()` recalculate aggregates
- Stats computed from all performances for a player in a season
- Calculates: batting average, strike rate, boundary %, bowling economy, dot ball %, etc.

**Duplicate Detection:**
- `generateContentHash()` creates hash from HTML content
- Hash stored in `import_history` table
- Import route checks hash before processing to prevent duplicate imports

### Innings and Team Detection

**Our Team vs Opponent (`src/lib/import/import-plan.ts`):**
- Side i = the team that batted in innings i. Innings i's bowling table, fielders and bowler wicket types belong to the fielding side (1 - i)
- `/api/parse` returns both sides' players with roles and a roster suggestion (`matchPlayerName`)
- The upload page asks which side is us: Team A, Team B or Both (intrasquad), then a decision per scorecard name: link / new UCLA player / guest
- `/api/matches/import` takes `ourSide` + `playerDecisions` and writes what the pure `buildImportPlan()` returns; it 400s on a missing side or decision
- Intrasquad: both innings imported, `match_type='intrasquad'`, `result='no_result'`; excluded from the team record/totals, counted in individual stats
- Guests (`players.is_ucla = false`): performances stored, hidden from leaderboards, dashboard top performers/player count and Excel player sheets (filtered at query time)
- Migration `src/lib/supabase/migrations/001-guests-intrasquad.sql` must run before deploying this code

**Result Calculation:**
- Result determined by comparing our innings total vs the other innings total
- Ignores unreliable result text from parsed HTML
- Values: 'win', 'loss', 'tie', 'no_result'

**Extras Tracking:**
- Match stores `our_extras_total`, `our_extras_wides`, `our_extras_no_balls`, `our_extras_byes`, `our_extras_leg_byes`
- Parsed from `ourInnings.extrasBreakdown`

### Fielding Stats Extraction

Fielding performances (catches, run outs, stumpings) are automatically parsed from dismissal text in batting entries:
- "c Naman S b Tanmay D" → catch credited to Naman S
- "run out (Devansh M)" → run out credited to Devansh M
- "st John K b Rohan M" → stumping credited to John K
- Parser groups by player and creates/updates `fielding_performances`

### Bowler Wicket Types

Tracks HOW bowlers take wickets via `bowler_wicket_types` table:
- Dismissal types: 'caught', 'bowled', 'lbw', 'stumped', 'hit_wicket', 'other'
- Parsed from opponent batting dismissals
- Grouped by bowler name and dismissal type
- Upserted with conflict resolution on `match_id,bowler_player_id,dismissal_type`

### Type System (`src/types/models.ts`)

**Database Models:** Season, Player, PlayerAlias, Match, ImportHistory, BattingPerformance, BowlingPerformance, FieldingPerformance, PlayerSeasonStats, BowlingSeasonStats, FieldingSeasonStats, MatchPlayerOverride

**Parsed Types:** ParsedBattingEntry, ParsedBowlingEntry, ParsedFieldingEntry, ParsedBowlerWicketEntry, ExtrasBreakdown, ParsedMatchData

**API Response Types:** PlayerWithStats, MatchWithPerformances, CalculatedBattingStats, CalculatedBowlingStats, CalculatedFieldingStats

### Utility Functions (`src/lib/utils.ts`)

- `formatScore(runs, balls, notOut)` - Format as "22(21)" or "10(6)*"
- `formatStat(value, decimals)` - Format numbers with proper decimals, handles NaN/Infinity
- `safePercentage(numerator, denominator)` - Calculate percentage with zero-division safety
- `formatDate(date)` - Format as "Dec 4, 2024"
- `getInitials(name)` - Extract first two initials
- `isUnclaimed(name)` - Check if player name is unclaimed placeholder
- `displayPlayerName(name)` - Show "Unclaimed" instead of "Unclaimed #1"
- `cn(...inputs)` - Merge Tailwind classes via clsx + tailwind-merge

## Database Schema Notes

**Key Tables:**
- `seasons` - Academic year seasons (2024-2025, etc.)
- `players` - Canonical player records
- `player_aliases` - Name variations → player_id mapping
- `matches` - Match metadata, scores, result, extras breakdown
- `import_history` - Deduplication via content_hash
- `batting_performances` - Per-match batting stats
- `bowling_performances` - Per-match bowling stats
- `fielding_performances` - Per-match fielding stats
- `bowler_wicket_types` - How bowlers take wickets (caught/bowled/lbw/etc.)
- `player_season_stats` - Aggregated batting stats per season
- `bowling_season_stats` - Aggregated bowling stats per season
- `fielding_season_stats` - Aggregated fielding stats per season
- `match_player_overrides` - Manual player reassignments (for fixing misidentified players)

## Important Notes

**Authentication:**
- Admin API routes call `requireAdmin` (`src/lib/auth/require-admin.ts`), which checks the session's email against `ADMIN_EMAILS`
- All writes use `getSupabaseAdmin()` (`src/lib/supabase/server.ts`, service-role key, server only)
- Browser calls admin routes through `adminFetch` (`src/lib/auth/admin-fetch.ts`)
- RLS is public-read only (`src/lib/supabase/rls.sql`); anon key cannot write

**Seed Script:**
- Located at `src/scripts/seed-players.ts`
- Creates players, aliases, and seasons (2024-2025, 2025-2026)
- Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; run with `npx tsx --env-file=.env.local src/scripts/seed-players.ts`

**Name Variations:**
- Player names in scorecards vary ("Devansh M", "Devansh Mishra", "D Mishra")
- Alias system maps all variations to canonical player
- Parser must call `resolvePlayerName()` before creating performances
- Unclaimed players use special naming: "Unclaimed #1", "Unclaimed #2", etc.

**CricClubs HTML Format:**
- Parser expects specific HTML structure from CricClubs scorecards
- Extracts: teams, date, venue, innings (batting/bowling/fielding entries), extras breakdown
- Handles variations in HTML structure (bowling entries may be in either innings)

**Deployment:**
- Designed for Vercel deployment
- Environment variables must be set in Vercel dashboard
- Database runs on Supabase (free tier supported)
