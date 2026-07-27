import { useMemo, useState } from 'react'
import { DataGuard } from '@/components/layout/DataGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDataStore } from '@/store/dataStore'
import { useTariffStore } from '@/store/tariffStore'
import { useBatteryStore } from '@/store/batteryStore'
import { calculateCost } from '@/lib/tariffCalculator'
import { annualizeFactor } from '@/lib/annualize'
import { RecommendedRanking } from '@/components/comparison/RecommendedRanking'
import { PlanPicker } from '@/components/comparison/PlanPicker'
import { ComparisonCards } from '@/components/comparison/ComparisonCards'
import { CostBreakdownChart } from '@/components/comparison/CostBreakdownChart'
import { MonthlyCostChart } from '@/components/comparison/MonthlyCostChart'
import { ByPeriodTable } from '@/components/comparison/ByPeriodTable'
import { ShareLinkButton } from '@/components/comparison/ShareLinkButton'
import { ProviderQuoteForm } from '@/components/comparison/ProviderQuoteForm'
import { ProviderComparisonTable } from '@/components/comparison/ProviderComparisonTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { ProviderQuote } from '@/types/tariff'

function blankProviderQuote(): ProviderQuote {
  return {
    id: crypto.randomUUID(),
    providerName: '',
    planName: '',
    gstInclusive: true,
    billingPeriodDays: 30,
    dailySupplyCharge: 1.0,
    monthlyAmounts: Array(12).fill(0),
    annualConcessionsAud: 0,
    notes: '',
  }
}

function ProviderQuotes() {
  const providerQuotes = useTariffStore((s) => s.providerQuotes)
  const addProviderQuote = useTariffStore((s) => s.addProviderQuote)
  const updateProviderQuote = useTariffStore((s) => s.updateProviderQuote)
  const deleteProviderQuote = useTariffStore((s) => s.deleteProviderQuote)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {providerQuotes.map((q) => (
          <ProviderQuoteForm
            key={q.id}
            quote={q}
            onChange={(updates) => updateProviderQuote(q.id, updates)}
            onRemove={() => deleteProviderQuote(q.id)}
          />
        ))}
        {providerQuotes.length < 3 && (
          <Button variant="outline" className="h-full min-h-40" onClick={() => addProviderQuote(blankProviderQuote())}>
            <Plus className="mr-1 h-4 w-4" /> Add provider quote
          </Button>
        )}
      </div>
      <ProviderComparisonTable quotes={providerQuotes} />
    </div>
  )
}

function ManualCompare() {
  const intervals = useDataStore((s) => s.intervals)
  const plans = useTariffStore((s) => s.plans)
  const quotes = useBatteryStore((s) => s.quotes)
  const [selectedIds, setSelectedIds] = useState<string[]>(plans.slice(0, 2).map((p) => p.id))
  const summary = useDataStore((s) => s.summary)
  const factor = annualizeFactor(summary?.totalDays ?? 1)

  const entries = useMemo(() => {
    return plans
      .filter((p) => selectedIds.includes(p.id))
      .map((plan) => ({ plan, cost: calculateCost(intervals, plan) }))
  }, [plans, selectedIds, intervals])

  const selectedPlans = plans.filter((p) => selectedIds.includes(p.id))
  const latestQuote = quotes.length > 0 ? quotes[quotes.length - 1] : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PlanPicker plans={plans} selectedIds={selectedIds} onChange={setSelectedIds} />
        {selectedPlans.length > 0 && <ShareLinkButton plans={selectedPlans} quote={latestQuote} />}
      </div>
      {entries.length < 2 ? (
        <p className="text-sm text-muted-foreground">Select at least 2 plans to compare.</p>
      ) : (
        <>
          <ComparisonCards entries={entries} factor={factor} />
          <CostBreakdownChart entries={entries} />
          <MonthlyCostChart entries={entries} />
          <ByPeriodTable entries={entries} />
        </>
      )}
    </div>
  )
}

export function ComparePage() {
  const intervals = useDataStore((s) => s.intervals)
  const summary = useDataStore((s) => s.summary)

  return (
    <DataGuard>
      <PageHeader title="Compare plans" description="See which tariff plan costs the least for your actual usage." />
      <Tabs defaultValue="recommended" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
          <TabsTrigger value="manual">Manual compare</TabsTrigger>
          <TabsTrigger value="providers">Provider quotes</TabsTrigger>
        </TabsList>
        <TabsContent value="recommended">
          <RecommendedRanking intervals={intervals} totalDays={summary?.totalDays ?? 1} />
        </TabsContent>
        <TabsContent value="manual">
          <ManualCompare />
        </TabsContent>
        <TabsContent value="providers">
          <ProviderQuotes />
        </TabsContent>
      </Tabs>
    </DataGuard>
  )
}
