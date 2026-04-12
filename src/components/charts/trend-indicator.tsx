'use client'

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrendIndicatorProps {
  value: number // Percentage change
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TrendIndicator({
  value,
  showValue = true,
  size = 'md',
  className,
}: TrendIndicatorProps) {
  const isPositive = value > 0
  const isNeutral = value === 0
  const absValue = Math.abs(value)

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  const Icon = isNeutral ? Minus : isPositive ? ArrowUp : ArrowDown

  const colorClass = isNeutral
    ? 'text-muted-foreground'
    : isPositive
    ? 'text-green-500'
    : 'text-red-500'

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Icon className={cn(sizeClasses[size], colorClass)} />
      {showValue && (
        <span className={cn('font-medium tabular-nums', textSizeClasses[size], colorClass)}>
          {absValue.toFixed(1)}%
        </span>
      )}
    </div>
  )
}
