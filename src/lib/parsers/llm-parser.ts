import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { zodTextFormat } from 'openai/helpers/zod'
import { createHash } from 'crypto'
import type { z } from 'zod'
import type { ParsedMatchData } from '@/types/models'
import { ParseError } from './cricclubs-parser'
import { cleanScorecardHtml } from './clean-html'
import { ScorecardSchema, type Scorecard } from './scorecard-schema'
import { checkScorecard } from './scorecard-checks'
import { scorecardToParsedMatch } from './scorecard-convert'

export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-5-5'
export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini'
/** SCORECARD_MODEL wins; otherwise Claude if its key is set, else OpenAI. */
export const scorecardModel = () =>
  process.env.SCORECARD_MODEL || (process.env.ANTHROPIC_API_KEY ? DEFAULT_CLAUDE_MODEL : DEFAULT_OPENAI_MODEL)
const MAX_REPAIRS = 2

const INSTRUCTIONS = `You transcribe a cricket scorecard page into the given schema.

The input is the text of a saved web page. Tables are between [TABLE] and [/TABLE], one row per line, cells separated by " | "; " / " separates pieces of text inside one cell.

Rules:
- Copy names and numbers exactly as they appear. Do not expand, correct or complete names: if a dismissal says "c Arvind A b Trinabh S", the fielder is "Arvind A" and the bowler is "Trinabh S".
- Drop markers attached to names: *, †, (c), (wk), (sub).
- Never calculate or guess a value. If something is not on the page use null, or 0 for an extras component that is not listed.
- "batting" holds only players who batted. Players listed under "Did not bat" (or shown as dnb/absent) go in didNotBat.
- Each innings' "bowling" is the bowling table shown with that innings: the bowlers who bowled to those batters.
- howOut: "c X b Y" caught; "c & b Y" caught_and_bowled (bowler Y, no fielders); "st X b Y" stumped; "b Y" bowled; "lbw b Y" lbw; "run out (X)" or "run out (X/Y)" run_out with every named fielder and bowler null; "hit wicket b Y" hit_wicket; "retired hurt" and "retired not out" retired_not_out; "retired out" retired_out; "not out" not_out.
- A caught dismissal with no catcher named ("c b Y") has an empty fielders list.
- Ignore ball-by-ball, fall of wickets, partnerships, charts, navigation and adverts.
- If the page has no batting and bowling scorecard tables, set isScorecard to false, say why in notScorecardReason, and leave innings empty.`

export interface LlmParseResult {
  parsed: ParsedMatchData
  /** Checks that still fail after the repair turns. Shown to the admin before import. */
  warnings: string[]
  model: string
  repairs: number
}

/** Runs one extraction call. Split out so tests can stub it. */
export type Extractor = (pageText: string, previous?: { card: Scorecard; problems: string[] }) => Promise<Scorecard>

/**
 * One structured-output call. Claude models go to Anthropic, everything else to OpenAI.
 * Shared by the scorecard extraction and the roster name matching.
 */
export async function callStructured<T>(model: string, system: string, user: string, schema: z.ZodType<T>, name: string): Promise<T> {
  try {
    return await callProvider(model, system, user, schema, name)
  } catch (e) {
    throw accountError(e, model.startsWith('claude') ? 'Anthropic' : 'OpenAI') ?? e
  }
}

/** Turn "out of credits" and "bad key" from either provider into an error the upload page can show. */
function accountError(e: unknown, provider: 'Anthropic' | 'OpenAI'): ParseError | null {
  if (!(e instanceof Anthropic.APIError) && !(e instanceof OpenAI.APIError)) return null
  const billing = provider === 'Anthropic' ? 'console.anthropic.com → Billing' : 'platform.openai.com → Billing'
  const type = e instanceof Anthropic.APIError ? e.type : e.code
  // Anthropic: 402 billing_error (older accounts: 400 "credit balance is too low"). OpenAI: 429 insufficient_quota.
  if (e.status === 402 || type === 'billing_error' || type === 'insufficient_quota' || /credit balance|no credits remaining|exceeded your current quota/i.test(e.message)) {
    return new ParseError(
      `Scorecards cannot be read right now: the ${provider} API account is out of credits`,
      'API_CREDITS_EXHAUSTED',
      `Add credits at ${billing}, then upload the file again. Nothing was imported.`
    )
  }
  if (e.status === 401) {
    return new ParseError(
      `Scorecards cannot be read right now: the ${provider} API key was rejected`,
      'API_KEY_INVALID',
      'Check the key in the server environment variables, then upload the file again.'
    )
  }
  return null
}

