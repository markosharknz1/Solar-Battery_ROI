import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { Nav } from '@/components/layout/Nav'
import { SimpleModePage } from '@/pages/SimpleModePage'
import { AdvancedOverviewPage } from '@/pages/AdvancedOverviewPage'
import { ImportPage } from '@/pages/ImportPage'
import { TariffsPage } from '@/pages/TariffsPage'
import { BatteryPage } from '@/pages/BatteryPage'
import { ComparePage } from '@/pages/ComparePage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { BillsPage } from '@/pages/BillsPage'
import { useImportSharedLink } from '@/hooks/useImportSharedLink'
import { useUiStore } from '@/store/uiStore'

// Lazy-loaded: pulls in pdfjs-dist (a multi-MB parser + worker), which would otherwise bloat
// the main bundle for every visitor even though only PDF-bill imports need it.
const ImportBillPage = lazy(() => import('@/pages/ImportBillPage').then((m) => ({ default: m.ImportBillPage })))

// Redirects "/" to "/overview" only when Advanced mode was already active on arrival (e.g. a
// fresh load or browser-back into "/") - a mount-only effect, not a reactive <Navigate>, so it
// doesn't race with programmatic navigation triggered elsewhere (e.g. Simple mode's CTA button
// changing mode and navigating to /battery in the same click).
function RootRoute() {
  const mode = useUiStore((s) => s.mode)
  const navigate = useNavigate()

  useEffect(() => {
    if (mode === 'advanced') navigate('/overview', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <SimpleModePage />
}

function App() {
  const imported = useImportSharedLink()

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {imported && (
          <div className="mb-4 rounded-md border border-primary/30 bg-accent px-3 py-2 text-sm">
            Imported {imported.planCount} shared tariff plan{imported.planCount === 1 ? '' : 's'}
            {imported.hasQuote ? ' and a battery quote' : ''} from your link.
          </div>
        )}
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/overview" element={<AdvancedOverviewPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/tariffs" element={<TariffsPage />} />
          <Route path="/battery" element={<BatteryPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route
            path="/bills/import"
            element={
              <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
                <ImportBillPage />
              </Suspense>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
