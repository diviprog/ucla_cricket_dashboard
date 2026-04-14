'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import { Shield, Upload, BarChart3, Trophy, Award, Medal } from 'lucide-react'

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

type SortKey = 'dismissals' | 'catches' | 'runOuts' | 'stumpings'

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

    // Filter out Unclaimed players and players with 0 dismissals
    const filtered = (data || []).filter(row => 
      !row.player?.name?.toLowerCase().startsWith('unclaimed') && 
      row.total_dismissals > 0
    )
    
    // Sort data
    const sortedData = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'dismissals':
          return b.total_dismissals - a.total_dismissals
        case 'catches':
          return b.total_catches - a.total_catches
        case 'runOuts':
          return b.total_run_outs - a.total_run_outs
        case 'stumpings':
          return b.total_stumpings - a.total_stumpings
        default:
          return 0
      }
    })

    setStats(sortedData)
    setLoading(false)
  }

  return (
    <div className="container mx-auto px-4 py-8 page-transition">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-ucla-blue to-ucla-blue/80 shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <span>Fielding <span className="gradient-text">Leaderboard</span></span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">
            Season fielding statistics and rankings
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-wrap gap-4 mb-8"
      >
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Season
          </label>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="bg-card border border-border rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-ucla-blue focus:border-transparent transition-all"
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
            className="bg-card border border-border rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-ucla-blue focus:border-transparent transition-all"
          >
            <option value="dismissals">Total Dismissals</option>
            <option value="catches">Catches</option>
            <option value="runOuts">Run Outs</option>
            <option value="stumpings">Stumpings</option>
          </select>
        </div>
      </motion.div>

      {loading ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20"
        >
          <div className="mb-6 flex justify-center">
            <div className="p-8 rounded-2xl bg-gradient-to-br from-ucla-blue/10 to-transparent border border-ucla-blue/20">
              <BarChart3 className="h-20 w-20 text-ucla-blue animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading Stats...</h2>
          <p className="text-muted-foreground text-lg">
            Fetching fielding statistics
          </p>
        </motion.div>
      ) : stats.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20"
        >
          <div className="mb-6 flex justify-center">
            <div className="p-8 rounded-2xl bg-gradient-to-br from-ucla-blue/10 to-transparent border border-ucla-blue/20">
              <BarChart3 className="h-20 w-20 text-ucla-blue" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No Stats Yet</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Upload match scorecards to start tracking fielding statistics
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-ucla-gold to-yellow-500 hover:from-ucla-gold/90 hover:to-yellow-500/90 text-black px-8 py-4 rounded-xl font-bold transition-all duration-200 hover:shadow-2xl hover:shadow-ucla-gold/30"
            >
              <Upload className="h-5 w-5" />
              <span>Upload First Match</span>
            </Link>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card rounded-2xl border border-border overflow-hidden shadow-xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full stats-table">
              <thead>
                <tr className="bg-gradient-to-r from-ucla-blue to-ucla-darkblue text-white">
                  <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider">Player</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">Ct</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">RO</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">St</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row, index) => {
                  const rank = index + 1
                  return (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="border-b border-border"
                    >
                      <td className="px-6 py-4">
                        {rank <= 3 ? (
                          <div className={`ranking-badge rank-${rank}`}>
                            {rank === 1 ? <Trophy className="h-3.5 w-3.5" /> :
                             rank === 2 ? <Medal className="h-3.5 w-3.5" /> :
                             <Award className="h-3.5 w-3.5" />}
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-medium">{rank}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/players/${row.player.id}`}
                          className="flex items-center gap-3 hover:text-ucla-gold transition-colors group"
                        >
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 group-hover:scale-110 ${
                            rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900' :
                            rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                            'bg-gradient-to-br from-ucla-blue to-ucla-blue/80'
                          }`}>
                            {getInitials(row.player?.name || 'UN')}
                          </div>
                          <span className="font-semibold text-base">{row.player?.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn(
                          'font-medium tabular-nums',
                          row.total_catches > 0 ? 'text-green-400' : 'text-muted-foreground'
                        )}>
                          {row.total_catches}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn(
                          'font-medium tabular-nums',
                          row.total_run_outs > 0 ? 'text-blue-400' : 'text-muted-foreground'
                        )}>
                          {row.total_run_outs}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn(
                          'font-medium tabular-nums',
                          row.total_stumpings > 0 ? 'text-purple-400' : 'text-muted-foreground'
                        )}>
                          {row.total_stumpings}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-ucla-gold font-bold text-lg tabular-nums">
                          {row.total_dismissals}
                        </span>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}

