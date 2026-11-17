/**
 * Run the model-based parser against the real scorecard fixtures and compare with known facts.
 * Calls the model API (costs money). Run with:
 *   npx tsx --env-file=.env.local src/scripts/eval-parser.ts [model ...]
 */
import { readFileSync } from 'fs'
import { parseScorecardWithLLM, extractorFor, scorecardModel } from '@/lib/parsers/llm-parser'
import type { ParsedMatchData } from '@/types/models'

type Expect = (p: ParsedMatchData) => [string, unknown, unknown][]

const field = (p: ParsedMatchData, innings: number, name: string) =>
  p.innings[innings].fieldingEntries.find(f => f.playerName === name)
const wickets = (p: ParsedMatchData, innings: number, name: string) =>
  p.innings[innings].bowlerWicketEntries.filter(w => w.bowlerName === name).length

const CASES: { file: string; expect: Expect }[] = [
  {
    // New CricClubs layout (league.cricclubs.com)
    file: 'extracted-from-webarchive.html',
    expect: p => [
      ['date', p.date, '2026-03-12'],
      ['teams', p.teams, ['University of North Carolina at Chapel Hill', 'University of California, Los Angeles']],
      ['scores', p.innings.map(i => `${i.total}/${i.wickets}`), ['145/3', '123/7']],
      ['batters', p.innings.map(i => i.battingEntries.length), [5, 9]],
      ['bowlers', p.innings.map(i => i.bowlingEntries.length), [5, 6]],
      ['not outs', p.innings.map(i => i.battingEntries.filter(b => b.notOut).length), [2, 2]],
      ['extras', p.innings.map(i => i.extrasBreakdown), [
        { total: 3, wides: 3, noBalls: 0, byes: 0, legByes: 0 },
        { total: 9, wides: 7, noBalls: 1, byes: 1, legByes: 0 },
      ]],
      ['Tanmay Desai', p.innings[1].battingEntries[0], {
        playerName: 'Tanmay Desai', runs: 80, balls: 24, fours: 2, sixes: 11, notOut: false,
        dismissalText: 'c Rohan J b Eshaan R', battingPosition: 1, isBowledOrLBW: false,
      }],
      ['Devansh bowling', p.innings[0].bowlingEntries.find(b => b.playerName === 'Devansh Mishra'), {
        playerName: 'Devansh Mishra', overs: 2, balls: 12, maidens: 0, runs: 22, wickets: 1, dots: 4, wides: 0, noBalls: 0, economy: 11,
      }],
      // Keeper catch "c †Arvind A", resolved to the full name; "c  b Naman S" credits nobody
      ['UCLA fielding', p.innings[0].fieldingEntries, [{ playerName: 'Arvind Adavikolanu', catches: 1, runOuts: 0, stumpings: 0 }]],
      ['Devansh wickets', wickets(p, 0, 'Devansh Mishra'), 1],
      ['Naman wickets', wickets(p, 0, 'Naman Satija'), 1],
      // Short names in UCLA's dismissals resolve to UNC's full names, including one from the did-not-bat list
      ['Rohan Joshi catch', field(p, 1, 'Rohan Joshi')?.catches, 1],
      ['Utkarsh keeper catch', field(p, 1, 'Utkarsh Srivastava')?.catches, 1],
      ['Anirudh wickets', wickets(p, 1, 'Anirudh Anirudh'), 4],
    ],
  },
  {
    file: 'src/lib/__tests__/fixtures/criccenter-ucla-vs-asu.html',
    expect: p => [
      ['date', p.date, '2026-03-20'],
      ['teams', p.teams, ['UCLA', 'Arizona State University']],
      ['scores', p.innings.map(i => `${i.total}/${i.wickets}`), ['49/10', '50/4']],
      ['batters', p.innings.map(i => i.battingEntries.length), [11, 6]],
      ['not outs', p.innings.map(i => i.battingEntries.filter(b => b.notOut).length), [1, 2]],
      ['extras', p.innings[0].extrasBreakdown, { total: 11, wides: 6, noBalls: 1, byes: 1, legByes: 3 }],
      ['venue', !!p.venue, true],
      ['Aadi Pathak catches', field(p, 0, 'Aadi Pathak')?.catches, 2],
      ['Viraj Jadhav run out', field(p, 0, 'Viraj Jadhav')?.runOuts, 1],
      ['Naman c&b-style catch', field(p, 1, 'Naman Satija')?.catches, 1],
      ['Naman wickets', wickets(p, 1, 'Naman Satija'), 4],
      ['Anshul Kamble wickets', wickets(p, 0, 'Anshul Kamble'), 3],
    ],
  },
]

async function main() {
  const models = process.argv.slice(2).length ? process.argv.slice(2) : [scorecardModel()]
  let failed = 0
  await Promise.all(
    models.flatMap(model =>
      CASES.map(async c => {
        const started = Date.now()
        const tag = `${model} :: ${c.file.split('/').pop()}`
        try {
          const r = await parseScorecardWithLLM(readFileSync(c.file, 'utf8'), extractorFor(model))
          const wrong = c.expect(r.parsed).filter(([, got, want]) => JSON.stringify(got) !== JSON.stringify(want))
          failed += wrong.length
          const lines = [
            `${wrong.length ? 'FAIL' : 'PASS'} ${tag} (${((Date.now() - started) / 1000).toFixed(1)}s, ${r.repairs} repair turn(s))`,
            ...wrong.map(([what, got, want]) => `   ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`),
            ...r.warnings.map(w => `   warning: ${w}`),
          ]
          console.log(lines.join('\n'))
        } catch (e) {
          failed++
          console.log(`ERROR ${tag}: ${e instanceof Error ? e.message : e}`)
        }
      })
    )
  )
  process.exit(failed ? 1 : 0)
}

main()
