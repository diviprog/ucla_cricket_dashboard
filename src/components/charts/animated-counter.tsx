'use client'

import { useEffect, useRef } from 'react'
import CountUp from 'react-countup'

interface AnimatedCounterProps {
  value: number
  decimals?: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
  delay?: number
}

export function AnimatedCounter({
  value,
  decimals = 0,
  duration = 2,
  suffix = '',
  prefix = '',
  className = '',
  delay = 0,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)

  return (
    <span ref={ref} className={className}>
      <CountUp
        start={0}
        end={value}
        decimals={decimals}
        duration={duration}
        delay={delay}
        prefix={prefix}
        suffix={suffix}
        useEasing={true}
        separator=","
      />
    </span>
  )
}
