/**
 * Seed script to initialize player roster from 2025-2026 CSV
 * Run with: npm run db:seed
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bjgjiobxobgjqhtjcqku.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2ppb2J4b2JnanFodGpjcWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NzM0MjQsImV4cCI6MjA4MDQ0OTQyNH0.b4uOd1eZ7DNMyqJQrb7sBlJJAX30FjdDQ4X7QXtDun0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Player roster from 2025-2026 CSV
// Each entry: [canonical name, ...aliases]
const PLAYER_ROSTER: [string, ...string[]][] = [
  ['Adi', 'Adi'],
  ['Advait', 'Advait .', 'Advait'],
  ['Andrew', 'Andrew'],
  ['Arhaan Kohli', 'Arhaan'],
  ['Arjun', 'Arjun'],
  ['Arpit', 'Arpit', 'Arpit Ghotra'],
  ['Arsh Sheikh', 'Arsh', 'Arsh S'],
  ['Arvind Adavikolanu', 'Arvind', 'Arvind A'],
  ['Arya', 'Arya'],
  ['Avyay Toprani', 'Avyay', 'Avyay T', 'Avyay Toprani'],
  ['Devansh Mishra', 'Devansh', 'Devansh M', 'Devansh Mishra'],
  ['Dron Choudhury', 'Dron', 'Dron Choudhury', 'Dron C'],
  ['Jacob', 'Jacob'],
  ['Joy Borpujari', 'Joy', 'Joy B'],
  ['Kabir', 'Kabir'],
  ['Karthik Tholudur', 'Karthik', 'Karthik T', 'Karthik Tholudur'],
  ['Kavin Balamurali', 'Kavin', 'Kavin B', 'Kavin Balamurali'],
  ['Mahavirsinh Rathod', 'Mahavirsinh', 'Mahavir Rathod'],
  ['Manit Pansari', 'Manit', 'Manit P'],
  ['Ayush Monga', 'Monga', 'Ayush Monga', 'Ayush M'],
  ['Naman Satija', 'Naman', 'Naman S', 'Naman Satija'],
  ['Parik', 'Parik'],
  ['Rafid', 'Rafid'],
  ['Ronen', 'Ronen'],
  ['Rutansh', 'Rutansh'],
  ['Sahil Shah', 'Sahil', 'Sahil S'],
  ['Samanyu', 'Samanyu'],
  ['Shadab', 'Shadab'],
  ['Syed Tamim Ahmed', 'Tamim', 'Syed Tamim A', 'Syed Tamim Ahmed'],
  ['Tanmay Desai', 'Tanmay', 'Tanmay D', 'Tanmay Desai'],
  ['Trinabh Khera Sahni', 'Trinabh', 'Trinabh S', 'Trinabh Sahni', 'Trinabh Khera Sahni'],
  ['Vardaan Sinha', 'Vardaan', 'Vardaan S', 'Vardaan Sinha'],
  ['Dhruva Iyer', 'Dhruva', 'Dhruva Iyer'],
  ['Pranav Bellur', 'PB', 'Pranav Bellur'],
  ['Swapnil', 'Swapnil'],
  ['Nitish Kovalam', 'Nitish', 'Nitish K'],
  ['Parvind', 'Parvind'],
  // Additional players from 2024-2025 season
  ['Achyutha Kodavatikanti', 'Achyutha', 'Achyutha K'],
  ['Anand Somayajula', 'Anand', 'Anand S'],
  ['Anirudh Rao', 'Anirudh', 'Anirudh R'],
  ['Arrhan Kohli', 'Arrhan', 'Arrhan K'],
  ['Ayush Minga', 'Ayush Minga'],
  ['Bhavik Ahuja', 'Bhavik', 'Bhavik A'],
  ['Darsh Verma', 'Darsh', 'Darsh V'],
  ['Deva Yarlagadda', 'Deva', 'Deva Y'],
  ['Dhruv Patel', 'Dhruv', 'Dhruv P'],
  ['Harshith Senthilkumaran', 'Harshith', 'Harshith S'],
  ['Hershal Sabnis', 'Hershal', 'Hershal S'],
  ['Krish Panjwani', 'Krish', 'Krish P'],
  ['Oliver Whittaker', 'Oliver', 'Oliver W'],
  ['Raghava Kodavatikanti', 'Raghava', 'Raghava K'],
  ['Ronojoy Borjapuri', 'Ronojoy', 'Ronojoy B'],
  ['Shaswata Bisi', 'Shaswata', 'Shaswata B'],
  ['Siddhant Paliwal', 'Siddhant', 'Siddhant P'],
  ['Suraj Srinivasan', 'Suraj', 'Suraj S'],
  ['Sahil Bahety', 'Sahil B'],
]

async function seedPlayers() {
  console.log('🌱 Starting player seed...\n')
  
  let created = 0
  let skipped = 0
  let aliasesAdded = 0
  
  for (const [canonicalName, ...aliases] of PLAYER_ROSTER) {
    // Check if player already exists
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('name', canonicalName)
      .single()
    
    let playerId: string
    
    if (existing) {
      playerId = existing.id
      skipped++
      console.log(`⏭️  Skipped (exists): ${canonicalName}`)
    } else {
      // Create player
      const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({ name: canonicalName })
        .select()
        .single()
      
      if (error) {
        console.error(`❌ Error creating ${canonicalName}:`, error.message)
        continue
      }
      
      playerId = newPlayer.id
      created++
      console.log(`✅ Created: ${canonicalName}`)
    }
    
    // Add aliases
    for (const alias of aliases) {
      if (alias === canonicalName) continue // Skip if same as canonical
      
      const { error: aliasError } = await supabase
        .from('player_aliases')
        .insert({ player_id: playerId, alias })
        .select()
      
      if (aliasError && !aliasError.message.includes('duplicate')) {
        console.error(`   ⚠️  Error adding alias "${alias}":`, aliasError.message)
      } else if (!aliasError) {
        aliasesAdded++
        console.log(`   📝 Added alias: ${alias}`)
      }
    }
  }
  
  console.log('\n🎉 Seed complete!')
  console.log(`   Created: ${created} players`)
  console.log(`   Skipped: ${skipped} players`)
  console.log(`   Aliases: ${aliasesAdded} added`)
}

// Also seed default seasons if they don't exist
async function seedSeasons() {
  console.log('\n📅 Checking seasons...\n')
  
  const seasons = [
    { name: '2024-2025', start_date: '2024-09-01', end_date: '2025-06-30' },
    { name: '2025-2026', start_date: '2025-09-01', end_date: '2026-06-30' },
  ]
  
  for (const season of seasons) {
    const { data: existing } = await supabase
      .from('seasons')
      .select('id')
      .eq('name', season.name)
      .single()
    
    if (existing) {
      console.log(`⏭️  Season exists: ${season.name}`)
    } else {
      const { error } = await supabase
        .from('seasons')
        .insert(season)
      
      if (error) {
        console.error(`❌ Error creating season ${season.name}:`, error.message)
      } else {
        console.log(`✅ Created season: ${season.name}`)
      }
    }
  }
}

async function main() {
  console.log('═'.repeat(50))
  console.log('UCLA Cricket Stats - Database Seeder')
  console.log('═'.repeat(50))
  
  await seedSeasons()
  await seedPlayers()
  
  console.log('\n' + '═'.repeat(50))
  console.log('Done! Your database is ready.')
  console.log('═'.repeat(50))
}

main().catch(console.error)

