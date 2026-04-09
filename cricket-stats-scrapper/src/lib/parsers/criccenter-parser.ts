import * as cheerio from 'cheerio'
import crypto from 'crypto'
import {
  ParsedMatchData,
  ParsedBattingEntry,
  ParsedBowlingEntry,
  ParsedFieldingEntry,
  ParsedBowlerWicketEntry,
  ExtrasBreakdown,
} from '@/types/models'

/**
 * Parses a CricCenter scorecard HTML and extracts match data
 * @param html The HTML content from CricCenter
 * @returns Parsed match data
 */
export function parseCricCenterScorecard(html: string): ParsedMatchData {
  const $ = cheerio.load(html)

  // Extract match metadata
  const dateStr = $('time[datetime]').attr('datetime') || new Date().toISOString()
  const date = new Date(dateStr).toISOString().split('T')[0] // Format: YYYY-MM-DD

  const competition = $('.ended-match-summary-title').text().trim()
  const venue = $('.ended-match-summary-venue').text().trim()

  // Extract team names from team list
  const teamNames: string[] = []
  $('.ended-match-team-name').each((_, el) => {
    const name = $(el).text().trim()
    if (name) teamNames.push(name)
  })

  const teams: [string, string] = [
    teamNames[0] || 'Team 1',
    teamNames[1] || 'Team 2',
  ]

  // Extract match result
  const result = $('.match-result span').text().trim()

  // Parse innings data
  const innings: ParsedMatchData['innings'] = []

  // Iterate through each team's scorecard
  $('.team-wrap').each((teamIndex, teamEl) => {
    const $team = $(teamEl)

    // Get team name from the header
    const teamNameText = $team.find('.nav-right-text .text-wrapper').first().text().trim()
    const teamName = teamNameText || teams[teamIndex]

    // Get score and overs
    const scoreText = $team.find('.nav-left-text .text-wrapper-4').text().trim()
    const oversText = $team.find('.nav-left-text .text-wrapper-2').text().trim()

    // Parse score (e.g., "49/10")
    const scoreParts = scoreText.match(/(\d+)\/(\d+)/)
    const total = scoreParts ? parseInt(scoreParts[1]) : 0
    const wickets = scoreParts ? parseInt(scoreParts[2]) : 0

    // Parse overs (e.g., "Overs (15.4)")
    const oversMatch = oversText.match(/(\d+\.?\d*)/)
    const overs = oversMatch ? parseFloat(oversMatch[1]) : 0

    // Parse batting entries
    const battingEntries: ParsedBattingEntry[] = []
    let battingPosition = 1

    $team.find('.table-wrapper').first().find('.stats-table tbody tr').each((_, row) => {
      const $row = $(row)

      // Skip extras and total rows
      if ($row.hasClass('extras-row') || $row.hasClass('total-row')) {
        return
      }

      const tds = $row.find('td')
      if (tds.length < 7) return

      const playerName = $(tds[0]).text().trim()
      const dismissalText = $(tds[1]).text().trim()
      const runs = parseInt($(tds[2]).text().trim()) || 0
      const balls = parseInt($(tds[3]).text().trim()) || 0
      const fours = parseInt($(tds[4]).text().trim()) || 0
      const sixes = parseInt($(tds[5]).text().trim()) || 0

      const notOut = dismissalText.toLowerCase().includes('not out')
      const isBowledOrLBW = dismissalText.toLowerCase().includes('b ') ||
                           dismissalText.toLowerCase().includes('lbw')

      battingEntries.push({
        playerName,
        runs,
        balls,
        fours,
        sixes,
        notOut,
        dismissalText,
        battingPosition: battingPosition++,
        isBowledOrLBW,
      })
    })

    // Parse extras
    let extrasBreakdown: ExtrasBreakdown = {
      total: 0,
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
    }

    const extrasRow = $team.find('.extras-row')
    if (extrasRow.length > 0) {
      const extrasText = extrasRow.find('td').eq(1).text() // e.g., "( nb 1, w 6, b 1, lb 3, pen 0 )"
      const extrasTotal = parseInt(extrasRow.find('td.stats').text().trim()) || 0

      // Parse breakdown: ( nb 1, w 6, b 1, lb 3, pen 0 )
      const nbMatch = extrasText.match(/nb\s+(\d+)/)
      const wMatch = extrasText.match(/w\s+(\d+)/)
      const bMatch = extrasText.match(/b\s+(\d+)/)
      const lbMatch = extrasText.match(/lb\s+(\d+)/)

      extrasBreakdown = {
        total: extrasTotal,
        wides: wMatch ? parseInt(wMatch[1]) : 0,
        noBalls: nbMatch ? parseInt(nbMatch[1]) : 0,
        byes: bMatch ? parseInt(bMatch[1]) : 0,
        legByes: lbMatch ? parseInt(lbMatch[1]) : 0,
      }
    }

    // Parse bowling entries
    const bowlingEntries: ParsedBowlingEntry[] = []

    $team.find('.bowling-stats-table tbody tr').each((_, row) => {
      const $row = $(row)
      const tds = $row.find('td')

      if (tds.length < 11) return

      const playerName = $(tds[0]).text().trim()
      const oversStr = $(tds[1]).text().trim()
      const maidens = parseInt($(tds[2]).text().trim()) || 0
      const runs = parseInt($(tds[3]).text().trim()) || 0
      const wicketsCount = parseInt($(tds[4]).text().trim()) || 0
      const economy = parseFloat($(tds[5]).text().trim()) || 0
      const dots = parseInt($(tds[6]).text().trim()) || 0
      const wides = parseInt($(tds[9]).text().trim()) || 0
      const noBalls = parseInt($(tds[10]).text().trim()) || 0

      // Parse overs (e.g., "4" or "3.2")
      const oversParts = oversStr.split('.')
      const completeOvers = parseInt(oversParts[0]) || 0
      const partialBalls = oversParts.length > 1 ? parseInt(oversParts[1]) : 0
      const totalBalls = completeOvers * 6 + partialBalls

      bowlingEntries.push({
        playerName,
        overs: parseFloat(oversStr) || 0,
        balls: totalBalls,
        maidens,
        runs,
        wickets: wicketsCount,
        dots,
        wides,
        noBalls,
        economy,
      })
    })

    // Parse fielding entries from dismissal text
    const fieldingEntries: ParsedFieldingEntry[] = []
    const fieldingMap = new Map<string, { catches: number; runOuts: number; stumpings: number }>()

    battingEntries.forEach((batting) => {
      const dismissal = batting.dismissalText.toLowerCase()

      // Catches: "c PlayerName b BowlerName"
      const caughtMatch = dismissal.match(/c\s+([^b]+)\s+b/)
      if (caughtMatch) {
        const fielderName = caughtMatch[1].trim()
        const current = fieldingMap.get(fielderName) || { catches: 0, runOuts: 0, stumpings: 0 }
        current.catches++
        fieldingMap.set(fielderName, current)
      }

      // Run outs: "run out (PlayerName)"
      const runOutMatch = dismissal.match(/run\s+out\s*\(([^)]+)\)/)
      if (runOutMatch) {
        const fielderName = runOutMatch[1].trim()
        const current = fieldingMap.get(fielderName) || { catches: 0, runOuts: 0, stumpings: 0 }
        current.runOuts++
        fieldingMap.set(fielderName, current)
      }

      // Stumpings: "st PlayerName b BowlerName"
      const stumpedMatch = dismissal.match(/st\s+([^b]+)\s+b/)
      if (stumpedMatch) {
        const fielderName = stumpedMatch[1].trim()
        const current = fieldingMap.get(fielderName) || { catches: 0, runOuts: 0, stumpings: 0 }
        current.stumpings++
        fieldingMap.set(fielderName, current)
      }
    })

    fieldingMap.forEach((stats, playerName) => {
      fieldingEntries.push({
        playerName,
        catches: stats.catches,
        runOuts: stats.runOuts,
        stumpings: stats.stumpings,
      })
    })

    // Parse bowler wicket types from dismissal text
    const bowlerWicketEntries: ParsedBowlerWicketEntry[] = []

    battingEntries.forEach((batting) => {
      const dismissal = batting.dismissalText.toLowerCase()

      // Extract bowler name
      let bowlerName = ''
      let dismissalType: ParsedBowlerWicketEntry['dismissalType'] = 'other'

      // "b BowlerName" or "bowled BowlerName"
      const bowledMatch = dismissal.match(/\bb\s+([^,]+)/) || dismissal.match(/bowled\s+([^,]+)/)
      if (bowledMatch) {
        bowlerName = bowledMatch[1].trim()
        dismissalType = 'bowled'
      }

      // "c FielderName b BowlerName"
      const caughtMatch = dismissal.match(/c\s+[^b]+b\s+([^,]+)/)
      if (caughtMatch) {
        bowlerName = caughtMatch[1].trim()
        dismissalType = 'caught'
      }

      // "lbw b BowlerName" or "lbw BowlerName"
      const lbwMatch = dismissal.match(/lbw\s+(?:b\s+)?([^,]+)/)
      if (lbwMatch) {
        bowlerName = lbwMatch[1].trim()
        dismissalType = 'lbw'
      }

      // "st FielderName b BowlerName"
      const stumpedMatch = dismissal.match(/st\s+[^b]+b\s+([^,]+)/)
      if (stumpedMatch) {
        bowlerName = stumpedMatch[1].trim()
        dismissalType = 'stumped'
      }

      // "hit wicket b BowlerName"
      const hitWicketMatch = dismissal.match(/hit\s+wicket\s+(?:b\s+)?([^,]+)/)
      if (hitWicketMatch) {
        bowlerName = hitWicketMatch[1].trim()
        dismissalType = 'hit_wicket'
      }

      if (bowlerName) {
        bowlerWicketEntries.push({
          bowlerName,
          dismissalType,
        })
      }
    })

    innings.push({
      team: teamName,
      battingEntries,
      bowlingEntries,
      fieldingEntries,
      bowlerWicketEntries,
      total,
      wickets,
      overs,
      extras: extrasBreakdown.total,
      extrasBreakdown,
    })
  })

  return {
    date,
    teams,
    venue: venue || undefined,
    competition: competition || undefined,
    matchType: undefined, // Not always available in CricCenter HTML
    result: result || undefined,
    innings,
  }
}

/**
 * Generates a content hash for duplicate detection
 * @param html The HTML content
 * @returns SHA-256 hash of the content
 */
export function generateContentHash(html: string): string {
  return crypto.createHash('sha256').update(html).digest('hex')
}