async function callProvider<T>(model: string, system: string, user: string, schema: z.ZodType<T>, name: string): Promise<T> {
  const noOutput = (why: unknown) => new ParseError('The model did not return a result', 'PARSE_FAILED', `Call ended with: ${why}`)
  if (model.startsWith('claude')) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ParseError('ANTHROPIC_API_KEY is not set', 'PARSE_FAILED', 'Add ANTHROPIC_API_KEY to the server environment to parse scorecards.')
    }
    const response = await new Anthropic().messages.parse({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: zodOutputFormat(schema) },
    })
    if (!response.parsed_output) throw noOutput(response.stop_reason)
    return schema.parse(response.parsed_output)
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new ParseError('OPENAI_API_KEY is not set', 'PARSE_FAILED', 'Add OPENAI_API_KEY to the server environment to parse scorecards.')
  }
  const response = await new OpenAI().responses.parse({
    model,
    instructions: system,
    input: [{ role: 'user', content: user }],
    text: { format: zodTextFormat(schema, name) },
  })
  if (!response.output_parsed) throw noOutput(response.incomplete_details?.reason || response.status)
  return schema.parse(response.output_parsed)
}

/** A repair is one fresh call carrying the earlier attempt and the checks it failed. */
export const extractorFor = (model: string): Extractor => (pageText, previous) =>
  callStructured(
    model,
    INSTRUCTIONS,
    previous
      ? `${pageText}\n\n---\nAn earlier extraction of this page:\n${JSON.stringify(previous.card)}\n\n` +
          'That extraction fails these checks against the page:\n' +
          previous.problems.map(p => `- ${p}`).join('\n') +
          '\n\nRe-read the page and return the full corrected extraction. Change only what the page supports; if the page itself is inconsistent, keep what the page shows.'
      : pageText,
    ScorecardSchema,
    'scorecard'
  )

/**
 * Parse any saved scorecard page: clean the HTML, have the model transcribe it into the schema,
 * check the result in code, and send failed checks back for up to MAX_REPAIRS corrections.
 */
export async function parseScorecardWithLLM(html: string, extractor?: Extractor): Promise<LlmParseResult> {
  if (!html || html.trim().length < 100) {
    throw new ParseError('Invalid HTML content - file appears to be empty or too small', 'INVALID_HTML')
  }
  let pageText: string
  try {
    pageText = cleanScorecardHtml(html)
  } catch (e) {
    throw new ParseError('Could not read the page', 'INVALID_HTML', e instanceof Error ? e.message : undefined)
  }

  const model = scorecardModel()
  const extract = extractor ?? extractorFor(model)

  let card = await extract(pageText)
  let repairs = 0
  let result = checkScorecard(card, pageText)

  const notScorecard = () =>
    new ParseError(
      'This page is not a full scorecard',
      'WRONG_PAGE_TYPE',
      card.notScorecardReason || 'No batting and bowling tables were found. Save the Scorecard tab of the match and upload that.'
    )
  if (!card.isScorecard) throw notScorecard()

  while ((result.fatal.length || result.problems.length) && repairs < MAX_REPAIRS) {
    const next = await extract(pageText, { card, problems: [...result.fatal, ...result.problems] })
    repairs++
    const nextResult = checkScorecard(next, pageText)
    // Keep a repair only if it is not worse
    const score = (r: typeof result) => r.fatal.length * 100 + r.problems.length
    if (score(nextResult) <= score(result)) {
      card = next
      result = nextResult
    } else {
      break
    }
  }

  if (!card.isScorecard) throw notScorecard()
  if (result.fatal.length) {
    const code = result.fatal.some(f => f.includes('date')) ? 'DATE_NOT_FOUND' : 'NO_BATTING_DATA'
    throw new ParseError(result.fatal[0], code, result.fatal.join('; '))
  }

  return { parsed: scorecardToParsedMatch(card), warnings: result.problems, model, repairs }
}

/**
 * Duplicate key built from the match itself, not the file: the same match saved twice, or from a
 * different browser, hashes the same.
 */
export function matchFingerprint(parsed: ParsedMatchData): string {
  const lines = parsed.innings
    .map(i => `${i.total}/${i.wickets}:` + i.battingEntries.map(b => `${b.runs}(${b.balls})`).join(','))
    .sort()
  return createHash('sha256').update(`${parsed.date}|${lines.join('|')}`).digest('hex')
}
