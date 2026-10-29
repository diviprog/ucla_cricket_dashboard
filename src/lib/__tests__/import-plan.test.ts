import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCricCenterScorecard } from '@/lib/parsers/criccenter-parser'
import { parseCricClubsScorecard } from '@/lib/parsers/cricclubs-parser'
import {
  extractSides,
  buildImportPlan,
  type PlayerDecision,
  type Roster,
  type ImportPlan,
} from '@/lib/import/import-plan'

// Real CricCenter scorecard: UCLA 49/10 (innings 1) vs Arizona State University 50/4 (innings 2), 2026-03-20
const cricCenter = () =>
  parseCricCenterScorecard(
    readFileSync(join(process.cwd(), 'src/lib/__tests__/fixtures/criccenter-ucla-vs-asu.html'), 'utf8')
  )

// CricClubs Full Scorecard in the legacy layout the parser targets, with both innings and bowling tables
const bat = (name: string, dismissal: string, r: number, b: number) =>
  `<tr><th><a href="viewPlayer.do?id=1"><b>${name}</b></a></th><th>${dismissal}</th><th>${r}</th><th>${b}</th><th>0</th><th>0</th><th>0</th></tr>`
const bowlRow = (name: string, o: number, m: number, d: number, r: number, w: number) =>
  `<tr><td><a href="viewPlayer.do?id=2"><b>${name}</b></a></td><td>${o}</td><td>${m}</td><td>${d}</td><td>${r}</td><td>${w}</td><td>${(r / o).toFixed(2)}</td></tr>`
const bowlTable = (rows: string) =>
  `<div class="match-innings-bottom-all"><table><thead><tr><th>Bowling</th><th>O</th><th>M</th><th>Dot</th><th>R</th><th>W</th><th>Econ</th></tr></thead><tbody>${rows}</tbody></table></div>`
const innings = (id: string, header: string, battingRows: string, bowling: string) =>
  `<div id="${id}"><table><tr><th>${header}</th></tr></table>
<div class="match-table-innings"><table><thead><tr><th>Batting</th><th></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>
${battingRows}
<tr><th>Total</th><th></th><th><b>0</b></th></tr>
</tbody></table></div>${bowling}</div>`

const UCLA_BATTING =
  bat('Naman Satija', 'c Raj K b Tom J', 20, 15) + bat('Devansh Mishra', 'b Tom J', 30, 22) + bat('Dhruv Patel', 'not out', 5, 6)
const UNC_BATTING =
  bat('Tom Jones', 'c Naman S b Devansh M', 40, 30) + bat('Raj Kumar', 'run out (Dhruv Patel)', 12, 10) + bat('Sam Lee', 'not out', 3, 4)
// UNC bowled to UCLA; UCLA bowled to UNC
const UNC_BOWLERS = bowlRow('Tom Jones', 4, 0, 10, 30, 2) + bowlRow('Sam Lee', 3, 0, 5, 25, 0)
const UCLA_BOWLERS = bowlRow('Devansh Mishra', 4, 1, 12, 20, 1) + bowlRow('Naman Satija', 4, 0, 8, 35, 0)

function cricClubsHtml(body: string) {
  return `<!-- saved from url=(0080)https://cricclubs.com/CCL/fullScorecard.do?matchId=1 -->
<html><head><title>League: UCLA vs UNC - Collegiate Cricket League</title></head><body>
<div class="ms-league-name">League <span>03/12/2026</span></div>${body}</body></html>`
}

const cricClubs = () =>
  parseCricClubsScorecard(
    cricClubsHtml(
      innings('ballByBallTeam1', 'UCLA innings (20 overs)', UCLA_BATTING, bowlTable(UNC_BOWLERS)) +
        innings('ballByBallTeam2', 'UNC innings (20 overs)', UNC_BATTING, bowlTable(UCLA_BOWLERS))
    )
  )

