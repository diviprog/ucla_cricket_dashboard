# CricCenter Parser Integration

This document describes the CricCenter parser integration that enables the system to parse scorecards from both CricClubs and CricCenter formats.

## Overview

The system now automatically detects whether an uploaded scorecard is from CricClubs or CricCenter and uses the appropriate parser. Both parsers output the same `ParsedMatchData` format, so the rest of the import pipeline (player resolution, stats calculation, etc.) works identically for both formats.

## Files Created

### 1. `src/lib/parsers/format-detector.ts`
**Purpose:** Detects the format of uploaded HTML scorecards

**Exports:**
- `detectScorecardFormat(html: string): ScorecardFormat` - Returns 'cricclubs', 'criccenter', or 'unknown'

**Detection Logic:**
- **CricCenter:** Looks for `.ended-match-summary-header`, `.team-wrap`, `.stats-table`, and "CRICCENTER" branding
- **CricClubs:** Looks for CricClubs-specific table structures and classes
- **Unknown:** Returns if neither format is detected

### 2. `src/lib/parsers/criccenter-parser.ts`
**Purpose:** Parses CricCenter scorecard HTML

**Exports:**
- `parseCricCenterScorecard(html: string): ParsedMatchData` - Main parser function
- `generateContentHash(html: string): string` - SHA-256 hash for duplicate detection

**Parsing Capabilities:**
- ✅ Match metadata (date, venue, competition, teams, result)
- ✅ Batting performances (runs, balls, fours, sixes, dismissals, not outs)
- ✅ Bowling performances (overs, maidens, runs, wickets, economy, dots, wides, no-balls)
- ✅ Fielding performances (catches, run outs, stumpings) - extracted from dismissal text
- ✅ Bowler wicket types (caught, bowled, lbw, stumped, hit wicket) - extracted from dismissal text
- ✅ Extras breakdown (wides, no-balls, byes, leg-byes, penalties)
- ✅ Fall of wickets (implicit through batting order)

**Key Selectors Used:**
```javascript
// Match metadata
.ended-match-summary-header    // Header section
time[datetime]                 // Match date
.ended-match-summary-title     // Competition name
.ended-match-summary-venue     // Venue
.ended-match-team-name         // Team names

// Scorecard data
.team-wrap                     // Each innings section
.stats-table                   // Batting table
.bowling-stats-table           // Bowling table
.player-name                   // Player names
.stats                         // Stat cells
.extras-row                    // Extras breakdown
.total-row                     // Total score
```

**Extras Format Parsing:**
CricCenter uses format: `( nb 1, w 6, b 1, lb 3, pen 0 )`
Parser extracts each component using regex patterns.

## Files Modified

### `src/app/api/matches/import/route.ts`

**Changes:**
1. Added imports for CricCenter parser and format detector
2. Added format detection before parsing
3. Routed to appropriate parser based on detected format
4. Added validation to reject unknown formats

**New Flow:**
```
1. Receive HTML + metadata
2. Detect format (CricClubs vs CricCenter)
3. Validate format is recognized
4. Generate content hash using format-specific hasher
5. Check for duplicates
6. Parse using format-specific parser → ParsedMatchData
7. Continue with existing pipeline (player resolution, stats calculation, etc.)
```

## Usage

### For End Users
No changes required! Simply upload either CricClubs or CricCenter HTML files through the existing upload interface. The system will automatically detect and parse the correct format.

### For Developers

**Testing the Parser:**
```typescript
import { parseCricCenterScorecard } from '@/lib/parsers/criccenter-parser'
import { detectScorecardFormat } from '@/lib/parsers/format-detector'

const html = // ... load HTML content
const format = detectScorecardFormat(html)

if (format === 'criccenter') {
  const parsedData = parseCricCenterScorecard(html)
  console.log(parsedData)
}
```

**Importing a Match:**
```bash
POST /api/matches/import
Content-Type: application/json

{
  "html": "<html>...</html>",
  "metadata": {
    "ourTeamName": "UCLA",
    "matchType": "league",
    "competitionName": "NCCA Championship",
    "venue": "Optional override",
    "notes": "Optional notes"
  }
}
```

## CricCenter HTML Structure

