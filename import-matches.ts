import * as fs from 'fs'
import * as path from 'path'

const VERCEL_API_URL = process.env.VERCEL_URL || 'https://ucla-cricket-dashboard.vercel.app'

async function importMatch(htmlFile: string) {
  console.log(`\n📄 Processing ${htmlFile}...`)

  try {
    const html = fs.readFileSync(path.join(__dirname, htmlFile), 'utf-8')

    console.log(`  ✓ Read ${html.length} characters`)

    // Call the import API
    const response = await fetch(`${VERCEL_API_URL}/api/matches/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        metadata: {
          ourTeamName: 'UCLA',
          matchType: 'league',
          competitionName: 'NCCA Championship',
          filename: htmlFile,
        },
      }),
    })

    const result = await response.json()

    if (result.success) {
      console.log(`  ✅ Successfully imported match: ${result.message}`)
      console.log(`     Match ID: ${result.matchId}`)
      console.log(`     Stats: ${result.stats.batting} batters, ${result.stats.bowling} bowlers, ${result.stats.fielding} fielders`)
    } else {
      console.log(`  ❌ Failed to import: ${result.error}`)
    }

    return result
  } catch (error) {
    console.error(`  ❌ Error processing ${htmlFile}:`, error instanceof Error ? error.message : error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function main() {
  console.log('🏏 UCLA Cricket Stats - Match Importer')
  console.log(`📡 API URL: ${VERCEL_API_URL}`)
  console.log('=' .repeat(50))

  const files = ['match.html', 'match1.html', 'match2.html']

  for (const file of files) {
    await importMatch(file)
    // Small delay between imports
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ Import process completed!')
}

main().catch(console.error)
