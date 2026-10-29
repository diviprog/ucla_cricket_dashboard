/**
 * Pure (no DB) logic for importing a parsed scorecard:
 * - extractSides: which scorecard names played for which team, and in what role
 * - buildImportPlan: given our side(s) and the admin's per-name decisions, the rows to write
 *
 * Side convention: side i = the team that batted in innings i (innings[i].team).
 *
 * Who fielded in innings i? The other side, 1 - i. That is certain for fieldingEntries and
 * bowlerWicketEntries, because both are derived from the dismissal text of innings i's batters.
 * bowlingEntries come from the bowling table rendered under innings i. In both parsers that table
 * lists the bowlers who bowled TO innings i's batters, i.e. side 1 - i (checked against the real
 * CricCenter fixture and against every match already imported into prod). The CricClubs parser has
 * a fallback that searches the parent container, which could hand back a table from the wrong
 * innings, so resolveBowlingSides cross-checks the names against the batting lists.
 */
import type {
  ParsedMatchData,
  ParsedBattingEntry,
  ParsedBowlingEntry,
  ParsedBowlerWicketEntry,
} from '@/types/models'
import { normalizePlayerName } from '@/lib/parsers/player-resolver'

export type Side = 0 | 1
export type OurSide = Side | 'both'
export type Role = 'bat' | 'bowl' | 'field'

export interface SidePlayer {
  name: string // scorecard name as shown (best-cased variant)
  roles: Role[]
}

export interface MatchSides {
  teams: [string, string] // teams[i] batted in innings i
  players: [SidePlayer[], SidePlayer[]]
  /** Side whose bowlers are in innings[i].bowlingEntries; null = ignore that table (duplicate). */
  bowlingSideOfInnings: (Side | null)[]
  warnings: string[]
}

/** Returned by /api/parse for each scorecard name, to prefill the review UI. */
export type PlayerSuggestion =
  | { type: 'existing'; playerId: string; playerName: string; isUcla: boolean }
  | { type: 'new' }

export type PlayerDecision =
  | { action: 'link'; playerId: string }
  | { action: 'new_ucla' }
  | { action: 'guest' }

export interface RosterPlayer {
  id: string
  name: string
  is_ucla: boolean
}

export interface Roster {
  players: RosterPlayer[]
  aliases: { alias: string; player_id: string }[]
}

/** A player row the import writes against: an existing id, or one created in this import. */
export type PlayerRef = { kind: 'existing'; playerId: string } | { kind: 'new'; key: string }

export interface ImportPlan {
  match: {
    our_team_name: string
    opponent: string
    result: 'win' | 'loss' | 'tie' | 'no_result'
    our_score: string | null
    opponent_score: string | null
    our_extras_total: number
    our_extras_wides: number
    our_extras_no_balls: number
    our_extras_byes: number
    our_extras_leg_byes: number
    /** Set only for intrasquad; otherwise the caller's chosen match type is used. */
    match_type?: 'intrasquad'
  }
  newPlayers: { key: string; name: string; isUcla: boolean }[]
  aliases: { playerId: string; alias: string }[]
  /** teamSide is relative to the match row: 0 = our_team_name, 1 = opponent. */
  batting: { player: PlayerRef; scorecardName: string; teamSide: Side; entry: ParsedBattingEntry }[]
  bowling: { player: PlayerRef; scorecardName: string; teamSide: Side; entry: ParsedBowlingEntry }[]
  fielding: { player: PlayerRef; teamSide: Side; catches: number; runOuts: number; stumpings: number }[]
  wicketTypes: { player: PlayerRef; dismissalType: ParsedBowlerWicketEntry['dismissalType']; count: number }[]
}

export type PlanResult =
  | { ok: true; plan: ImportPlan }
  | { ok: false; error: string; missing?: string[] }

export function nameKey(name: string): string {
  return normalizePlayerName(name).toLowerCase()
}

const hasLetters = (name: string) => /[a-z]/i.test(name)

