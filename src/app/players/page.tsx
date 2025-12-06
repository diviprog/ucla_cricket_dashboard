import Link from 'next/link'
import { getSeasonLeaderboard } from '@/lib/services/stats-service'
import { formatStat, getInitials } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  const leaderboard = await getSeasonLeaderboard()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Batting <span className="text-ucla-gold">Leaderboard</span>
          </h1>
          <p className="text-muted-foreground">
            Season batting statistics and rankings
          </p>
        </div>
        
        <Link
          href="/players/manage"
          className="bg-ucla-blue hover:bg-ucla-blue/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Manage Players
        </Link>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Stats Yet</h2>
          <p className="text-muted-foreground mb-4">
            Upload match scorecards to start tracking player statistics
          </p>
          <Link
            href="/upload"
            className="inline-block bg-ucla-gold hover:bg-ucla-gold/90 text-black px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Upload First Match
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-ucla-blue text-white">
                  <th className="px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Player</th>
                  <th className="px-4 py-3 text-center font-semibold">M</th>
                  <th className="px-4 py-3 text-center font-semibold">Runs</th>
                  <th className="px-4 py-3 text-center font-semibold">Avg</th>
                  <th className="px-4 py-3 text-center font-semibold">SR</th>
                  <th className="px-4 py-3 text-center font-semibold">4s</th>
                  <th className="px-4 py-3 text-center font-semibold">6s</th>
                  <th className="px-4 py-3 text-center font-semibold">Bdry %</th>
                  <th className="px-4 py-3 text-center font-semibold">B/LBW %</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((stat, index) => (
                  <tr 
                    key={stat.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/players/${stat.player_id}`}
                        className="flex items-center gap-3 hover:text-ucla-gold transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-ucla-blue flex items-center justify-center text-white font-bold">
                          {getInitials(stat.player?.name || 'UN')}
                        </div>
                        <span className="font-medium">{stat.player?.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">{stat.matches_played}</td>
                    <td className="px-4 py-3 text-center font-bold text-ucla-gold">{stat.total_runs}</td>
                    <td className="px-4 py-3 text-center">{formatStat(stat.average, 1)}</td>
                    <td className="px-4 py-3 text-center">{formatStat(stat.strike_rate, 1)}</td>
                    <td className="px-4 py-3 text-center">{stat.fours}</td>
                    <td className="px-4 py-3 text-center">{stat.sixes}</td>
                    <td className="px-4 py-3 text-center">{formatStat(stat.boundary_percentage, 1)}%</td>
                    <td className="px-4 py-3 text-center">{formatStat(stat.bowled_lbw_percentage, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

