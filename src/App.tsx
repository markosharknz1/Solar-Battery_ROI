import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Nav } from '@/components/layout/Nav'
import { AdvancedOverviewPage } from '@/pages/AdvancedOverviewPage'
import { ImportPage } from '@/pages/ImportPage'
import { HouseholdPage } from '@/pages/HouseholdPage'
import { TariffsPage } from '@/pages/TariffsPage'
import { BatteryPage } from '@/pages/BatteryPage'
import { ComparePage } from '@/pages/ComparePage'
import { VppPage } from '@/pages/VppPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { BillsPage } from '@/pages/BillsPage'
import { useImportSharedLink } from '@/hooks/useImportSharedLink'
import { useDataStore } from '@/store/dataStore'

// Lazy-loaded: pulls in pdfjs-dist (a multi-MB parser + worker), which would otherwise bloat
// the main bundle for every visitor even though only PDF-bill imports need it.
const ImportBillPage = lazy(() => import('@/pages/ImportBillPage').then((m) => ({ default: m.ImportBillPage })))

// "/" lands on the overview when data is loaded, otherwise on the NEM data input page.
function RootRoute() {
  const hasData = useDataStore((s) => s.summary !== null)
  return <Navigate to={hasData ? '/overview' : '/import'} replace />
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
          <Route path="/vpp" element={<VppPage />} />
          <Route path="/household" element={<HouseholdPage />} />
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
