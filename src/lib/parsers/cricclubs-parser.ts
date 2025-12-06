import * as cheerio from 'cheerio'
import type { ParsedMatchData, ParsedBattingEntry, ParsedBowlingEntry, ParsedFieldingEntry } from '@/types/models'
import { createHash } from 'crypto'

/**
 * Parse CricClubs HTML scorecard
 */
export function parseCricClubsScorecard(html: string): ParsedMatchData {
  const $ = cheerio.load(html)
  
  // Extract match metadata
  const title = $('title').text() // "Semi Final: UCSD vs UCLA - Los Angeles Cricket Academy"
  const metaDescription = $('meta[name="description"]').attr('content') || ''
  
  // Parse teams from title
  const teamsMatch = title.match(/:\s*(.+?)\s*vs\s*(.+?)\s*-/)
  const teams: [string, string] = teamsMatch 
    ? [teamsMatch[1].trim(), teamsMatch[2].trim()]
    : ['Unknown', 'Unknown']
  
  // Parse date from the page
  const dateText = $('.ms-league-name span').text() || ''
  const dateMatch = dateText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
  const date = dateMatch ? parseDate(dateMatch[1]) : new Date().toISOString().split('T')[0]
  
  // Parse competition name
  const competition = $('.match-summary h3 strong').first().text().trim()
  
  // Parse match type (Semi Final, Final, League, etc.)
  const matchTypeText = $('.ms-league-name').text().split(/\d/)[0].trim()
  const matchType = inferMatchType(matchTypeText)
  
  // Parse result
  const resultText = $('.score-top h3').last().text().trim()
  const result = inferResult(resultText, teams)
  
  // Parse both innings
  const innings: ParsedMatchData['innings'] = []
  
  // Find innings tables - they're in #ballByBallTeam1 and #ballByBallTeam2
  const inningsDivs = ['#ballByBallTeam1', '#ballByBallTeam2']
  
  inningsDivs.forEach((divId, index) => {
    const inningsDiv = $(divId)
    if (!inningsDiv.length) return
    
    // Get team name from the innings header
    const teamNameHeader = inningsDiv.find('th:contains("innings")').first().text()
    const teamNameMatch = teamNameHeader.match(/^(\w+)\s+innings/)
    const teamName = teamNameMatch ? teamNameMatch[1] : teams[index]
    
    const battingEntries: ParsedBattingEntry[] = []
    let position = 1
    
    // Parse batting table rows
    const battingTable = inningsDiv.find('.match-table-innings table').first()
    battingTable.find('tbody tr').each((_, row) => {
      const $row = $(row)
      const cells = $row.find('th')
      
      // Skip extras and total rows
      const firstCellText = cells.first().text().trim()
      if (firstCellText.includes('Extras') || firstCellText.includes('Total')) {
        return
      }
      
      // Get player name from the link
      const playerLink = cells.first().find('a[href*="viewPlayer"]').first()
      if (!playerLink.length) return
      
      let playerName = playerLink.find('b').text().trim()
      if (!playerName) {
        playerName = playerLink.text().trim()
      }
      
      // Remove asterisk from name (indicates captain/keeper)
      playerName = playerName.replace(/\*$/, '').trim()
      
      // Check for "not out" indicator
      const dismissalCell = cells.eq(1)
      const dismissalText = dismissalCell.text().trim()
      const notOut = dismissalText.toLowerCase() === 'not out' || 
                     playerName.endsWith('*') ||
                     cells.first().text().includes('not out')
      
      // Clean player name
      playerName = playerName.replace(/\*$/, '').trim()
      
      // Parse stats - find the cells with numbers
      const statCells = cells.slice(2) // Skip name and dismissal columns
      const runs = parseInt(statCells.eq(0).text().trim()) || 0
      const balls = parseInt(statCells.eq(1).text().trim()) || 0
      const fours = parseInt(statCells.eq(2).text().trim()) || 0
      const sixes = parseInt(statCells.eq(3).text().trim()) || 0
      
      // Check if bowled or LBW
      const isBowledOrLBW = checkBowledOrLBW(dismissalText)
      
      battingEntries.push({
        playerName,
        runs,
        balls,
        fours,
        sixes,
        notOut,
        dismissalText,
        battingPosition: position++,
        isBowledOrLBW,
      })
    })
    
    // Parse bowling table (bowlers for the opposite team's innings)
    const bowlingEntries: ParsedBowlingEntry[] = parseBowlingTable($, inningsDiv)
    
    // Parse fielding from dismissals (catches, run outs, stumpings)
    const fieldingEntries: ParsedFieldingEntry[] = parseFieldingFromDismissals(battingEntries)
    
    // Parse total from the innings
    const totalText = inningsDiv.find('th:contains("Total")').parent().find('th b').last().text()
    const total = parseInt(totalText) || battingEntries.reduce((sum, e) => sum + e.runs, 0)
    
    // Parse overs and wickets from header
    const headerText = teamNameHeader
    const oversMatch = headerText.match(/(\d+\.?\d*)\s*overs?/)
    const wicketsMatch = headerText.match(/(\d+)\s*wickets?/)
    
    const overs = oversMatch ? parseFloat(oversMatch[1]) : 0
    const wickets = wicketsMatch ? parseInt(wicketsMatch[1]) : battingEntries.filter(e => !e.notOut).length
    
    // Parse extras with breakdown
    const extrasRow = inningsDiv.find('th:contains("Extras")').parent()
    const extrasFullText = extrasRow.text()
    const extrasTotalText = extrasRow.find('th b').text()
    const extrasTotal = parseInt(extrasTotalText) || 0
    
    // Parse breakdown like "15 (w 5, nb 2, lb 4, b 4)" or "15 (5w, 2nb, 4lb, 4b)"
    const widesMatch = extrasFullText.match(/(\d+)\s*w(?:ide)?s?(?:\)|,|\s|$)/i) || extrasFullText.match(/w(?:ide)?s?\s*(\d+)/i)
    const noBallsMatch = extrasFullText.match(/(\d+)\s*n(?:o)?b(?:all)?s?(?:\)|,|\s|$)/i) || extrasFullText.match(/n(?:o)?b(?:all)?s?\s*(\d+)/i)
    const byesMatch = extrasFullText.match(/(\d+)\s*b(?:ye)?s?(?:\)|,|\s|$)/i) || extrasFullText.match(/(?:^|\s)b(?:ye)?s?\s*(\d+)/i)
    const legByesMatch = extrasFullText.match(/(\d+)\s*l(?:eg)?b(?:ye)?s?(?:\)|,|\s|$)/i) || extrasFullText.match(/l(?:eg)?b(?:ye)?s?\s*(\d+)/i)
    
    const extrasBreakdown = {
      total: extrasTotal,
      wides: widesMatch ? parseInt(widesMatch[1]) : 0,
      noBalls: noBallsMatch ? parseInt(noBallsMatch[1]) : 0,
      byes: byesMatch ? parseInt(byesMatch[1]) : 0,
      legByes: legByesMatch ? parseInt(legByesMatch[1]) : 0,
    }
    
    innings.push({
      team: teamName,
      battingEntries,
      bowlingEntries,
      fieldingEntries,
      total,
      wickets,
      overs,
      extras: extrasTotal,
      extrasBreakdown,
    })
  })
  
  return {
    date,
    teams,
    venue: undefined, // Could parse from page if available
    competition,
    matchType,
    result,
    innings,
  }
}

