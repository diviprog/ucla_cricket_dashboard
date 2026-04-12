'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface RadialProgressProps {
  value: number // 0-100
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  showLabel?: boolean
  label?: string
}

export function RadialProgress({
  value,
  size = 120,
  strokeWidth = 8,
  color = '#FFB81C', // UCLA gold
  backgroundColor = '#2a2e3a',
  showLabel = true,
  label,
}: RadialProgressProps) {
  const data = [
    { name: 'completed', value: Math.min(100, Math.max(0, value)) },
    { name: 'remaining', value: 100 - Math.min(100, Math.max(0, value)) },
  ]

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={90}
            endAngle={-270}
            innerRadius={`${((size / 2) - strokeWidth) / (size / 2) * 100}%`}
            outerRadius="100%"
            dataKey="value"
            strokeWidth={0}
          >
            <Cell fill={color} />
            <Cell fill={backgroundColor} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-white tabular-nums">
            {Math.round(value)}%
          </div>
          {label && (
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          )}
        </div>
      )}
    </div>
  )
}
