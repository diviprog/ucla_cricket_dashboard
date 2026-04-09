# UCLA Cricket Stats Platform

A comprehensive cricket statistics platform that parses CricClubs HTML scorecards, manages player rosters with aliases, calculates batting/bowling/fielding statistics, and displays them in a beautiful dashboard with leaderboards and player profiles.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC)

## Features

### Dashboard
- Team Record - Wins, losses, ties, win percentage
- Team Stats - Total runs, wickets taken, catches, boundaries
- Top Performers - Best batters, bowlers, and fielders
- Recent Matches - Quick view of latest results

### Batting Statistics
- Runs, balls, fours, sixes, not outs
- Batting average, strike rate
- Boundary percentage, bowled/LBW percentage
- Match-by-match breakdown

### Bowling Statistics
- Overs, maidens, runs conceded, wickets
- Bowling average, economy rate, strike rate
- Dot ball percentage

### Fielding Statistics
- Catches, run outs, stumpings
- Total dismissals, dismissals per match
- Extracted automatically from dismissal text

### Match Upload
- Drag and drop CricClubs HTML scorecards
- Auto-detection of teams, date, scores
- Metadata editing (tournament, venue, match type)
- Duplicate detection via content hashing

### Editable Scorecards
- Reassign Players - Click any player name to reassign
- Edit Stats - Click any stat to edit inline
- Mark as Unclaimed - For unknown players
- Edit Match Details - Tournament name, venue, result

### Player Management
- Alias System - Handle name variations
- Player Profiles - Full career stats and match history
- Add Aliases - Directly from player profile page

### Excel Export
Export all stats to Excel with 4 sheets:
- Batting Stats
- Bowling Stats
- Fielding Stats
- Match Results (color-coded)

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier works)

### Installation

1. Clone and install:
```bash
git clone https://github.com/YOUR_USERNAME/cricket-stats-scrapper.git
cd cricket-stats-scrapper
npm install
```

2. Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Set up database - run `src/lib/supabase/schema.sql` in Supabase SQL Editor

4. Start dev server:
```bash
npm run dev
```

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Supabase (PostgreSQL)
- Tailwind CSS
- Cheerio (HTML parsing)
- ExcelJS (Excel export)

## Deployment

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy!

## License

MIT License

---

Built with love for UCLA Cricket
# Deployment trigger
