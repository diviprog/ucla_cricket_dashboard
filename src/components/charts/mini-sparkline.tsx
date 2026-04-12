'use client'

import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

interface MiniSparklineProps {
  data: number[]
  width?: number | string
  height?: number
  color?: string
  showGradient?: boolean
}

export function MiniSparkline({
  data,
  width = '100%',
  height = 40,
  color = '#FFB81C', // UCLA gold
  showGradient = true,
}: MiniSparklineProps) {
  // Transform data into format recharts expects
  const chartData = data.map((value, index) => ({ value, index }))

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          {showGradient && (
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={showGradient ? `url(#gradient-${color})` : 'none'}
          isAnimationActive={true}
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
