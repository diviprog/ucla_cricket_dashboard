'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  } | null
  status: 'pending' | 'parsing' | 'parsed' | 'error'
  error?: string
  errorCode?: string
  errorDetails?: string
  content?: string
}

interface MatchGroup {
  key: string
  date: string
  teams: [string, string]
  files: ParsedFile[]
  metadata: {
    matchType: 'league' | 'playoff' | 'friendly' | 'tournament'
    competitionName: string
    ourTeamName: string
    notes: string
  }
}

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [matchGroups, setMatchGroups] = useState<MatchGroup[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)

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
        const content = await file.text()
        
        // Send to parse API
        const response = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: content, filename: file.name }),
        })
        
        const result = await response.json()
        
        if (result.success) {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'parsed', matchInfo: result.data, content }
              : f
          ))
        } else {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { 
                  ...f, 
                  status: 'error', 
                  error: result.error,
                  errorCode: result.errorCode,
                  errorDetails: result.details,
                }
              : f
          ))
        }
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'error', error: 'Network error: Failed to parse file', errorCode: 'NETWORK_ERROR' }
            : f
        ))
      }
    }
  }, [])

  const groupFilesByMatch = (currentFiles: ParsedFile[]) => {
    const parsedFiles = currentFiles.filter(f => f.status === 'parsed' && f.matchInfo)
    
    if (parsedFiles.length === 0) {
      setMatchGroups([])
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
    
    const newMatchGroups: MatchGroup[] = Array.from(groups.entries()).map(([key, groupFiles]) => ({
      key,
      date: groupFiles[0].matchInfo!.date,
      teams: groupFiles[0].matchInfo!.teams,
      files: groupFiles,
      metadata: {
        matchType: 'league',
        competitionName: groupFiles[0].matchInfo?.competition || '',
        ourTeamName: 'UCLA',
        notes: '',
      },
    }))
    
    setMatchGroups(newMatchGroups)
  }

  const updateMatchMetadata = (key: string, field: string, value: string) => {
    setMatchGroups(prev => prev.map(g => 
      g.key === key 
        ? { ...g, metadata: { ...g.metadata, [field]: value } }
        : g
    ))
  }

  const handleImport = async () => {
    setImporting(true)
    setImportResult(null)
    
    // Redirect to dashboard immediately - import happens in background
    router.push('/')
    
    try {
      for (const group of matchGroups) {
        // Find the main file (one with content)
        const mainFile = group.files.find(f => f.content)
        if (!mainFile?.content) continue
        
        const response = await fetch('/api/matches/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: mainFile.content,
            metadata: {
              ...group.metadata,
              date: group.date,
              teams: group.teams,
            },
          }),
        })
        
        const result = await response.json()
        
        if (!result.success) {
          console.error('Import error:', result.error)
        }
      }
    } catch (error) {
      console.error('Import failed:', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setImporting(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/html': ['.html', '.htm'],
    },
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">
        Upload <span className="text-ucla-gold">Match Scorecards</span>
      </h1>
      <p className="text-muted-foreground mb-2">
        Drag and drop CricClubs HTML files to import match data
      </p>
      <div className="bg-ucla-blue/20 border border-ucla-blue/40 rounded-lg p-4 mb-8">
        <p className="text-sm text-ucla-gold font-medium">💡 Important: Only upload "Full Scorecard" pages</p>
        <p className="text-xs text-muted-foreground mt-1">
          Go to CricClubs → Match → Click the <strong>"Full Scorecard"</strong> tab → Save page (Cmd+S or Ctrl+S)
        </p>
        <p className="text-xs text-muted-foreground">
          Other tabs (Info, Ball by Ball, Over by Over, Charts) will not work.
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
            <p className="text-lg text-white">Drag & drop HTML files here</p>
            <p className="text-sm text-muted-foreground mt-2">or click to select files</p>
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
          <div className="space-y-6">
            {matchGroups.map((group) => (
              <div 
                key={group.key}
                className="bg-card p-6 rounded-lg border border-border"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {group.teams[0]} vs {group.teams[1]}
                    </h3>
                    <p className="text-muted-foreground">{group.date}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.files.length} file(s) detected
                    </p>
                  </div>
                </div>

                {/* Metadata Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Match Type
                    </label>
                    <select
                      value={group.metadata.matchType}
                      onChange={(e) => updateMatchMetadata(group.key, 'matchType', e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-white"
                    >
                      <option value="league">League</option>
                      <option value="playoff">Playoff</option>
                      <option value="friendly">Friendly</option>
                      <option value="tournament">Tournament</option>
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
                      Our Team Name (if not UCLA)
                    </label>
                    <input
                      type="text"
                      value={group.metadata.ourTeamName}
                      onChange={(e) => updateMatchMetadata(group.key, 'ourTeamName', e.target.value)}
                      placeholder="UCLA"
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
              </div>
            ))}
          </div>

          {/* Import Button */}
          <div className="mt-6 flex items-center gap-4">
            <Button
              onClick={handleImport}
              disabled={importing}
              className="px-8"
            >
              {importing ? 'Importing...' : `Import ${matchGroups.length} Match(es)`}
            </Button>
            
            {importResult && (
              <p className={cn(
                'text-sm',
                importResult.success ? 'text-green-500' : 'text-red-500'
              )}>
                {importResult.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

