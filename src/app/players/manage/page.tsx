'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AdminGuard } from '@/components/admin-guard'

interface Player {
  id: string
  name: string
  aliases: string[]
}

export default function ManagePlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

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

  const handleDeletePlayer = async (player: Player) => {
    setDeleting(player.id)
    setMessage(null)
    
    try {
      const response = await fetch(`/api/players?id=${player.id}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMessage({ type: 'success', text: `Player "${player.name}" deleted!` })
        setConfirmDelete(null)
        fetchPlayers()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete player' })
        setConfirmDelete(null)
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete player' })
      setConfirmDelete(null)
    } finally {
      setDeleting(null)
    }
  }

  // Filter players by search term
  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.aliases.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))
  )

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
    <AdminGuard>
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">
        Manage <span className="text-ucla-gold">Roster</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Add or remove players. Click a player name to edit their profile and aliases.
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
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">
            Player Roster ({filteredPlayers.length})
          </h2>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search players..."
            className="bg-background border border-border rounded-md px-3 py-2 text-white text-sm w-64"
          />
        </div>
        
        <div className="divide-y divide-border">
          {filteredPlayers.map((player) => (
            <div key={player.id} className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <Link 
                  href={`/players/${player.id}`}
                  className="flex items-center gap-3 hover:text-ucla-gold transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-ucla-blue flex items-center justify-center text-white font-bold">
                    {player.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-ucla-gold transition-colors">
                      {player.name}
                    </h3>
                    {player.aliases.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {player.aliases.length} alias{player.aliases.length !== 1 ? 'es' : ''}
                      </p>
                    )}
                  </div>
                </Link>
                
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  onClick={() => setConfirmDelete(player)}
                >
                  🗑️ Delete
                </Button>
              </div>
            </div>
          ))}
          
          {filteredPlayers.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No players found
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-2">Delete Player?</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong className="text-white">{confirmDelete.name}</strong>?
            </p>
            <p className="text-sm text-orange-400 mb-6">
              ⚠️ This cannot be undone. Players with match performances cannot be deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="ghost" 
                onClick={() => setConfirmDelete(null)}
                disabled={deleting === confirmDelete.id}
              >
                Cancel
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDeletePlayer(confirmDelete)}
                disabled={deleting === confirmDelete.id}
              >
                {deleting === confirmDelete.id ? 'Deleting...' : 'Delete Player'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminGuard>
  )
}