const names = (ps: { name: string }[]) => ps.map(p => p.name)
const rolesOf = (ps: { name: string; roles: string[] }[], name: string) => ps.find(p => p.name === name)?.roles

test('CricCenter: bowlers under an innings are the fielding side', () => {
  const sides = extractSides(cricCenter())
  assert.deepEqual(sides.teams, ['UCLA', 'Arizona State University'])
  assert.deepEqual(sides.bowlingSideOfInnings, [1, 0])
  assert.deepEqual(sides.warnings, [])

  const [ucla, asu] = sides.players
  // UCLA's bowlers are listed under ASU's innings
  assert.deepEqual(rolesOf(ucla, 'Karthik Tholudur'), ['bat', 'bowl'])
  assert.deepEqual(rolesOf(ucla, 'Naman Satija'), ['bat', 'bowl', 'field'])
  assert.deepEqual(rolesOf(ucla, 'Trinabh Khera Sahni'), ['bat', 'bowl'])
  assert.deepEqual(rolesOf(ucla, 'Arya Panjwani'), ['bat'])
  // ASU: Soorya Satish only bowled, Viraj Jadhav only fielded (lowercased in dismissal text)
  assert.deepEqual(rolesOf(asu, 'Soorya Satish'), ['bowl'])
  assert.deepEqual(rolesOf(asu, 'Evin H'), ['bat', 'bowl', 'field'])
  assert.deepEqual(rolesOf(asu, 'viraj jadhav'), ['field'])
  assert.equal(ucla.length, 11)
  assert.ok(!names(ucla).includes('Evin H'))
  assert.ok(!names(asu).includes('Naman Satija'))
})

test('CricClubs legacy layout: same convention', () => {
  const sides = extractSides(cricClubs())
  assert.deepEqual(sides.teams, ['UCLA', 'UNC'])
  assert.deepEqual(sides.bowlingSideOfInnings, [1, 0])
  const [ucla, unc] = sides.players
  assert.deepEqual(rolesOf(ucla, 'Devansh Mishra'), ['bat', 'bowl'])
  // fielders/bowlers named in UNC's dismissals are UCLA's
  assert.deepEqual(rolesOf(ucla, 'naman s'), ['field'])
  // the CricClubs run-out regex keeps only the first word of the fielder (existing parser quirk)
  assert.deepEqual(rolesOf(ucla, 'Dhruv Patel'), ['bat'])
  assert.deepEqual(rolesOf(ucla, 'dhruv'), ['field'])
  assert.deepEqual(rolesOf(unc, 'Tom Jones'), ['bat', 'bowl'])
  assert.deepEqual(rolesOf(unc, 'raj k'), ['field'])
})

test('CricClubs fallback that attaches one bowling table to both innings is counted once', () => {
  // Bowling table outside both innings divs: the parser's parent-container fallback returns it for both
  const parsed = parseCricClubsScorecard(
    cricClubsHtml(
      `<div class="container">` +
        innings('ballByBallTeam1', 'UCLA innings (20 overs)', UCLA_BATTING, '') +
        innings('ballByBallTeam2', 'UNC innings (20 overs)', UNC_BATTING, '') +
        bowlTable(UNC_BOWLERS) +
        `</div>`
    )
  )
  assert.deepEqual(parsed.innings[0].bowlingEntries.map(e => e.playerName), ['Tom Jones', 'Sam Lee'])
  assert.deepEqual(parsed.innings[1].bowlingEntries.map(e => e.playerName), ['Tom Jones', 'Sam Lee'])

  const sides = extractSides(parsed)
  assert.deepEqual(sides.bowlingSideOfInnings, [1, null])
  assert.equal(sides.warnings.length, 1)
  assert.ok(!sides.players[0].some(p => p.roles.includes('bowl') && p.name === 'Tom Jones'))
})

