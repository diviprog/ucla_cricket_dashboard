import { z } from 'zod'
import { callStructured, scorecardModel } from './llm-parser'
import { normalizePlayerName } from './player-resolver'

/**
 * Second pass for scorecard names the exact matcher (matchPlayerName) could not place:
 * "Arya Panjwani" when the roster has "Arya", "D Mishra" for "Devansh Mishra", a misspelling.
 * The model proposes, code decides: a proposal is dropped unless the two names share a word,
 * and unless it is the only name on that team pointing at that player. What survives is only a
 * prefilled suggestion on the upload page; the admin still confirms it.
 */

export interface RosterEntry {
  id: string
  name: string
  aliases: string[]
}
export interface UnmatchedName {
  name: string
  team: string
}

const MatchSchema = z.object({
  matches: z.array(z.object({ name: z.string(), team: z.string(), player: z.number().int().nullable() })),
})
export type NameMatchAnswer = z.infer<typeof MatchSchema>
export type NameMatchAsker = (prompt: string) => Promise<NameMatchAnswer>

const SYSTEM = `You match player names from a cricket scorecard to a club's roster.

For each scorecard name, give the number of the roster player who is the same person, or null.
- Match only when the scorecard name is plainly a variant of the roster name or one of its aliases: a shortened or missing surname, an initial for a first name, a middle name added or dropped, a small spelling difference.
- A shared first name alone is enough when one side is only that first name (roster "Arya" for scorecard "Arya Panjwani", or scorecard "Sahil" for roster "Sahil Shah") and no other roster player has that first name. Two different surnames are different people.
- If two roster players fit, or you are unsure, answer null. A wrong match puts one player's stats under another, which is worse than no match.
- Many scorecard names belong to the other team and are not on the roster at all: answer null for those.
Return every scorecard name exactly as given, with its team.`

const words = (s: string) => normalizePlayerName(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1)

/** Returns scorecard name+team -> roster id for the proposals that pass the code checks. */
export async function suggestRosterMatches(
  unmatched: UnmatchedName[],
  roster: RosterEntry[],
  /** Roster ids already taken by an exact match, per team. */
  taken: Map<string, Set<string>>,
  ask: NameMatchAsker = prompt => callStructured(scorecardModel(), SYSTEM, prompt, MatchSchema, 'name_matches')
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!unmatched.length || !roster.length) return out

  const prompt =
    'Roster:\n' +
    roster.map((r, i) => `${i + 1}. ${r.name}${r.aliases.length ? ` (also: ${r.aliases.join(', ')})` : ''}`).join('\n') +
    '\n\nScorecard names:\n' +
    unmatched.map(u => `- ${u.name} [team: ${u.team}]`).join('\n')
  const answer = await ask(prompt)

  const key = (u: UnmatchedName) => `${u.team}\n${u.name}`
  const asked = new Set(unmatched.map(key))
  const proposals: { key: string; team: string; id: string }[] = []
  for (const m of answer.matches) {
    const r = m.player === null ? undefined : roster[m.player - 1]
    if (!r || !asked.has(key(m))) continue
    const rosterWords = new Set([r.name, ...r.aliases].flatMap(words))
    if (!words(m.name).some(w => rosterWords.has(w))) continue // no word in common: not a name variant
    if (taken.get(m.team)?.has(r.id)) continue // that player is already on this team's sheet
    proposals.push({ key: key(m), team: m.team, id: r.id })
  }
  // Two names on one team cannot both be the same player; keep neither
  for (const p of proposals) {
    if (proposals.filter(q => q.team === p.team && q.id === p.id).length === 1) out.set(p.key, p.id)
  }
  return out
}
