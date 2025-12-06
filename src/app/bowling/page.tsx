'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface BowlingStatsRow {
  id: string
  player_id: string
  matches_bowled: number
  total_overs: number
  total_balls: number
  total_runs: number
  total_wickets: number
  total_maidens: number
  total_dots: number
  total_wides: number
  total_no_balls: number
  average: number
  strike_rate: number
  economy: number
  dot_percentage: number
  player: {
    id: string
    name: string
  }
  season: {
    id: string
    name: string
  }
}

interface Season {
  id: string
  name: string
}

type SortKey = 'wickets' | 'average' | 'economy' | 'strikeRate' | 'overs' | 'dots'

export default function BowlingPage() {
  const [stats, setStats] = useState<BowlingStatsRow[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortKey>('wickets')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSeasons()
  }, [])

  useEffect(() => {
    if (selectedSeason) {
      loadStats()
    }
  }, [selectedSeason, sortBy])

  async function loadSeasons() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })

    if (data && data.length > 0) {
      setSeasons(data)
      setSelectedSeason(data[0].id)
    }
  }

  async function loadStats() {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('bowling_season_stats')
      .select(`
        *,
        player:players(id, name),
        season:seasons(id, name)
      `)
      .eq('season_id', selectedSeason)
      .gt('total_balls', 0)

    if (error) {
      console.error('Error loading bowling stats:', error)
      setLoading(false)
      return
    }

    // Sort data
    const sortedData = [...(data || [])].sort((a, b) => {
      switch (sortBy) {
        case 'wickets':
          return b.total_wickets - a.total_wickets
        case 'average':
          // Handle divide by zero - if no wickets, put at bottom
          if (a.total_wickets === 0 && b.total_wickets === 0) return 0
          if (a.total_wickets === 0) return 1
          if (b.total_wickets === 0) return -1
          return a.average - b.average // Lower is better
        case 'economy':
          return a.economy - b.economy // Lower is better
        case 'strikeRate':
          // Handle divide by zero
          if (a.total_wickets === 0 && b.total_wickets === 0) return 0
          if (a.total_wickets === 0) return 1
          if (b.total_wickets === 0) return -1
          return a.strike_rate - b.strike_rate // Lower is better
        case 'overs':
          return b.total_overs - a.total_overs
        case 'dots':
          return b.total_dots - a.total_dots
        default:
          return 0
      }
    })

    setStats(sortedData)
    setLoading(false)
  }

  const formatAverage = (avg: number, wickets: number) => {
    if (wickets === 0) return '-'
    return avg.toFixed(2)
  }

  const formatStrikeRate = (sr: number, wickets: number) => {
    if (wickets === 0) return '-'
    return sr.toFixed(1)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">
        Bowling <span className="text-ucla-gold">Leaderboard</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Season bowling statistics and rankings
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Season
          </label>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 text-white"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-background border border-border rounded-md px-3 py-2 text-white"
          >
            <option value="wickets">Wickets</option>
            <option value="average">Average (Best)</option>
            <option value="economy">Economy (Best)</option>
            <option value="strikeRate">Strike Rate (Best)</option>
            <option value="overs">Overs Bowled</option>
            <option value="dots">Dot Balls</option>
          </select>
        </div>
      </div>

      {/* Stats Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading bowling stats...
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No bowling data found for this season
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">#</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Player</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">M</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">O</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">R</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">W</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Avg</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">SR</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Econ</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Dots</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Dot%</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Wd</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">NB</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row, index) => (
                <tr 
                  key={row.id}
                  className={cn(
                    'border-b border-border/50 hover:bg-ucla-blue/10 transition-colors',
                    index < 3 && 'bg-ucla-gold/5'
                  )}
                >
                  <td className="py-3 px-4">
                    <span className={cn(
                      'font-medium',
                      index === 0 && 'text-ucla-gold',
                      index === 1 && 'text-gray-300',
                      index === 2 && 'text-amber-600',
                    )}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <a 
                      href={`/players/${row.player.id}`}
                      className="text-white hover:text-ucla-gold transition-colors font-medium"
                    >
                      {row.player.name}
                    </a>
                  </td>
                  <td className="py-3 px-4 text-center text-muted-foreground">
                    {row.matches_bowled}
                  </td>
                  <td className="py-3 px-4 text-center text-white">
                    {row.total_overs.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-center text-muted-foreground">
                    {row.total_runs}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-ucla-gold font-bold text-lg">
                      {row.total_wickets}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-white">
                    {formatAverage(row.average, row.total_wickets)}
                  </td>
                  <td className="py-3 px-4 text-center text-muted-foreground">
                    {formatStrikeRate(row.strike_rate, row.total_wickets)}
                  </td>
                  <td className={cn(
                    'py-3 px-4 text-center font-medium',
                    row.economy <= 6 ? 'text-green-400' :
                    row.economy <= 8 ? 'text-white' :
                    'text-red-400'
                  )}>
                    {row.economy.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center text-muted-foreground">
                    {row.total_dots}
                  </td>
                  <td className={cn(
                    'py-3 px-4 text-center',
                    row.dot_percentage >= 50 ? 'text-green-400' : 'text-muted-foreground'
                  )}>
                    {row.dot_percentage.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-center text-muted-foreground">
                    {row.total_wides}
                  </td>
                  <td className="py-3 px-4 text-center text-muted-foreground">
                    {row.total_no_balls}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 text-sm text-muted-foreground">
        <p className="mb-2"><strong>Legend:</strong></p>
        <p>M = Matches Bowled, O = Overs, R = Runs, W = Wickets</p>
        <p>Avg = Average (runs per wicket), SR = Strike Rate (balls per wicket)</p>
        <p>Econ = Economy (runs per over), Dots = Dot Balls, Dot% = Dot Ball Percentage</p>
        <p>Wd = Wides, NB = No Balls</p>
      </div>
    </div>
  )
}

