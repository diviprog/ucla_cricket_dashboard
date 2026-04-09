import * as cheerio from 'cheerio'

export type ScorecardFormat = 'cricclubs' | 'criccenter' | 'unknown'

/**
 * Detects the format of a cricket scorecard HTML
 * @param html The HTML content to analyze
 * @returns The detected format type
 */
export function detectScorecardFormat(html: string): ScorecardFormat {
  const $ = cheerio.load(html)

  // Check for CricCenter signatures
  const hasCricCenterHeader = $('.ended-match-summary-header').length > 0
  const hasCricCenterTeamWrap = $('.team-wrap').length > 0
  const hasCricCenterStatsTable = $('.stats-table').length > 0
  const hasCricCenterBrandName = $('.brand-name').text().includes('CRICCENTER')

  if (hasCricCenterHeader || hasCricCenterTeamWrap || hasCricCenterBrandName) {
    return 'criccenter'
  }

  // Check for CricClubs signatures
  // CricClubs typically has specific table structures or classes
  // This is a placeholder - adjust based on actual CricClubs HTML structure
  const hasCricClubsTable = $('table.CricketScorecardTable').length > 0 ||
                            $('div.scorecard').length > 0 ||
                            $('div[class*="cricclubs"]').length > 0

  if (hasCricClubsTable) {
    return 'cricclubs'
  }

  // If we have tables but can't identify the format, check content patterns
  if ($('table').length > 0) {
    // Check if there are batting/bowling stats
    const hasStatsHeaders = $('th').text().toLowerCase().includes('batting') ||
                           $('th').text().toLowerCase().includes('bowling')

    if (hasStatsHeaders && hasCricCenterStatsTable) {
      return 'criccenter'
    }

    if (hasStatsHeaders) {
      // Default to cricclubs for now if we have stats but can't identify
      return 'cricclubs'
    }
  }

  return 'unknown'
}
