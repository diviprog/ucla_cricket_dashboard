import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { BowlingPerformance } from '@/types/models'

// stats-service imports the browser Supabase client, which needs these to construct (no requests are made)
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'

const spell = (match_id: string, overs: number, balls: number, runs: number): BowlingPerformance => ({
  id: match_id, match_id, player_id: 'p1', overs, balls, maidens: 0, runs_conceded: runs,
  wickets: 1, dots: 0, wides: 0, no_balls: 0, economy: 0, created_at: '2025-01-01',
})

test('partial overs are summed as balls, not decimals', async () => {
  const { calculateBowlingStats } = await import('@/lib/services/stats-service')
  const stats = calculateBowlingStats([spell('m1', 3.2, 20, 25), spell('m2', 2.4, 16, 17)])
  assert.equal(stats.totalBalls, 36)
  assert.equal(stats.totalOvers, 6)
  assert.equal(stats.economy, 42 / 6)
})

test('totalOvers uses cricket notation for leftover balls', async () => {
  const { calculateBowlingStats } = await import('@/lib/services/stats-service')
  const stats = calculateBowlingStats([spell('m1', 3.2, 20, 30)])
  assert.equal(stats.totalOvers, 3.2)
  assert.equal(stats.economy, 9)
})

test('real row with overs 4.0 but 23 balls uses balls (matches CricClubs 8.87)', async () => {
  const { calculateBowlingStats } = await import('@/lib/services/stats-service')
  const stats = calculateBowlingStats([spell('m1', 4, 23, 34)])
  assert.equal(stats.economy.toFixed(2), '8.87')
  assert.equal(stats.totalOvers, 3.5)
})

test('no balls gives zero economy', async () => {
  const { calculateBowlingStats } = await import('@/lib/services/stats-service')
  assert.equal(calculateBowlingStats([]).economy, 0)
})
