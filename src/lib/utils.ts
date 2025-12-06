import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a score for display (e.g., "22(21)" or "10(6)*")
 */
export function formatScore(runs: number, balls: number, notOut: boolean): string {
  return `${runs}(${balls})${notOut ? '*' : ''}`
}

/**
 * Format a number with proper decimal places
 */
export function formatStat(value: number, decimals: number = 2): string {
  if (!isFinite(value) || isNaN(value)) return '-'
  return value.toFixed(decimals)
}

/**
 * Calculate percentage safely
 */
export function safePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return (numerator / denominator) * 100
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

