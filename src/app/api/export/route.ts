import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import ExcelJS from 'exceljs'

// GET /api/export?format=xlsx|csv&seasonId=xxx
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const seasonId = searchParams.get('seasonId')
    
    // Get season info
    let seasonQuery = supabase.from('seasons').select('*').order('start_date', { ascending: false })
    if (seasonId) {
      seasonQuery = seasonQuery.eq('id', seasonId)
    }
    const { data: seasons } = await seasonQuery.limit(1)
    const season = seasons?.[0]
    
    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 })
    }
    
    // Get all matches for the season
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('season_id', season.id)
      .order('date')
    
    // Get batting stats
    const { data: battingStats } = await supabase
      .from('player_season_stats')
      .select(`
        *,
        player:players(name)
      `)
      .eq('season_id', season.id)
      .gt('total_runs', 0)
      .order('total_runs', { ascending: false })
    
    // Get bowling stats
    const { data: bowlingStats } = await supabase
      .from('bowling_season_stats')
      .select(`
        *,
        player:players(name)
      `)
      .eq('season_id', season.id)
      .gt('total_balls', 0)
      .order('total_wickets', { ascending: false })
    
    // Get fielding stats
    const { data: fieldingStats } = await supabase
      .from('fielding_season_stats')
      .select(`
        *,
        player:players(name)
      `)
      .eq('season_id', season.id)
      .gt('total_dismissals', 0)
      .order('total_dismissals', { ascending: false })
    
    // Build export data
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'UCLA Cricket Stats'
    workbook.created = new Date()
    
    // ============ SHEET 1: Batting Stats ============
    const battingSheet = workbook.addWorksheet('Batting Stats')
    
    const battingHeader = [
      'Player', 'Innings', 'Runs', 'Balls', 'Dismissals', 'Not Outs', '4s', '6s',
      'Average', 'Strike Rate', 'Boundary %', 'Bowled/LBW %'
    ]
    battingSheet.addRow(battingHeader)
    styleHeaderRow(battingSheet.getRow(1))
    
    battingStats?.forEach(stat => {
      battingSheet.addRow([
        stat.player?.name || 'Unknown',
        stat.matches_played,
        stat.total_runs,
        stat.total_balls,
        stat.dismissals,
        stat.not_outs,
        stat.fours,
        stat.sixes,
        stat.dismissals > 0 ? stat.average.toFixed(2) : '-',
        stat.strike_rate.toFixed(2),
        `${stat.boundary_percentage.toFixed(1)}%`,
        `${stat.bowled_lbw_percentage.toFixed(1)}%`,
      ])
    })
    
    battingSheet.columns.forEach((column, i) => { column.width = i === 0 ? 25 : 12 })
    
    // ============ SHEET 3: Bowling Stats ============
    const bowlingSheet = workbook.addWorksheet('Bowling Stats')
    
    const bowlingHeader = [
      'Player', 'Matches', 'Overs', 'Maidens', 'Runs', 'Wickets',
      'Average', 'Economy', 'Strike Rate', 'Dot %'
    ]
    bowlingSheet.addRow(bowlingHeader)
    styleHeaderRow(bowlingSheet.getRow(1), 'FF228B22') // Green
    
    bowlingStats?.forEach(stat => {
      bowlingSheet.addRow([
        stat.player?.name || 'Unknown',
        stat.matches_bowled,
        stat.total_overs.toFixed(1),
        stat.total_maidens,
        stat.total_runs,
        stat.total_wickets,
        stat.total_wickets > 0 ? stat.average.toFixed(2) : '-',
        stat.economy.toFixed(2),
        stat.total_wickets > 0 ? stat.strike_rate.toFixed(1) : '-',
        `${stat.dot_percentage.toFixed(1)}%`,
      ])
    })
    
    bowlingSheet.columns.forEach((column, i) => { column.width = i === 0 ? 25 : 12 })
    
    // ============ SHEET 4: Fielding Stats ============
    const fieldingSheet = workbook.addWorksheet('Fielding Stats')
    
    const fieldingHeader = [
      'Player', 'Matches', 'Catches', 'Run Outs', 'Stumpings', 'Total Dismissals', 'Per Match'
    ]
    fieldingSheet.addRow(fieldingHeader)
    styleHeaderRow(fieldingSheet.getRow(1), 'FF800080') // Purple
    
    fieldingStats?.forEach(stat => {
      fieldingSheet.addRow([
        stat.player?.name || 'Unknown',
        stat.matches_played,
        stat.total_catches,
        stat.total_run_outs,
        stat.total_stumpings,
        stat.total_dismissals,
        stat.dismissals_per_match.toFixed(2),
      ])
    })
    
    fieldingSheet.columns.forEach((column, i) => { column.width = i === 0 ? 25 : 15 })
    
    // ============ SHEET 5: Match Results ============
    const resultsSheet = workbook.addWorksheet('Match Results')
    
    const resultsHeader = ['Date', 'Opponent', 'Result', 'Our Score', 'Their Score', 'Competition', 'Type']
    resultsSheet.addRow(resultsHeader)
    styleHeaderRow(resultsSheet.getRow(1), 'FFFFA500') // Orange
    
    matches?.forEach(match => {
      const row = resultsSheet.addRow([
        new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        match.opponent,
        match.result.toUpperCase(),
        match.our_score || '-',
        match.opponent_score || '-',
        match.competition_name || 'League',
        match.match_type,
      ])
      
      // Color code results
      const resultCell = row.getCell(3)
      if (match.result === 'win') {
        resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } }
      } else if (match.result === 'loss') {
        resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCB' } }
      }
    })
    
    resultsSheet.columns.forEach((column, i) => { column.width = i === 1 ? 25 : 15 })
    
    // Generate file
    const buffer = await workbook.xlsx.writeBuffer()
    
    const filename = `UCLA_Cricket_Stats_${season.name}.xlsx`
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}

// Helper function to style header rows
function styleHeaderRow(row: ExcelJS.Row, color: string = 'FF2D68C4') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color },
  }
}
