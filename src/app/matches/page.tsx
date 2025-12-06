'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

interface Match {
  id: string
  date: string
  opponent: string
  result: string
  our_score: string | null
  opponent_score: string | null
  match_type: string
  competition_name: string | null
  season: { name: string } | null
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadMatches()
  }, [])

  async function loadMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        season:seasons(name)
      `)
      .order('date', { ascending: false })
    
    if (error) {
      console.error('Error fetching matches:', error)
    }
    
    setMatches(data || [])
    setLoading(false)
  }

  async function deleteMatch(matchId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this match? All associated batting, bowling, and fielding records will be permanently deleted.')) {
      return
    }
    
    setDeleting(matchId)
    
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'DELETE',
      })
      
      const result = await response.json()
      
      if (result.success) {
        setMatches(prev => prev.filter(m => m.id !== matchId))
      } else {
        alert('Failed to delete match: ' + result.error)
      }
    } catch (error) {
      console.error('Error deleting match:', error)
      alert('Failed to delete match')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-muted-foreground">
          Loading matches...
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Match <span className="text-ucla-gold">History</span>
          </h1>
          <p className="text-muted-foreground">
            All imported match scorecards
          </p>
        </div>
        
        <Link
          href="/upload"
          className="bg-ucla-blue hover:bg-ucla-blue/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Upload Match
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🏏</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Matches Yet</h2>
          <p className="text-muted-foreground mb-4">
            Upload CricClubs scorecards to start tracking match results
          </p>
          <Link
            href="/upload"
            className="inline-block bg-ucla-gold hover:bg-ucla-gold/90 text-black px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Upload First Match
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className="bg-card rounded-lg p-6 border border-border hover:border-ucla-blue transition-colors"
            >
              <div className="flex items-center justify-between">
                <Link 
                  href={`/matches/${match.id}`}
                  className="flex items-center gap-4 flex-1"
                >
                  {/* Result indicator */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    match.result === 'win' ? 'bg-green-600' :
                    match.result === 'loss' ? 'bg-red-600' :
                    match.result === 'tie' ? 'bg-yellow-600' :
                    'bg-gray-600'
                  }`}>
                    {match.result === 'win' ? 'W' :
                     match.result === 'loss' ? 'L' :
                     match.result === 'tie' ? 'T' : '-'}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      vs {match.opponent}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(match.date)} • {match.competition_name || 'League Match'}
                    </p>
                  </div>
                </Link>
                
                <div className="flex items-center gap-6">
                  <Link href={`/matches/${match.id}`} className="text-right">
                    <div className="flex items-center gap-2 text-xl font-mono">
                      <span className={match.result === 'win' ? 'text-ucla-gold font-bold' : ''}>
                        {match.our_score || '-'}
                      </span>
                      <span className="text-muted-foreground">vs</span>
                      <span className={match.result === 'loss' ? 'text-red-400 font-bold' : ''}>
                        {match.opponent_score || '-'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {match.match_type.charAt(0).toUpperCase() + match.match_type.slice(1)}
                    </p>
                  </Link>
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => deleteMatch(match.id, e)}
                    disabled={deleting === match.id}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete match"
                  >
                    {deleting === match.id ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
