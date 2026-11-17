import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { cleanScorecardHtml } from '@/lib/parsers/clean-html'
import { checkScorecard } from '@/lib/parsers/scorecard-checks'
import { scorecardToParsedMatch } from '@/lib/parsers/scorecard-convert'
import { parseScorecardWithLLM, matchFingerprint, type Extractor } from '@/lib/parsers/llm-parser'
import { ParseError } from '@/lib/parsers/cricclubs-parser'
import { extractSides } from '@/lib/import/import-plan'
import type { Scorecard } from '@/lib/parsers/scorecard-schema'

// No network in these tests: the model is stubbed. src/scripts/eval-parser.ts runs the real one.

const html = readFileSync(join(process.cwd(), 'extracted-from-webarchive.html'), 'utf8')
const page = cleanScorecardHtml(html)

type Bat = Scorecard['innings'][number]['batting'][number]
const bat = (name: string, dismissalText: string, howOut: Bat['howOut'], fielders: string[], bowler: string | null, runs: number, balls: number, fours: number, sixes: number): Bat =>
  ({ name, dismissalText, howOut, fielders, bowler, runs, balls, fours, sixes })
const bowl = (name: string, overs: string, dots: number, runs: number, wickets: number) =>
  ({ name, overs, maidens: 0, runs, wickets, dots, wides: null, noBalls: null })