CricCenter uses a React-rendered client-side application with the following structure:

### Match Header
```html
<header class="ended-match-summary-header">
  <time datetime="2026-03-20T18:30:00.000+00:00">Friday 20 March, 11:30 AM</time>
  <h1 class="ended-match-summary-title">National College Cricket Association</h1>
  <p class="ended-match-summary-venue">Venue details...</p>
  <section class="ended-match-team-list">
    <article class="ended-match-team-row">
      <figcaption class="ended-match-team-name">UCLA</figcaption>
      <span class="score-value">49/10</span>
      <span class="score-overs">(15.4 OV)</span>
    </article>
  </section>
</header>
```

### Batting Table
```html
<div class="team-wrap">
  <table class="stats-table">
    <thead>
      <tr><th>Batting</th><th></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
    </thead>
    <tbody>
      <tr>
        <td class="player-name">Player Name</td>
        <td>c Fielder b Bowler</td>
        <td class="stats">10</td>
        <td class="stats">15</td>
        <td class="stats">1</td>
        <td class="stats">0</td>
        <td class="stats">66.67</td>
      </tr>
      <tr class="extras-row">
        <td class="player-name">Extras</td>
        <td>( nb 1, w 6, b 1, lb 3, pen 0 )</td>
        <td class="stats">11</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td>Total</td>
        <td>15.4 Ov (CRR: 3.13)</td>
        <td colspan="5">49</td>
      </tr>
    </tfoot>
  </table>
</div>
```

### Bowling Table
```html
<table class="stats-table bowling-stats-table">
  <thead>
    <tr><th>Bowling</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ.</th><th>Dots</th><th>4s</th><th>6s</th><th>WD</th><th>NB</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="player-name">Bowler Name</td>
      <td class="stats">4</td>
      <td class="stats">1</td>
      <td class="stats">18</td>
      <td class="stats">2</td>
      <td class="stats">4.50</td>
      <td class="stats">13</td>
      <td class="stats">-</td>
      <td class="stats">-</td>
      <td class="stats">2</td>
      <td class="stats">0</td>
    </tr>
  </tbody>
</table>
```

## Differences from CricClubs

| Feature | CricClubs | CricCenter |
|---------|-----------|------------|
| Rendering | Server-side HTML | Client-side React |
| Extras Format | Varies | `( nb X, w X, b X, lb X, pen X )` |
| Bowling Dots | May not be present | Always present |
| Player Names | Various formats | Consistent format |
| Date Format | Text parsing | ISO datetime attribute |
| Team Scores | Embedded in text | Structured elements |

## Error Handling

The parser includes comprehensive error handling:

1. **Unknown Format:** Returns 400 error if format can't be detected
2. **Duplicate Detection:** Uses content hash to prevent re-importing
3. **Missing Data:** Uses sensible defaults (0 for numeric values, empty strings)
4. **Malformed HTML:** Cheerio gracefully handles most HTML issues

## Future Enhancements

Potential improvements for the CricCenter parser:

1. **Match Details Parsing:** Extract toss, umpires, player of the match from `.match-details-wrap`
2. **Fall of Wickets:** Parse `.fall-wickets` section for detailed wicket timeline
3. **Partnership Stats:** Extract partnership information if available
4. **Match Officials:** Parse umpire and referee information
5. **Awards:** Parse player of the match, MVP awards from `.ended-match-summary-awards`

## Testing

To test the parser:

1. Save a CricCenter scorecard HTML to `match.html`
2. Use the import API endpoint with the HTML content
3. Verify the match appears in the dashboard
4. Check player stats are calculated correctly
5. Verify fielding stats and wicket types are captured

## Support

If you encounter issues:

1. Check the format detector correctly identifies the HTML
2. Verify the HTML structure matches expected selectors
3. Check browser console for any parsing errors
4. Review the generated content hash for duplicates
5. Validate player name resolution is working

## Implementation Notes

- Parser uses Cheerio for HTML parsing (same as CricClubs parser)
- All data flows through the same `ParsedMatchData` interface
- Player resolution and stats calculation remain unchanged
- Content hashing ensures no duplicate imports
- Both parsers can coexist indefinitely

