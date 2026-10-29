'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AdminGuard } from '@/components/admin-guard'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { adminFetch, isAuthError, ADMIN_AUTH_ERROR } from '@/lib/auth/admin-fetch'
import type { OurSide, PlayerDecision, PlayerSuggestion, Role } from '@/lib/import/import-plan'

interface TeamSide {
  team: string
  players: { name: string; roles: Role[]; suggestion: PlayerSuggestion }[]
}

interface RosterPlayer {
  id: string
  name: string
  is_ucla: boolean
}

// Select value per scorecard name: '' (undecided), 'new_ucla', 'guest' or 'link:<playerId>'
type DecisionValue = string

const MATCH_TYPES = ['league', 'playoff', 'friendly', 'tournament', 'intrasquad'] as const

const isUclaName = (team: string) => team.toLowerCase().includes('ucla')

function toDecision(value: DecisionValue): PlayerDecision | null {
  if (value === 'new_ucla') return { action: 'new_ucla' }
  if (value === 'guest') return { action: 'guest' }
  if (value.startsWith('link:')) return { action: 'link', playerId: value.slice(5) }
  return null
}

function defaultDecision(suggestion: PlayerSuggestion, team: string): DecisionValue {
  if (suggestion.type === 'existing') return suggestion.isUcla ? `link:${suggestion.playerId}` : 'guest'
  return isUclaName(team) ? 'new_ucla' : ''
}

/** Names on the chosen side(s), with the team each played for. */
function namesOnOurSide(sides: TeamSide[], ourSide: OurSide | null) {
  if (ourSide === null) return []
  const idx = ourSide === 'both' ? [0, 1] : [ourSide]
  return idx.flatMap(i => (sides[i]?.players || []).map(p => ({ ...p, team: sides[i].team, side: i })))
}

interface ParsedFile {
  id: string // unique ID for each file
  filename: string
  matchInfo: {
    date: string
    teams: [string, string]
    competition?: string
    result?: string
    battingEntries?: number
    bowlingEntries?: number
    sides?: TeamSide[]
    warnings?: string[]
  } | null
  status: 'pending' | 'parsing' | 'parsed' | 'error'
  error?: string
  errorCode?: string
  errorDetails?: string
  content?: string // HTML content (for HTML files)
  rawFile?: File // Original file (for webarchive files)
}

interface MatchGroup {
  key: string
  date: string
  teams: [string, string]
  files: ParsedFile[]
  sides: TeamSide[]
  warnings: string[]
  ourSide: OurSide | null
  decisions: Record<string, DecisionValue>
  metadata: {
    matchType: (typeof MATCH_TYPES)[number]
    competitionName: string
    notes: string
  }
  importStatus: 'idle' | 'importing' | 'success' | 'error'
  importMessage?: string
  matchId?: string
}

function withSide(group: MatchGroup, ourSide: OurSide | null): MatchGroup {
  const decisions: Record<string, DecisionValue> = {}
  for (const p of namesOnOurSide(group.sides, ourSide)) {
    decisions[p.name] = group.decisions[p.name] ?? defaultDecision(p.suggestion, p.team)
  }
  let matchType = group.metadata.matchType
  if (ourSide === 'both') matchType = 'intrasquad'
  else if (matchType === 'intrasquad') matchType = 'league'
  return { ...group, ourSide, decisions, metadata: { ...group.metadata, matchType } }
}

function isReady(group: MatchGroup) {
  return (
    group.ourSide !== null &&
    namesOnOurSide(group.sides, group.ourSide).every(p => toDecision(group.decisions[p.name] || '') !== null)
  )
}

