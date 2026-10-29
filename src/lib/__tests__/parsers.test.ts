import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isNotOutDismissal, isDidNotBat } from '@/lib/parsers/dismissal'
import { parseCricClubsScorecard, ParseError } from '@/lib/parsers/cricclubs-parser'
import { parseCricCenterScorecard } from '@/lib/parsers/criccenter-parser'
import { detectScorecardFormat } from '@/lib/parsers/format-detector'

test('not-out rule on real dismissal strings', () => {
  for (const s of ['not out', 'Not Out', 'retired hurt', 'Retired Hurt', 'retired not out', 'retd hurt']) {
    assert.equal(isNotOutDismissal(s), true, s)
  }
  for (const s of ['Retired Out', 'retired out', 'b Tanmay D', 'c Naman S b Tanmay D', 'run out (Devansh M)', 'lbw b Rohan M', '']) {
    assert.equal(isNotOutDismissal(s), false, s)
  }
})

test('did-not-bat rule', () => {
  for (const s of ['dnb', 'DNB', 'did not bat', 'Did not bat', 'absent', 'absent hurt']) {
    assert.equal(isDidNotBat(s), true, s)
  }
  for (const s of ['not out', 'retired hurt', 'b Absentee']) {
    assert.equal(isDidNotBat(s), false, s)
  }
})

// Minimal CricClubs Full Scorecard in the legacy layout the parser targets
function cricClubsHtml(dateHeader: string): string {
  const bat = (name: string, dismissal: string, r: number, b: number) =>
    `<tr><th><a href="viewPlayer.do?id=1"><b>${name}</b></a></th><th>${dismissal}</th><th>${r}</th><th>${b}</th><th>0</th><th>0</th><th>0</th></tr>`
  return `<!-- saved from url=(0080)https://cricclubs.com/CCL/fullScorecard.do?matchId=1 -->
<html><head><title>League: UNC vs UCLA - Collegiate Cricket League</title></head><body>
<div class="ms-league-name">League <span>${dateHeader}</span></div>
<div id="ballByBallTeam1"><table><tr><th>UCLA innings (20 overs)</th></tr></table>
<div class="match-table-innings"><table><thead><tr><th>Batting</th><th></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>
${bat('Naman Satija', 'c Raj K b Tom J', 20, 15)}
${bat('Devansh Mishra', 'not out', 30, 22)}
${bat('Deva Yarlagadda', 'retired hurt', 12, 10)}
${bat('Dhruv Patel', 'Retired Out', 5, 6)}
${bat('Sahil Shah', 'dnb', 0, 0)}
</tbody></table></div></div></body></html>`
}

test('CricClubs parser: date, not-outs, retired and dnb rows', () => {
  const data = parseCricClubsScorecard(cricClubsHtml('03/12/2026'))
  assert.equal(data.date, '2026-03-12')
  const entries = data.innings[0].battingEntries
  assert.deepEqual(entries.map(e => e.playerName), ['Naman Satija', 'Devansh Mishra', 'Deva Yarlagadda', 'Dhruv Patel'])
  assert.deepEqual(entries.map(e => e.notOut), [false, true, true, false])
})

test('CricClubs parser throws ParseError when the date is missing', () => {
  assert.throws(
    () => parseCricClubsScorecard(cricClubsHtml('')),
    (err: unknown) => err instanceof ParseError && err.code === 'DATE_NOT_FOUND'
  )
})

test('CricCenter parser throws ParseError when the date is missing', () => {
  const html = '<html><body><div class="team-wrap"></div><p>' + 'x'.repeat(200) + '</p></body></html>'
  assert.throws(
    () => parseCricCenterScorecard(html),
    (err: unknown) => err instanceof ParseError && err.code === 'DATE_NOT_FOUND'
  )
})

// The repo fixture is the newer React/antd CricClubs layout (UNC vs UCLA, Mar 12, 2026).
// Neither parser supports it yet, so /api/parse rejects it with UNKNOWN_FORMAT
// rather than importing a wrong date or wrong stats.
test('real fixture is rejected, not silently mis-parsed', () => {
  const html = readFileSync(join(process.cwd(), 'extracted-from-webarchive.html'), 'utf8')
  assert.match(html, /University of North Carolina at Chapel Hill vs University of California, Los Angeles/)
  assert.equal(detectScorecardFormat(html), 'unknown')
  assert.throws(() => parseCricClubsScorecard(html), ParseError)
})
