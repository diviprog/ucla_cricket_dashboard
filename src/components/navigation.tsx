'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/players', label: 'Batting', icon: '🏏' },
  { href: '/bowling', label: 'Bowling', icon: '🎯' },
  { href: '/fielding', label: 'Fielding', icon: '🧤' },
  { href: '/matches', label: 'Matches', icon: '📋' },
  { href: '/upload', label: 'Upload', icon: '📤' },
]

export function Navigation() {
  const pathname = usePathname()
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        {/* Logo - clickable back to dashboard */}
        <Link href="/" className="flex items-center gap-2 mr-8 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-ucla-blue flex items-center justify-center">
            <span className="text-xl">🏏</span>
          </div>
          <span className="font-bold text-xl">
            <span className="text-ucla-blue">UCLA</span>
            <span className="text-ucla-gold"> Cricket</span>
          </span>
        </Link>
        
        {/* Navigation Links */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-ucla-blue text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span>{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

