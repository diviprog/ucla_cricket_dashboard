'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/auth-context'
import {
  TrendingUp,
  Target,
  Hand,
  Calendar,
  Upload,
  Settings,
  Trophy,
  type LucideIcon
} from 'lucide-react'

// Public nav items (visible to everyone)
const publicNavItems: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: '/players', label: 'Batting', Icon: TrendingUp },
  { href: '/bowling', label: 'Bowling', Icon: Target },
  { href: '/fielding', label: 'Fielding', Icon: Hand },
  { href: '/matches', label: 'Matches', Icon: Calendar },
]

// Admin-only nav items
const adminNavItems: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: '/upload', label: 'Upload', Icon: Upload },
  { href: '/players/manage', label: 'Manage', Icon: Settings },
]

export function Navigation() {
  const pathname = usePathname()
  const { isAdmin, user, signOut, loading } = useAuth()

  const navItems = isAdmin 
    ? [...publicNavItems, ...adminNavItems]
    : publicNavItems
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center">
          {/* Logo - clickable back to dashboard */}
          <Link href="/" className="flex items-center gap-2 mr-8 hover:opacity-90 transition-all group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ucla-blue to-ucla-blue/80 flex items-center justify-center shadow-lg group-hover:shadow-ucla-blue/50 transition-shadow">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">
              <span className="text-ucla-blue">UCLA</span>
              <span className="text-ucla-gold"> Cricket</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-ucla-blue text-white shadow-lg shadow-ucla-blue/30'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ucla-gold rounded-full" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Auth Section */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">...</div>
          ) : isAdmin ? (
            <>
              <span className="hidden md:inline text-xs text-muted-foreground">
                {user?.email}
              </span>
              <span className="hidden sm:inline px-2 py-1 bg-ucla-gold/20 text-ucla-gold text-xs font-medium rounded">
                Admin
              </span>
              <button
                onClick={() => signOut()}
                className="text-sm text-muted-foreground hover:text-white transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/admin/login"
              className="text-sm text-muted-foreground hover:text-white transition-colors"
            >
              Admin Login
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

