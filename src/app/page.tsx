'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { StatsCard } from '@/components/ui/stats-card'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { RadialProgress, AnimatedCounter } from '@/components/charts'
import {
  Upload,
  TrendingUp,
  Target,
  Hand,
  Calendar,
  Trophy,
  BarChart3,
  Download,
  ArrowRight,
  Loader2,
} from 'lucide-react'

interface Season {
  id: string
  name: string
}

interface DashboardStats {
  totalMatches: number
  wins: number
  losses: number
  ties: number
  winPercentage: number
  totalRuns: number
  totalWickets: number
  totalCatches: number
  totalBoundaries: number
  totalFours: number
  totalSixes: number
  avgTeamScore: number
  totalPlayers: number
}

interface TopPerformers {
  topRunScorer: { id: string; name: string; runs: number; average: number; strikeRate: number } | null
  bestAverage: { id: string; name: string; average: number; runs: number; matches: number } | null
  bestStrikeRate: { id: string; name: string; strikeRate: number; runs: number; balls: number } | null
  topWicketTaker: { id: string; name: string; wickets: number; average: number; economy: number } | null
  bestBowlingAverage: { id: string; name: string; average: number; wickets: number; matches: number } | null
  bestEconomy: { id: string; name: string; economy: number; overs: number; wickets: number } | null
  topFielder: { id: string; name: string; dismissals: number; catches: number; runOuts: number; matches: number } | null
}

interface Match {
  id: string
  date: string
  opponent: string
  result: string
  our_score: string | null
  opponent_score: string | null
  competition_name: string | null
}