export default function UploadPage() {
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([])
  const [importing, setImporting] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [roster, setRoster] = useState<RosterPlayer[]>([])

  useEffect(() => {
    fetch('/api/players/list')
      .then(r => r.json())
      .then(d => {
        if (d.success) setRoster(d.players.filter((p: RosterPlayer) => !p.name.toLowerCase().startsWith('unclaimed')))
      })
      .catch(() => {})
  }, [])

  // Auto-group files when they're all parsed
  useEffect(() => {
    const allParsed = files.length > 0 && files.every(f => f.status === 'parsed' || f.status === 'error')
    if (allParsed) {
      groupFilesByMatch(files)
    }
  }, [files])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Add files to state with unique IDs
    const newFiles: ParsedFile[] = acceptedFiles.map((f, idx) => ({
      id: `${Date.now()}-${idx}-${f.name}`,
      filename: f.name,
      matchInfo: null,
      status: 'pending' as const,
    }))

    setFiles(prev => [...prev, ...newFiles])

    // Parse each file
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i]
      const fileId = newFiles[i].id

      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'parsing' } : f
      ))

      try {
        // For all files (HTML and webarchive), send as FormData to server
        // Server will handle extraction if needed
        const formData = new FormData()
        formData.append('file', file)

        // Send to parse API (which now handles both HTML and webarchive)
        const response = await adminFetch('/api/parse', {
          method: 'POST',
          body: formData, // Send as FormData, not JSON
        })

        const result = await response.json()

        // For webarchive files, we need to extract HTML again for import
        // For HTML files, just read the text
        let content: string | undefined
        const isWebArchiveFile = file.name.toLowerCase().endsWith('.webarchive')

        if (isWebArchiveFile) {
          // For webarchive, we'll need to send the file itself during import
          // Store the file reference instead of content
          content = undefined // Will send file during import
        } else {
          content = await file.text()
        }

        if (result.success) {
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? { ...f, status: 'parsed', matchInfo: result.data, content, rawFile: isWebArchiveFile ? file : undefined }
              : f
          ))
        } else {
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? {
                  ...f,
                  status: 'error',
                  error: isAuthError(response) ? ADMIN_AUTH_ERROR : result.error,
                  errorCode: result.errorCode,
                  errorDetails: result.details,
                }
              : f
          ))
        }
      } catch (error) {
        setFiles(prev => prev.map(f =>
          f.id === fileId
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Failed to parse file', errorCode: 'PARSE_ERROR' }
            : f
        ))
      }
    }
  }, [])

  const groupFilesByMatch = (currentFiles: ParsedFile[]) => {
    const parsedFiles = currentFiles.filter(f => f.status === 'parsed' && f.matchInfo)

    if (parsedFiles.length === 0) {
      setMatchGroups([])
      setExpandedGroups(new Set())
      return
    }

    const groups = new Map<string, ParsedFile[]>()

    parsedFiles.forEach(file => {
      if (!file.matchInfo) return
      const key = `${file.matchInfo.date}_${[...file.matchInfo.teams].sort().join('_')}`

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(file)
    })

    const newMatchGroups: MatchGroup[] = Array.from(groups.entries()).map(([key, groupFiles]) => {
      // The file that gets imported is the one whose sides we review
      const mainInfo = (groupFiles.find(f => f.content || f.rawFile) || groupFiles[0]).matchInfo!
      const sides = mainInfo.sides || []
      const uclaSides = sides.map((s, i) => (isUclaName(s.team) ? i : -1)).filter(i => i >= 0)
      const preselected: OurSide | null = uclaSides.length === 1 ? (uclaSides[0] as 0 | 1) : null
      // Keep choices already made for this match if files are added later
      const previous = matchGroups.find(g => g.key === key)
      if (previous) return { ...previous, files: groupFiles }
      const base: MatchGroup = {
        key,
        date: mainInfo.date,
        teams: mainInfo.teams,
        files: groupFiles,
        sides,
        warnings: mainInfo.warnings || [],
        ourSide: null,
        decisions: {},
        metadata: {
          matchType: 'league',
          competitionName: mainInfo.competition || '',
          notes: '',
        },
        importStatus: 'idle',
      }
      return withSide(base, preselected)
    })

    setMatchGroups(newMatchGroups)

    // Auto-expand the first match
    if (newMatchGroups.length > 0) {
      setExpandedGroups(new Set([newMatchGroups[0].key]))
    }
  }

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const updateGroup = (key: string, fn: (g: MatchGroup) => MatchGroup) => {
    setMatchGroups(prev => prev.map(g => (g.key === key ? fn(g) : g)))
  }

  const updateMatchMetadata = (key: string, field: string, value: string) => {
    updateGroup(key, g => {
      if (field === 'matchType' && value === 'intrasquad') return withSide(g, 'both')
      if (field === 'matchType' && g.ourSide === 'both') {
        // Leaving intrasquad means picking one side again
        return { ...withSide(g, null), metadata: { ...g.metadata, matchType: value as MatchGroup['metadata']['matchType'] } }
      }
      return { ...g, metadata: { ...g.metadata, [field]: value } }
    })
  }

  const setDecision = (key: string, name: string, value: DecisionValue) => {
    updateGroup(key, g => ({ ...g, decisions: { ...g.decisions, [name]: value } }))
  }

  const pendingGroups = matchGroups.filter(g => g.importStatus !== 'success')
  const canImport = pendingGroups.length > 0 && pendingGroups.every(isReady)

  const importGroup = async (group: MatchGroup) => {
    const mainFile = group.files.find(f => f.content || f.rawFile)
    if (!mainFile || group.ourSide === null) return
    updateGroup(group.key, g => ({ ...g, importStatus: 'importing', importMessage: undefined }))

    const playerDecisions: Record<string, PlayerDecision> = {}
    for (const p of namesOnOurSide(group.sides, group.ourSide)) {
      const d = toDecision(group.decisions[p.name] || '')
      if (d) playerDecisions[p.name] = d
    }
    const metadata = { ...group.metadata, date: group.date, teams: group.teams }

    try {
      let response: Response
      if (mainFile.rawFile) {
        // Webarchive files go up as FormData
        const formData = new FormData()
        formData.append('file', mainFile.rawFile)
        formData.append('metadata', JSON.stringify(metadata))
        formData.append('ourSide', String(group.ourSide))
        formData.append('playerDecisions', JSON.stringify(playerDecisions))
        response = await adminFetch('/api/matches/import', { method: 'POST', body: formData })
      } else {
        response = await adminFetch('/api/matches/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: mainFile.content, metadata, ourSide: group.ourSide, playerDecisions }),
        })
      }
      const result = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` }))
      updateGroup(group.key, g => ({
        ...g,
        importStatus: result.success ? 'success' : 'error',
        importMessage: isAuthError(response)
          ? ADMIN_AUTH_ERROR
          : result.success
            ? result.message
            : result.errorCode === 'ALREADY_IMPORTED'
              ? 'Already imported.'
              : result.error || 'Import failed',
        matchId: result.matchId,
      }))
    } catch (error) {
      updateGroup(group.key, g => ({
        ...g,
        importStatus: 'error',
        importMessage: error instanceof Error ? error.message : 'Import failed',
      }))
    }
  }

  const handleImport = async () => {
    setImporting(true)
    for (const group of pendingGroups) {
      await importGroup(group)
    }
    setImporting(false)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/html': ['.html', '.htm'],
      'application/x-webarchive': ['.webarchive'],
    },
  })

  return (
    <AdminGuard>
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">
        Upload <span className="text-ucla-gold">Match Scorecards</span>
      </h1>
      <p className="text-muted-foreground mb-2">
        Drag and drop CricClubs or CricCenter HTML files (or Safari WebArchive files) to import match data
      </p>
      <div className="bg-ucla-blue/20 border border-ucla-blue/40 rounded-lg p-4 mb-8">
        <p className="text-sm text-ucla-gold font-medium">💡 Supported Formats</p>
        <p className="text-xs text-muted-foreground mt-1">
          <strong>CricClubs:</strong> Match → "Full Scorecard" tab → Save page (Cmd+S or Ctrl+S)
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>CricCenter:</strong> Match → "Scorecard" tab → Save page (Cmd+S or Ctrl+S)
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          📄 Accepts: .html, .htm, .webarchive (Safari Web Archive)
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          ⚠️ Other tabs (Info, Ball by Ball, Charts, etc.) will not work.
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
          isDragActive 
            ? 'border-ucla-gold bg-ucla-gold/10' 
            : 'border-border hover:border-ucla-blue hover:bg-ucla-blue/5'
        )}
      >
        <input {...getInputProps()} />
        <div className="text-5xl mb-4">📁</div>
        {isDragActive ? (
          <p className="text-lg text-ucla-gold">Drop the files here...</p>
        ) : (
          <>
            <p className="text-lg text-white">Drag & drop HTML or WebArchive files here</p>
            <p className="text-sm text-muted-foreground mt-2">or click to select files (.html, .htm, .webarchive)</p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Uploaded Files</h2>
          <div className="space-y-2">
            {files.map((file) => (
              <div 
                key={file.id}
                className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border"
              >
                <div className="text-2xl">
                  {file.status === 'pending' && '⏳'}
                  {file.status === 'parsing' && '🔄'}
                  {file.status === 'parsed' && '✅'}
                  {file.status === 'error' && '❌'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{file.filename}</p>
                  {file.matchInfo && (
                    <p className="text-sm text-muted-foreground">
                      {file.matchInfo.teams[0]} vs {file.matchInfo.teams[1]} • {file.matchInfo.date}
                      {file.matchInfo.battingEntries !== undefined && (
                        <span className="ml-2 text-green-400">
                          ({file.matchInfo.battingEntries} batters, {file.matchInfo.bowlingEntries} bowlers)
                        </span>
                      )}
                    </p>
                  )}
                  {file.error && (
                    <div className="mt-1 p-2 bg-red-900/30 border border-red-600/50 rounded">
                      <p className="text-sm font-medium text-red-400">
                        {file.errorCode === 'WRONG_PAGE_TYPE' && '⚠️ '}
                        {file.error}
                      </p>
                      {file.errorDetails && (
                        <p className="text-xs text-red-300/80 mt-1">{file.errorDetails}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match Groups */}
      {matchGroups.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Detected Matches ({matchGroups.length})
          </h2>
          <div className="space-y-3">
            {matchGroups.map((group, index) => {
              const isExpanded = expandedGroups.has(group.key)
              const ourNames = namesOnOurSide(group.sides, group.ourSide)
              const undecided = ourNames.filter(p => toDecision(group.decisions[p.name] || '') === null).length
              const locked = group.importStatus === 'importing' || group.importStatus === 'success'
              const sideOptions: { value: OurSide; label: string }[] = [
                { value: 0, label: `Team A: ${group.sides[0]?.team ?? group.teams[0]}` },
                { value: 1, label: `Team B: ${group.sides[1]?.team ?? group.teams[1]}` },
                { value: 'both', label: 'Both (intrasquad)' },
              ]
              return (
                <div
                  key={group.key}
                  className="bg-card rounded-lg border border-border overflow-hidden"
                >
                  {/* Collapsible Header */}
                  <button
                    onClick={() => toggleGroupExpanded(group.key)}
                    className="w-full flex items-center justify-between p-4 hover:bg-background/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ucla-gold/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-ucla-gold">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {group.teams[0]} vs {group.teams[1]}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {group.date} • {group.files.length} file(s)
                          {group.ourSide === null && <span className="ml-2 text-orange-400">Choose our side</span>}
                          {group.ourSide !== null && undecided > 0 && (
                            <span className="ml-2 text-orange-400">{undecided} player(s) to review</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {/* Import result for this match */}
                  {group.importStatus !== 'idle' && (
                    <div className={cn(
                      'mx-4 mb-4 p-3 rounded border text-sm',
                      group.importStatus === 'success' && 'bg-green-900/30 border-green-600/50 text-green-300',
                      group.importStatus === 'error' && 'bg-red-900/30 border-red-600/50 text-red-300',
                      group.importStatus === 'importing' && 'bg-ucla-blue/20 border-ucla-blue/40 text-white'
                    )}>
                      {group.importStatus === 'importing' ? 'Importing...' : group.importMessage}
                      {group.matchId && group.importStatus !== 'importing' && (
                        <Link href={`/matches/${group.matchId}`} className="ml-2 underline text-ucla-gold">
                          View match
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Metadata Form (collapsible) */}
                  {isExpanded && (
                    <fieldset disabled={locked} className="px-4 pb-4 border-t border-border">
                      {/* Our side */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Which side is us?
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {sideOptions.map(opt => (
                            <button
                              key={String(opt.value)}
                              type="button"
                              onClick={() => updateGroup(group.key, g => withSide(g, opt.value))}
                              className={cn(
                                'px-3 py-2 rounded-md border text-sm transition-colors',
                                group.ourSide === opt.value
                                  ? 'bg-ucla-blue border-ucla-blue text-white'
                                  : 'bg-background border-border text-muted-foreground hover:border-ucla-blue'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {group.warnings.map(w => (
                          <p key={w} className="text-xs text-orange-400 mt-2">⚠️ {w}</p>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Match Type
                    </label>
                    <select
                      value={group.metadata.matchType}
                      onChange={(e) => updateMatchMetadata(group.key, 'matchType', e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-white"
                    >
                      {MATCH_TYPES.map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Competition Name
                    </label>
                    <input
                      type="text"
                      value={group.metadata.competitionName}
                      onChange={(e) => updateMatchMetadata(group.key, 'competitionName', e.target.value)}
                      placeholder="e.g., West Coast Regionals 2025"
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={group.metadata.notes}
                      onChange={(e) => updateMatchMetadata(group.key, 'notes', e.target.value)}
                      placeholder="Any special notes (e.g., player swaps)"
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-white"
                    />
                  </div>
                </div>

                      {/* Player review */}
                      {group.ourSide !== null && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-white mb-1">Players on our side</h4>
                          <p className="text-xs text-muted-foreground mb-3">
                            Link each scorecard name to an existing player, add a new UCLA player, or mark a guest.
                            Guests are stored but left out of individual stats.
                          </p>
                          {(group.ourSide === 'both' ? [0, 1] : [group.ourSide]).map(sideIdx => (
                            <div key={sideIdx} className="mb-4 rounded-md border border-border overflow-hidden">
                              <div className="bg-muted px-3 py-2 text-sm font-medium text-white">
                                {group.sides[sideIdx]?.team}
                              </div>
                              <div className="divide-y divide-border">
                                {ourNames.filter(p => p.side === sideIdx).map(p => {
                                  const value = group.decisions[p.name] || ''
                                  return (
                                    <div key={p.name} className="flex flex-col md:flex-row md:items-center gap-2 px-3 py-2">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-white font-medium">{p.name}</span>
                                        {p.roles.map(r => (
                                          <span key={r} className="ml-2 inline-block px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                                            {r}
                                          </span>
                                        ))}
                                        {p.suggestion.type === 'existing' && (
                                          <span className="ml-2 text-xs text-muted-foreground">
                                            matched {p.suggestion.playerName}{p.suggestion.isUcla ? '' : ' (guest)'}
                                          </span>
                                        )}
                                      </div>
                                      <select
                                        value={value}
                                        onChange={(e) => setDecision(group.key, p.name, e.target.value)}
                                        className={cn(
                                          'md:w-72 bg-background border rounded-md px-3 py-1.5 text-sm text-white',
                                          value ? 'border-border' : 'border-orange-500'
                                        )}
                                      >
                                        <option value="">Choose...</option>
                                        <option value="new_ucla">New UCLA player</option>
                                        <option value="guest">Guest (not UCLA)</option>
                                        <optgroup label="Link to existing player">
                                          {roster.map(r => (
                                            <option key={r.id} value={`link:${r.id}`}>
                                              {r.name}{r.is_ucla ? '' : ' (guest)'}
                                            </option>
                                          ))}
                                        </optgroup>
                                      </select>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  )}
                </div>
              )
            })}
          </div>

          {/* Import Button */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button
              onClick={handleImport}
              disabled={importing || !canImport}
              className="px-8"
            >
              {importing ? 'Importing...' : `Import ${pendingGroups.length} Match(es)`}
            </Button>
            {!canImport && pendingGroups.length > 0 && !importing && (
              <p className="text-sm text-muted-foreground">Choose our side and review every player first.</p>
            )}
            {matchGroups.some(g => g.importStatus === 'success') && !importing && (
              <Link href="/" className="text-sm text-ucla-gold underline">Go to dashboard</Link>
            )}
          </div>
        </div>
      )}
    </div>
    </AdminGuard>
  )
}

