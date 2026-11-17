import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { matchFingerprint } from '@/lib/parsers/llm-parser'
import { ParsedMatchSchema } from '@/lib/parsers/parsed-match-schema'
import {
  detectSeasonFromDate,
  getOrCreateSeason,
  updatePlayerSeasonStats,
  updateBowlingSeasonStats,
  updateFieldingSeasonStats,
} from '@/lib/services/stats-service'
import { buildImportPlan, type OurSide, type PlayerDecision, type PlayerRef, type Roster } from '@/lib/import/import-plan'
import { describeDbError } from '@/lib/supabase/migration-guard'
import { clearPlayerCache } from '@/lib/parsers/player-resolver'
import { ParsedMatchData } from '@/types/models'

function parseOurSide(value: unknown): OurSide | null {
  if (value === 0 || value === '0') return 0
  if (value === 1 || value === '1') return 1
  if (value === 'both') return 'both'
  return null
}

const bad = (error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status: 400 })

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const supabase = getSupabaseAdmin()
    // The body carries the scorecard exactly as /api/parse returned it and the admin reviewed it
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Expected a JSON body')
    const metadata = body.metadata || {}
    const ourSideRaw: unknown = body.ourSide
    const decisionsRaw: unknown = body.playerDecisions

    const validated = ParsedMatchSchema.safeParse(body.parsed)
    if (!validated.success) {
      return bad('parsed scorecard is missing or malformed. Upload the file again.', {
        details: validated.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const parsedData: ParsedMatchData = validated.data

    const ourSide = parseOurSide(ourSideRaw)
    if (ourSide === null) {
      return bad("ourSide is required: 0 (Team A), 1 (Team B) or 'both' (intrasquad)")
    }
    const decisions = (decisionsRaw && typeof decisionsRaw === 'object' ? decisionsRaw : {}) as Record<string, PlayerDecision>
    if (metadata?.matchType === 'intrasquad' && ourSide !== 'both') {
      return bad("Match type 'intrasquad' requires ourSide 'both'")
    }

    // Duplicate detection on the match itself (date + both innings), not on the file's bytes
    const contentHash = matchFingerprint(parsedData)
    const { data: existingImport } = await supabase
      .from('import_history')
      .select('id, match_id')
      .eq('content_hash', contentHash)
      .maybeSingle()

    if (existingImport) {
      return NextResponse.json({
        success: false,
        errorCode: 'ALREADY_IMPORTED',
        error: 'This scorecard has already been imported',
        matchId: existingImport.match_id,
      })
    }

    // Matches imported before fingerprints were hashed from the file: same date and same two scores
    const scores = parsedData.innings.map(i => `${i.total}/${i.wickets}`).sort()
    const { data: sameDay } = await supabase
      .from('matches')
      .select('id, our_score, opponent_score')
      .eq('date', parsedData.date)
    const twin = (sameDay || []).find(
      m => JSON.stringify([m.our_score, m.opponent_score].filter(Boolean).sort()) === JSON.stringify(scores)
    )
    if (twin) {
      return NextResponse.json({
        success: false,
        errorCode: 'ALREADY_IMPORTED',
        error: 'A match on this date with the same scores has already been imported',
        matchId: twin.id,
      })
    }

    // Roster = past confirmations (players + aliases)
    const [{ data: players, error: playersError }, { data: aliases, error: aliasesError }] = await Promise.all([
      supabase.from('players').select('id, name, is_ucla'),
      supabase.from('player_aliases').select('alias, player_id'),
    ])
    if (playersError || aliasesError) {
      return NextResponse.json(
        { success: false, error: describeDbError(playersError || aliasesError, 'Failed to load players') },
        { status: 500 }
      )
    }
    const roster: Roster = { players: players || [], aliases: aliases || [] }

    // Everything below is decided here, before any write
    const planned = buildImportPlan(parsedData, ourSide, decisions, roster)
    if (!planned.ok) return bad(planned.error, { missing: planned.missing })
    const plan = planned.plan

    const seasonId = await getOrCreateSeason(detectSeasonFromDate(parsedData.date))

    // ---- Writes ----
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        season_id: seasonId,
        date: parsedData.date,
        venue: (metadata?.venue || parsedData.venue)?.slice(0, 200),
        match_type: plan.match.match_type || metadata?.matchType || parsedData.matchType || 'league',
        competition_name: metadata?.competitionName || parsedData.competition,
        notes: metadata?.notes,
        raw_html_hash: contentHash,
        our_team_name: plan.match.our_team_name,
        opponent: plan.match.opponent,
        result: plan.match.result,
        our_score: plan.match.our_score,
        opponent_score: plan.match.opponent_score,
        our_extras_total: plan.match.our_extras_total,
        our_extras_wides: plan.match.our_extras_wides,
        our_extras_no_balls: plan.match.our_extras_no_balls,
        our_extras_byes: plan.match.our_extras_byes,
        our_extras_leg_byes: plan.match.our_extras_leg_byes,
      })
      .select()
      .single()

    if (matchError) {
      console.error('Error creating match:', matchError)
      return NextResponse.json({ success: false, error: 'Failed to create match record' }, { status: 500 })
    }

    const writeErrors: string[] = []
    const note = (what: string, error: { message?: string } | null) => {
      if (error) {
        console.error(`Import: ${what}:`, error)
        writeErrors.push(`${what}: ${describeDbError(error)}`)
      }
    }

    const { error: historyError } = await supabase.from('import_history').insert({
      match_id: match.id,
      filename: metadata?.filename || 'unknown.html',
      content_hash: contentHash,
    })
    note('import history', historyError)

    // New players (UCLA or guest)
    const newIds = new Map<string, string>()
    for (const p of plan.newPlayers) {
      const { data, error } = await supabase
        .from('players')
        .insert({ name: p.name, is_ucla: p.isUcla })
        .select('id')
        .single()
      if (error || !data) note(`create player ${p.name}`, error)
      else newIds.set(p.key, data.id)
    }

    // Aliases for links whose scorecard name differs from the canonical name; duplicates are fine
    for (const a of plan.aliases) {
      const { error } = await supabase.from('player_aliases').insert({ player_id: a.playerId, alias: a.alias })
      if (error && error.code !== '23505') note(`alias ${a.alias}`, error)
    }
    if (plan.newPlayers.length || plan.aliases.length) clearPlayerCache()

    const idOf = (ref: PlayerRef) => (ref.kind === 'existing' ? ref.playerId : newIds.get(ref.key))

    const battingRows = plan.batting
      .filter(r => idOf(r.player))
      .map(({ player, teamSide, entry }) => ({
        match_id: match.id,
        player_id: idOf(player)!,
        team_side: teamSide,
        runs: entry.runs,
        balls: entry.balls,
        fours: entry.fours,
        sixes: entry.sixes,
        not_out: entry.notOut,
        bowled_lbw: entry.isBowledOrLBW,
        dismissal_text: entry.dismissalText,
        batting_position: entry.battingPosition,
      }))
    const bowlingRows = plan.bowling
      .filter(r => idOf(r.player))
      .map(({ player, teamSide, entry }) => ({
        match_id: match.id,
        player_id: idOf(player)!,
        team_side: teamSide,
        overs: entry.overs,
        balls: entry.balls,
        maidens: entry.maidens,
        runs_conceded: entry.runs,
        wickets: entry.wickets,
        dots: entry.dots,
        wides: entry.wides,
        no_balls: entry.noBalls,
        economy: entry.economy,
      }))
    const fieldingRows = plan.fielding
      .filter(r => idOf(r.player))
      .map(r => ({
        match_id: match.id,
        player_id: idOf(r.player)!,
        team_side: r.teamSide,
        catches: r.catches,
        run_outs: r.runOuts,
        stumpings: r.stumpings,
      }))
    const wicketRows = plan.wicketTypes
      .filter(r => idOf(r.player))
      .map(r => ({
        match_id: match.id,
        bowler_player_id: idOf(r.player)!,
        dismissal_type: r.dismissalType,
        wicket_count: r.count,
      }))

    if (battingRows.length) note('batting', (await supabase.from('batting_performances').insert(battingRows)).error)
    if (bowlingRows.length) note('bowling', (await supabase.from('bowling_performances').insert(bowlingRows)).error)
    if (fieldingRows.length) note('fielding', (await supabase.from('fielding_performances').insert(fieldingRows)).error)
    if (wicketRows.length) {
      note(
        'wicket types',
        (
          await supabase
            .from('bowler_wicket_types')
            .upsert(wicketRows, { onConflict: 'match_id,bowler_player_id,dismissal_type' })
        ).error
      )
    }

    // Season stats (guests included; views filter on players.is_ucla)
    const uniqueBatting = Array.from(new Set(battingRows.map(r => r.player_id)))
    const uniqueBowling = Array.from(new Set(bowlingRows.map(r => r.player_id)))
    const uniqueFielding = Array.from(new Set(fieldingRows.map(r => r.player_id)))
    for (const id of uniqueBatting) await updatePlayerSeasonStats(id, seasonId)
    for (const id of uniqueBowling) await updateBowlingSeasonStats(id, seasonId)
    for (const id of uniqueFielding) await updateFieldingSeasonStats(id, seasonId)

    const label = ourSide === 'both'
      ? `${plan.match.our_team_name} vs ${plan.match.opponent} (intrasquad)`
      : `${plan.match.our_team_name} vs ${plan.match.opponent}`

    if (writeErrors.length) {
      return NextResponse.json(
        {
          success: false,
          matchId: match.id,
          error: `Match ${label} was created but some rows failed (${writeErrors.join('; ')}). Delete the match from the Matches page and import again.`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      matchId: match.id,
      message: `Imported ${label} on ${parsedData.date}`,
      stats: {
        batting: uniqueBatting.length,
        bowling: uniqueBowling.length,
        fielding: uniqueFielding.length,
        newPlayers: plan.newPlayers.length,
        guests: plan.newPlayers.filter(p => !p.isUcla).length,
      },
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
