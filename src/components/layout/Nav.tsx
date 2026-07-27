import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { ModeToggle } from '@/components/layout/ModeToggle'
import { Zap } from 'lucide-react'

const links = [
  { to: '/overview', label: 'Overview' },
  { to: '/tariffs', label: 'Tariffs' },
  { to: '/battery', label: 'Battery' },
  { to: '/compare', label: 'Compare' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/import', label: 'Import' },
]

export function Nav() {
  const hasData = useDataStore((s) => s.summary !== null)
  const mode = useUiStore((s) => s.mode)

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <Zap className="h-5 w-5 text-primary" />
          Solar &amp; Battery Advisor
        </NavLink>
        {mode === 'advanced' && (
          <nav className="flex flex-1 items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                    link.to !== '/import' && !hasData && 'pointer-events-none opacity-40',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className={cn(mode === 'simple' && 'ml-auto')}>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
