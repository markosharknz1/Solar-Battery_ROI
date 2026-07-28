import { DataGuard } from '@/components/layout/DataGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDataStore } from '@/store/dataStore'
import { useTariffStore } from '@/store/tariffStore'
import { UsageHeatmap } from '@/components/analytics/UsageHeatmap'
import { MonthlyBarChart } from '@/components/analytics/MonthlyBarChart'
import { DailyProfileChart } from '@/components/analytics/DailyProfileChart'
import { PeakTimesRanking } from '@/components/analytics/PeakTimesRanking'
import { SolarAnalysisPanel } from '@/components/analytics/SolarAnalysisPanel'
import { SeasonalBillsPanel } from '@/components/analytics/SeasonalBillsPanel'

const SEASONALITY_WARNINGS: Record<string, string> = {
  summer_heavy: 'Your data is mostly from summer months - costs and solar output may look different in winter.',
  winter_heavy: 'Your data is mostly from winter months - costs and solar output may look different in summer.',
  partial: 'Your data covers less than a year - seasonal patterns (summer/winter usage and solar) may not be fully represented.',
}

function OverviewTab() {
  const summary = useDataStore((s) => s.summary)
  if (!summary) return null

  const avgDailyImport = summary.totalGridImport / summary.totalDays
  const seasonalityWarning = SEASONALITY_WARNINGS[summary.dataSeasonality]

  return (
    <div className="space-y-4">
      {seasonalityWarning && (
        <p className="rounded-md bg-accent px-3 py-2 text-sm text-muted-foreground">{seasonalityWarning}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
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
            <CardTitle className="text-xs font-normal text-muted-foreground">Avg daily import</CardTitle>
            <p className="text-2xl font-semibold">{avgDailyImport.toFixed(1)} kWh</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Days of data</CardTitle>
            <p className="text-2xl font-semibold">{summary.totalDays}</p>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  const intervals = useDataStore((s) => s.intervals)
  const summary = useDataStore((s) => s.summary)
  const householdProfile = useDataStore((s) => s.householdProfile)
  const plans = useTariffStore((s) => s.plans)
  const activePlan = plans.find((p) => p.isActive)
  const hasSolar = summary?.hasSolarExport ?? false

  const evWindow = householdProfile.ev.enabled
    ? (() => {
        const [startHour, startMin] = householdProfile.ev.chargingStartTime.split(':').map(Number)
        const startSlot = Math.floor((startHour * 60 + startMin) / 30)
        const durationSlots = Math.round(householdProfile.ev.typicalChargeDurationHours * 2)
        const endSlot = (startSlot + durationSlots) % 48
        const endHour = Math.floor(((startHour * 60 + startMin + householdProfile.ev.typicalChargeDurationHours * 60) % 1440) / 60)
        return { startHour, endHour, startSlot, endSlot }
      })()
    : undefined

  return (
    <DataGuard>
      <PageHeader title="Usage analytics" />
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="timeseries">Time series</TabsTrigger>
          <TabsTrigger value="profile">Daily profile</TabsTrigger>
          <TabsTrigger value="peak">Peak times</TabsTrigger>
          {hasSolar && <TabsTrigger value="solar">Solar analysis</TabsTrigger>}
          <TabsTrigger value="seasonal">Seasonal &amp; bills</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="heatmap">
          <UsageHeatmap intervals={intervals} evWindow={evWindow ? { startSlot: evWindow.startSlot, endSlot: evWindow.endSlot } : undefined} />
        </TabsContent>
        <TabsContent value="timeseries">
          <MonthlyBarChart intervals={intervals} simple={false} tariff={activePlan} />
        </TabsContent>
        <TabsContent value="profile">
          <DailyProfileChart intervals={intervals} evWindow={evWindow ? { startHour: evWindow.startHour, endHour: evWindow.endHour } : undefined} />
        </TabsContent>
        <TabsContent value="peak">
          <PeakTimesRanking intervals={intervals} />
        </TabsContent>
        {hasSolar && (
          <TabsContent value="solar">
            <SolarAnalysisPanel intervals={intervals} activePlan={activePlan} />
          </TabsContent>
        )}
        <TabsContent value="seasonal">
          {summary && <SeasonalBillsPanel intervals={intervals} summary={summary} plans={plans} />}
        </TabsContent>
      </Tabs>
    </DataGuard>
  )
}
