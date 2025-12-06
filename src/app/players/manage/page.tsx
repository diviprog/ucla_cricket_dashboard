'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Player {
  id: string
  name: string
  aliases: string[]
}

export default function ManagePlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newAlias, setNewAlias] = useState<{ playerId: string; alias: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    try {
      const response = await fetch('/api/players')
      const data = await response.json()
      if (data.success) {
        setPlayers(data.players)
      }
    } catch (error) {
      console.error('Error fetching players:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return
    
    setSaving(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlayerName.trim() }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMessage({ type: 'success', text: `Player "${newPlayerName}" added!` })
        setNewPlayerName('')
        fetchPlayers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add player' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add player' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddAlias = async () => {
    if (!newAlias?.playerId || !newAlias.alias.trim()) return
    
    setSaving(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/players/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          playerId: newAlias.playerId, 
          alias: newAlias.alias.trim() 
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMessage({ type: 'success', text: `Alias "${newAlias.alias}" added!` })
        setNewAlias(null)
        fetchPlayers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add alias' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add alias' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-5xl mb-4 animate-spin">⏳</div>
          <p className="text-muted-foreground">Loading players...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">
        Manage <span className="text-ucla-gold">Players</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Add players and manage their aliases for name resolution
      </p>

      {/* Message */}
      {message && (
        <div className={cn(
          'mb-6 p-4 rounded-lg',
          message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        )}>
          {message.text}
        </div>
      )}

      {/* Add New Player */}
      <div className="bg-card rounded-lg p-6 border border-border mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Add New Player</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Player name (e.g., Naman Satija)"
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
          />
          <Button onClick={handleAddPlayer} disabled={saving || !newPlayerName.trim()}>
            {saving ? 'Adding...' : 'Add Player'}
          </Button>
        </div>
      </div>

      {/* Player List */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-semibold text-white">
            Player Roster ({players.length})
          </h2>
        </div>
        
        <div className="divide-y divide-border">
          {players.map((player) => (
            <div key={player.id} className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{player.name}</h3>
                  {player.aliases.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Aliases: {player.aliases.join(', ')}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {newAlias?.playerId === player.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAlias.alias}
                        onChange={(e) => setNewAlias({ ...newAlias, alias: e.target.value })}
                        placeholder="New alias"
                        className="w-40 bg-background border border-border rounded-md px-2 py-1 text-sm text-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleAddAlias} disabled={saving}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNewAlias(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setNewAlias({ playerId: player.id, alias: '' })}
                    >
                      + Add Alias
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