/**
 * Decide which side each innings' bowling table belongs to.
 * Default: innings i's table holds side (1 - i)'s bowlers. Overridden only when the names clearly
 * say otherwise (they overlap more with innings i's own batters than with the other side's).
 * If both innings carry the identical table (CricClubs parent-container fallback), keep one copy.
 */
export function resolveBowlingSides(parsed: ParsedMatchData): { sides: (Side | null)[]; warnings: string[] } {
  const inn = parsed.innings
  const warnings: string[] = []
  const sides: (Side | null)[] = inn.map((_, i) => (1 - i) as Side)
  if (inn.length !== 2) return { sides, warnings }

  const batters = inn.map(i => new Set(i.battingEntries.map(e => nameKey(e.playerName))))
  const bowlers = inn.map(i => i.bowlingEntries.map(e => nameKey(e.playerName)))
  const overlap = (names: string[], set: Set<string>) => names.filter(n => set.has(n)).length

  const sameTable =
    bowlers[0].length > 0 &&
    bowlers[0].length === bowlers[1].length &&
    bowlers[0].every((n, k) => n === bowlers[1][k])

  if (sameTable) {
    // One real table, attached to both innings. Its bowlers are whichever side they batted for.
    const own0 = overlap(bowlers[0], batters[0])
    const own1 = overlap(bowlers[0], batters[1])
    const bowlersSide: Side = own0 > own1 ? 0 : 1
    // They bowled in the other side's innings; keep that innings' copy only.
    const keepInnings = 1 - bowlersSide
    sides[keepInnings] = bowlersSide
    sides[1 - keepInnings] = null
    warnings.push(
      `Both innings had the same bowling table; counted it once, for ${inn[bowlersSide].team}.` +
        (own0 === own1 ? ' Could not confirm the side from batting names, please check the bowlers.' : '')
    )
    return { sides, warnings }
  }

  for (let i = 0; i < 2; i++) {
    const own = overlap(bowlers[i], batters[i])
    const other = overlap(bowlers[i], batters[1 - i])
    if (own > other) {
      sides[i] = i as Side
      warnings.push(
        `The bowling table under ${inn[i].team}'s innings looks like ${inn[i].team}'s own bowlers; assigned them to ${inn[i].team}.`
      )
    }
  }
  return { sides, warnings }
}

export function extractSides(parsed: ParsedMatchData): MatchSides {
  const inn = parsed.innings
  if (inn.length === 0 || inn.length > 2) {
    throw new Error(`Expected 1 or 2 innings in the scorecard, found ${inn.length}`)
  }
  const teams: [string, string] = [
    inn[0].team,
    inn[1]?.team ?? parsed.teams.find(t => t !== inn[0].team) ?? parsed.teams[1],
  ]
  const { sides: bowlingSideOfInnings, warnings } = resolveBowlingSides(parsed)

  const acc: [Map<string, SidePlayer>, Map<string, SidePlayer>] = [new Map(), new Map()]
  const add = (side: Side, rawName: string, role: Role) => {
    const name = normalizePlayerName(rawName)
    if (!name || !hasLetters(name)) return
    const key = name.toLowerCase()
    const existing = acc[side].get(key)
    if (!existing) {
      acc[side].set(key, { name, roles: [role] })
      return
    }
    if (!existing.roles.includes(role)) existing.roles.push(role)
    // Fielder names come lowercased from dismissal text; prefer a properly cased variant.
    if (existing.name === existing.name.toLowerCase() && name !== name.toLowerCase()) existing.name = name
  }

  inn.forEach((innings, i) => {
    const battingSide = i as Side
    const fieldingSide = (1 - i) as Side
    innings.battingEntries.forEach(e => add(battingSide, e.playerName, 'bat'))
    const bowlingSide = bowlingSideOfInnings[i]
    if (bowlingSide !== null) innings.bowlingEntries.forEach(e => add(bowlingSide, e.playerName, 'bowl'))
    innings.bowlerWicketEntries.forEach(e => add(fieldingSide, e.bowlerName, 'bowl'))
    innings.fieldingEntries.forEach(e => add(fieldingSide, e.playerName, 'field'))
  })

  const roleOrder: Role[] = ['bat', 'bowl', 'field']
  const list = (m: Map<string, SidePlayer>) =>
    Array.from(m.values()).map(p => ({ ...p, roles: roleOrder.filter(r => p.roles.includes(r)) }))

  return { teams, players: [list(acc[0]), list(acc[1])], bowlingSideOfInnings, warnings }
}

