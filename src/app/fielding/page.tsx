'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface FieldingStatsRow {
  id: string
  player_id: string
  matches_played: number
  total_catches: number
  total_run_outs: number
  total_stumpings: number
  total_dismissals: number
  dismissals_per_match: number
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

type SortKey = 'dismissals' | 'catches' | 'runOuts' | 'stumpings' | 'perMatch'

export default function FieldingPage() {
  const [stats, setStats] = useState<FieldingStatsRow[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortKey>('dismissals')
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
      .from('fielding_season_stats')
      .select(`
        *,
        player:players(id, name),
        season:seasons(id, name)
      `)
      .eq('season_id', selectedSeason)

    if (error) {
      console.error('Error loading fielding stats:', error)
      setLoading(false)
      return
    }

    // Sort data
    const sortedData = [...(data || [])].sort((a, b) => {
      switch (sortBy) {
        case 'dismissals':
          return b.total_dismissals - a.total_dismissals
        case 'catches':
          return b.total_catches - a.total_catches
        case 'runOuts':
          return b.total_run_outs - a.total_run_outs
        case 'stumpings':
          return b.total_stumpings - a.total_stumpings
        case 'perMatch':
          return b.dismissals_per_match - a.dismissals_per_match
        default:
          return 0
      }
    })

    setStats(sortedData)
    setLoading(false)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">
        Fielding <span className="text-ucla-gold">Leaderboard</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Season fielding statistics and rankings
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
            <option value="dismissals">Total Dismissals</option>
            <option value="catches">Catches</option>
            <option value="runOuts">Run Outs</option>
            <option value="stumpings">Stumpings</option>
            <option value="perMatch">Dismissals Per Match</option>
          </select>
        </div>
      </div>

      {/* Stats Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading fielding stats...
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No fielding data found for this season
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">#</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Player</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">M</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ct</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">RO</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">St</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Total</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">D/M</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row, index) => (
                <tr 
                  key={row.id}
                  className={cn(
                    'border-b border-border/50 hover:bg-ucla-blue/10 transition-colors',
                    index < 3 && row.total_dismissals > 0 && 'bg-ucla-gold/5'
                  )}
                >
                  <td className="py-3 px-4">
                    <span className={cn(
                      'font-medium',
                      index === 0 && row.total_dismissals > 0 && 'text-ucla-gold',
                      index === 1 && row.total_dismissals > 0 && 'text-gray-300',
                      index === 2 && row.total_dismissals > 0 && 'text-amber-600',
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
                    {row.matches_played}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      'font-medium',
                      row.total_catches > 0 ? 'text-green-400' : 'text-muted-foreground'
                    )}>
                      {row.total_catches}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      'font-medium',
                      row.total_run_outs > 0 ? 'text-blue-400' : 'text-muted-foreground'
                    )}>
                      {row.total_run_outs}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      'font-medium',
                      row.total_stumpings > 0 ? 'text-purple-400' : 'text-muted-foreground'
                    )}>
                      {row.total_stumpings}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-ucla-gold font-bold text-lg">
                      {row.total_dismissals}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-white">
                    {row.dismissals_per_match.toFixed(2)}
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
        <p>M = Matches Played, Ct = Catches, RO = Run Outs, St = Stumpings</p>
        <p>Total = Total Dismissals (Ct + RO + St), D/M = Dismissals Per Match</p>
      </div>

      {/* Note */}
      <div className="mt-4 p-4 bg-ucla-blue/10 rounded-lg border border-ucla-blue/30">
        <p className="text-sm text-muted-foreground">
          <strong className="text-white">Note:</strong> Fielding stats are extracted from dismissal descriptions in scorecards. 
          A player is credited with a catch, run out, or stumping based on the dismissal text (e.g., "c Naman S b Tanmay D").
        </p>
      </div>
    </div>
  )
}

