import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '@/store/dataStore'
import { Button } from '@/components/ui/button'

export function DataGuard({ children }: { children: ReactNode }) {
  const hasData = useDataStore((s) => s.summary !== null)

  if (!hasData) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h2 className="text-lg font-semibold">Load your usage data first</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Import a smart meter CSV, or enter a bill manually, to unlock this page.
        </p>
        <Button asChild className="mt-4">
          <Link to="/import">Go to Import</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
