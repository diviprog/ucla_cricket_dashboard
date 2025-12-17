'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { StatsCard } from '@/components/ui/stats-card'
import { formatDate } from '@/lib/utils'

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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            UCLA Cricket <span className="text-ucla-gold">Dashboard</span>
          </h1>
          <p className="text-muted-foreground">
            {filterLabel}
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value)
              setSelectedCompetition('all')
            }}
            className="bg-background border border-border rounded-md px-3 py-2 text-white text-sm"
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
            className="bg-background border border-border rounded-md px-3 py-2 text-white text-sm"
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
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            <span>📊</span>
            <span>Export</span>
          </a>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading stats...
        </div>
      ) : stats ? (
        <>
          {/* Team Record Card */}
          <div className="bg-gradient-to-r from-ucla-blue to-ucla-blue/80 rounded-xl p-6 mb-8 border border-ucla-gold/20">
            <h2 className="text-xl font-bold text-white mb-4">Team Record</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{stats.totalMatches}</div>
                <div className="text-sm text-white/70">Matches</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-400">{stats.wins}</div>
                <div className="text-sm text-white/70">Wins</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-400">{stats.losses}</div>
                <div className="text-sm text-white/70">Losses</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-400">{stats.ties}</div>
                <div className="text-sm text-white/70">Ties</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-ucla-gold">{stats.winPercentage.toFixed(0)}%</div>
                <div className="text-sm text-white/70">Win Rate</div>
              </div>
            </div>
          </div>

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
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-ucla-gold mb-3 flex items-center gap-2">
                  <span>🏏</span> Batting
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Top Run Scorer */}
                  <PerformerCard
                    title="Most Runs"
                    icon="🏆"
                    performer={topPerformers.topRunScorer}
                    mainStat={topPerformers.topRunScorer?.runs}
                    subtitle={topPerformers.topRunScorer && 
                      `Avg ${topPerformers.topRunScorer.average.toFixed(1)} • SR ${topPerformers.topRunScorer.strikeRate.toFixed(1)}`
                    }
                    color="ucla-blue"
                  />
                  
                  {/* Best Average */}
                  <PerformerCard
                    title="Best Average"
                    icon="📊"
                    performer={topPerformers.bestAverage}
                    mainStat={topPerformers.bestAverage?.average.toFixed(2)}
                    subtitle={topPerformers.bestAverage && 
                      `${topPerformers.bestAverage.runs} runs • ${topPerformers.bestAverage.matches} matches`
                    }
                    color="ucla-blue"
                  />
                  
                  {/* Best Strike Rate */}
                  <PerformerCard
                    title="Best Strike Rate"
                    icon="⚡"
                    performer={topPerformers.bestStrikeRate}
                    mainStat={topPerformers.bestStrikeRate?.strikeRate.toFixed(1)}
                    subtitle={topPerformers.bestStrikeRate && 
                      `${topPerformers.bestStrikeRate.runs} runs off ${topPerformers.bestStrikeRate.balls} balls`
                    }
                    color="ucla-blue"
                  />
                </div>
              </div>

              {/* Bowling Leaders */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-ucla-gold mb-3 flex items-center gap-2">
                  <span>🎯</span> Bowling
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PerformerCard
                    title="Most Wickets"
                    icon="🏆"
                    performer={topPerformers.topWicketTaker}
                    mainStat={topPerformers.topWicketTaker?.wickets}
                    subtitle={topPerformers.topWicketTaker && 
                      `Avg ${topPerformers.topWicketTaker.average.toFixed(1)} • Econ ${topPerformers.topWicketTaker.economy.toFixed(2)}`
                    }
                    color="green-700"
                    textColor="green-400"
                  />
                  
                  <PerformerCard
                    title="Best Average"
                    icon="📊"
                    performer={topPerformers.bestBowlingAverage}
                    mainStat={topPerformers.bestBowlingAverage?.average.toFixed(2)}
                    subtitle={topPerformers.bestBowlingAverage && 
                      `${topPerformers.bestBowlingAverage.wickets} wickets • ${topPerformers.bestBowlingAverage.matches} matches`
                    }
                    color="green-700"
                    textColor="green-400"
                  />
                  
                  <PerformerCard
                    title="Best Economy"
                    icon="💰"
                    performer={topPerformers.bestEconomy}
                    mainStat={topPerformers.bestEconomy?.economy.toFixed(2)}
                    subtitle={topPerformers.bestEconomy && 
                      `${topPerformers.bestEconomy.overs} overs • ${topPerformers.bestEconomy.wickets} wickets`
                    }
                    color="green-700"
                    textColor="green-400"
                  />
                </div>
              </div>

              {/* Fielding Leader */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-ucla-gold mb-3 flex items-center gap-2">
                  <span>🧤</span> Fielding
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PerformerCard
                    title="Most Dismissals"
                    icon="🏆"
                    performer={topPerformers.topFielder}
                    mainStat={topPerformers.topFielder?.dismissals}
                    subtitle={topPerformers.topFielder && 
                      `${topPerformers.topFielder.catches} ct • ${topPerformers.topFielder.runOuts} ro • ${topPerformers.topFielder.matches} matches`
                    }
                    color="purple-700"
                    textColor="purple-400"
                  />
                </div>
              </div>
            </>
          )}

          {/* Recent Matches & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Matches */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Recent Matches</h2>
              {recentMatches.length === 0 ? (
                <div className="bg-card rounded-lg p-6 border border-border text-center">
                  <p className="text-muted-foreground">No matches yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMatches.map((match) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="flex items-center gap-4 bg-card rounded-lg p-4 border border-border hover:border-ucla-blue transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        match.result === 'win' ? 'bg-green-600' :
                        match.result === 'loss' ? 'bg-red-600' :
                        match.result === 'tie' ? 'bg-yellow-600' :
                        'bg-gray-600'
                      }`}>
                        {match.result === 'win' ? 'W' :
                         match.result === 'loss' ? 'L' :
                         match.result === 'tie' ? 'T' : '-'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">vs {match.opponent}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(match.date)}</p>
                      </div>
                      <div className="text-right font-mono text-sm">
                        <span className={match.result === 'win' ? 'text-ucla-gold' : ''}>
                          {match.our_score || '-'}
                        </span>
                        <span className="text-muted-foreground mx-1">vs</span>
                        <span className={match.result === 'loss' ? 'text-red-400' : ''}>
                          {match.opponent_score || '-'}
                        </span>
                      </div>
                    </Link>
                  ))}
                  <Link
                    href="/matches"
                    className="block text-center text-sm text-ucla-blue hover:text-ucla-gold py-2"
                  >
                    View all matches →
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 gap-4">
                <Link
                  href="/upload"
                  className="bg-ucla-blue hover:bg-ucla-blue/90 text-white rounded-lg p-6 text-center transition-colors"
                >
                  <div className="text-3xl mb-2">📤</div>
                  <h3 className="text-lg font-semibold">Upload Match</h3>
                  <p className="text-sm opacity-80">Import CricClubs scorecard</p>
                </Link>

                <div className="grid grid-cols-3 gap-4">
                  <Link
                    href="/players"
                    className="bg-card hover:bg-card/80 border border-border rounded-lg p-4 text-center transition-colors"
                  >
                    <div className="text-2xl mb-1">🏏</div>
                    <h3 className="text-sm font-semibold">Batting</h3>
                  </Link>
                  
                  <Link
                    href="/bowling"
                    className="bg-card hover:bg-card/80 border border-border rounded-lg p-4 text-center transition-colors"
                  >
                    <div className="text-2xl mb-1">🎯</div>
                    <h3 className="text-sm font-semibold">Bowling</h3>
                  </Link>
                  
                  <Link
                    href="/fielding"
                    className="bg-card hover:bg-card/80 border border-border rounded-lg p-4 text-center transition-colors"
                  >
                    <div className="text-2xl mb-1">🧤</div>
                    <h3 className="text-sm font-semibold">Fielding</h3>
                  </Link>
                </div>

                <Link
                  href="/matches"
                  className="bg-card hover:bg-card/80 border border-border rounded-lg p-4 text-center transition-colors"
                >
                  <div className="text-2xl mb-1">🗓️</div>
                  <h3 className="text-sm font-semibold">Match History</h3>
                  <p className="text-xs text-muted-foreground">View all scorecards</p>
                </Link>
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
  color = 'ucla-blue',
  textColor = 'ucla-gold',
}: {
  title: string
  icon: string
  performer: { id: string; name: string } | null
  mainStat: string | number | undefined
  subtitle: string | undefined
  color?: string
  textColor?: string
}) {
  return (
    <div className="bg-card rounded-lg p-5 border border-border">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>
      {performer ? (
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full bg-${color} flex items-center justify-center text-xl font-bold text-white`}>
            {performer.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-white">{performer.name}</p>
            <p className={`text-2xl font-bold text-${textColor}`}>{mainStat}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No data</p>
      )}
    </div>
  )
}
