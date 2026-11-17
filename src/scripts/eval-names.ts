/**
 * Run the real model on roster name matching, with the seed roster and the names from the
 * UNC vs UCLA fixture that the exact matcher misses. Costs money. Run with:
 *   npx tsx --env-file=.env.local src/scripts/eval-names.ts
 */
import { suggestRosterMatches } from '@/lib/parsers/name-matcher'

const ROSTER: [string, ...string[]][] = [
  ['Adi'], ['Advait'], ['Arhaan Kohli', 'Arhaan'], ['Arjun'], ['Arsh Sheikh', 'Arsh', 'Arsh S'],
  ['Arvind Adavikolanu', 'Arvind', 'Arvind A'], ['Arya'], ['Avyay Toprani', 'Avyay T'],
  ['Devansh Mishra', 'Devansh', 'Devansh M'], ['Kabir'], ['Ayush Monga', 'Monga', 'Ayush M'],
  ['Naman Satija', 'Naman S'], ['Sahil Shah', 'Sahil S'], ['Tanmay Desai', 'Tanmay D'],
  ['Trinabh Khera Sahni', 'Trinabh S', 'Trinabh Sahni'], ['Vardaan Sinha', 'Vardaan S'],
  ['Anirudh Rao', 'Anirudh', 'Anirudh R'], ['Dhruv Patel', 'Dhruv', 'Dhruv P'], ['Rohan Mehta', 'Rohan M'],
]
const UCLA = 'University of California, Los Angeles'
const UNC = 'University of North Carolina at Chapel Hill'
// name, team, expected roster name (null = must stay unmatched)
const CASES: [string, string, string | null][] = [
  ['Arya Panjwani', UCLA, 'Arya'],
  ['Adi Veerappan', UCLA, 'Adi'],
  ['D Mishra', UCLA, 'Devansh Mishra'],
  ['Arhan Kohli', UCLA, 'Arhaan Kohli'],
  ['Sahil', UCLA, 'Sahil Shah'],
  ['Rohan Kapoor', UCLA, null],
  ['Vikram Nair', UCLA, null],
  ['Abhiram Bolisetty', UNC, null],
  ['Utkarsh Srivastava', UNC, null],
  ['Rohan Phadke', UNC, null],
  ['Rohan Joshi', UNC, null],
  ['Khush Patel', UNC, null],
  ['Smeet Pandit', UNC, null],
]

async function main() {
  const roster = ROSTER.map(([name, ...aliases]) => ({ id: name, name, aliases }))
  const got = await suggestRosterMatches(CASES.map(([name, team]) => ({ name, team })), roster, new Map())
  let failed = 0
  for (const [name, team, want] of CASES) {
    const g = got.get(`${team}\n${name}`) ?? null
    if (g !== want) failed++
    console.log(`${g === want ? 'ok  ' : 'FAIL'} ${name} -> ${g}${g === want ? '' : ` (want ${want})`}`)
  }
  process.exit(failed ? 1 : 0)
}
main()
