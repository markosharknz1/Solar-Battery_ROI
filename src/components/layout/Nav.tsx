import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDataStore } from '@/store/dataStore'
import { Zap } from 'lucide-react'

const links = [
  { to: '/overview', label: 'Overview' },
  { to: '/import', label: 'NEM data' },
  { to: '/bills', label: 'Bills' },
  { to: '/battery', label: 'Battery' },
  { to: '/vpp', label: 'VPP' },
  { to: '/household', label: 'Household' },
  { to: '/tariffs', label: 'Tariffs' },
  { to: '/compare', label: 'Compare' },
  { to: '/analytics', label: 'Analytics' },
]

// Input/configuration pages that work before any meter data is loaded.
const ALWAYS_ENABLED = new Set(['/import', '/bills', '/vpp', '/household'])

export function Nav() {
  const hasData = useDataStore((s) => s.summary !== null)

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 whitespace-nowrap font-semibold">
          <Zap className="h-5 w-5 text-primary" />
          Solar &amp; Battery Advisor
        </NavLink>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                  !ALWAYS_ENABLED.has(link.to) && !hasData && 'pointer-events-none opacity-40',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
