import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-lg p-6 border border-border',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-3xl opacity-50">
            {icon === 'calendar' && '📅'}
            {icon === 'trending-up' && '📈'}
            {icon === 'users' && '👥'}
            {icon === 'bar-chart' && '📊'}
            {icon === 'trophy' && '🏆'}
            {icon === 'target' && '🎯'}
            {icon === 'hand' && '🧤'}
            {icon === 'zap' && '⚡'}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-sm">
          {trend === 'up' && <span className="text-green-500">↑</span>}
          {trend === 'down' && <span className="text-red-500">↓</span>}
          {trend === 'neutral' && <span className="text-muted-foreground">→</span>}
        </div>
      )}
    </div>
  )
}

