'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { formatScore, formatStat, formatDate, getInitials } from '@/lib/utils'

interface PlayerData {
  id: string
  name: string
  aliases: string[]
  year?: string
  major?: string
  battingSeasonStats: any[]
  bowlingSeasonStats: any[]
  fieldingSeasonStats: any[]
  battingPerformances: any[]
  bowlingPerformances: any[]
}

export default function PlayerProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newAlias, setNewAlias] = useState('')
  const [addingAlias, setAddingAlias] = useState(false)
  const [editingAliases, setEditingAliases] = useState(false)

  useEffect(() => {
    loadPlayer()
  }, [params.id])

  async function loadPlayer() {
    setLoading(true)
    
    // Get player info
    const { data: playerData, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (error || !playerData) {
      router.push('/players')
      return
    }
    
    // Get aliases
    const { data: aliasData } = await supabase
      .from('player_aliases')
      .select('alias')
      .eq('player_id', params.id)
    
    // Get batting performances
    const { data: battingPerformances } = await supabase
      .from('batting_performances')
      .select(`
        *,
        match:matches(*)
      `)
      .eq('player_id', params.id)
      .order('match(date)', { ascending: false })
    
    // Get bowling performances
    const { data: bowlingPerformances } = await supabase
      .from('bowling_performances')
      .select(`
        *,
        match:matches(*)
      `)
      .eq('player_id', params.id)
      .order('match(date)', { ascending: false })
    
    // Get batting season stats
    const { data: battingSeasonStats } = await supabase
      .from('player_season_stats')
      .select(`
        *,
        season:seasons(*)
      `)
      .eq('player_id', params.id)
    
    // Get bowling season stats
    const { data: bowlingSeasonStats } = await supabase
      .from('bowling_season_stats')
      .select(`
        *,
        season:seasons(*)
      `)
      .eq('player_id', params.id)
    
    // Get fielding season stats
    const { data: fieldingSeasonStats } = await supabase
      .from('fielding_season_stats')
      .select(`
        *,
        season:seasons(*)
      `)
      .eq('player_id', params.id)

    setPlayer({
      ...playerData,
      aliases: aliasData?.map(a => a.alias) || [],
      battingPerformances: battingPerformances || [],
      bowlingPerformances: bowlingPerformances || [],
      battingSeasonStats: battingSeasonStats || [],
      bowlingSeasonStats: bowlingSeasonStats || [],
      fieldingSeasonStats: fieldingSeasonStats || [],
    })
    setLoading(false)
  }

  async function addAlias() {
    if (!newAlias.trim() || !player) return
    
    setAddingAlias(true)
    try {
      const { error } = await supabase
        .from('player_aliases')
        .insert({
          player_id: player.id,
          alias: newAlias.trim(),
        })
      
      if (error) {
        if (error.code === '23505') {
          alert('This alias already exists')
        } else {
          alert('Failed to add alias')
        }
      } else {
        setNewAlias('')
        loadPlayer()
      }
    } catch (err) {
      alert('Failed to add alias')
    } finally {
      setAddingAlias(false)
    }
  }

  async function removeAlias(alias: string) {
    if (!player) return
    
    if (!confirm(`Remove alias "${alias}"?`)) return
    
    try {
      const { error } = await supabase
        .from('player_aliases')
        .delete()
        .eq('player_id', player.id)
        .eq('alias', alias)
      
      if (error) {
        alert('Failed to remove alias')
      } else {
        loadPlayer()
      }
    } catch (err) {
      alert('Failed to remove alias')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-muted-foreground">
          Loading player profile...
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-muted-foreground">
          Player not found
        </div>
      </div>
    )
  }

  // Get current season stats
  const currentBattingStats = player.battingSeasonStats?.[0]
  const currentBowlingStats = player.bowlingSeasonStats?.[0]
  const currentFieldingStats = player.fieldingSeasonStats?.[0]

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-ucla-blue flex items-center justify-center text-4xl font-bold text-white">
          {getInitials(player.name)}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">{player.name}</h1>
          
          {/* Aliases Section */}
          <div className="mt-2">
            <div className="flex items-center gap-2 flex-wrap">
              {player.aliases.length > 0 && (
                <span className="text-muted-foreground text-sm">Also known as:</span>
              )}
              {player.aliases.map((alias) => (
                <span 
                  key={alias} 
                  className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                >
                  {alias}
                  {editingAliases && (
                    <button
                      onClick={() => removeAlias(alias)}
                      className="text-red-400 hover:text-red-300 ml-1"
                      title="Remove alias"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              <button
                onClick={() => setEditingAliases(!editingAliases)}
                className="text-xs text-ucla-blue hover:text-ucla-gold"
              >
                {editingAliases ? 'Done' : '+ Manage Aliases'}
              </button>
            </div>
            
            {/* Add Alias Form */}
            {editingAliases && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder="Add new alias..."
                  className="px-3 py-1.5 bg-background border border-border rounded text-sm text-white placeholder:text-muted-foreground w-48"
                  onKeyDown={(e) => e.key === 'Enter' && addAlias()}
                />
                <button
                  onClick={addAlias}
                  disabled={addingAlias || !newAlias.trim()}
                  className="px-3 py-1.5 bg-ucla-blue text-white rounded text-sm hover:bg-ucla-blue/90 disabled:opacity-50"
                >
                  {addingAlias ? 'Adding...' : 'Add'}
                </button>
              </div>
            )}
          </div>
          
          {player.year && player.major && (
            <p className="text-muted-foreground mt-2">
              {player.year} • {player.major}
            </p>
          )}
        </div>
      </div>

      {/* Batting Stats Summary */}
      {currentBattingStats && currentBattingStats.total_runs > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">🏏 Batting Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Innings</p>
              <p className="text-2xl font-bold text-white">{currentBattingStats.matches_played}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Runs</p>
              <p className="text-2xl font-bold text-ucla-gold">{currentBattingStats.total_runs}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Average</p>
              <p className="text-2xl font-bold text-white">{formatStat(currentBattingStats.average, 2)}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Strike Rate</p>
              <p className="text-2xl font-bold text-white">{formatStat(currentBattingStats.strike_rate, 1)}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">4s / 6s</p>
              <p className="text-2xl font-bold text-white">{currentBattingStats.fours} / {currentBattingStats.sixes}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Boundary %</p>
              <p className="text-2xl font-bold text-white">{formatStat(currentBattingStats.boundary_percentage, 1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Bowling Stats Summary */}
      {currentBowlingStats && currentBowlingStats.total_balls > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">🎯 Bowling Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Matches</p>
              <p className="text-2xl font-bold text-white">{currentBowlingStats.matches_bowled}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Wickets</p>
              <p className="text-2xl font-bold text-ucla-gold">{currentBowlingStats.total_wickets}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Overs</p>
              <p className="text-2xl font-bold text-white">{currentBowlingStats.total_overs.toFixed(1)}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Economy</p>
              <p className="text-2xl font-bold text-white">{formatStat(currentBowlingStats.economy, 2)}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Average</p>
              <p className="text-2xl font-bold text-white">
                {currentBowlingStats.total_wickets > 0 ? formatStat(currentBowlingStats.average, 2) : '-'}
              </p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Dot %</p>
              <p className="text-2xl font-bold text-white">{formatStat(currentBowlingStats.dot_percentage, 1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Fielding Stats Summary */}
      {currentFieldingStats && currentFieldingStats.total_dismissals > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">🧤 Fielding Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Catches</p>
              <p className="text-2xl font-bold text-green-400">{currentFieldingStats.total_catches}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Run Outs</p>
              <p className="text-2xl font-bold text-blue-400">{currentFieldingStats.total_run_outs}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Stumpings</p>
              <p className="text-2xl font-bold text-purple-400">{currentFieldingStats.total_stumpings}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground">Total Dismissals</p>
              <p className="text-2xl font-bold text-ucla-gold">{currentFieldingStats.total_dismissals}</p>
            </div>
          </div>
        </div>
      )}

      {/* Batting Match History */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Batting History</h2>
        
        {!player.battingPerformances || player.battingPerformances.length === 0 ? (
          <div className="bg-card rounded-lg p-8 border border-border text-center">
            <p className="text-muted-foreground">No batting performances recorded yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Opponent</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">4s</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">6s</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">SR</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Dismissal</th>
                  </tr>
                </thead>
                <tbody>
                  {player.battingPerformances.map((perf: any) => {
                    const sr = perf.balls > 0 ? (perf.runs / perf.balls) * 100 : 0
                    return (
                      <tr 
                        key={perf.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(perf.match?.date)}
                        </td>
                        <td className="px-4 py-3">
                          <Link 
                            href={`/matches/${perf.match_id}`}
                            className="hover:text-ucla-gold transition-colors"
                          >
                            vs {perf.match?.opponent}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold">
                          <span className={perf.not_out ? 'text-ucla-gold' : ''}>
                            {formatScore(perf.runs, perf.balls, perf.not_out)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">{perf.fours}</td>
                        <td className="px-4 py-3 text-center">{perf.sixes}</td>
                        <td className="px-4 py-3 text-center">{formatStat(sr, 1)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {perf.not_out ? 'not out' : perf.dismissal_text || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bowling Match History */}
      {player.bowlingPerformances && player.bowlingPerformances.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Bowling History</h2>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Opponent</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">O</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">M</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">R</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">W</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Econ</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Dots</th>
                  </tr>
                </thead>
                <tbody>
                  {player.bowlingPerformances.map((perf: any) => (
                    <tr 
                      key={perf.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(perf.match?.date)}
                      </td>
                      <td className="px-4 py-3">
                        <Link 
                          href={`/matches/${perf.match_id}`}
                          className="hover:text-ucla-gold transition-colors"
                        >
                          vs {perf.match?.opponent}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">{perf.overs}</td>
                      <td className="px-4 py-3 text-center">{perf.maidens}</td>
                      <td className="px-4 py-3 text-center">{perf.runs_conceded}</td>
                      <td className="px-4 py-3 text-center font-bold text-ucla-gold">{perf.wickets}</td>
                      <td className="px-4 py-3 text-center">{formatStat(perf.economy, 2)}</td>
                      <td className="px-4 py-3 text-center">{perf.dots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Back Link */}
      <Link
        href="/players"
        className="text-ucla-blue hover:text-ucla-gold transition-colors"
      >
        ← Back to Leaderboard
      </Link>
    </div>
  )
}
