'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { getSeasonLeaderboard, getBattingDismissalStatsForLeaderboard } from '@/lib/services/stats-service'
import { formatStat, getInitials } from '@/lib/utils'
import { TrendingUp, Users, BarChart3, Upload, Trophy, Award, Medal } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  const [leaderboard, dismissalStats] = await Promise.all([
    getSeasonLeaderboard(),
    getBattingDismissalStatsForLeaderboard()
  ])

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
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <span>Batting <span className="gradient-text">Leaderboard</span></span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">
            Season batting statistics and rankings
          </p>
        </div>

        <Link
          href="/players/manage"
          className="flex items-center gap-2 bg-ucla-blue hover:bg-ucla-blue/90 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-ucla-blue/30"
        >
          <Users className="h-4 w-4" />
          <span>Manage Players</span>
        </Link>
      </motion.div>

      {leaderboard.length === 0 ? (
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
            Upload match scorecards to start tracking player statistics
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
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">M</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">Runs</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">Avg</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">SR</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">4s</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">6s</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider">Bdry %</th>
                  <th className="px-4 py-4 text-center font-bold text-xs uppercase tracking-wider" title="Most common dismissal type">Main Out</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((stat, index) => {
                  const dismissalInfo = dismissalStats.get(stat.player_id)
                  const rank = index + 1
                  return (
                    <motion.tr
                      key={stat.id}
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
                          href={`/players/${stat.player_id}`}
                          className="flex items-center gap-3 hover:text-ucla-gold transition-colors group"
                        >
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 group-hover:scale-110 ${
                            rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900' :
                            rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                            'bg-gradient-to-br from-ucla-blue to-ucla-blue/80'
                          }`}>
                            {getInitials(stat.player?.name || 'UN')}
                          </div>
                          <span className="font-semibold text-base">{stat.player?.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-center text-sm">{stat.matches_played}</td>
                      <td className="px-4 py-4 text-center font-bold text-ucla-gold text-lg tabular-nums">{stat.total_runs}</td>
                      <td className="px-4 py-4 text-center tabular-nums">{formatStat(stat.average, 1)}</td>
                      <td className="px-4 py-4 text-center tabular-nums">{formatStat(stat.strike_rate, 1)}</td>
                      <td className="px-4 py-4 text-center tabular-nums">{stat.fours}</td>
                      <td className="px-4 py-4 text-center tabular-nums">{stat.sixes}</td>
                      <td className="px-4 py-4 text-center tabular-nums">{formatStat(stat.boundary_percentage, 1)}%</td>
                      <td className="px-4 py-4 text-center">
                        {dismissalInfo ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium"
                            title={`${dismissalInfo.label} (${dismissalInfo.percentage.toFixed(0)}%)`}
                          >
                            <span className="text-white">{dismissalInfo.label}</span>
                            <span className="text-muted-foreground">({dismissalInfo.percentage.toFixed(0)}%)</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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

