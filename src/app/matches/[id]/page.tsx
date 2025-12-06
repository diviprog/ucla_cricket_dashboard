'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { formatStat, formatDate, getInitials, cn } from '@/lib/utils'
import { EditableScorecard } from '@/components/editable-scorecard'

interface MatchData {
  id: string
  date: string
  opponent: string
  our_team_name: string | null
  our_score: string | null
  opponent_score: string | null
  result: string
  competition_name: string | null
  match_type: string
  venue: string | null
  notes: string | null
  our_extras_total: number | null
  our_extras_wides: number | null
  our_extras_no_balls: number | null
  our_extras_byes: number | null
  our_extras_leg_byes: number | null
  season: { name: string } | null
  battingPerformances: any[]
  bowlingPerformances: any[]
  fieldingPerformances: any[]
}

// Check if a player name indicates unclaimed
function isUnclaimed(name: string | undefined): boolean {
  return name?.toLowerCase().startsWith('unclaimed') || false
}

// Parse score string like "156/7" to get total
function parseScoreTotal(score: string | null): number | null {
  if (!score) return null
  const m = score.match(/^(\d+)/)
  return m ? parseInt(m[1]) : null
}

export default function MatchDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [match, setMatch] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  
  // Metadata editing state
  const [editingMetadata, setEditingMetadata] = useState(false)
  const [metadata, setMetadata] = useState({
    competition_name: '',
    match_type: 'league',
    venue: '',
    result: 'no_result',
    notes: '',
  })

  useEffect(() => {
    loadMatchDetails()
  }, [params.id])

  async function loadMatchDetails() {
    setLoading(true)
    
    // Get match info
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        season:seasons(name)
      `)
      .eq('id', params.id)
      .single()
    
    if (matchError || !matchData) {
      router.push('/matches')
      return
    }
    
    // Get batting performances
    const { data: battingPerformances } = await supabase
      .from('batting_performances')
      .select(`
        *,
        player:players(id, name)
      `)
      .eq('match_id', params.id)
      .order('batting_position')
    
    // Get bowling performances
    const { data: bowlingPerformances } = await supabase
      .from('bowling_performances')
      .select(`
        *,
        player:players(id, name)
      `)
      .eq('match_id', params.id)
      .order('created_at')
    
    // Get fielding performances
    const { data: fieldingPerformances } = await supabase
      .from('fielding_performances')
      .select(`
        *,
        player:players(id, name)
      `)
      .eq('match_id', params.id)

    const fullMatch = {
      ...matchData,
      battingPerformances: battingPerformances || [],
      bowlingPerformances: bowlingPerformances || [],
      fieldingPerformances: fieldingPerformances || [],
    }

    setMatch(fullMatch)
    setMetadata({
      competition_name: matchData.competition_name || '',
      match_type: matchData.match_type || 'league',
      venue: matchData.venue || '',
      result: matchData.result || 'no_result',
      notes: matchData.notes || '',
    })
    setLoading(false)
  }

  async function saveMetadata() {
    if (!match) return
    
    try {
      const response = await fetch('/api/matches/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          updates: metadata,
        }),
      })
      const result = await response.json()
      if (result.success) {
        loadMatchDetails()
        setEditingMetadata(false)
      } else {
        alert(result.error)
      }
    } catch (error) {
      alert('Failed to save changes')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-muted-foreground">
          Loading match details...
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-muted-foreground">
          Match not found
        </div>
      </div>
    )
  }

  // Calculate totals for read-only view
  const battingTotals = {
    runs: match.battingPerformances.reduce((s: number, p: any) => s + p.runs, 0),
    balls: match.battingPerformances.reduce((s: number, p: any) => s + p.balls, 0),
    fours: match.battingPerformances.reduce((s: number, p: any) => s + p.fours, 0),
    sixes: match.battingPerformances.reduce((s: number, p: any) => s + p.sixes, 0),
    wickets: match.battingPerformances.filter((p: any) => !p.not_out).length,
  }

  // Get extras from match data or calculate
  const teamTotal = parseScoreTotal(match.our_score)
  const extrasTotal = match.our_extras_total || (teamTotal !== null ? teamTotal - battingTotals.runs : 0)
  const extrasWides = match.our_extras_wides || 0
  const extrasNoBalls = match.our_extras_no_balls || 0
  const extrasByes = match.our_extras_byes || 0
  const extrasLegByes = match.our_extras_leg_byes || 0

  const fieldingTotals = {
    catches: match.fieldingPerformances.reduce((s: number, p: any) => s + p.catches, 0),
    runOuts: match.fieldingPerformances.reduce((s: number, p: any) => s + p.run_outs, 0),
    stumpings: match.fieldingPerformances.reduce((s: number, p: any) => s + p.stumpings, 0),
  }

  const ourTeam = match.our_team_name || 'UCLA'

  // Format extras string
  const extrasBreakdownParts = []
  if (extrasWides > 0) extrasBreakdownParts.push(`${extrasWides}w`)
  if (extrasNoBalls > 0) extrasBreakdownParts.push(`${extrasNoBalls}nb`)
  if (extrasByes > 0) extrasBreakdownParts.push(`${extrasByes}b`)
  if (extrasLegByes > 0) extrasBreakdownParts.push(`${extrasLegByes}lb`)
  const extrasBreakdownString = extrasBreakdownParts.length > 0 
    ? `(${extrasBreakdownParts.join(', ')})` 
    : '(wides, no-balls, byes, leg-byes)'

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Match Header */}
      <div className="bg-gradient-to-r from-ucla-blue to-ucla-blue/80 rounded-xl p-6 border border-ucla-gold/20 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <p className="text-sm text-white/70">
              {match.competition_name || 'League Match'} • {formatDate(match.date)}
              {match.venue && ` • ${match.venue}`}
            </p>
            <h1 className="text-3xl font-bold text-white mt-1">
              {ourTeam} vs {match.opponent}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Edit Toggle Button */}
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                editMode 
                  ? 'bg-ucla-gold text-black hover:bg-ucla-gold/90' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {editMode ? '✓ Done Editing' : '✏️ Edit Scorecard'}
            </button>
            
            {/* Result Badge */}
            <div className={`px-6 py-3 rounded-lg text-xl font-bold ${
              match.result === 'win' ? 'bg-green-600 text-white' :
              match.result === 'loss' ? 'bg-red-600 text-white' :
              match.result === 'tie' ? 'bg-yellow-600 text-black' :
              'bg-gray-600 text-white'
            }`}>
              {match.result === 'win' ? '🎉 WIN' :
               match.result === 'loss' ? 'LOSS' :
               match.result === 'tie' ? 'TIE' : 'N/R'}
            </div>
          </div>
        </div>
        
        {/* Score Summary */}
        <div className="grid grid-cols-2 gap-8 mt-4">
          <div className="bg-white/10 rounded-lg p-4">
            <span className="text-sm text-white/70 block">{ourTeam}</span>
            <span className="text-3xl font-bold text-white">
              {match.our_score || '-'}
            </span>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <span className="text-sm text-white/70 block">{match.opponent}</span>
            <span className="text-3xl font-bold text-white">
              {match.opponent_score || '-'}
            </span>
          </div>
        </div>
        
        {match.notes && (
          <p className="text-sm text-white/70 mt-4 border-t border-white/20 pt-4">
            📝 {match.notes}
          </p>
        )}
      </div>

      {/* Scorecard - Edit Mode or Read-Only */}
      {editMode ? (
        <>
          {/* Metadata Editor */}
          <div className="bg-card rounded-lg border border-border p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Match Details</h3>
              {!editingMetadata ? (
                <button
                  onClick={() => setEditingMetadata(true)}
                  className="text-sm text-ucla-blue hover:text-ucla-gold"
                >
                  ✏️ Edit Details
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={saveMetadata}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingMetadata(false)}
                    className="px-3 py-1 bg-muted text-white rounded text-sm hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            
            {editingMetadata ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Tournament/Competition Name
                  </label>
                  <input
                    type="text"
                    value={metadata.competition_name}
                    onChange={(e) => setMetadata(prev => ({ ...prev, competition_name: e.target.value }))}
                    placeholder="e.g., SoCal Premier League 2025"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Match Stage
                  </label>
                  <select
                    value={metadata.match_type}
                    onChange={(e) => setMetadata(prev => ({ ...prev, match_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-white"
                  >
                    <option value="league">League Stage</option>
                    <option value="playoff">Semi-Final</option>
                    <option value="tournament">Final</option>
                    <option value="friendly">Friendly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Result
                  </label>
                  <select
                    value={metadata.result}
                    onChange={(e) => setMetadata(prev => ({ ...prev, result: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-white"
                  >
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="tie">Tie</option>
                    <option value="no_result">No Result</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Venue
                  </label>
                  <input
                    type="text"
                    value={metadata.venue}
                    onChange={(e) => setMetadata(prev => ({ ...prev, venue: e.target.value }))}
                    placeholder="e.g., Woodley Park Cricket Field"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={metadata.notes}
                    onChange={(e) => setMetadata(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes about the match"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Tournament</span>
                  <span className="text-white font-medium">{match.competition_name || 'League Match'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Stage</span>
                  <span className="text-white font-medium capitalize">{match.match_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Venue</span>
                  <span className="text-white font-medium">{match.venue || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Result</span>
                  <span className="text-white font-medium capitalize">{match.result}</span>
                </div>
              </div>
            )}
          </div>
          
          <EditableScorecard
            matchId={match.id}
            ourTeam={ourTeam}
            opponent={match.opponent}
            ourScore={match.our_score}
            opponentScore={match.opponent_score}
            battingPerformances={match.battingPerformances}
            bowlingPerformances={match.bowlingPerformances}
            fieldingPerformances={match.fieldingPerformances}
            extrasTotal={extrasTotal}
            extrasWides={extrasWides}
            extrasNoBalls={extrasNoBalls}
            extrasByes={extrasByes}
            extrasLegByes={extrasLegByes}
            onUpdate={loadMatchDetails}
          />
        </>
      ) : (
        <div className="space-y-8">
          {/* Batting Scorecard - Read Only */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="bg-ucla-blue px-4 py-3">
              <h2 className="text-lg font-bold text-white">
                {ourTeam} Batting
                {match.our_score && <span className="ml-2 text-ucla-gold">{match.our_score}</span>}
              </h2>
            </div>
            
            {match.battingPerformances.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No batting data available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted text-muted-foreground text-sm">
                      <th className="px-4 py-3 text-left font-medium">Batter</th>
                      <th className="px-4 py-3 text-left font-medium">Dismissal</th>
                      <th className="px-4 py-3 text-center font-medium">R</th>
                      <th className="px-4 py-3 text-center font-medium">B</th>
                      <th className="px-4 py-3 text-center font-medium">4s</th>
                      <th className="px-4 py-3 text-center font-medium">6s</th>
                      <th className="px-4 py-3 text-center font-medium">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.battingPerformances.map((perf: any, idx: number) => {
                      const sr = perf.balls > 0 ? (perf.runs / perf.balls) * 100 : 0
                      const playerIsUnclaimed = isUnclaimed(perf.player?.name)
                      return (
                        <tr 
                          key={perf.id}
                          className={cn(
                            'border-b border-border hover:bg-muted/50 transition-colors',
                            idx % 2 === 0 ? '' : 'bg-muted/20',
                            playerIsUnclaimed && 'bg-orange-500/10'
                          )}
                        >
                          <td className="px-4 py-3">
                            <Link 
                              href={`/players/${perf.player?.id}`}
                              className="flex items-center gap-3 hover:text-ucla-gold transition-colors"
                            >
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold',
                                playerIsUnclaimed ? 'bg-orange-600' : 'bg-ucla-blue'
                              )}>
                                {playerIsUnclaimed ? '?' : getInitials(perf.player?.name || 'UN')}
                              </div>
                              <span className={cn(
                                'font-medium',
                                playerIsUnclaimed ? 'text-orange-400 italic' : 'text-white'
                              )}>
                                {playerIsUnclaimed ? '❓ ' : ''}{perf.player?.name}
                                {perf.not_out && <span className="text-ucla-gold">*</span>}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                            {perf.not_out ? 'not out' : perf.dismissal_text || '-'}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-ucla-gold">{perf.runs}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{perf.balls}</td>
                          <td className="px-4 py-3 text-center">{perf.fours}</td>
                          <td className="px-4 py-3 text-center">{perf.sixes}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{formatStat(sr, 1)}</td>
                        </tr>
                      )
                    })}
                    {/* Extras Row with Breakdown */}
                    <tr className="border-b border-border bg-muted/30">
                      <td className="px-4 py-3" colSpan={2}>
                        <span className="text-muted-foreground italic">Extras</span>
                        <span className="text-xs text-muted-foreground ml-2">{extrasBreakdownString}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-muted-foreground">
                        {extrasTotal > 0 ? extrasTotal : '-'}
                      </td>
                      <td className="px-4 py-3" colSpan={4}></td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted font-medium">
                      <td className="px-4 py-3" colSpan={2}>
                        <span className="text-white">Total</span>
                        <span className="text-muted-foreground ml-2">({battingTotals.wickets} wkts)</span>
                      </td>
                      <td className="px-4 py-3 text-center text-ucla-gold font-bold">
                        {teamTotal !== null ? teamTotal : battingTotals.runs}
                      </td>
                      <td className="px-4 py-3 text-center">{battingTotals.balls}</td>
                      <td className="px-4 py-3 text-center">{battingTotals.fours}</td>
                      <td className="px-4 py-3 text-center">{battingTotals.sixes}</td>
                      <td className="px-4 py-3 text-center">
                        {formatStat(battingTotals.balls > 0 ? (battingTotals.runs / battingTotals.balls) * 100 : 0, 1)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Bowling Scorecard - Read Only (No totals footer) */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="bg-green-700 px-4 py-3">
              <h2 className="text-lg font-bold text-white">
                {ourTeam} Bowling vs {match.opponent}&apos;s {match.opponent_score || '-'}
              </h2>
            </div>
            
            {match.bowlingPerformances.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No bowling data available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted text-muted-foreground text-sm">
                      <th className="px-4 py-3 text-left font-medium">Bowler</th>
                      <th className="px-4 py-3 text-center font-medium">O</th>
                      <th className="px-4 py-3 text-center font-medium">M</th>
                      <th className="px-4 py-3 text-center font-medium">R</th>
                      <th className="px-4 py-3 text-center font-medium">W</th>
                      <th className="px-4 py-3 text-center font-medium">Dots</th>
                      <th className="px-4 py-3 text-center font-medium">Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.bowlingPerformances.map((perf: any, idx: number) => {
                      const economy = perf.overs > 0 ? perf.runs_conceded / perf.overs : 0
                      const playerIsUnclaimed = isUnclaimed(perf.player?.name)
                      return (
                        <tr 
                          key={perf.id}
                          className={cn(
                            'border-b border-border hover:bg-muted/50 transition-colors',
                            idx % 2 === 0 ? '' : 'bg-muted/20',
                            playerIsUnclaimed && 'bg-orange-500/10'
                          )}
                        >
                          <td className="px-4 py-3">
                            <Link 
                              href={`/players/${perf.player?.id}`}
                              className="flex items-center gap-3 hover:text-green-400 transition-colors"
                            >
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold',
                                playerIsUnclaimed ? 'bg-orange-600' : 'bg-green-700'
                              )}>
                                {playerIsUnclaimed ? '?' : getInitials(perf.player?.name || 'UN')}
                              </div>
                              <span className={cn(
                                'font-medium',
                                playerIsUnclaimed ? 'text-orange-400 italic' : 'text-white'
                              )}>
                                {playerIsUnclaimed ? '❓ ' : ''}{perf.player?.name}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center">{perf.overs}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{perf.maidens}</td>
                          <td className="px-4 py-3 text-center">{perf.runs_conceded}</td>
                          <td className="px-4 py-3 text-center font-bold text-green-400">{perf.wickets}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{perf.dots}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{formatStat(economy, 2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Fielding Summary - Read Only */}
          {match.fieldingPerformances.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="bg-purple-700 px-4 py-3">
                <h2 className="text-lg font-bold text-white">
                  {ourTeam} Fielding
                  <span className="ml-2 text-purple-300">
                    {fieldingTotals.catches + fieldingTotals.runOuts + fieldingTotals.stumpings} dismissals
                  </span>
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted text-muted-foreground text-sm">
                      <th className="px-4 py-3 text-left font-medium">Fielder</th>
                      <th className="px-4 py-3 text-center font-medium">Catches</th>
                      <th className="px-4 py-3 text-center font-medium">Run Outs</th>
                      <th className="px-4 py-3 text-center font-medium">Stumpings</th>
                      <th className="px-4 py-3 text-center font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.fieldingPerformances
                      .filter((p: any) => p.catches > 0 || p.run_outs > 0 || p.stumpings > 0)
                      .map((perf: any, idx: number) => {
                        const playerIsUnclaimed = isUnclaimed(perf.player?.name)
                        return (
                          <tr 
                            key={perf.id}
                            className={cn(
                              'border-b border-border hover:bg-muted/50 transition-colors',
                              idx % 2 === 0 ? '' : 'bg-muted/20',
                              playerIsUnclaimed && 'bg-orange-500/10'
                            )}
                          >
                            <td className="px-4 py-3">
                              <Link 
                                href={`/players/${perf.player?.id}`}
                                className="flex items-center gap-3 hover:text-purple-400 transition-colors"
                              >
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold',
                                  playerIsUnclaimed ? 'bg-orange-600' : 'bg-purple-700'
                                )}>
                                  {playerIsUnclaimed ? '?' : getInitials(perf.player?.name || 'UN')}
                                </div>
                                <span className={cn(
                                  'font-medium',
                                  playerIsUnclaimed ? 'text-orange-400 italic' : 'text-white'
                                )}>
                                  {playerIsUnclaimed ? '❓ ' : ''}{perf.player?.name}
                                </span>
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-center">{perf.catches}</td>
                            <td className="px-4 py-3 text-center">{perf.run_outs}</td>
                            <td className="px-4 py-3 text-center">{perf.stumpings}</td>
                            <td className="px-4 py-3 text-center font-bold text-purple-400">
                              {perf.catches + perf.run_outs + perf.stumpings}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted font-medium">
                      <td className="px-4 py-3 text-white">Total</td>
                      <td className="px-4 py-3 text-center">{fieldingTotals.catches}</td>
                      <td className="px-4 py-3 text-center">{fieldingTotals.runOuts}</td>
                      <td className="px-4 py-3 text-center">{fieldingTotals.stumpings}</td>
                      <td className="px-4 py-3 text-center font-bold text-purple-400">
                        {fieldingTotals.catches + fieldingTotals.runOuts + fieldingTotals.stumpings}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Info Summary */}
      <div className="bg-card rounded-lg border border-border p-6 mt-8">
        <h3 className="text-lg font-bold text-white mb-4">Match Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Date</span>
            <span className="text-white font-medium">{formatDate(match.date)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Competition</span>
            <span className="text-white font-medium">{match.competition_name || 'League Match'}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Match Type</span>
            <span className="text-white font-medium capitalize">{match.match_type}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Season</span>
            <span className="text-white font-medium">{match.season?.name || '-'}</span>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="mt-8">
        <Link
          href="/matches"
          className="text-ucla-blue hover:text-ucla-gold transition-colors"
        >
          ← Back to Matches
        </Link>
      </div>
    </div>
  )
}