export default function Dashboard() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [competitions, setCompetitions] = useState<string[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [selectedCompetition, setSelectedCompetition] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [topPerformers, setTopPerformers] = useState<TopPerformers | null>(null)
  const [recentMatches, setRecentMatches] = useState<Match[]>([])

  // Load seasons and competitions on mount
  useEffect(() => {
    async function loadFilters() {
      try {
        const response = await fetch('/api/seasons')
        const data = await response.json()
        if (data.success) {
          setSeasons(data.seasons)
          setCompetitions(data.competitions)
          if (data.seasons.length > 0) {
            setSelectedSeason(data.seasons[0].id)
          }
        }
      } catch (error) {
        console.error('Error loading filters:', error)
      }
    }
    loadFilters()
  }, [])

  // Load stats when filters change
  useEffect(() => {
    async function loadStats() {
      if (!selectedSeason) return
      
      setLoading(true)
      try {
        const params = new URLSearchParams({
          seasonId: selectedSeason,
          ...(selectedCompetition !== 'all' && { competition: selectedCompetition }),
        })
        const response = await fetch(`/api/stats/dashboard?${params}`)
        const data = await response.json()
        if (data.success) {
          setStats(data.stats)
          setTopPerformers(data.topPerformers)
          setRecentMatches(data.recentMatches)
        }
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [selectedSeason, selectedCompetition])

  const currentSeason = seasons.find(s => s.id === selectedSeason)
  const filterLabel = selectedCompetition === 'all' 
    ? `${currentSeason?.name || ''} Stats`
    : `${selectedCompetition} Stats`

  return (
    <div className="container mx-auto px-4 py-8 page-transition">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            UCLA Cricket <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            {filterLabel}
          </p>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap items-center gap-3"
        >
          <select
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value)
              setSelectedCompetition('all')
            }}
            className="bg-card border border-border rounded-lg px-4 py-2.5 text-white text-sm font-medium shadow-sm hover:border-ucla-blue/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ucla-blue/50"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            className="bg-card border border-border rounded-lg px-4 py-2.5 text-white text-sm font-medium shadow-sm hover:border-ucla-blue/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ucla-blue/50"
          >
            <option value="all">All Tournaments</option>
            {competitions.map((comp) => (
              <option key={comp} value={comp}>
                {comp}
              </option>
            ))}
          </select>

          <a
            href="/api/export?format=xlsx"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:shadow-green-600/30 text-sm"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </a>
        </motion.div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 text-ucla-blue animate-spin mb-4" />
          <p className="text-muted-foreground text-lg">Loading stats...</p>
        </div>
      ) : stats ? (
        <>
          {/* Team Record Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-gradient-to-br from-ucla-blue via-ucla-blue to-ucla-darkblue rounded-2xl p-8 mb-8 border border-ucla-gold/30 shadow-2xl shadow-ucla-blue/20 relative overflow-hidden"
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-ucla-gold rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                  <Trophy className="h-6 w-6 text-ucla-gold" />
                </div>
                <h2 className="text-2xl font-bold text-white">Team Record</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white tabular-nums">
                    <AnimatedCounter value={stats.totalMatches} />
                  </div>
                  <div className="text-sm text-white/70 mt-1">Matches</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-400 tabular-nums">
                    <AnimatedCounter value={stats.wins} />
                  </div>
                  <div className="text-sm text-white/70 mt-1">Wins</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-red-400 tabular-nums">
                    <AnimatedCounter value={stats.losses} />
                  </div>
                  <div className="text-sm text-white/70 mt-1">Losses</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-yellow-400 tabular-nums">
                    <AnimatedCounter value={stats.ties} />
                  </div>
                  <div className="text-sm text-white/70 mt-1">Ties</div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <RadialProgress
                    value={stats.winPercentage}
                    size={140}
                    strokeWidth={10}
                    color="#FFB81C"
                    backgroundColor="rgba(255,255,255,0.1)"
                    label="Win Rate"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Team Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <StatsCard
              title="Total Runs"
              value={stats.totalRuns.toLocaleString()}
              icon="trending-up"
            />
            <StatsCard
              title="Wickets Taken"
              value={stats.totalWickets}
              icon="target"
            />
            <StatsCard
              title="Catches"
              value={stats.totalCatches}
              icon="hand"
            />
            <StatsCard
              title="Boundaries"
              value={stats.totalBoundaries}
              subtitle={`${stats.totalFours} 4s / ${stats.totalSixes} 6s`}
              icon="zap"
            />
            <StatsCard
              title="Avg Team Score"
              value={stats.avgTeamScore.toFixed(1)}
              icon="bar-chart"
            />
            <StatsCard
              title="Players"
              value={stats.totalPlayers}
              icon="users"
            />
          </div>

          {/* Top Performers */}
          {topPerformers && (
            <>
              <h2 className="text-2xl font-bold text-white mb-4">Top Performers</h2>
              
              {/* Batting Leaders */}
              <div className="mb-8">
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-xl font-bold text-ucla-gold mb-4 flex items-center gap-2"
                >
                  <div className="p-2 rounded-lg bg-ucla-gold/10">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <span>Batting Leaders</span>
                </motion.h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Top Run Scorer */}
                  <PerformerCard
                    title="Most Runs"
                    icon="trophy"
                    performer={topPerformers.topRunScorer}
                    mainStat={topPerformers.topRunScorer?.runs}
                    subtitle={topPerformers.topRunScorer
                      ? `Avg ${topPerformers.topRunScorer.average.toFixed(1)} • SR ${topPerformers.topRunScorer.strikeRate.toFixed(1)}`
                      : undefined
                    }
                    variant="batting"
                    index={0}
                  />

                  {/* Best Average */}
                  <PerformerCard
                    title="Best Average"
                    icon="bar-chart"
                    performer={topPerformers.bestAverage}
                    mainStat={topPerformers.bestAverage?.average.toFixed(2)}
                    subtitle={topPerformers.bestAverage
                      ? `${topPerformers.bestAverage.runs} runs • ${topPerformers.bestAverage.matches} matches`
                      : undefined
                    }
                    variant="batting"
                    index={1}
                  />

                  {/* Best Strike Rate */}
                  <PerformerCard
                    title="Best Strike Rate"
                    icon="trending"
                    performer={topPerformers.bestStrikeRate}
                    mainStat={topPerformers.bestStrikeRate?.strikeRate.toFixed(1)}
                    subtitle={topPerformers.bestStrikeRate
                      ? `${topPerformers.bestStrikeRate.runs} runs off ${topPerformers.bestStrikeRate.balls} balls`
                      : undefined
                    }
                    variant="batting"
                    index={2}
                  />
                </div>
              </div>

              {/* Bowling Leaders */}
              <div className="mb-8">
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2"
                >
                  <div className="p-2 rounded-lg bg-green-600/10">
                    <Target className="h-5 w-5" />
                  </div>
                  <span>Bowling Leaders</span>
                </motion.h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PerformerCard
                    title="Most Wickets"
                    icon="trophy"
                    performer={topPerformers.topWicketTaker}
                    mainStat={topPerformers.topWicketTaker?.wickets}
                    subtitle={topPerformers.topWicketTaker
                      ? `Avg ${topPerformers.topWicketTaker.average.toFixed(1)} • Econ ${topPerformers.topWicketTaker.economy.toFixed(2)}`
                      : undefined
                    }
                    variant="bowling"
                    index={0}
                  />

                  <PerformerCard
                    title="Best Average"
                    icon="bar-chart"
                    performer={topPerformers.bestBowlingAverage}
                    mainStat={topPerformers.bestBowlingAverage?.average.toFixed(2)}
                    subtitle={topPerformers.bestBowlingAverage
                      ? `${topPerformers.bestBowlingAverage.wickets} wickets • ${topPerformers.bestBowlingAverage.matches} matches`
                      : undefined
                    }
                    variant="bowling"
                    index={1}
                  />

                  <PerformerCard
                    title="Best Economy"
                    icon="target"
                    performer={topPerformers.bestEconomy}
                    mainStat={topPerformers.bestEconomy?.economy.toFixed(2)}
                    subtitle={topPerformers.bestEconomy
                      ? `${topPerformers.bestEconomy.overs} overs • ${topPerformers.bestEconomy.wickets} wickets`
                      : undefined
                    }
                    variant="bowling"
                    index={2}
                  />
                </div>
              </div>

              {/* Fielding Leader */}
              <div className="mb-8">
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2"
                >
                  <div className="p-2 rounded-lg bg-purple-600/10">
                    <Hand className="h-5 w-5" />
                  </div>
                  <span>Fielding Leaders</span>
                </motion.h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PerformerCard
                    title="Most Dismissals"
                    icon="trophy"
                    performer={topPerformers.topFielder}
                    mainStat={topPerformers.topFielder?.dismissals}
                    subtitle={topPerformers.topFielder
                      ? `${topPerformers.topFielder.catches} ct • ${topPerformers.topFielder.runOuts} ro • ${topPerformers.topFielder.matches} matches`
                      : undefined
                    }
                    variant="fielding"
                    index={0}
                  />
                </div>
              </div>
            </>
          )}

          {/* Recent Matches & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Matches */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-ucla-blue/10">
                  <Calendar className="h-5 w-5 text-ucla-blue" />
                </div>
                <span>Recent Matches</span>
              </h2>
              {recentMatches.length === 0 ? (
                <div className="bg-card rounded-xl p-8 border border-border text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">No matches yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMatches.map((match, index) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Link
                        href={`/matches/${match.id}`}
                        className="flex items-center gap-4 bg-card rounded-xl p-4 border border-border hover:border-ucla-blue/50 transition-all duration-200 hover:shadow-xl hover:shadow-ucla-blue/10 group"
                      >
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                            match.result === 'win' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                            match.result === 'loss' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                            match.result === 'tie' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                            'bg-gradient-to-br from-gray-500 to-gray-600'
                          }`}
                        >
                          {match.result === 'win' ? 'W' :
                           match.result === 'loss' ? 'L' :
                           match.result === 'tie' ? 'T' : '-'}
                        </motion.div>
                        <div className="flex-1">
                          <p className="font-semibold text-white group-hover:text-ucla-gold transition-colors">vs {match.opponent}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(match.date)}</p>
                        </div>
                        <div className="text-right font-mono text-sm flex items-center gap-1.5 tabular-nums">
                          <span className={match.result === 'win' ? 'text-ucla-gold font-bold' : 'text-white'}>
                            {match.our_score || '-'}
                          </span>
                          <span className="text-muted-foreground text-xs">vs</span>
                          <span className={match.result === 'loss' ? 'text-red-400 font-bold' : 'text-white'}>
                            {match.opponent_score || '-'}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </Link>
                    </motion.div>
                  ))}
                  <Link
                    href="/matches"
                    className="flex items-center justify-center gap-2 text-center text-sm text-ucla-blue hover:text-ucla-gold py-3 transition-colors group font-medium mt-4"
                  >
                    <span>View all matches</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-ucla-gold/10">
                  <Trophy className="h-5 w-5 text-ucla-gold" />
                </div>
                <span>Quick Actions</span>
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    href="/upload"
                    className="bg-gradient-to-br from-ucla-blue to-ucla-blue/90 hover:from-ucla-blue/90 hover:to-ucla-blue/80 text-white rounded-xl p-6 text-center transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-ucla-blue/30 group block"
                  >
                    <div className="mb-3 flex justify-center">
                      <div className="p-3 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors group-hover:scale-110 duration-300">
                        <Upload className="h-7 w-7" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold">Upload Match</h3>
                    <p className="text-sm opacity-80 mt-1">Import CricClubs scorecard</p>
                  </Link>
                </motion.div>

                <div className="grid grid-cols-3 gap-3">
                  <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                    <Link
                      href="/players"
                      className="bg-card hover:bg-card/80 border border-border hover:border-ucla-blue/50 rounded-xl p-4 text-center transition-all duration-200 shadow-md hover:shadow-lg group block"
                    >
                      <div className="mb-2 flex justify-center">
                        <div className="p-2 rounded-lg bg-ucla-blue/10 group-hover:bg-ucla-blue/20 transition-colors">
                          <TrendingUp className="h-5 w-5 text-ucla-blue" />
                        </div>
                      </div>
                      <h3 className="text-xs font-semibold text-white">Batting</h3>
                    </Link>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                    <Link
                      href="/bowling"
                      className="bg-card hover:bg-card/80 border border-border hover:border-green-600/50 rounded-xl p-4 text-center transition-all duration-200 shadow-md hover:shadow-lg group block"
                    >
                      <div className="mb-2 flex justify-center">
                        <div className="p-2 rounded-lg bg-green-600/10 group-hover:bg-green-600/20 transition-colors">
                          <Target className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                      <h3 className="text-xs font-semibold text-white">Bowling</h3>
                    </Link>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                    <Link
                      href="/fielding"
                      className="bg-card hover:bg-card/80 border border-border hover:border-purple-600/50 rounded-xl p-4 text-center transition-all duration-200 shadow-md hover:shadow-lg group block"
                    >
                      <div className="mb-2 flex justify-center">
                        <div className="p-2 rounded-lg bg-purple-600/10 group-hover:bg-purple-600/20 transition-colors">
                          <Hand className="h-5 w-5 text-purple-500" />
                        </div>
                      </div>
                      <h3 className="text-xs font-semibold text-white">Fielding</h3>
                    </Link>
                  </motion.div>
                </div>

                <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
                  <Link
                    href="/matches"
                    className="bg-card hover:bg-card/80 border border-border hover:border-ucla-blue/50 rounded-xl p-5 text-center transition-all duration-200 shadow-md hover:shadow-xl group block"
                  >
                    <div className="mb-2 flex justify-center">
                      <div className="p-2 rounded-lg bg-ucla-blue/10 group-hover:bg-ucla-blue/20 transition-colors">
                        <Calendar className="h-6 w-6 text-ucla-blue" />
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-white">Match History</h3>
                    <p className="text-xs text-muted-foreground mt-1">View all scorecards</p>
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

// Helper component for performer cards
function PerformerCard({
  title,
  icon,
  performer,
  mainStat,
  subtitle,
  variant = 'batting',
  index = 0,
}: {
  title: string
  icon: 'trophy' | 'bar-chart' | 'trending' | 'target'
  performer: { id: string; name: string } | null
  mainStat: string | number | undefined
  subtitle?: string
  variant?: 'batting' | 'bowling' | 'fielding'
  index?: number
}) {
  const IconComponent =
    icon === 'trophy' ? Trophy :
    icon === 'bar-chart' ? BarChart3 :
    icon === 'trending' ? TrendingUp :
    Target

  const avatarBg =
    variant === 'batting' ? 'bg-gradient-to-br from-ucla-blue to-ucla-blue/80' :
    variant === 'bowling' ? 'bg-gradient-to-br from-green-600 to-green-700' :
    'bg-gradient-to-br from-purple-600 to-purple-700'

  const statColor =
    variant === 'batting' ? 'text-ucla-gold' :
    variant === 'bowling' ? 'text-green-400' :
    'text-purple-400'

  const iconBg =
    variant === 'batting' ? 'bg-ucla-blue/10 border-ucla-blue/30' :
    variant === 'bowling' ? 'bg-green-600/10 border-green-600/30' :
    'bg-purple-600/10 border-purple-600/30'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
    >
      <Card padding="sm" className="hover:border-ucla-blue/50 transition-all duration-300 hover:shadow-xl hover:shadow-ucla-blue/10">
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-2 rounded-lg border ${iconBg}`}>
            <IconComponent className="h-4 w-4 text-ucla-blue" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        </div>
        {performer ? (
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className={`w-16 h-16 rounded-full ${avatarBg} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}
            >
              {performer.name.charAt(0)}
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate text-base">{performer.name}</p>
              <p className={`text-2xl font-bold ${statColor} tabular-nums`}>{mainStat}</p>
              {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-6">
            <p className="text-muted-foreground text-sm">No data available</p>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
