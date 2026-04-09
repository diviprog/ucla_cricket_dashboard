import { NextRequest, NextResponse } from 'next/server'
import { parseCricClubsScorecard, ParseError } from '@/lib/parsers/cricclubs-parser'
import { parseCricCenterScorecard } from '@/lib/parsers/criccenter-parser'
import { detectScorecardFormat } from '@/lib/parsers/format-detector'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { html, filename } = body

    if (!html) {
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

    // Detect the format first
    const format = detectScorecardFormat(html)

    // Only reject if format is unknown
    if (format === 'unknown') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to detect scorecard format',
          errorCode: 'UNKNOWN_FORMAT',
          details: 'This HTML file does not appear to be from CricClubs or CricCenter. Please upload a valid scorecard HTML file.'
        },
        { status: 400 }
      )
    }

    // Parse using the appropriate parser
    const parsedData = format === 'cricclubs'
      ? parseCricClubsScorecard(html)
      : parseCricCenterScorecard(html)
    
    // Add summary of what was parsed
    const battingCount = parsedData.innings.reduce((sum, inn) => sum + inn.battingEntries.length, 0)
    const bowlingCount = parsedData.innings.reduce((sum, inn) => sum + inn.bowlingEntries.length, 0)
    
    return NextResponse.json({
      success: true,
      data: {
        date: parsedData.date,
        teams: parsedData.teams,
        competition: parsedData.competition,
        result: parsedData.result,
        innings: parsedData.innings.length,
        battingEntries: battingCount,
        bowlingEntries: bowlingCount,
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

