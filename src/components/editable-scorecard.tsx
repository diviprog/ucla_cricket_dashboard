'use client'

import { useState, useEffect, useRef } from 'react'
import { formatStat, getInitials, cn } from '@/lib/utils'

interface Player {
  id: string
  name: string
}

interface BattingPerformance {
  id: string
  player_id: string
  player: Player | null
  runs: number
  balls: number
  fours: number
  sixes: number
  not_out: boolean
  dismissal_text: string | null
}

interface BowlingPerformance {
  id: string
  player_id: string
  player: Player | null
  overs: number
  maidens: number
  runs_conceded: number
  wickets: number
  dots: number
  economy: number
}

interface FieldingPerformance {
  id: string
  player_id: string
  player: Player | null
  catches: number
  run_outs: number
  stumpings: number
}

interface EditableScorecardProps {
  matchId: string
  ourTeam: string
  opponent: string
  ourScore: string | null
  opponentScore: string | null
  battingPerformances: BattingPerformance[]
  bowlingPerformances: BowlingPerformance[]
  fieldingPerformances: FieldingPerformance[]
  extrasTotal?: number
  extrasWides?: number
  extrasNoBalls?: number
  extrasByes?: number
  extrasLegByes?: number
  onUpdate: () => void
}

// Special player ID for unclaimed performances
const UNCLAIMED_PLAYER_ID = 'unclaimed'

// Check if a player name indicates unclaimed
function isUnclaimed(name: string | undefined): boolean {
  return name?.toLowerCase().startsWith('unclaimed') || false
}

// Parse score string like "156/7" to get total
function parseScoreTotal(score: string | null): number | null {
  if (!score) return null
  const match = score.match(/^(\d+)/)
  return match ? parseInt(match[1]) : null
}