/**
 * Parse bowling table from CricClubs scorecard
 * CricClubs bowling table structure varies, so we try multiple approaches:
 * - .match-innings-bottom-all div
 * - Table with "Bowling" header
 * - Any table that looks like a bowling table (has O, M, R, W columns)
 */
function parseBowlingTable($: cheerio.CheerioAPI, inningsDiv: cheerio.Cheerio<cheerio.Element>): ParsedBowlingEntry[] {
  const bowlingEntries: ParsedBowlingEntry[] = []
  
  // Try 1: Find the bowling section in .match-innings-bottom-all
  let bowlingTable = inningsDiv.find('.match-innings-bottom-all table').first()
  
  // Try 2: Look for table with "Bowling" header
  if (!bowlingTable.length) {
    bowlingTable = inningsDiv.find('th:contains("Bowling")').closest('table')
  }
  
  // Try 3: Look for any table after the batting table that has bowling-like headers
  if (!bowlingTable.length) {
    inningsDiv.find('table').each((_, table) => {
      const $table = $(table)
      const headerText = $table.find('th').text().toLowerCase()
      // Look for bowling indicators: overs (O), maidens (M), wickets (W)
      if ((headerText.includes(' o ') || headerText.includes('overs')) && 
          (headerText.includes(' w ') || headerText.includes('wickets'))) {
        bowlingTable = $table
        return false // break the each loop
      }
    })
  }
  
  // Try 4: Look in the parent container for bowling section
  if (!bowlingTable.length) {
    const parentContainer = inningsDiv.parent()
    bowlingTable = parentContainer.find('.match-innings-bottom-all table').first()
    if (!bowlingTable.length) {
      bowlingTable = parentContainer.find('th:contains("Bowling")').closest('table')
    }
  }
  
  if (!bowlingTable.length) return bowlingEntries
  
  // Parse rows - try tbody first, then all tr
  let rows = bowlingTable.find('tbody tr')
  if (!rows.length) {
    rows = bowlingTable.find('tr').not(':first') // Skip header row
  }
  
  rows.each((_, row) => {
    const entry = parseBowlingRow($, $(row))
    if (entry) bowlingEntries.push(entry)
  })
  
  return bowlingEntries
}