/** The UNC vs UCLA fixture, transcribed by hand the way the model is asked to. */
const correct = (): Scorecard => ({
  isScorecard: true,
  notScorecardReason: null,
  date: '2026-03-12',
  competition: 'CCL Collegiate Cup 2026',
  venue: null,
  stage: 'league',
  resultText: 'University of North Carolina at Chapel Hill won by 22 Runs',
  innings: [
    {
      battingTeam: 'University of North Carolina at Chapel Hill',
      total: 145,
      wickets: 3,
      overs: '10',
      batting: [
        bat('Abhiram Bolisetty', 'b Devansh M', 'bowled', [], 'Devansh M', 80, 26, 11, 5),
        bat('Utkarsh Srivastava', 'c b Naman S', 'caught', [], 'Naman S', 30, 16, 4, 1),
        bat('Smeet Pandit', 'c †Arvind A b Trinabh S', 'caught', ['Arvind A'], 'Trinabh S', 6, 6, 0, 0),
        bat('Rohan Phadke', 'not out', 'not_out', [], null, 22, 9, 4, 0),
        bat('Anirudh Anirudh', 'not out', 'not_out', [], null, 4, 3, 0, 0),
      ],
      didNotBat: ['Tanish Dongre', 'Sanjan Bhoothapuri', 'Rohan Joshi', 'Krish Singhvi', 'Eshaan Raj', 'Khush Patel'],
      extras: { total: 3, wides: 3, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
      bowling: [
        bowl('Naman Satija', '2', 3, 36, 1),
        bowl('Trinabh Sahni', '2', 3, 22, 1),
        bowl('Arya Panjwani', '2', 0, 32, 0),
        bowl('Devansh Mishra', '2', 4, 22, 1),
        bowl('Ayush Monga', '2', 1, 33, 0),
      ],
    },
    {
      battingTeam: 'University of California, Los Angeles',
      total: 123,
      wickets: 7,
      overs: '10',
      batting: [
        bat('Tanmay Desai', 'c Rohan J b Eshaan R', 'caught', ['Rohan J'], 'Eshaan R', 80, 24, 2, 11),
        bat('Trinabh Sahni', 'c Abhiram B b Anirudh A', 'caught', ['Abhiram B'], 'Anirudh A', 3, 6, 0, 0),
        bat('Arya Panjwani', 'c †Utkarsh S b Rohan P', 'caught', ['Utkarsh S'], 'Rohan P', 24, 14, 3, 0),
        bat('Naman Satija', 'b Smeet P', 'bowled', [], 'Smeet P', 1, 3, 0, 0),
        bat('Ayush Monga', 'c Khush P b Anirudh A', 'caught', ['Khush P'], 'Anirudh A', 4, 5, 0, 0),
        bat('Arvind Adavikolanu', 'b Anirudh A', 'bowled', [], 'Anirudh A', 0, 1, 0, 0),
        bat('Devansh Mishra', 'b Anirudh A', 'bowled', [], 'Anirudh A', 0, 1, 0, 0),
        bat('Vardaan Sinha', 'not out', 'not_out', [], null, 1, 4, 0, 0),
        bat('Avyay Toprani', 'not out', 'not_out', [], null, 1, 3, 0, 0),
      ],
      didNotBat: ['Adi Veerappan'],
      extras: { total: 9, wides: 7, noBalls: 1, byes: 1, legByes: 0, penalties: 0 },
      bowling: [
        bowl('Utkarsh Srivastava', '2', 4, 32, 0),
        bowl('Rohan Phadke', '2', 6, 22, 1),
        bowl('Anirudh Anirudh', '2', 6, 11, 4),
        bowl('Tanish Dongre', '2', 0, 38, 0),
        bowl('Eshaan Raj', '1', 2, 14, 1),
        bowl('Smeet Pandit', '1', 1, 5, 1),
      ],
    },
  ],
})

test('cleaning keeps the scorecard rows and drops per-render noise', () => {
  assert.ok(page.length < 10_000, `cleaned page is ${page.length} chars`)
  assert.match(page, /Smeet Pandit \/ c †Arvind A b Trinabh S \| 6 \| 6 \| 0 \| 0/)
  assert.match(page, /Devansh Mishra \| 2 \| 0 \| 4 \| 22 \| 1/)
  assert.match(page, /Source URL: https:\/\/league\.cricclubs\.com/)
  assert.doesNotMatch(page, /data-row-key|<div|function\s*\(/)

  const cc = cleanScorecardHtml(readFileSync(join(process.cwd(), 'src/lib/__tests__/fixtures/criccenter-ucla-vs-asu.html'), 'utf8'))
  assert.match(cc, /2026-03-20T/) // date lives only in <time datetime>
  assert.match(cc, /Arhaan Kohli \| run out \(Viraj Jadhav\) \| 1 \| 4/)
})

test('a correct transcription passes every check', () => {
  assert.deepEqual(checkScorecard(correct(), page), { fatal: [], problems: [] })
})

test('checks catch wrong numbers, invented names and a missing date', () => {
  const wrongRuns = correct()
  wrongRuns.innings[1].batting[0].runs = 8
  assert.match(checkScorecard(wrongRuns, page).problems.join('\n'), /batter runs 42 \+ extras 9 = 51, but the total is 123/)

  const invented = correct()
  invented.innings[0].batting[2].fielders = ['Arvind Adavikolanu Jr']
  assert.match(checkScorecard(invented, page).problems.join('\n'), /"arvind adavikolanu jr" does not appear on the page/)

  const shiftedColumns = correct()
  shiftedColumns.innings[0].bowling[0].wickets = 3 // read Dot as W
  assert.match(checkScorecard(shiftedColumns, page).problems.join('\n'), /bowlers have 5 wickets, but 3 dismissals/)

  const noDate = correct()
  noDate.date = null
  assert.equal(checkScorecard(noDate, page).fatal.length, 1)
})

test('conversion credits fielders and bowlers under their full names', () => {
  const parsed = scorecardToParsedMatch(correct())
  assert.deepEqual(parsed.teams, ['University of North Carolina at Chapel Hill', 'University of California, Los Angeles'])
  assert.equal(parsed.matchType, 'league')

  // "c †Arvind A" is a catch for Arvind Adavikolanu; "c b Naman S" credits no fielder
  assert.deepEqual(parsed.innings[0].fieldingEntries, [{ playerName: 'Arvind Adavikolanu', catches: 1, runOuts: 0, stumpings: 0 }])
  assert.deepEqual(parsed.innings[0].bowlerWicketEntries, [
    { bowlerName: 'Devansh Mishra', dismissalType: 'bowled' },
    { bowlerName: 'Naman Satija', dismissalType: 'caught' },
    { bowlerName: 'Trinabh Sahni', dismissalType: 'caught' },
  ])
  // "Rohan J" is Rohan Joshi from the did-not-bat list, not Rohan Phadke
  assert.deepEqual(parsed.innings[1].fieldingEntries.map(f => f.playerName).sort(), ['Abhiram Bolisetty', 'Khush Patel', 'Rohan Joshi', 'Utkarsh Srivastava'])
  assert.equal(parsed.innings[1].bowlerWicketEntries.filter(w => w.bowlerName === 'Anirudh Anirudh').length, 4)
  assert.deepEqual(parsed.innings[0].bowlingEntries[3], {
    playerName: 'Devansh Mishra', overs: 2, balls: 12, maidens: 0, runs: 22, wickets: 1, dots: 4, wides: 0, noBalls: 0, economy: 11,
  })

  // One row per person in the review list: no short-name duplicates on either side
  const sides = extractSides(parsed)
  assert.equal(sides.players[1].length, 9) // UCLA: 9 batters, 5 of whom bowled, 1 of whom kept
  assert.ok(sides.players.flat().every(p => !/^\S+ \S$/.test(p.name)), 'no "First L" names left')
})

test('ambiguous or unknown short names are left as written', () => {
  const card = correct()
  card.innings[1].batting[0].fielders = ['Rohan'] // Rohan Joshi or Rohan Phadke
  card.innings[1].batting[1].fielders = ['Sub Fielder']
  const names = scorecardToParsedMatch(card).innings[1].fieldingEntries.map(f => f.playerName)
  assert.ok(names.includes('Rohan') && names.includes('Sub Fielder'))
})

test('failed checks go back to the model once, and the corrected card is used', async () => {
  const calls: (string[] | undefined)[] = []
  const extractor: Extractor = async (_text, previous) => {
    calls.push(previous?.problems)
    if (!previous) {
      const bad = correct()
      bad.innings[0].batting[0].runs = 8
      return bad
    }
    return correct()
  }
  const r = await parseScorecardWithLLM(html, extractor)
  assert.equal(r.repairs, 1)
  assert.deepEqual(r.warnings, [])
  assert.equal(calls.length, 2)
  assert.match(calls[1]!.join('\n'), /but the total is 145/)
  assert.equal(r.parsed.innings[0].battingEntries[0].runs, 80)
})

test('checks that still fail after two repairs become warnings, not a silent import', async () => {
  let n = 0
  const extractor: Extractor = async () => {
    n++
    const bad = correct()
    bad.innings[0].batting[0].runs = 8
    return bad
  }
  const r = await parseScorecardWithLLM(html, extractor)
  assert.equal(n, 3)
  // total mismatch, and 11 fours cannot fit in 8 runs
  assert.equal(r.warnings.length, 2)
})

test('a page that is not a scorecard is rejected', async () => {
  const extractor: Extractor = async () => ({ ...correct(), isScorecard: false, notScorecardReason: 'Ball by ball page', innings: [] })
  await assert.rejects(
    () => parseScorecardWithLLM(html, extractor),
    (e: unknown) => e instanceof ParseError && e.code === 'WRONG_PAGE_TYPE' && e.details === 'Ball by ball page'
  )
})

test('fingerprint ignores names and file bytes, changes with the scores', () => {
  const a = scorecardToParsedMatch(correct())
  const renamed = correct()
  renamed.innings[0].batting[0].name = 'A Bolisetty'
  renamed.competition = 'Something else'
  assert.equal(matchFingerprint(a), matchFingerprint(scorecardToParsedMatch(renamed)))
  const different = correct()
  different.innings[0].batting[0].balls = 27
  assert.notEqual(matchFingerprint(a), matchFingerprint(scorecardToParsedMatch(different)))
})

// --- Roster name matching (model proposes, code decides) ---
import { suggestRosterMatches, type NameMatchAnswer } from '@/lib/parsers/name-matcher'

const roster = [
  { id: 'arya', name: 'Arya', aliases: [] },
  { id: 'dev', name: 'Devansh Mishra', aliases: ['Devansh M'] },
  { id: 'kabir', name: 'Kabir', aliases: [] },
]
const U = 'UCLA'
const stub = (matches: NameMatchAnswer['matches']) => async () => ({ matches })

test('model name proposals are kept only when code can vouch for them', async () => {
  const unmatched = ['Arya Panjwani', 'D Mishra', 'Rohan Joshi', 'K Shah', 'Kabir S'].map(name => ({ name, team: U }))
  const got = await suggestRosterMatches(
    unmatched,
    roster,
    new Map(),
    stub([
      { name: 'Arya Panjwani', team: U, player: 1 },
      { name: 'D Mishra', team: U, player: 2 },
      { name: 'Rohan Joshi', team: U, player: 3 }, // no word in common with "Kabir"
      { name: 'K Shah', team: U, player: 99 }, // not a roster number
      { name: 'Kabir S', team: U, player: null },
      { name: 'Someone Else', team: U, player: 1 }, // never asked about
    ])
  )
  assert.deepEqual(Object.fromEntries(got), { 'UCLA\nArya Panjwani': 'arya', 'UCLA\nD Mishra': 'dev' })
})

test('a player already on the sheet, or claimed by two names, is not suggested', async () => {
  const two = await suggestRosterMatches(
    [{ name: 'Kabir Shah', team: U }, { name: 'Kabir Rao', team: U }],
    roster,
    new Map(),
    stub([{ name: 'Kabir Shah', team: U, player: 3 }, { name: 'Kabir Rao', team: U, player: 3 }])
  )
  assert.equal(two.size, 0)
  const taken = await suggestRosterMatches(
    [{ name: 'Arya Panjwani', team: U }],
    roster,
    new Map([[U, new Set(['arya'])]]),
    stub([{ name: 'Arya Panjwani', team: U, player: 1 }])
  )
  assert.equal(taken.size, 0)
})