const refId = (ref: PlayerRef) => (ref.kind === 'existing' ? `id:${ref.playerId}` : `new:${ref.key}`)

export function buildImportPlan(
  parsed: ParsedMatchData,
  ourSide: OurSide,
  decisions: Record<string, PlayerDecision>,
  roster: Roster
): PlanResult {
  if (ourSide !== 0 && ourSide !== 1 && ourSide !== 'both') {
    return { ok: false, error: "ourSide must be 0, 1 or 'both'" }
  }
  let sides: MatchSides
  try {
    sides = extractSides(parsed)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not read the innings' }
  }
  const ourSides: Side[] = ourSide === 'both' ? [0, 1] : [ourSide]
  const isOurs = (s: Side | null) => s !== null && ourSides.includes(s)
  const teamSide = (s: Side): Side => (ourSide === 'both' ? s : 0)

  // Decisions, keyed case-insensitively
  const decisionByKey = new Map<string, PlayerDecision>()
  for (const [name, d] of Object.entries(decisions || {})) decisionByKey.set(nameKey(name), d)

  const ourPlayers = new Map<string, SidePlayer>()
  for (const s of ourSides) for (const p of sides.players[s]) if (!ourPlayers.has(nameKey(p.name))) ourPlayers.set(nameKey(p.name), p)

  const missing = Array.from(ourPlayers.values())
    .filter(p => !decisionByKey.has(nameKey(p.name)))
    .map(p => p.name)
  if (missing.length > 0) {
    return { ok: false, error: `No decision for: ${missing.join(', ')}`, missing }
  }

  // Resolve every name on our side(s) to a player ref
  const playersById = new Map(roster.players.map(p => [p.id, p]))
  const aliasOwner = new Map(roster.aliases.map(a => [nameKey(a.alias), a.player_id]))
  const refs = new Map<string, PlayerRef>()
  const newPlayers: ImportPlan['newPlayers'] = []
  const aliases: ImportPlan['aliases'] = []

  for (const [key, p] of ourPlayers) {
    const d = decisionByKey.get(key)!
    if (d.action === 'link') {
      const target = playersById.get(d.playerId)
      if (!target) return { ok: false, error: `${p.name}: linked player ${d.playerId} does not exist` }
      refs.set(key, { kind: 'existing', playerId: target.id })
      if (nameKey(target.name) !== key && !aliasOwner.has(key)) {
        aliases.push({ playerId: target.id, alias: p.name })
        aliasOwner.set(key, target.id)
      }
    } else if (d.action === 'guest') {
      const existingGuest = roster.players.find(
        r => !r.is_ucla && (nameKey(r.name) === key || aliasOwner.get(key) === r.id)
      )
      if (existingGuest) {
        refs.set(key, { kind: 'existing', playerId: existingGuest.id })
      } else {
        refs.set(key, { kind: 'new', key })
        newPlayers.push({ key, name: p.name, isUcla: false })
      }
    } else if (d.action === 'new_ucla') {
      refs.set(key, { kind: 'new', key })
      newPlayers.push({ key, name: p.name, isUcla: true })
    } else {
      return { ok: false, error: `${p.name}: unknown action` }
    }
  }
  const refFor = (name: string) => refs.get(nameKey(name))

  const batting: ImportPlan['batting'] = []
  const bowling: ImportPlan['bowling'] = []
  const fieldingAgg = new Map<string, ImportPlan['fielding'][number]>()
  const wicketAgg = new Map<string, ImportPlan['wicketTypes'][number]>()

  parsed.innings.forEach((innings, i) => {
    const battingSide = i as Side
    const fieldingSide = (1 - i) as Side

    if (isOurs(battingSide)) {
      for (const entry of innings.battingEntries) {
        const player = refFor(entry.playerName)
        if (player) batting.push({ player, scorecardName: entry.playerName, teamSide: teamSide(battingSide), entry })
      }
    }

    const bowlingSide = sides.bowlingSideOfInnings[i]
    if (bowlingSide !== null && isOurs(bowlingSide)) {
      for (const entry of innings.bowlingEntries) {
        const player = refFor(entry.playerName)
        if (player) bowling.push({ player, scorecardName: entry.playerName, teamSide: teamSide(bowlingSide), entry })
      }
    }

    if (isOurs(fieldingSide)) {
      for (const f of innings.fieldingEntries) {
        const player = refFor(f.playerName)
        if (!player) continue
        const id = refId(player)
        const row = fieldingAgg.get(id) || { player, teamSide: teamSide(fieldingSide), catches: 0, runOuts: 0, stumpings: 0 }
        row.catches += f.catches
        row.runOuts += f.runOuts
        row.stumpings += f.stumpings
        fieldingAgg.set(id, row)
      }
      for (const w of innings.bowlerWicketEntries) {
        const player = refFor(w.bowlerName)
        if (!player) continue
        const id = `${refId(player)}|${w.dismissalType}`
        const row = wicketAgg.get(id) || { player, dismissalType: w.dismissalType, count: 0 }
        row.count++
        wicketAgg.set(id, row)
      }
    }
  })

  // batting/bowling are unique per (match, player): two scorecard names on one player is a mistake
  for (const [label, rows] of [['batted', batting], ['bowled', bowling]] as const) {
    const seen = new Map<string, string>()
    for (const r of rows) {
      const id = refId(r.player)
      if (seen.has(id)) {
        return { ok: false, error: `${seen.get(id)} and ${r.scorecardName} both ${label} but are linked to the same player` }
      }
      seen.set(id, r.scorecardName)
    }
  }

  // Match row
  const inn = parsed.innings
  const score = (i: number) => (inn[i] ? `${inn[i].total}/${inn[i].wickets}` : null)
  const extrasOf = (i: number) => {
    const x = inn[i]
    return {
      our_extras_total: x?.extrasBreakdown?.total || x?.extras || 0,
      our_extras_wides: x?.extrasBreakdown?.wides || 0,
      our_extras_no_balls: x?.extrasBreakdown?.noBalls || 0,
      our_extras_byes: x?.extrasBreakdown?.byes || 0,
      our_extras_leg_byes: x?.extrasBreakdown?.legByes || 0,
    }
  }

  let match: ImportPlan['match']
  if (ourSide === 'both') {
    match = {
      our_team_name: sides.teams[0],
      opponent: sides.teams[1],
      result: 'no_result',
      our_score: score(0),
      opponent_score: score(1),
      ...extrasOf(0),
      match_type: 'intrasquad',
    }
  } else {
    const us = ourSide
    const them = 1 - us
    let result: ImportPlan['match']['result'] = 'no_result'
    if (inn[us] && inn[them]) {
      result = inn[us].total > inn[them].total ? 'win' : inn[us].total < inn[them].total ? 'loss' : 'tie'
    }
    match = {
      our_team_name: sides.teams[us],
      opponent: sides.teams[them],
      result,
      our_score: score(us),
      opponent_score: score(them),
      ...extrasOf(us),
    }
  }

  return {
    ok: true,
    plan: {
      match,
      newPlayers,
      aliases,
      batting,
      bowling,
      fielding: Array.from(fieldingAgg.values()),
      wicketTypes: Array.from(wicketAgg.values()),
    },
  }
}
