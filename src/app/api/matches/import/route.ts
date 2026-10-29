import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { parseCricClubsScorecard, generateContentHash as generateCricClubsHash } from '@/lib/parsers/cricclubs-parser'
import { parseCricCenterScorecard, generateContentHash as generateCricCenterHash } from '@/lib/parsers/criccenter-parser'
import { detectScorecardFormat } from '@/lib/parsers/format-detector'
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
import { extractHTMLFromWebArchive, isWebArchive, getWebArchiveErrorMessage } from '@/lib/parsers/webarchive-extractor'

function parseOurSide(value: unknown): OurSide | null {
  if (value === 0 || value === '0') return 0
  if (value === 1 || value === '1') return 1
  if (value === 'both') return 'both'
  return null
}

function parseJson<T>(value: unknown): T | undefined {
  if (typeof value !== 'string') return value as T | undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

const bad = (error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status: 400 })

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const supabase = getSupabaseAdmin()
    let html: string
    let metadata: any = {}
    let ourSideRaw: unknown
    let decisionsRaw: unknown

    // Check if request is FormData (file upload) or JSON
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) return bad('No file provided')

      metadata = parseJson(formData.get('metadata')) || {}
      metadata.filename = file.name
      ourSideRaw = formData.get('ourSide')
      decisionsRaw = parseJson(formData.get('playerDecisions'))

      if (isWebArchive(file.name)) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          html = await extractHTMLFromWebArchive(arrayBuffer)
        } catch (error) {
          return bad(error instanceof Error ? getWebArchiveErrorMessage(error) : 'Failed to process webarchive file')
        }
      } else {
        html = await file.text()
      }
    } else {
      const body = await request.json()
      html = body.html
      metadata = body.metadata || {}
      ourSideRaw = body.ourSide
      decisionsRaw = body.playerDecisions
    }

    if (!html || html.trim().length === 0) return bad('HTML content is empty')

    const ourSide = parseOurSide(ourSideRaw)
    if (ourSide === null) {
      return bad("ourSide is required: 0 (Team A), 1 (Team B) or 'both' (intrasquad)")
    }
    const decisions = (decisionsRaw && typeof decisionsRaw === 'object' ? decisionsRaw : {}) as Record<string, PlayerDecision>
    if (metadata?.matchType === 'intrasquad' && ourSide !== 'both') {
      return bad("Match type 'intrasquad' requires ourSide 'both'")
    }

    const format = detectScorecardFormat(html)
    if (format === 'unknown') {
      return bad('Unable to detect scorecard format. Please ensure the HTML is from CricClubs or CricCenter.')
    }

    // Duplicate detection
    const contentHash = format === 'cricclubs' ? generateCricClubsHash(html) : generateCricCenterHash(html)
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

    const parsedData: ParsedMatchData =
      format === 'cricclubs' ? parseCricClubsScorecard(html) : parseCricCenterScorecard(html)

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
        venue: metadata?.venue,
        match_type: plan.match.match_type || metadata?.matchType || 'league',
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
