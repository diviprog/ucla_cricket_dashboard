'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0-100
  max?: number
  height?: 'sm' | 'md' | 'lg'
  color?: string
  backgroundColor?: string
  showLabel?: boolean
  label?: string
  animated?: boolean
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  height = 'md',
  color = 'bg-ucla-gold',
  backgroundColor = 'bg-muted',
  showLabel = false,
  label,
  animated = true,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
          {showLabel && <span className="text-xs font-bold text-white tabular-nums">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={cn('relative w-full rounded-full overflow-hidden', backgroundColor, heightClasses[height])}>
        {animated ? (
          <motion.div
            className={cn('h-full rounded-full', color)}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ) : (
          <div
            className={cn('h-full rounded-full', color)}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  )
}
