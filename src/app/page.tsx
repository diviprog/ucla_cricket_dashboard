import Link from 'next/link'
import { StatsCard } from '@/components/ui/stats-card'
import { getSeasonStats, getTopPerformers, getRecentMatches } from '@/lib/services/stats-service'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const seasonStats = await getSeasonStats()
  const topPerformers = await getTopPerformers()
  const recentMatches = await getRecentMatches(5)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            UCLA Cricket <span className="text-ucla-gold">Dashboard</span>
          </h1>
          <p className="text-muted-foreground">
            Season 2024-2025 Statistics Overview
          </p>
        </div>
        <a
          href="/api/export?format=xlsx"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          <span>📊</span>
          <span>Export to Excel</span>
        </a>
      </div>

      {/* Team Record Card */}
      <div className="bg-gradient-to-r from-ucla-blue to-ucla-blue/80 rounded-xl p-6 mb-8 border border-ucla-gold/20">
        <h2 className="text-xl font-bold text-white mb-4">Team Record</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-white">{seasonStats.totalMatches}</div>
            <div className="text-sm text-white/70">Matches</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-400">{seasonStats.wins}</div>
            <div className="text-sm text-white/70">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-400">{seasonStats.losses}</div>
            <div className="text-sm text-white/70">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-yellow-400">{seasonStats.ties}</div>
            <div className="text-sm text-white/70">Ties</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-ucla-gold">{seasonStats.winPercentage.toFixed(0)}%</div>
            <div className="text-sm text-white/70">Win Rate</div>
          </div>
        </div>
      </div>

      {/* Team Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatsCard
          title="Total Runs"
          value={seasonStats.totalRuns.toLocaleString()}
          icon="trending-up"
        />
        <StatsCard
          title="Wickets Taken"
          value={seasonStats.totalWickets}
          icon="target"
        />
        <StatsCard
          title="Catches"
          value={seasonStats.totalCatches}
          icon="hand"
        />
        <StatsCard
          title="Boundaries"
          value={seasonStats.totalBoundaries}
          subtitle={`${seasonStats.totalFours} 4s / ${seasonStats.totalSixes} 6s`}
          icon="zap"
        />
        <StatsCard
          title="Avg Team Score"
          value={seasonStats.avgTeamScore.toFixed(1)}
          icon="bar-chart"
        />
        <StatsCard
          title="Players"
          value={seasonStats.totalPlayers}
          icon="users"
        />
      </div>

      {/* Top Performers - Three Categories */}
      <h2 className="text-2xl font-bold text-white mb-4">Top Performers</h2>
      
      {/* Batting Leaders */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-ucla-gold mb-3 flex items-center gap-2">
          <span>🏏</span> Batting
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Run Scorer */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🏆</span>
              <span className="text-sm font-medium text-muted-foreground">Most Runs</span>
            </div>
            {topPerformers.topRunScorer ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-ucla-blue flex items-center justify-center text-xl font-bold text-white">
                  {topPerformers.topRunScorer.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{topPerformers.topRunScorer.name}</p>
                  <p className="text-2xl font-bold text-ucla-gold">{topPerformers.topRunScorer.runs}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg {topPerformers.topRunScorer.average.toFixed(1)} • SR {topPerformers.topRunScorer.strikeRate.toFixed(1)}
                  </p>
                </div>
              </div>
            ) : <p className="text-muted-foreground text-sm">No data</p>}
          </div>

          {/* Best Average */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📊</span>
              <span className="text-sm font-medium text-muted-foreground">Best Average</span>
            </div>
            {topPerformers.bestAverage ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-ucla-blue flex items-center justify-center text-xl font-bold text-white">
                  {topPerformers.bestAverage.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{topPerformers.bestAverage.name}</p>
                  <p className="text-2xl font-bold text-ucla-gold">{topPerformers.bestAverage.average.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {topPerformers.bestAverage.runs} runs • {topPerformers.bestAverage.matches} matches
                  </p>
                </div>
              </div>
            ) : <p className="text-muted-foreground text-sm">No data</p>}
          </div>

          {/* Best Strike Rate */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚡</span>
              <span className="text-sm font-medium text-muted-foreground">Best Strike Rate</span>
            </div>
            {topPerformers.bestStrikeRate ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-ucla-blue flex items-center justify-center text-xl font-bold text-white">
                  {topPerformers.bestStrikeRate.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{topPerformers.bestStrikeRate.name}</p>
                  <p className="text-2xl font-bold text-ucla-gold">{topPerformers.bestStrikeRate.strikeRate.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">
                    {topPerformers.bestStrikeRate.runs} runs off {topPerformers.bestStrikeRate.balls} balls
                  </p>
                </div>
              </div>
            ) : <p className="text-muted-foreground text-sm">No data</p>}
          </div>
        </div>
      </div>

      {/* Bowling Leaders */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-ucla-gold mb-3 flex items-center gap-2">
          <span>🎯</span> Bowling
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Wicket Taker */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🏆</span>
              <span className="text-sm font-medium text-muted-foreground">Most Wickets</span>
            </div>
            {topPerformers.topWicketTaker ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-700 flex items-center justify-center text-xl font-bold text-white">
                  {topPerformers.topWicketTaker.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{topPerformers.topWicketTaker.name}</p>
                  <p className="text-2xl font-bold text-green-400">{topPerformers.topWicketTaker.wickets}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg {topPerformers.topWicketTaker.average.toFixed(1)} • Econ {topPerformers.topWicketTaker.economy.toFixed(2)}
                  </p>
                </div>
              </div>
            ) : <p className="text-muted-foreground text-sm">No data</p>}
          </div>

          {/* Best Bowling Average */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📊</span>
              <span className="text-sm font-medium text-muted-foreground">Best Average</span>
            </div>
            {topPerformers.bestBowlingAverage ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-700 flex items-center justify-center text-xl font-bold text-white">
                  {topPerformers.bestBowlingAverage.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{topPerformers.bestBowlingAverage.name}</p>
                  <p className="text-2xl font-bold text-green-400">{topPerformers.bestBowlingAverage.average.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {topPerformers.bestBowlingAverage.wickets} wickets • {topPerformers.bestBowlingAverage.matches} matches
                  </p>
                </div>
              </div>
            ) : <p className="text-muted-foreground text-sm">No data</p>}
          </div>

          {/* Best Economy */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💰</span>
              <span className="text-sm font-medium text-muted-foreground">Best Economy</span>
            </div>
            {topPerformers.bestEconomy ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-700 flex items-center justify-center text-xl font-bold text-white">
                  {topPerformers.bestEconomy.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{topPerformers.bestEconomy.name}</p>
                  <p className="text-2xl font-bold text-green-400">{topPerformers.bestEconomy.economy.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {topPerformers.bestEconomy.overs} overs • {topPerformers.bestEconomy.wickets} wickets
                  </p>
                </div>
              </div>
            ) : <p className="text-muted-foreground text-sm">No data</p>}
          </div>
        </div>
      </div>

      {/* Fielding Leader */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-ucla-gold mb-3 flex items-center gap-2">
          <span>🧤</span> Fielding
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Fielder */}
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🏆</span>
              <span className="text-sm font-medium text-muted-foreground">Most Dismissals</span>
            </div>
            {topPerformers.topFielder ? (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-purple-700 flex items-center justify-center text-xl font-bold text-white">
                  {topPerformers.topFielder.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{topPerformers.topFielder.name}</p>
                  <p className="text-2xl font-bold text-purple-400">{topPerformers.topFielder.dismissals}</p>
                  <p className="text-xs text-muted-foreground">
                    {topPerformers.topFielder.catches} ct • {topPerformers.topFielder.runOuts} ro • {topPerformers.topFielder.matches} matches
                  </p>
                </div>
              </div>
            ) : <p className="text-muted-foreground text-sm">No data</p>}
          </div>
        </div>
      </div>

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
    </div>
  )
}
