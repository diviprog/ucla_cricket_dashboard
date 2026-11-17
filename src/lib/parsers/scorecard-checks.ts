import type { Scorecard } from './scorecard-schema'

/** Dismissals credited to a bowler. */
const BOWLER_WICKET = new Set(['bowled', 'caught', 'caught_and_bowled', 'lbw', 'stumped', 'hit_wicket'])
const NOT_OUT = new Set(['not_out', 'retired_not_out'])

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

export interface CheckResult {
  /** Nothing usable was extracted; do not import. */
  fatal: string[]
  /** Numbers or names that do not add up. Sent back to the model, then shown to the admin. */
  problems: string[]
}

/**
 * Deterministic checks on an extracted scorecard against cricket arithmetic and the page text.
 * These are what make a model-based parser safe to import from.
 */
export function checkScorecard(card: Scorecard, pageText: string): CheckResult {
  const fatal: string[] = []
  const problems: string[] = []
  const page = norm(pageText)

  if (!card.date || !/^\d{4}-\d{2}-\d{2}$/.test(card.date) || isNaN(new Date(card.date).getTime())) {
    fatal.push('No valid match date (YYYY-MM-DD) was found')
  } else if (!page.includes(card.date.slice(0, 4))) {
    problems.push(`Date ${card.date}: the year does not appear anywhere on the page`)
  }
  if (card.innings.length < 1 || card.innings.length > 2) {
    fatal.push(`Expected 1 or 2 innings, found ${card.innings.length}`)
  }
  if (card.innings.some(i => i.batting.length === 0)) fatal.push('An innings has no batters')

  card.innings.forEach((inn, idx) => {
    const label = `Innings ${idx + 1} (${inn.battingTeam})`
    const x = inn.extras

    const batRuns = inn.batting.reduce((s, b) => s + b.runs, 0)
    if (batRuns + x.total !== inn.total) {
      problems.push(`${label}: batter runs ${batRuns} + extras ${x.total} = ${batRuns + x.total}, but the total is ${inn.total}`)
    }
    const parts = x.wides + x.noBalls + x.byes + x.legByes + x.penalties
    if (parts !== x.total) problems.push(`${label}: extras breakdown adds to ${parts}, but extras total is ${x.total}`)

    const out = inn.batting.filter(b => !NOT_OUT.has(b.howOut)).length
    if (out !== inn.wickets) problems.push(`${label}: ${out} batters are out, but the score shows ${inn.wickets} wickets`)

    if (inn.bowling.length > 0) {
      const credited = inn.batting.filter(b => BOWLER_WICKET.has(b.howOut)).length
      const taken = inn.bowling.reduce((s, b) => s + b.wickets, 0)
      if (credited !== taken) {
        problems.push(`${label}: bowlers have ${taken} wickets, but ${credited} dismissals are credited to a bowler`)
      }
      const conceded = inn.bowling.reduce((s, b) => s + b.runs, 0)
      const expected = inn.total - x.byes - x.legByes - x.penalties
      if (conceded !== expected) {
        problems.push(`${label}: bowlers conceded ${conceded}, expected ${expected} (total minus byes, leg byes and penalties)`)
      }
    }

    for (const b of inn.batting) {
      if (BOWLER_WICKET.has(b.howOut) && !b.bowler) problems.push(`${label}: ${b.name} is ${b.howOut} but has no bowler`)
      if (b.fours * 4 + b.sixes * 6 > b.runs) problems.push(`${label}: ${b.name} has more boundary runs than runs`)
    }

    // Anything the model names must be on the page
    const names = [
      inn.battingTeam,
      ...inn.batting.flatMap(b => [b.name, ...b.fielders, ...(b.bowler ? [b.bowler] : [])]),
      ...inn.didNotBat,
      ...inn.bowling.map(b => b.name),
    ]
    for (const n of new Set(names.map(norm))) {
      if (n && !page.includes(n)) problems.push(`${label}: the name "${n}" does not appear on the page`)
    }
  })

  return { fatal, problems }
}