// Roster: past confirmations (players + aliases)
const roster: Roster = {
  players: [
    { id: 'p-naman', name: 'Naman Satija', is_ucla: true },
    { id: 'p-karthik', name: 'Karthik Tholudur', is_ucla: true },
    { id: 'p-guest-evin', name: 'Evin Hegde', is_ucla: false },
    { id: 'p-dhruva', name: 'Dhruva Iyer', is_ucla: true },
  ],
  aliases: [{ alias: 'Evin H', player_id: 'p-guest-evin' }],
}

function decideAll(names: string[], d: PlayerDecision): Record<string, PlayerDecision> {
  return Object.fromEntries(names.map(n => [n, d]))
}

const plan = (r: ReturnType<typeof buildImportPlan>): ImportPlan => {
  if (!r.ok) assert.fail(r.error)
  return r.plan
}

test('single side: our batting from our innings, bowling/fielding/wickets from the innings we fielded', () => {
  const parsed = cricCenter()
  const ucla = extractSides(parsed).players[0]
  const decisions = {
    ...decideAll(names(ucla), { action: 'new_ucla' }),
    'Naman Satija': { action: 'link', playerId: 'p-naman' } as PlayerDecision,
    'Karthik Tholudur': { action: 'link', playerId: 'p-karthik' } as PlayerDecision,
  }
  const p = plan(buildImportPlan(parsed, 0, decisions, roster))

  assert.equal(p.match.our_team_name, 'UCLA')
  assert.equal(p.match.opponent, 'Arizona State University')
  assert.equal(p.match.result, 'loss')
  assert.equal(p.match.our_score, '49/10')
  assert.equal(p.match.opponent_score, '50/4')
  assert.equal(p.match.match_type, undefined)

  assert.equal(p.batting.length, 11)
  assert.deepEqual(p.bowling.map(b => b.scorecardName), ['Karthik Tholudur', 'Naman Satija', 'Trinabh Khera Sahni'])
  assert.ok(p.batting.every(b => b.teamSide === 0))

  // "naman satija" from dismissal text resolves to the same linked player
  assert.deepEqual(p.fielding, [{ player: { kind: 'existing', playerId: 'p-naman' }, teamSide: 0, catches: 1, runOuts: 0, stumpings: 0 }])
  const naman = p.wicketTypes.filter(w => w.player.kind === 'existing' && w.player.playerId === 'p-naman')
  assert.deepEqual(naman.map(w => [w.dismissalType, w.count]).sort(), [['bowled', 3], ['caught', 1]])

  // 9 new UCLA players, no opponent created
  assert.equal(p.newPlayers.length, 9)
  assert.ok(p.newPlayers.every(n => n.isUcla))
  assert.ok(!p.newPlayers.some(n => n.name === 'Evin H'))
  assert.deepEqual(p.aliases, [])
})

test("both (intrasquad): everyone's batting, bowling, fielding and wicket types", () => {
  const parsed = cricCenter()
  const [a, b] = extractSides(parsed).players
  const p = plan(buildImportPlan(parsed, 'both', decideAll([...names(a), ...names(b)], { action: 'new_ucla' }), roster))

  assert.equal(p.match.match_type, 'intrasquad')
  assert.equal(p.match.result, 'no_result')
  assert.equal(p.match.our_team_name, 'UCLA')
  assert.equal(p.match.opponent, 'Arizona State University')
  assert.equal(p.match.our_score, '49/10')
  assert.equal(p.match.opponent_score, '50/4')

  assert.equal(p.batting.length, 11 + 6)
  assert.equal(p.bowling.length, 3 + 7)
  assert.equal(p.batting.filter(r => r.teamSide === 1).length, 6)
  assert.equal(p.bowling.filter(r => r.teamSide === 1).length, 7)
  assert.equal(p.fielding.length, 1 + 4)
  const wickets = p.wicketTypes.reduce((s, w) => s + w.count, 0)
  assert.equal(wickets, 4 + 9)
})

