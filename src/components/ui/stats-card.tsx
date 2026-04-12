'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  Calendar,
  TrendingUp,
  Users,
  BarChart3,
  Trophy,
  Target,
  Hand,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { AnimatedCounter, MiniSparkline, TrendIndicator } from '@/components/charts'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: 'calendar' | 'trending-up' | 'users' | 'bar-chart' | 'trophy' | 'target' | 'hand' | 'zap'
  trend?: number // Percentage change
  trendData?: number[] // Data points for sparkline
  className?: string
  animated?: boolean
}

const iconMap: Record<string, LucideIcon> = {
  calendar: Calendar,
  'trending-up': TrendingUp,
  users: Users,
  'bar-chart': BarChart3,
  trophy: Trophy,
  target: Target,
  hand: Hand,
  zap: Zap,
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendData,
  className,
  animated = true,
}: StatsCardProps) {
  const IconComponent = icon ? iconMap[icon] : null
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''))
  const canAnimate = !isNaN(numericValue) && animated

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={cn(
        'bg-card rounded-xl p-6 border border-border transition-all duration-300',
        'hover:shadow-xl hover:shadow-ucla-blue/10 hover:border-ucla-blue/40',
        'relative overflow-hidden',
        className
      )}
    >
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-ucla-blue/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          {IconComponent && (
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-ucla-blue/20 to-ucla-blue/10 border border-ucla-blue/30">
              <IconComponent className="h-5 w-5 text-ucla-blue" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-3xl font-bold text-white tabular-nums">
            {canAnimate ? (
              <AnimatedCounter value={numericValue} decimals={typeof value === 'string' && value.includes('.') ? 1 : 0} />
            ) : (
              value
            )}
          </p>

          {(subtitle || trend !== undefined || trendData) && (
            <div className="flex items-center justify-between gap-2 min-h-[20px]">
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
              {trend !== undefined && (
                <TrendIndicator value={trend} size="sm" />
              )}
            </div>
          )}

          {trendData && trendData.length > 0 && (
            <div className="mt-3 -mx-2">
              <MiniSparkline data={trendData} height={32} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

