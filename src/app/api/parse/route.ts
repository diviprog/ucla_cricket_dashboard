import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { ParseError } from '@/lib/parsers/cricclubs-parser'
import { parseScorecardWithLLM } from '@/lib/parsers/llm-parser'
import { extractHTMLFromWebArchive, isWebArchive, getWebArchiveErrorMessage } from '@/lib/parsers/webarchive-extractor'
import { matchPlayerName } from '@/lib/parsers/player-resolver'
import { suggestRosterMatches } from '@/lib/parsers/name-matcher'
import { extractSides, type PlayerSuggestion } from '@/lib/import/import-plan'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { describeDbError } from '@/lib/supabase/migration-guard'
import type { Player } from '@/types/models'

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    let html: string
    let filename: string = 'unknown.html'

    // Check if request is FormData (file upload) or JSON
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json(
          {
            success: false,
            error: 'No file provided',
            errorCode: 'NO_FILE',
            details: 'Please upload a file.'
          },
          { status: 400 }
        )
      }

      filename = file.name

      // Check if it's a webarchive file
      if (isWebArchive(file.name)) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          html = await extractHTMLFromWebArchive(arrayBuffer)
        } catch (error) {
          const errorMsg = error instanceof Error ? getWebArchiveErrorMessage(error) : 'Failed to process webarchive file'
          return NextResponse.json(
            {
              success: false,
              error: errorMsg,
              errorCode: 'WEBARCHIVE_EXTRACT_FAILED',
              details: error instanceof Error ? error.message : 'Could not extract HTML from webarchive.'
            },
            { status: 400 }
          )
        }
      } else {
        // Regular HTML file
        html = await file.text()
      }
    } else {
      // Handle JSON request (existing behavior)
      const body = await request.json()
      html = body.html
      filename = body.filename || 'unknown.html'
    }

    if (!html || html.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No HTML content provided',
          errorCode: 'NO_CONTENT',
          details: 'The uploaded file appears to be empty.'
        },
        { status: 400 }
      )
    }

    // Model-based extraction, checked in code (see llm-parser.ts)
    const { parsed: parsedData, warnings: parseWarnings } = await parseScorecardWithLLM(html)

    // Who played for which team, with a suggested roster match for each name
    let sides
    try {
      sides = extractSides(parsedData)
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          error: 'No innings found in the scorecard',
          errorCode: 'NO_BATTING_DATA',
          details: e instanceof Error ? e.message : 'The scorecard has no innings tables.',
        },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const [{ data: players, error: playersError }, { data: aliases, error: aliasesError }] = await Promise.all([
      supabase.from('players').select('id, name, is_ucla'),
      supabase.from('player_aliases').select('alias, player_id'),
    ])
    if (playersError || aliasesError) {
      return NextResponse.json(
        {
          success: false,
          error: describeDbError(playersError || aliasesError, 'Failed to load players'),
          errorCode: 'ROSTER_LOAD_FAILED',
        },
        { status: 500 }
      )
    }
    const aliasMap = new Map((aliases || []).map(a => [a.alias.toLowerCase(), a.player_id as string]))
    const playerById = new Map((players || []).map(p => [p.id as string, p]))
    const suggest = (name: string): PlayerSuggestion => {
      const m = matchPlayerName(name, (players || []) as Player[], aliasMap)
      if (!m) return { type: 'new' }
      return { type: 'existing', playerId: m.playerId, playerName: m.playerName, isUcla: playerById.get(m.playerId)?.is_ucla !== false }
    }
    const teamSides = sides.teams.map((team, i) => ({
      team,
      players: sides.players[i].map(p => ({ ...p, suggestion: suggest(p.name) })),
    }))

    // Names the exact matcher missed get a second, model-assisted look. Never fatal.
    const matchWarnings: string[] = []
    try {
      const unmatched = teamSides.flatMap(s => s.players.filter(p => p.suggestion.type === 'new').map(p => ({ name: p.name, team: s.team })))
      const taken = new Map(
        teamSides.map(s => [s.team, new Set(s.players.flatMap(p => (p.suggestion.type === 'existing' ? [p.suggestion.playerId] : [])))])
      )
      const roster = (players || []).map(p => ({
        id: p.id as string,
        name: p.name as string,
        aliases: (aliases || []).filter(a => a.player_id === p.id).map(a => a.alias as string),
      }))
      const guesses = await suggestRosterMatches(unmatched, roster, taken)
      for (const s of teamSides) {
        for (const p of s.players) {
          const hit = playerById.get(guesses.get(`${s.team}\n${p.name}`) || '')
          if (hit) p.suggestion = { type: 'existing', playerId: hit.id, playerName: hit.name, isUcla: hit.is_ucla !== false, guessed: true }
        }
      }
    } catch (e) {
      console.error('Name matching failed:', e)
      matchWarnings.push('Could not suggest roster matches for unrecognised names; link them by hand below.')
    }

    // Add summary of what was parsed
    const battingCount = parsedData.innings.reduce((sum, inn) => sum + inn.battingEntries.length, 0)
    const bowlingCount = parsedData.innings.reduce((sum, inn) => sum + inn.bowlingEntries.length, 0)
    
    return NextResponse.json({
      success: true,
      data: {
        date: parsedData.date,
        teams: parsedData.teams,
        competition: parsedData.competition,
        venue: parsedData.venue,
        matchType: parsedData.matchType,
        result: parsedData.result,
        innings: parsedData.innings.length,
        battingEntries: battingCount,
        bowlingEntries: bowlingCount,
        sides: teamSides,
        warnings: [...parseWarnings, ...sides.warnings, ...matchWarnings],
        // Sent back unchanged to /api/matches/import, so what was reviewed is what gets imported
        parsed: parsedData,
      },
      filename,
    })
  } catch (error) {
    console.error('Parse error:', error)
    
    // Handle our custom ParseError
    if (error instanceof ParseError) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          errorCode: error.code,
          details: error.details,
        },
        { status: 400 }
      )
    }
    
    // Handle unexpected errors
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to parse HTML',
        errorCode: 'PARSE_FAILED',
        details: error instanceof Error ? error.message : 'An unexpected error occurred while parsing the file.'
      },
      { status: 500 }
    )
  }
}