test('guests on a mixed team: created as non-UCLA, existing guests reused by alias', () => {
  const parsed = cricCenter()
  const asu = extractSides(parsed).players[1]
  const decisions = {
    ...decideAll(names(asu), { action: 'guest' }),
    'Aditya Dixit': { action: 'new_ucla' } as PlayerDecision,
  }
  const p = plan(buildImportPlan(parsed, 1, decisions, roster))

  assert.equal(p.match.our_team_name, 'Arizona State University')
  assert.equal(p.match.opponent, 'UCLA')
  assert.equal(p.match.result, 'win')

  // "Evin H" and "evin h" are one person, and an existing guest via alias
  const evinRows = p.batting.filter(r => r.scorecardName === 'Evin H')
  assert.deepEqual(evinRows[0].player, { kind: 'existing', playerId: 'p-guest-evin' })
  assert.ok(!p.newPlayers.some(n => n.key === 'evin h'))

  const aditya = p.newPlayers.find(n => n.name === 'Aditya Dixit')
  assert.equal(aditya?.isUcla, true)
  const guests = p.newPlayers.filter(n => !n.isUcla)
  assert.equal(guests.length, asu.length - 2)
  assert.ok(p.bowling.length === 7 && p.batting.length === 6)
})

test('link with a different scorecard name adds an alias once; matching names add none', () => {
  const parsed = cricCenter()
  const ucla = extractSides(parsed).players[0]
  const decisions = {
    ...decideAll(names(ucla), { action: 'new_ucla' }),
    'Naman Satija': { action: 'link', playerId: 'p-naman' } as PlayerDecision, // same as canonical
    'Dhruva Iyer': { action: 'link', playerId: 'p-dhruva' } as PlayerDecision, // same as canonical
    'Arya Panjwani': { action: 'link', playerId: 'p-karthik' } as PlayerDecision, // different
  }
  const p = plan(buildImportPlan(parsed, 0, decisions, roster))
  assert.deepEqual(p.aliases, [{ playerId: 'p-karthik', alias: 'Arya Panjwani' }])

  // an alias that already exists is not added again
  const asu = extractSides(parsed).players[1]
  const p2 = plan(
    buildImportPlan(parsed, 1, { ...decideAll(names(asu), { action: 'guest' }), 'Evin H': { action: 'link', playerId: 'p-guest-evin' } }, roster)
  )
  assert.deepEqual(p2.aliases, [])
})

test('missing decision is an error that names the player', () => {
  const parsed = cricCenter()
  const ucla = extractSides(parsed).players[0]
  const decisions = decideAll(names(ucla).filter(n => n !== 'Naman Satija'), { action: 'new_ucla' })
  const r = buildImportPlan(parsed, 0, decisions, roster)
  assert.equal(r.ok, false)
  if (!r.ok) assert.deepEqual(r.missing, ['Naman Satija'])

  // the other side's names are not required for a single side
  assert.equal(buildImportPlan(parsed, 0, decideAll(names(ucla), { action: 'new_ucla' }), roster).ok, true)
  // but are for both
  assert.equal(buildImportPlan(parsed, 'both', decideAll(names(ucla), { action: 'new_ucla' }), roster).ok, false)
})

test('missing ourSide, unknown linked player, and two batters on one player are errors', () => {
  const parsed = cricCenter()
  const ucla = extractSides(parsed).players[0]
  const all = decideAll(names(ucla), { action: 'new_ucla' })
  assert.equal(buildImportPlan(parsed, undefined as never, all, roster).ok, false)
  assert.equal(buildImportPlan(parsed, 0, { ...all, 'Naman Satija': { action: 'link', playerId: 'nope' } }, roster).ok, false)
  const r = buildImportPlan(
    parsed,
    0,
    { ...all, 'Naman Satija': { action: 'link', playerId: 'p-naman' }, 'Arya Panjwani': { action: 'link', playerId: 'p-naman' } },
    roster
  )
  assert.equal(r.ok, false)
})
