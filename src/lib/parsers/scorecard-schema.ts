import { z } from 'zod'

/**
 * What the model transcribes from a scorecard page. Strict structured output:
 * every field is required, "not on the page" is null (or an empty list).
 */
export const HOW_OUT = [
  'not_out',
  'retired_not_out', // retired hurt / retired not out
  'retired_out',
  'bowled',
  'caught',
  'caught_and_bowled',
  'lbw',
  'stumped',
  'run_out',
  'hit_wicket',
  'other',
] as const

const BattingRow = z.object({
  name: z.string().describe('Batter name exactly as shown, without markers such as *, †, (c), (wk)'),
  dismissalText: z.string().describe('Dismissal text exactly as shown, e.g. "c †Arvind A b Trinabh S" or "not out"'),
  howOut: z.enum(HOW_OUT),
  fielders: z
    .array(z.string())
    .describe('Catcher, stumper or run-out fielder(s) named in the dismissal, as written, without markers. Empty if none named.'),
  bowler: z.string().nullable().describe('Bowler credited in the dismissal, as written. null for run outs and not outs.'),
  runs: z.number().int(),
  balls: z.number().int(),
  fours: z.number().int(),
  sixes: z.number().int(),
})

const BowlingRow = z.object({
  name: z.string(),
  overs: z.string().describe('Overs exactly as shown, e.g. "4" or "3.2"'),
  maidens: z.number().int(),
  runs: z.number().int(),
  wickets: z.number().int(),
  dots: z.number().int().nullable(),
  wides: z.number().int().nullable(),
  noBalls: z.number().int().nullable(),
})

const Innings = z.object({
  battingTeam: z.string().describe('Name of the team batting in this innings, as shown'),
  total: z.number().int(),
  wickets: z.number().int(),
  overs: z.string().describe('Overs faced, e.g. "20" or "15.4"'),
  batting: z.array(BattingRow).describe('Only batters who batted, in batting order. Did-not-bat players go in didNotBat.'),
  didNotBat: z.array(z.string()),
  extras: z.object({
    total: z.number().int(),
    wides: z.number().int(),
    noBalls: z.number().int(),
    byes: z.number().int(),
    legByes: z.number().int(),
    penalties: z.number().int(),
  }),
  bowling: z.array(BowlingRow).describe("The bowlers who bowled in this innings (the fielding team's bowlers)"),
})

export const ScorecardSchema = z.object({
  isScorecard: z.boolean().describe('false if the page has no batting and bowling tables (wrong tab, loading page, not cricket)'),
  notScorecardReason: z.string().nullable(),
  date: z.string().nullable().describe('Match date as YYYY-MM-DD, or null if not on the page'),
  competition: z.string().nullable(),
  venue: z.string().nullable(),
  stage: z.string().nullable().describe('Stage or match type text if shown, e.g. "League", "Semi Final", "Friendly"'),
  resultText: z.string().nullable().describe('Result line as shown, e.g. "UNC won by 22 Runs"'),
  innings: z.array(Innings).describe('In the order they were played'),
})

export type Scorecard = z.infer<typeof ScorecardSchema>
export type ScorecardInnings = Scorecard['innings'][number]
