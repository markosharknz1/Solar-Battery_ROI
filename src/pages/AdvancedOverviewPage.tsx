import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { DataGuard } from '@/components/layout/DataGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/store/dataStore'
import { useTariffStore } from '@/store/tariffStore'
import { useBatteryStore } from '@/store/batteryStore'
import { calculateCost } from '@/lib/tariffCalculator'
import { MonthlyBarChart } from '@/components/analytics/MonthlyBarChart'

const SEASONALITY_WARNINGS: Record<string, string> = {
  summer_heavy: 'Your data is mostly from summer months - costs and solar output may look different in winter.',
  winter_heavy: 'Your data is mostly from winter months - costs and solar output may look different in summer.',
  partial: 'Your data covers less than a year - seasonal patterns may not be fully represented.',
}

export function AdvancedOverviewPage() {
  const summary = useDataStore((s) => s.summary)
  const intervals = useDataStore((s) => s.intervals)
  const plans = useTariffStore((s) => s.plans)
  const activePlan = plans.find((p) => p.isActive)
  const quotes = useBatteryStore((s) => s.quotes)
  const results = useBatteryStore((s) => s.results)

  if (!summary) return <DataGuard>{null}</DataGuard>

  const avgDailyCost = activePlan ? calculateCost(intervals, activePlan).totalCostAud / summary.totalDays : null
  const seasonalityWarning = SEASONALITY_WARNINGS[summary.dataSeasonality]

  return (
    <DataGuard>
      <PageHeader title="Overview" description="Your household energy snapshot." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {summary.totalDays} day(s) loaded ({format(summary.dateRange.start, 'MMM yyyy')} - {format(summary.dateRange.end, 'MMM yyyy')})
        </Badge>
      </div>

      {seasonalityWarning && (
        <p className="mb-4 rounded-md bg-accent px-3 py-2 text-sm text-muted-foreground">{seasonalityWarning}</p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Total import</CardTitle>
            <p className="text-2xl font-semibold">{summary.totalGridImport.toFixed(0)} kWh</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Total export</CardTitle>
            <p className="text-2xl font-semibold">{summary.totalGridExport.toFixed(0)} kWh</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Avg daily cost</CardTitle>
            <p className="text-2xl font-semibold">{avgDailyCost !== null ? `$${avgDailyCost.toFixed(2)}` : 'N/A'}</p>
            {!activePlan && <p className="text-xs text-muted-foreground">Set an active tariff plan to see this.</p>}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Active tariff</CardTitle>
            <p className="text-lg font-semibold">{activePlan?.name ?? 'None set'}</p>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monthly usage summary</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart intervals={intervals} tariff={activePlan} simple={false} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/analytics">
          <Card className="transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle className="text-base">Usage analytics →</CardTitle>
              <CardDescription>Heatmaps, daily profiles, and solar analysis.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/compare">
          <Card className="transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle className="text-base">Compare tariff plans →</CardTitle>
              <CardDescription>Find the cheapest plan for your actual usage.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {quotes.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Saved battery simulations</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quotes.map((q) => {
              const resultEntry = Object.entries(results).find(([key]) => key.startsWith(`${q.id}_`))
              const result = resultEntry?.[1]
              return (
                <Link key={q.id} to="/battery">
                  <Card className="transition-colors hover:bg-accent">
                    <CardHeader>
                      <CardTitle className="text-base">{q.name}</CardTitle>
                      <CardDescription>
                        {q.capacityKwh} kWh -{' '}
                        {result ? `$${(result.annualSavingsAud + result.vppCreditAud).toFixed(0)}/yr saving` : 'Not simulated'}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </DataGuard>
  )
}
