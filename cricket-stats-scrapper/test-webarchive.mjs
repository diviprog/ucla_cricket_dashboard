import fs from 'fs'
import bplist from 'bplist-parser'

// Get webarchive path from command line argument
const webarchivePath = process.argv[2]

if (!webarchivePath) {
  console.error('Usage: node test-webarchive.mjs <path-to-webarchive-file>')
  console.error('\nExample:')
  console.error('  node test-webarchive.mjs "./match.webarchive"')
  process.exit(1)
}

if (!fs.existsSync(webarchivePath)) {
  console.error(`File not found: ${webarchivePath}`)
  process.exit(1)
}

console.log(`Reading webarchive file: ${webarchivePath}...`)
const buffer = fs.readFileSync(webarchivePath)

console.log('Parsing webarchive...')
const parsed = await bplist.parseBuffer(buffer)

if (!parsed || parsed.length === 0) {
  console.error('Failed to parse webarchive')
  process.exit(1)
}

const webarchive = parsed[0]
const mainResource = webarchive.WebMainResource

if (!mainResource) {
  console.error('No WebMainResource found')
  process.exit(1)
}

if (!mainResource.WebResourceData) {
  console.error('No WebResourceData found')
  process.exit(1)
}

const html = mainResource.WebResourceData.toString('utf-8')

console.log(`\nExtracted HTML length: ${html.length} characters`)
console.log('\nFirst 500 characters of extracted HTML:')
console.log(html.substring(0, 500))
console.log('\n...')
console.log('\nSearching for key elements...')

// Check for scorecard elements
const hasMatchTable = html.includes('match-table-innings')
const hasBallByBall = html.includes('ballByBallTeam')
const hasInnings = html.includes('innings')
const hasAntSpin = html.includes('ant-spin')
const hasLoading = html.includes('loading')

console.log(`Has match-table-innings: ${hasMatchTable}`)
console.log(`Has ballByBallTeam: ${hasBallByBall}`)
console.log(`Has innings: ${hasInnings}`)
console.log(`Has ant-spin (loading): ${hasAntSpin}`)
console.log(`Has loading: ${hasLoading}`)

if (!hasMatchTable && !hasBallByBall) {
  console.log('\n⚠️  WARNING: This appears to be a loading page, not the actual scorecard!')
  console.log('The HTML was saved before the JavaScript loaded the actual match data.')
  console.log('\nSolution:')
  console.log('1. Wait for the page to FULLY load (all batting/bowling tables visible)')
  console.log('2. Then save the page as Web Archive')
  console.log('3. Or use browser DevTools to copy the rendered HTML')
} else {
  console.log('\n✅ This looks like a valid scorecard!')
}

// Save extracted HTML for inspection
fs.writeFileSync('./extracted-from-webarchive.html', html)
console.log('\n📄 Saved extracted HTML to: ./extracted-from-webarchive.html')
