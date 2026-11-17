import type {
  ParsedMatchData,
  ParsedBattingEntry,
  ParsedBowlingEntry,
  ParsedFieldingEntry,
  ParsedBowlerWicketEntry,
} from '@/types/models'
import type { Scorecard } from './scorecard-schema'

const clean = (s: string) => s.replace(/[*†‡]/g, '').replace(/\((c|wk|c & wk|sub)\)/gi, '').replace(/\s+/g, ' ').trim()
const key = (s: string) => clean(s).toLowerCase()

function oversToBalls(overs: string): { overs: number; balls: number } {
  const [whole, part] = overs.trim().split('.')
  const o = parseInt(whole) || 0
  const b = parseInt(part) || 0
  return { overs: parseFloat(overs) || 0, balls: o * 6 + b }
}

function matchTypeFromStage(stage: string | null): string | undefined {
  if (!stage) return undefined
  const s = stage.toLowerCase()
  if (/final|semi|playoff|knockout|eliminator/.test(s)) return 'playoff'
  if (s.includes('friendly')) return 'friendly'
  if (s.includes('tournament')) return 'tournament'
  if (s.includes('league')) return 'league'
  return undefined
}

/**
 * Dismissal text uses short names ("c Arvind A b Trinabh S") while the batting and bowling tables
 * use full ones ("Arvind Adavikolanu"). Map a short name to the one full name on that side it can
 * mean, so one person is one row in the review list. Ambiguous or unknown names are left alone.
 */
function fullNameResolver(sideNames: string[]) {
  const full = Array.from(new Map(sideNames.map(n => [key(n), clean(n)])).values())
  return (raw: string): string => {
    const name = clean(raw)
    const k = name.toLowerCase()
    if (full.some(f => f.toLowerCase() === k)) return full.find(f => f.toLowerCase() === k)!
    const parts = k.split(' ')
    const candidates = full.filter(f => {
      const fp = f.toLowerCase().split(' ')
      if (fp.length < 2 || fp[0] !== parts[0]) return false
      if (parts.length === 1) return true // "Kabir" -> "Kabir Shah"
      const last = parts[parts.length - 1].replace(/\.$/, '')
      return last.length === 1 && fp[fp.length - 1].startsWith(last) // "Arvind A" -> "Arvind Adavikolanu"
    })
    return candidates.length === 1 ? candidates[0] : name
  }
}

/** Model output -> the ParsedMatchData shape the import plan already consumes. */
export function scorecardToParsedMatch(card: Scorecard): ParsedMatchData {
  if (!card.date) throw new Error('Scorecard has no date')
  const inn = card.innings

  // Everyone known to be on side i (the team batting in innings i): its batters, its did-not-bat
  // list, and the bowlers in the other innings' bowling table.
  const sideNames = (i: number) => [
    ...(inn[i]?.batting.map(b => b.name) || []),
    ...(inn[i]?.didNotBat || []),
    ...(inn[1 - i]?.bowling.map(b => b.name) || []),
  ]

  const innings: ParsedMatchData['innings'] = inn.map((x, i) => {
    // Fielders and bowlers in innings i's dismissals belong to the other side
    const resolve = fullNameResolver([...sideNames(1 - i), ...x.bowling.map(b => b.name)])

    const battingEntries: ParsedBattingEntry[] = x.batting.map((b, pos) => ({
      playerName: clean(b.name),
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      notOut: b.howOut === 'not_out' || b.howOut === 'retired_not_out',
      dismissalText: b.dismissalText,
      battingPosition: pos + 1,
      isBowledOrLBW: b.howOut === 'bowled' || b.howOut === 'lbw',
    }))

    const bowlingEntries: ParsedBowlingEntry[] = x.bowling.map(b => {
      const { overs, balls } = oversToBalls(b.overs)
      return {
        playerName: clean(b.name),
        overs,
        balls,
        maidens: b.maidens,
        runs: b.runs,
        wickets: b.wickets,
        dots: b.dots ?? 0,
        wides: b.wides ?? 0,
        noBalls: b.noBalls ?? 0,
        economy: balls > 0 ? Math.round((b.runs / (balls / 6)) * 100) / 100 : 0,
      }
    })

    const fielding = new Map<string, ParsedFieldingEntry>()
    const credit = (raw: string, what: 'catches' | 'runOuts' | 'stumpings') => {
      const name = resolve(raw)
      if (!name || /^sub$/i.test(name)) return
      const row = fielding.get(name.toLowerCase()) || { playerName: name, catches: 0, runOuts: 0, stumpings: 0 }
      row[what]++
      fielding.set(name.toLowerCase(), row)
    }
    const bowlerWicketEntries: ParsedBowlerWicketEntry[] = []
    const WICKET_TYPE: Record<string, ParsedBowlerWicketEntry['dismissalType']> = {
      bowled: 'bowled',
      caught: 'caught',
      caught_and_bowled: 'caught',
      lbw: 'lbw',
      stumped: 'stumped',
      hit_wicket: 'hit_wicket',
    }

    for (const b of x.batting) {
      if (b.howOut === 'caught' && b.fielders[0]) credit(b.fielders[0], 'catches')
      if (b.howOut === 'caught_and_bowled' && b.bowler) credit(b.bowler, 'catches')
      if (b.howOut === 'stumped' && b.fielders[0]) credit(b.fielders[0], 'stumpings')
      if (b.howOut === 'run_out') b.fielders.forEach(f => credit(f, 'runOuts'))
      const type = WICKET_TYPE[b.howOut]
      if (type && b.bowler) bowlerWicketEntries.push({ bowlerName: resolve(b.bowler), dismissalType: type })
    }

    return {
      team: x.battingTeam.trim(),
      battingEntries,
      bowlingEntries,
      fieldingEntries: Array.from(fielding.values()),
      bowlerWicketEntries,
      total: x.total,
      wickets: x.wickets,
      overs: parseFloat(x.overs) || 0,
      extras: x.extras.total,
      extrasBreakdown: {
        total: x.extras.total,
        wides: x.extras.wides,
        noBalls: x.extras.noBalls,
        byes: x.extras.byes,
        legByes: x.extras.legByes,
      },
    }
  })

  return {
    date: card.date,
    teams: [innings[0]?.team ?? 'Team 1', innings[1]?.team ?? 'Team 2'],
    venue: card.venue || undefined,
    competition: card.competition || undefined,
    matchType: matchTypeFromStage(card.stage),
    result: card.resultText || undefined,
    innings,
  }
}