/**
 * Parse a single bowling row from CricClubs
 * Row structure varies but typically includes: Name, O, M, Dot/R, R/Dot, W, Econ
 */
function parseBowlingRow($: cheerio.CheerioAPI, $row: cheerio.Cheerio<cheerio.Element>): ParsedBowlingEntry | null {
  const cells = $row.find('td, th')
  if (cells.length < 5) return null
  
  // Find the cell with the player link - check multiple positions
  let playerName = ''
  let dataStartIndex = 0
  
  for (let i = 0; i < Math.min(cells.length, 4); i++) {
    const cell = cells.eq(i)
    // Try multiple ways to find player name
    const playerLink = cell.find('a[href*="viewPlayer"], a[href*="player"]').first()
    if (playerLink.length) {
      playerName = playerLink.find('b').text().trim() || playerLink.text().trim()
      dataStartIndex = i + 1
      break
    }
    // Try looking for just a bolded name
    const boldName = cell.find('b').first()
    if (boldName.length && !cell.text().toLowerCase().includes('bowling')) {
      playerName = boldName.text().trim()
      dataStartIndex = i + 1
      break
    }
  }
  
  // Skip header rows and empty rows
  if (!playerName || playerName.toLowerCase() === 'bowling' || playerName.toLowerCase() === 'bowler') {
    return null
  }
  
  // Clean player name (remove asterisk for captain, etc.)
  playerName = playerName.replace(/\*$/, '').replace(/†/g, '').trim()
  
  // Get the data cells starting after the name
  const dataCells = cells.slice(dataStartIndex)
  if (dataCells.length < 4) return null
  
  // Extract all numeric values from the remaining cells
  const numericValues: number[] = []
  dataCells.each((_, cell) => {
    const text = $(cell).text().trim().replace(/[<>]/g, '')
    const num = parseFloat(text)
    if (!isNaN(num)) {
      numericValues.push(num)
    }
  })
  
  if (numericValues.length < 4) return null
  
  // CricClubs typical column order: O, M, Dot, R, W, Econ
  // But sometimes it's: O, M, R, W, Econ (no dots)
  // Try to detect based on number of columns
  let overs = 0, maidens = 0, dots = 0, runs = 0, wickets = 0, economy = 0
  
  if (numericValues.length >= 6) {
    // Full format: O, M, Dot, R, W, Econ
    overs = numericValues[0]
    maidens = numericValues[1]
    dots = numericValues[2]
    runs = numericValues[3]
    wickets = numericValues[4]
    economy = numericValues[5]
  } else if (numericValues.length >= 5) {
    // Without dots: O, M, R, W, Econ
    overs = numericValues[0]
    maidens = numericValues[1]
    runs = numericValues[2]
    wickets = numericValues[3]
    economy = numericValues[4]
  } else {
    // Minimal: O, R, W, Econ (or O, M, R, W)
    overs = numericValues[0]
    runs = numericValues[1]
    wickets = numericValues[2]
    economy = numericValues[3] || 0
  }
  
  // Convert overs to balls (4.2 overs = 4*6 + 2 = 26 balls)
  const oversStr = String(overs)
  const oversParts = oversStr.split('.')
  const completedOvers = parseInt(oversParts[0]) || 0
  const extraBalls = parseInt(oversParts[1]) || 0
  const balls = completedOvers * 6 + extraBalls
  
  // Calculate economy if not provided
  if (!economy && overs > 0) {
    economy = runs / overs
  }
  
  // Look for wides and no-balls in any remaining cells
  let wides = 0
  let noBalls = 0
  dataCells.each((_, cell) => {
    const text = $(cell).text().trim().toLowerCase()
    const widesMatch = text.match(/(\d+)\s*w(?:\)|$|\s)/i)
    const nbMatch = text.match(/(\d+)\s*nb/i)
    if (widesMatch) wides = parseInt(widesMatch[1]) || 0
    if (nbMatch) noBalls = parseInt(nbMatch[1]) || 0
  })
  
  return {
    playerName,
    overs,
    balls,
    maidens,
    runs,
    wickets,
    dots,
    wides,
    noBalls,
    economy,
  }
}

/**
 * Parse fielding contributions from dismissal texts
 * Extract catches, run outs, and stumpings
 */
