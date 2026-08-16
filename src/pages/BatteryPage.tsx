import { useState } from 'react'
import { DataGuard } from '@/components/layout/DataGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDataStore } from '@/store/dataStore'
import { useTariffStore } from '@/store/tariffStore'
import { useBatteryStore } from '@/store/batteryStore'
import { useVppStore } from '@/store/vppStore'
import { BatteryQuoteForm } from '@/components/battery/BatteryQuoteForm'
import { BatteryResults } from '@/components/battery/BatteryResults'
import { StrategyPlanner } from '@/components/battery/StrategyPlanner'
import { simulateBattery } from '@/lib/batterySimulator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { BatteryQuote, BatterySimResult } from '@/types/battery'
import type { TariffPlan } from '@/types/tariff'

export function BatteryPage() {
  const intervals = useDataStore((s) => s.intervals)
  const summary = useDataStore((s) => s.summary)
  const plans = useTariffStore((s) => s.plans)
  const quotes = useBatteryStore((s) => s.quotes)
  const addQuote = useBatteryStore((s) => s.addQuote)
  const deleteQuote = useBatteryStore((s) => s.deleteQuote)
  const results = useBatteryStore((s) => s.results)
  const setResult = useBatteryStore((s) => s.setResult)
  const draftQuote = useBatteryStore((s) => s.draftQuote)
  const vppPrograms = useVppStore((s) => s.programs)
  const updateDraftQuote = useBatteryStore((s) => s.updateDraftQuote)
  const setDraftTariffId = useBatteryStore((s) => s.setDraftTariffId)

  const [current, setCurrent] = useState<{ quote: BatteryQuote; plan: TariffPlan; result: BatterySimResult } | null>(null)
  const [topTab, setTopTab] = useState('strategy')

  const runSimulation = (quote: BatteryQuote, tariffId: string) => {
    const plan = plans.find((p) => p.id === tariffId)
    if (!plan) return
    const vpp = vppPrograms.find((p) => p.id === quote.vppProgramId) ?? null
    const result = simulateBattery(intervals, quote, plan, vpp)
    addQuote(quote)
    setResult(`${quote.id}_${tariffId}`, result)
    setCurrent({ quote, plan, result })
  }

  const applyFromPlanner = (quote: BatteryQuote, tariffId: string) => {
    runSimulation(quote, tariffId)
    setTopTab('configure')
  }

  // "Play back" a saved quote: load it into the shared draft (so the form shows its
  // parameters and further runs update it in place) and, if it has a stored result
  // against a plan that still exists, show that result immediately.
  const loadQuote = (q: BatteryQuote) => {
    updateDraftQuote(q)
    const resultEntry = Object.entries(results).find(([key]) => key.startsWith(`${q.id}_`))
    if (resultEntry) {
      const tariffId = resultEntry[0].slice(q.id.length + 1)
      const plan = plans.find((p) => p.id === tariffId)
      if (plan) {
        setDraftTariffId(plan.id)
        setCurrent({ quote: q, plan, result: resultEntry[1] })
      }
    }
    setTopTab('configure')
  }

  return (
    <DataGuard>
      <PageHeader
        title="Battery simulator"
        description="Model a battery quote's charge/discharge strategy and estimate savings and payback."
      />
      {summary?.isFlatEstimate && (
        <p className="mb-4 rounded-md bg-accent px-3 py-2 text-sm text-muted-foreground">
          Battery simulation needs real interval data - the flat-estimate bill you entered isn't detailed enough.
          Import a smart meter CSV to use this page.
        </p>
      )}

      <Tabs value={topTab} onValueChange={setTopTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="strategy">Strategy planner</TabsTrigger>
          <TabsTrigger value="configure">Configure &amp; simulate</TabsTrigger>
        </TabsList>

        <TabsContent value="strategy">
          <StrategyPlanner intervals={intervals} plans={plans} onApplyAndRun={applyFromPlanner} />
        </TabsContent>

        <TabsContent value="configure">
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <BatteryQuoteForm onRun={runSimulation} />
            <div>
              {current ? (
                <BatteryResults result={current.result} quote={current.quote} plan={current.plan} totalDays={summary?.totalDays ?? 1} />
              ) : (
                <p className="text-sm text-muted-foreground">Configure a quote and run a simulation to see results.</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {quotes.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Saved quotes</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Annual saving</TableHead>
                <TableHead>Payback</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => {
                const resultEntry = Object.entries(results).find(([key]) => key.startsWith(`${q.id}_`))
                const result = resultEntry?.[1]
                return (
                  <TableRow key={q.id}>
                    <TableCell>
                      {q.name}
                      {draftQuote.id === q.id && <span className="ml-2 text-xs text-muted-foreground">(loaded)</span>}
                    </TableCell>
                    <TableCell>{q.capacityKwh} kWh</TableCell>
                    <TableCell>${q.totalCostAud.toFixed(0)}</TableCell>
                    <TableCell>
                      {result ? `$${(result.annualSavingsAud + result.vppCreditAud).toFixed(0)}/yr` : '-'}
                    </TableCell>
                    <TableCell>
                      {result && Number.isFinite(result.simplePaybackYears) ? `${result.simplePaybackYears.toFixed(1)} yrs` : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => loadQuote(q)}>
                        Load
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteQuote(q.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </DataGuard>
  )
}
