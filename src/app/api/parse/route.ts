import { NextRequest, NextResponse } from 'next/server'
import { parseCricClubsScorecard } from '@/lib/parsers/cricclubs-parser'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { html, filename } = body
    
    if (!html) {
      return NextResponse.json(
        { success: false, error: 'No HTML content provided' },
        { status: 400 }
      )
    }
    
    const parsedData = parseCricClubsScorecard(html)
    
    return NextResponse.json({
      success: true,
      data: {
        date: parsedData.date,
        teams: parsedData.teams,
        competition: parsedData.competition,
        result: parsedData.result,
        innings: parsedData.innings.length,
      },
      filename,
    })
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to parse HTML' },
      { status: 500 }
    )
  }
}