export function EditableScorecard({
  matchId,
  ourTeam,
  opponent,
  ourScore,
  opponentScore,
  battingPerformances,
  bowlingPerformances,
  fieldingPerformances,
  extrasTotal = 0,
  extrasWides = 0,
  extrasNoBalls = 0,
  extrasByes = 0,
  extrasLegByes = 0,
  onUpdate,
}: EditableScorecardProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [editingPlayer, setEditingPlayer] = useState<{ id: string; type: string } | null>(null)
  const [editingStats, setEditingStats] = useState<{ id: string; type: string; field: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch players on mount
  useEffect(() => {
    fetchPlayers()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEditingPlayer(null)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchPlayers() {
    const response = await fetch('/api/players/list')
    const data = await response.json()
    if (data.success) {
      // Filter out unclaimed players from the roster list
      setPlayers(data.players.filter((p: Player) => !isUnclaimed(p.name)))
    }
  }

  async function handleReassign(performanceId: string, performanceType: string, newPlayerId: string) {
    setLoading(true)
    try {
      const response = await fetch('/api/performances/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceId,
          performanceType,
          newPlayerId,
          matchId,
        }),
      })
      const result = await response.json()
      if (result.success) {
        onUpdate()
      } else {
        alert(result.error)
      }
    } catch (error) {
      alert('Failed to reassign player')
    } finally {
      setLoading(false)
      setEditingPlayer(null)
      setSearchTerm('')
    }
  }

  async function handleStatUpdate(
    performanceId: string, 
    performanceType: string, 
    field: string, 
    value: number | boolean | string
  ) {
    try {
      const response = await fetch('/api/performances/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceId,
          performanceType,
          matchId,
          updates: { [field]: value },
        }),
      })
      const result = await response.json()
      if (result.success) {
        onUpdate()
      } else {
        alert(result.error)
      }
    } catch (error) {
      alert('Failed to update stat')
    } finally {
      setEditingStats(null)
    }
  }

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate totals
  const battingTotals = {
    runs: battingPerformances.reduce((s, p) => s + p.runs, 0),
    balls: battingPerformances.reduce((s, p) => s + p.balls, 0),
    fours: battingPerformances.reduce((s, p) => s + p.fours, 0),
    sixes: battingPerformances.reduce((s, p) => s + p.sixes, 0),
    wickets: battingPerformances.filter(p => !p.not_out).length,
  }

  // Use passed extras or calculate from score difference
  const teamTotal = parseScoreTotal(ourScore)
  const calculatedExtras = teamTotal !== null ? teamTotal - battingTotals.runs : 0
  const displayExtrasTotal = extrasTotal > 0 ? extrasTotal : calculatedExtras

  // Format extras breakdown string
  const extrasBreakdownParts = []
  if (extrasWides > 0) extrasBreakdownParts.push(`${extrasWides}w`)
  if (extrasNoBalls > 0) extrasBreakdownParts.push(`${extrasNoBalls}nb`)
  if (extrasByes > 0) extrasBreakdownParts.push(`${extrasByes}b`)
  if (extrasLegByes > 0) extrasBreakdownParts.push(`${extrasLegByes}lb`)
  const extrasBreakdownString = extrasBreakdownParts.length > 0 
    ? `(${extrasBreakdownParts.join(', ')})` 
    : '(wides, no-balls, byes, leg-byes)'

  const fieldingTotals = {
    catches: fieldingPerformances.reduce((s, p) => s + p.catches, 0),
    runOuts: fieldingPerformances.reduce((s, p) => s + p.run_outs, 0),
    stumpings: fieldingPerformances.reduce((s, p) => s + p.stumpings, 0),
  }

  // Player selector dropdown
  function PlayerDropdown({ 
    perfId, 
    perfType, 
    currentName,
    isUnclaimedPlayer,
  }: { 
    perfId: string
    perfType: string
    currentName: string
    isUnclaimedPlayer: boolean
  }) {
    const isOpen = editingPlayer?.id === perfId && editingPlayer?.type === perfType

    return (
      <div className="relative" ref={isOpen ? dropdownRef : null}>
        <button
          onClick={() => setEditingPlayer(isOpen ? null : { id: perfId, type: perfType })}
          className={cn(
            'flex items-center gap-2 px-2 py-1 rounded hover:bg-muted transition-colors text-left',
            isOpen && 'bg-muted',
            isUnclaimedPlayer && 'bg-orange-500/20 border border-orange-500/50'
          )}
          disabled={loading}
        >
          <span className="text-xs text-muted-foreground">✏️</span>
          <span className={cn(
            'font-medium',
            isUnclaimedPlayer ? 'text-orange-400 italic' : 'text-white'
          )}>
            {isUnclaimedPlayer ? '❓ ' : ''}{currentName}
          </span>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-border">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white placeholder:text-muted-foreground"
                autoFocus
              />
            </div>

            {/* Player List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleReassign(perfId, perfType, player.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-ucla-blue flex items-center justify-center text-white text-xs font-bold">
                    {getInitials(player.name)}
                  </div>
                  <span className="text-white">{player.name}</span>
                </button>
              ))}
              
              {filteredPlayers.length === 0 && (
                <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                  No players found
                </div>
              )}
            </div>

            {/* Unclaimed Option */}
            <div className="border-t border-border p-2">
              <button
                onClick={() => handleReassign(perfId, perfType, UNCLAIMED_PLAYER_ID)}
                className="w-full px-3 py-2 text-left text-sm text-orange-400 hover:bg-orange-500/10 rounded transition-colors flex items-center gap-2"
              >
                <span>❓</span>
                <span>Mark as Unclaimed/Misc</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Editable stat cell
  function EditableStatCell({
    perfId,
    perfType,
    field,
    value,
    isHighlight = false,
  }: {
    perfId: string
    perfType: string
    field: string
    value: number
    isHighlight?: boolean
  }) {
    const isEditing = editingStats?.id === perfId && editingStats?.type === perfType && editingStats?.field === field
    const [tempValue, setTempValue] = useState(value.toString())

    if (isEditing) {
      return (
        <td className="px-4 py-3 text-center">
          <input
            type="number"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => handleStatUpdate(perfId, perfType, field, parseInt(tempValue) || 0)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleStatUpdate(perfId, perfType, field, parseInt(tempValue) || 0)
              } else if (e.key === 'Escape') {
                setEditingStats(null)
              }
            }}
            className="w-16 px-2 py-1 bg-background border border-ucla-gold rounded text-center text-white text-sm"
            autoFocus
          />
        </td>
      )
    }

    return (
      <td 
        className={cn(
          'px-4 py-3 text-center cursor-pointer hover:bg-muted/50 transition-colors',
          isHighlight ? 'font-bold text-ucla-gold' : ''
        )}
        onClick={() => {
          setTempValue(value.toString())
          setEditingStats({ id: perfId, type: perfType, field })
        }}
        title="Click to edit"
      >
        {value}
      </td>
    )
  }

  return (
    <div className="space-y-8">
      {/* Edit Mode Banner */}
      <div className="bg-ucla-gold/10 border border-ucla-gold/30 rounded-lg p-4 flex items-center gap-3">
        <span className="text-2xl">✏️</span>
        <div>
          <p className="font-medium text-ucla-gold">Edit Mode Active</p>
          <p className="text-sm text-muted-foreground">
            Click on player names to reassign, or click on stats to edit values. 
            <span className="text-orange-400 ml-1">Orange highlights</span> indicate unclaimed performances.
          </p>
        </div>
      </div>

      {/* Batting Scorecard */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-ucla-blue px-4 py-3">
          <h2 className="text-lg font-bold text-white">
            {ourTeam} Batting
            {ourScore && <span className="ml-2 text-ucla-gold">{ourScore}</span>}
          </h2>
        </div>
        
        {battingPerformances.length === 0 ? (
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
                {battingPerformances.map((perf, idx) => {
                  const sr = perf.balls > 0 ? (perf.runs / perf.balls) * 100 : 0
                  const playerIsUnclaimed = isUnclaimed(perf.player?.name)
                  return (
                    <tr 
                      key={perf.id}
                      className={cn(
                        'border-b border-border',
                        idx % 2 === 0 ? '' : 'bg-muted/20',
                        playerIsUnclaimed && 'bg-orange-500/10'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold',
                            playerIsUnclaimed ? 'bg-orange-600' : 'bg-ucla-blue'
                          )}>
                            {playerIsUnclaimed ? '?' : getInitials(perf.player?.name || 'UN')}
                          </div>
                          <PlayerDropdown
                            perfId={perf.id}
                            perfType="batting"
                            currentName={`${perf.player?.name || 'Unknown'}${perf.not_out ? '*' : ''}`}
                            isUnclaimedPlayer={playerIsUnclaimed}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                        {perf.not_out ? 'not out' : perf.dismissal_text || '-'}
                      </td>
                      <EditableStatCell perfId={perf.id} perfType="batting" field="runs" value={perf.runs} isHighlight />
                      <EditableStatCell perfId={perf.id} perfType="batting" field="balls" value={perf.balls} />
                      <EditableStatCell perfId={perf.id} perfType="batting" field="fours" value={perf.fours} />
                      <EditableStatCell perfId={perf.id} perfType="batting" field="sixes" value={perf.sixes} />
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
                    {displayExtrasTotal > 0 ? displayExtrasTotal : '-'}
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

      {/* Bowling Scorecard */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-green-700 px-4 py-3">
          <h2 className="text-lg font-bold text-white">
            {ourTeam} Bowling vs {opponent}&apos;s {opponentScore || '-'}
          </h2>
        </div>
        
        {bowlingPerformances.length === 0 ? (
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
                {bowlingPerformances.map((perf, idx) => {
                  const economy = perf.overs > 0 ? perf.runs_conceded / perf.overs : 0
                  const playerIsUnclaimed = isUnclaimed(perf.player?.name)
                  return (
                    <tr 
                      key={perf.id}
                      className={cn(
                        'border-b border-border',
                        idx % 2 === 0 ? '' : 'bg-muted/20',
                        playerIsUnclaimed && 'bg-orange-500/10'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold',
                            playerIsUnclaimed ? 'bg-orange-600' : 'bg-green-700'
                          )}>
                            {playerIsUnclaimed ? '?' : getInitials(perf.player?.name || 'UN')}
                          </div>
                          <PlayerDropdown
                            perfId={perf.id}
                            perfType="bowling"
                            currentName={perf.player?.name || 'Unknown'}
                            isUnclaimedPlayer={playerIsUnclaimed}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{perf.overs}</td>
                      <EditableStatCell perfId={perf.id} perfType="bowling" field="maidens" value={perf.maidens} />
                      <EditableStatCell perfId={perf.id} perfType="bowling" field="runs_conceded" value={perf.runs_conceded} />
                      <EditableStatCell perfId={perf.id} perfType="bowling" field="wickets" value={perf.wickets} isHighlight />
                      <EditableStatCell perfId={perf.id} perfType="bowling" field="dots" value={perf.dots} />
                      <td className="px-4 py-3 text-center text-muted-foreground">{formatStat(economy, 2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              {/* No tfoot for bowling - removed as requested */}
            </table>
          </div>
        )}
      </div>

      {/* Fielding Scorecard */}
      {fieldingPerformances.length > 0 && (
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
                {fieldingPerformances
                  .filter(p => p.catches > 0 || p.run_outs > 0 || p.stumpings > 0)
                  .map((perf, idx) => {
                    const playerIsUnclaimed = isUnclaimed(perf.player?.name)
                    return (
                      <tr 
                        key={perf.id}
                        className={cn(
                          'border-b border-border',
                          idx % 2 === 0 ? '' : 'bg-muted/20',
                          playerIsUnclaimed && 'bg-orange-500/10'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold',
                              playerIsUnclaimed ? 'bg-orange-600' : 'bg-purple-700'
                            )}>
                              {playerIsUnclaimed ? '?' : getInitials(perf.player?.name || 'UN')}
                            </div>
                            <PlayerDropdown
                              perfId={perf.id}
                              perfType="fielding"
                              currentName={perf.player?.name || 'Unknown'}
                              isUnclaimedPlayer={playerIsUnclaimed}
                            />
                          </div>
                        </td>
                        <EditableStatCell perfId={perf.id} perfType="fielding" field="catches" value={perf.catches} />
                        <EditableStatCell perfId={perf.id} perfType="fielding" field="run_outs" value={perf.run_outs} />
                        <EditableStatCell perfId={perf.id} perfType="fielding" field="stumpings" value={perf.stumpings} />
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
  )
}