function parseFieldingFromDismissals(battingEntries: ParsedBattingEntry[]): ParsedFieldingEntry[] {
  const fieldingMap = new Map<string, ParsedFieldingEntry>()
  
  battingEntries.forEach(entry => {
    const dismissal = entry.dismissalText.toLowerCase()
    
    // Parse catches: "c PlayerName b Bowler" or "c & b Bowler"
    const catchMatch = dismissal.match(/^c\s+(?:&\s+b\s+)?([a-z\s]+?)(?:\s+b\s+|$)/i) ||
                       dismissal.match(/^c\s+([a-z\s]+?)\s+b\s+/i)
    
    if (catchMatch) {
      let catcher = catchMatch[1].trim()
      // Handle "c & b" (caught and bowled)
      if (dismissal.includes('c & b') || dismissal.includes('c&b')) {
        const bowlerMatch = dismissal.match(/c\s*&\s*b\s+([a-z\s]+)/i)
        if (bowlerMatch) catcher = bowlerMatch[1].trim()
      }
      
      if (catcher && catcher !== 'sub' && catcher !== 'sub)') {
        // Clean catcher name
        catcher = cleanFielderName(catcher)
        if (catcher) {
          const existing = fieldingMap.get(catcher) || {
            playerName: catcher,
            catches: 0,
            runOuts: 0,
            stumpings: 0,
          }
          existing.catches++
          fieldingMap.set(catcher, existing)
        }
      }
    }
    
    // Parse run outs: "run out (PlayerName)" or "run out PlayerName"
    const runOutMatch = dismissal.match(/run\s*out\s*\(?([a-z\s]+?)\)?(?:\s|$)/i)
    if (runOutMatch) {
      let fielder = cleanFielderName(runOutMatch[1].trim())
      if (fielder && fielder !== 'sub') {
        const existing = fieldingMap.get(fielder) || {
          playerName: fielder,
          catches: 0,
          runOuts: 0,
          stumpings: 0,
        }
        existing.runOuts++
        fieldingMap.set(fielder, existing)
      }
    }
    
    // Parse stumpings: "st PlayerName b Bowler"
    const stumpingMatch = dismissal.match(/^st\s+([a-z\s]+?)\s+b\s+/i)
    if (stumpingMatch) {
      let keeper = cleanFielderName(stumpingMatch[1].trim())
      if (keeper) {
        const existing = fieldingMap.get(keeper) || {
          playerName: keeper,
          catches: 0,
          runOuts: 0,
          stumpings: 0,
        }
        existing.stumpings++
        fieldingMap.set(keeper, existing)
      }
    }
  })
  
  return Array.from(fieldingMap.values())
}

/**
 * Clean fielder name from dismissal text
 */
function cleanFielderName(name: string): string {
  return name
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/^(sub|wk|†)\s*/i, '') // Remove sub/wk markers
    .trim()
}

/**
 * Check if dismissal is bowled or LBW
 */
function checkBowledOrLBW(dismissalText: string): boolean {
  const lower = dismissalText.toLowerCase()
  return lower.startsWith('b ') || 
         lower === 'bowled' || 
         lower.includes('lbw') ||
         lower.startsWith('lbw ')
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): string {
  // Handle MM/DD/YYYY format
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [month, day, year] = parts
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return new Date().toISOString().split('T')[0]
}

/**
 * Infer match type from text
 */
function inferMatchType(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('final')) return 'playoff'
  if (lower.includes('semi')) return 'playoff'
  if (lower.includes('playoff')) return 'playoff'
  if (lower.includes('friendly')) return 'friendly'
  if (lower.includes('tournament')) return 'tournament'
  return 'league'
}

/**
 * Infer result from result text
 */
function inferResult(text: string, teams: [string, string]): string {
  const lower = text.toLowerCase()
  if (lower.includes('won')) {
    // Check which team won
    if (lower.includes(teams[0].toLowerCase())) {
      return 'loss' // First team (opponent) won, we lost
    }
    return 'win'
  }
  if (lower.includes('tie') || lower.includes('tied')) return 'tie'
  return 'no_result'
}

/**
 * Generate content hash for duplicate detection
 */
export function generateContentHash(html: string): string {
  // Remove dynamic elements that might change
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  return createHash('sha256').update(cleanHtml).digest('hex')
}

/**
 * Detect which files belong to the same match
 */
export function detectMatchGroup(parsedData: ParsedMatchData[]): Map<string, ParsedMatchData[]> {
  const groups = new Map<string, ParsedMatchData[]>()
  
  parsedData.forEach(data => {
    // Create a key from date + teams
    const key = `${data.date}_${data.teams.sort().join('_vs_')}`
    
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(data)
  })
  
  return groups
}

/**
 * Merge multiple parsed files for the same match
 */
export function mergeParsedMatchData(files: ParsedMatchData[]): ParsedMatchData {
  // Use the file with the most batting entries as the primary
  const primary = files.reduce((best, current) => {
    const currentEntries = current.innings.reduce((sum, inn) => sum + inn.battingEntries.length, 0)
    const bestEntries = best.innings.reduce((sum, inn) => sum + inn.battingEntries.length, 0)
    return currentEntries > bestEntries ? current : best
  })
  
  return primary
}

