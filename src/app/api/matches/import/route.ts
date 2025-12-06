import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { parseCricClubsScorecard, generateContentHash } from '@/lib/parsers/cricclubs-parser'
import { resolvePlayerName, createPlayerIfNotExists, initializePlayerCache } from '@/lib/parsers/player-resolver'
import { 
  detectSeasonFromDate, 
  getOrCreateSeason, 
  updatePlayerSeasonStats,
  updateBowlingSeasonStats,
  updateFieldingSeasonStats,
} from '@/lib/services/stats-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { html, metadata } = body
    
    if (!html) {
      return NextResponse.json(
        { success: false, error: 'No HTML content provided' },
        { status: 400 }
      )
    }
    
    // Generate content hash for duplicate detection
    const contentHash = generateContentHash(html)
    
    // Check for duplicate
    const { data: existingImport } = await supabase
      .from('import_history')
      .select('id, match_id')
      .eq('content_hash', contentHash)
      .single()
    
    if (existingImport) {
      return NextResponse.json({
        success: false,
        error: 'This scorecard has already been imported',
        matchId: existingImport.match_id,
      })
    }
    
    // Parse the HTML
    const parsedData = parseCricClubsScorecard(html)
    
    // Detect and get/create season
    const seasonName = detectSeasonFromDate(parsedData.date)
    const seasonId = await getOrCreateSeason(seasonName)
    
    // Determine opponent and our innings
    const ourTeamName = metadata?.ourTeamName || 'UCLA'
    let ourInnings = parsedData.innings.find(i => 
      i.team.toLowerCase().includes(ourTeamName.toLowerCase())
    )
    let opponentInnings = parsedData.innings.find(i => 
      !i.team.toLowerCase().includes(ourTeamName.toLowerCase())
    )
    
    // If can't determine, use second innings as ours (common case)
    if (!ourInnings && parsedData.innings.length >= 2) {
      ourInnings = parsedData.innings[1]
      opponentInnings = parsedData.innings[0]
    }
    
    const opponent = opponentInnings?.team || parsedData.teams.find(t => 
      !t.toLowerCase().includes(ourTeamName.toLowerCase())
    ) || 'Unknown'
    
    // Determine result
    let result = 'no_result'
    if (parsedData.result) {
      result = parsedData.result
    } else if (ourInnings && opponentInnings) {
      if (ourInnings.total > opponentInnings.total) result = 'win'
      else if (ourInnings.total < opponentInnings.total) result = 'loss'
      else result = 'tie'
    }
    
    // Create match record with extras breakdown
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        season_id: seasonId,
        date: parsedData.date,
        opponent,
        venue: metadata?.venue,
        match_type: metadata?.matchType || 'league',
        competition_name: metadata?.competitionName || parsedData.competition,
        result,
        our_team_name: ourTeamName,
        our_score: ourInnings ? `${ourInnings.total}/${ourInnings.wickets}` : null,
        opponent_score: opponentInnings ? `${opponentInnings.total}/${opponentInnings.wickets}` : null,
        our_extras_total: ourInnings?.extrasBreakdown?.total || ourInnings?.extras || 0,
        our_extras_wides: ourInnings?.extrasBreakdown?.wides || 0,
        our_extras_no_balls: ourInnings?.extrasBreakdown?.noBalls || 0,
        our_extras_byes: ourInnings?.extrasBreakdown?.byes || 0,
        our_extras_leg_byes: ourInnings?.extrasBreakdown?.legByes || 0,
        notes: metadata?.notes,
        raw_html_hash: contentHash,
      })
      .select()
      .single()
    
    if (matchError) {
      console.error('Error creating match:', matchError)
      return NextResponse.json(
        { success: false, error: 'Failed to create match record' },
        { status: 500 }
      )
    }
    
    // Record import history
    await supabase.from('import_history').insert({
      match_id: match.id,
      filename: metadata?.filename || 'unknown.html',
      content_hash: contentHash,
    })
    
    // Initialize player cache
    await initializePlayerCache()
    
    // Track all players to update stats for
    const battingPlayerIds: string[] = []
    const bowlingPlayerIds: string[] = []
    const fieldingPlayerIds: string[] = []
    
    // Import batting performances for our team
    if (ourInnings) {
      for (const entry of ourInnings.battingEntries) {
        // Resolve or create player
        let playerId: string
        const resolved = await resolvePlayerName(entry.playerName, match.id)
        
        if (resolved) {
          playerId = resolved.playerId
        } else {
          // Create new player
          playerId = await createPlayerIfNotExists(entry.playerName)
        }
        
        battingPlayerIds.push(playerId)
        
        // Insert batting performance
        const { error: perfError } = await supabase
          .from('batting_performances')
          .insert({
            match_id: match.id,
            player_id: playerId,
            runs: entry.runs,
            balls: entry.balls,
            fours: entry.fours,
            sixes: entry.sixes,
            not_out: entry.notOut,
            bowled_lbw: entry.isBowledOrLBW,
            dismissal_text: entry.dismissalText,
            batting_position: entry.battingPosition,
          })
        
        if (perfError) {
          console.error('Error inserting batting performance:', perfError)
        }
      }
    }
    
    // Import bowling performances for our team (from opponent's innings)
    // When the opponent bats, our players bowl
    // Also try ourInnings bowling entries as fallback (some HTML structures differ)
    const bowlingEntriesToImport = opponentInnings?.bowlingEntries?.length 
      ? opponentInnings.bowlingEntries 
      : ourInnings?.bowlingEntries || []
    
    for (const entry of bowlingEntriesToImport) {
      // Resolve or create player
      let playerId: string
      const resolved = await resolvePlayerName(entry.playerName, match.id)
      
      if (resolved) {
        playerId = resolved.playerId
      } else {
        playerId = await createPlayerIfNotExists(entry.playerName)
      }
      
      bowlingPlayerIds.push(playerId)
      
      // Insert bowling performance
      const { error: bowlError } = await supabase
        .from('bowling_performances')
        .insert({
          match_id: match.id,
          player_id: playerId,
          overs: entry.overs,
          balls: entry.balls,
          maidens: entry.maidens,
          runs_conceded: entry.runs,
          wickets: entry.wickets,
          dots: entry.dots,
          wides: entry.wides,
          no_balls: entry.noBalls,
          economy: entry.economy,
        })
      
      if (bowlError) {
        console.error('Error inserting bowling performance:', bowlError)
      }
    }
    
    // Import fielding performances from dismissals in opponent's innings
    // (catches, run outs, stumpings are credited when opponent gets out)
    if (opponentInnings && opponentInnings.fieldingEntries) {
      for (const entry of opponentInnings.fieldingEntries) {
        // Resolve or create player
        let playerId: string
        const resolved = await resolvePlayerName(entry.playerName, match.id)
        
        if (resolved) {
          playerId = resolved.playerId
        } else {
          playerId = await createPlayerIfNotExists(entry.playerName)
        }
        
        fieldingPlayerIds.push(playerId)
        
        // Insert or update fielding performance
        const { data: existingFielding } = await supabase
          .from('fielding_performances')
          .select('id, catches, run_outs, stumpings')
          .eq('match_id', match.id)
          .eq('player_id', playerId)
          .single()
        
        if (existingFielding) {
          // Update existing record
          await supabase
            .from('fielding_performances')
            .update({
              catches: existingFielding.catches + entry.catches,
              run_outs: existingFielding.run_outs + entry.runOuts,
              stumpings: existingFielding.stumpings + entry.stumpings,
            })
            .eq('id', existingFielding.id)
        } else {
          // Insert new record
          const { error: fieldError } = await supabase
            .from('fielding_performances')
            .insert({
              match_id: match.id,
              player_id: playerId,
              catches: entry.catches,
              run_outs: entry.runOuts,
              stumpings: entry.stumpings,
            })
          
          if (fieldError) {
            console.error('Error inserting fielding performance:', fieldError)
          }
        }
      }
    }
    
    // Update season stats for all players
    const uniqueBatting = Array.from(new Set(battingPlayerIds))
    const uniqueBowling = Array.from(new Set(bowlingPlayerIds))
    const uniqueFielding = Array.from(new Set(fieldingPlayerIds))
    
    for (const playerId of uniqueBatting) {
      await updatePlayerSeasonStats(playerId, seasonId)
    }
    
    for (const playerId of uniqueBowling) {
      await updateBowlingSeasonStats(playerId, seasonId)
    }
    
    for (const playerId of uniqueFielding) {
      await updateFieldingSeasonStats(playerId, seasonId)
    }
    
    return NextResponse.json({
      success: true,
      matchId: match.id,
      message: `Imported match: ${opponent} on ${parsedData.date}`,
      stats: {
        batting: uniqueBatting.length,
        bowling: uniqueBowling.length,
        fielding: uniqueFielding.length,
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

