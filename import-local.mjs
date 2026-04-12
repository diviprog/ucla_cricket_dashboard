import { readFileSync } from 'fs';

const API_URL = 'http://localhost:3000';

async function importMatch(htmlFile) {
  console.log(`\n📄 Processing ${htmlFile}...`);

  try {
    const html = readFileSync(htmlFile, 'utf-8');
    console.log(`  ✓ Read ${html.length} characters`);

    const response = await fetch(`${API_URL}/api/matches/import`, {
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
    });

    const result = await response.json();

    if (result.success) {
      console.log(`  ✅ Successfully imported: ${result.message}`);
      console.log(`     Match ID: ${result.matchId}`);
      if (result.stats) {
        console.log(`     Stats: ${result.stats.batting} batters, ${result.stats.bowling} bowlers, ${result.stats.fielding} fielders`);
      }
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🏏 UCLA Cricket Stats - Match Importer (Local)');
  console.log(`📡 API URL: ${API_URL}`);
  console.log('='.repeat(50));

  const files = ['match.html', 'match1.html', 'match2.html'];

  for (const file of files) {
    await importMatch(file);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Import completed!');
}

main().catch(console.error);
