import fs from 'fs'
import path from 'path'
import bplist from 'bplist-parser'

// Webarchive files to import
const webarchiveFiles = [
  'Arizona State University vs University of California, Los Angeles - Collegiate Cricket League (CCL).webarchive',
  'University of California, Los Angeles vs George Washington University - Collegiate Cricket League (C.webarchive',
  'University of California, Los Angeles vs Arizona State University - Collegiate Cricket League (CCL).webarchive',
  'University of North Carolina at Chapel Hill vs University of California, Los Angeles - Collegiate Cr.webarchive'
]

async function extractHTMLFromWebArchive(buffer) {
  try {
    const parsed = await bplist.parseBuffer(buffer)

    if (!parsed || !Array.isArray(parsed) || parsed.length < 1) {
      throw new Error('Failed to parse webarchive file - empty result')
    }

    const webarchive = parsed[0]
    const mainResource = webarchive.WebMainResource

    if (!mainResource) {
      throw new Error('No WebMainResource found in webarchive')
    }

    if (!mainResource.WebResourceData) {
      throw new Error('No WebResourceData found in WebMainResource')
    }

    const html = mainResource.WebResourceData.toString('utf-8')

    if (!html || html.trim().length === 0) {
      throw new Error('Extracted HTML is empty')
    }

    return html
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract HTML from webarchive: ${error.message}`)
    }
    throw new Error('Failed to extract HTML from webarchive: Unknown error')
  }
}

async function importWebarchive(filename) {
  console.log(`\n📄 Processing: ${filename}`)

  try {
    // Read webarchive file
    const buffer = fs.readFileSync(filename)

    // Extract HTML
    console.log('  Extracting HTML from webarchive...')
    const html = await extractHTMLFromWebArchive(buffer)
    console.log(`  Extracted ${html.length} characters of HTML`)

    // Check if it has scorecard data
    const hasMatchTable = html.includes('match-table-innings')
    const hasBallByBall = html.includes('ballByBallTeam')

    if (!hasMatchTable && !hasBallByBall) {
      console.log('  ⚠️  WARNING: This appears to be a loading page, skipping import')
      return { success: false, error: 'Loading page detected' }
    }

    console.log('  ✅ Valid scorecard detected')

    // Import to database
    console.log('  Importing to database...')
    const response = await fetch('http://localhost:3000/api/matches/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: html,
        metadata: {
          filename: path.basename(filename),
          matchType: 'league',
          competitionName: 'Collegiate Cricket League (CCL)',
          ourTeamName: 'UCLA',
          notes: 'Imported from webarchive'
        }
      })
    })

    const result = await response.json()

    if (result.success) {
      console.log(`  ✅ Successfully imported! Match ID: ${result.matchId}`)
      console.log(`  📊 Stats: ${result.stats.batting} batters, ${result.stats.bowling} bowlers, ${result.stats.fielding} fielders`)
    } else {
      console.log(`  ❌ Import failed: ${result.error}`)
      if (result.matchId) {
        console.log(`  ℹ️  Duplicate match detected (Match ID: ${result.matchId})`)
      }
    }

    return result
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function main() {
  console.log('🏏 Starting webarchive import process...')
  console.log(`Found ${webarchiveFiles.length} files to import\n`)

  let successCount = 0
  let failCount = 0
  let skipCount = 0

  for (const filename of webarchiveFiles) {
    const result = await importWebarchive(filename)

    if (result.success) {
      successCount++
    } else if (result.error?.includes('already been imported')) {
      skipCount++
    } else {
      failCount++
    }

    // Wait a bit between imports to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Import Summary:')
  console.log(`  ✅ Successful: ${successCount}`)
  console.log(`  ⏭️  Skipped (duplicates): ${skipCount}`)
  console.log(`  ❌ Failed: ${failCount}`)
  console.log('='.repeat(50))
}

main().catch(console.error)
