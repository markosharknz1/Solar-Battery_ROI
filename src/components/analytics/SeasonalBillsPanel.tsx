import { useMemo, useState } from 'react'
import {
  Bar,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Interval, DataSummary } from '@/types/meter'
import type { TariffPlan } from '@/types/tariff'
import { computeSeasonalBreakdown, projectBills } from '@/lib/seasonalAnalysis'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function SeasonalBillsPanel({
  intervals,
  summary,
  plans,
}: {
  intervals: Interval[]
  summary: DataSummary
  plans: TariffPlan[]
}) {
  const activePlan = plans.find((p) => p.isActive)
  const [tariffId, setTariffId] = useState(activePlan?.id ?? plans[0]?.id ?? '')
  const plan = plans.find((p) => p.id === tariffId)
  const [proposedTariffId, setProposedTariffId] = useState<string>('none')
  const proposedPlan = plans.find((p) => p.id === proposedTariffId && p.id !== tariffId)

  const [years, setYears] = useState(5)
  const [dailyChargeIncreasePct, setDailyChargeIncreasePct] = useState(5)
  const [usageRateIncreasePct, setUsageRateIncreasePct] = useState(5)

  const seasonal = useMemo(() => (plan ? computeSeasonalBreakdown(intervals, plan) : []), [intervals, plan])
  // Same usage priced under the proposed plan, keyed onto the same seasons for the chart.
  const seasonalCompared = useMemo(() => {
    if (!proposedPlan) return seasonal.map((s) => ({ ...s, proposedDailyCostAud: null as number | null }))
    const proposed = computeSeasonalBreakdown(intervals, proposedPlan)
    return seasonal.map((s) => ({
      ...s,
      proposedDailyCostAud: proposed.find((p) => p.season === s.season)?.avgDailyCostAud ?? null,
    }))
  }, [seasonal, intervals, proposedPlan])

  const projection = useMemo(
    () =>
      plan
        ? projectBills(intervals, summary.totalDays, plan, Math.max(1, years), dailyChargeIncreasePct, usageRateIncreasePct)
        : [],
    [intervals, summary.totalDays, plan, years, dailyChargeIncreasePct, usageRateIncreasePct],
  )

  const cumulativeTotal = projection.reduce((sum, y) => sum + y.totalCostAud, 0)
  const finalYear = projection[projection.length - 1]
  const firstYear = projection[0]

  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a tariff plan on the Tariffs page first.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div>
          <Label>Current plan</Label>
          <Select value={tariffId} onValueChange={setTariffId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Proposed plan (optional)</Label>
          <Select value={proposedTariffId} onValueChange={setProposedTariffId}>
            <SelectTrigger>
              <SelectValue placeholder="Compare against..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None - current only</SelectItem>
              {plans
                .filter((p) => p.id !== tariffId)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Prices the same usage under a second plan - what buying this power from the grid would look like on it.
          </p>
        </div>
      </div>

      {plan && (
        <>
          <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
            <p className="mb-1 text-sm font-medium text-[var(--viz-text-primary)]">Seasonal breakdown</p>
            <p className="mb-3 text-xs text-[var(--viz-text-muted)]">
              Based on the months actually present in your data - seasons you haven't loaded data for aren't shown.
            </p>
            {seasonal.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data to break down.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={seasonalCompared} margin={{ left: 0, right: 12 }}>
                    <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
                    <XAxis dataKey="season" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
                    <YAxis yAxisId="kwh" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={40} />
                    <YAxis
                      yAxisId="cost"
                      orientation="right"
                      stroke="var(--viz-axis)"
                      tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
                      tickFormatter={(v) => `$${v}`}
                      width={44}
                    />
                    <Tooltip
                      formatter={(v, name) => (String(name).includes('$/day') ? `$${Number(v).toFixed(2)}` : `${Number(v).toFixed(1)} kWh`)}
                      contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
                    <Bar yAxisId="kwh" dataKey="totalImportKwh" name="Import kWh" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar yAxisId="kwh" dataKey="totalExportKwh" name="Export kWh" fill="var(--viz-series-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line yAxisId="cost" type="monotone" dataKey="avgDailyCostAud" name="Current $/day" stroke="var(--viz-series-4)" strokeWidth={2} dot={{ r: 4 }} />
                    {proposedPlan && (
                      <Line
                        yAxisId="cost"
                        type="monotone"
                        dataKey="proposedDailyCostAud"
                        name="Proposed $/day"
                        stroke="var(--viz-series-3)"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={{ r: 4 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {seasonalCompared.map((s) => (
                    <div key={s.season} className="rounded-md border p-2 text-sm">
                      <p className="font-medium">{s.season}</p>
                      <p className="text-xs text-muted-foreground">{s.days} day(s) of data</p>
                      <p className="mt-1">
                        {proposedPlan ? 'Current: ' : ''}${s.avgDailyCostAud.toFixed(2)}/day
                      </p>
                      {s.proposedDailyCostAud != null && (
                        <>
                          <p>Proposed: ${s.proposedDailyCostAud.toFixed(2)}/day</p>
                          {(() => {
                            const delta = (s.proposedDailyCostAud - s.avgDailyCostAud) * s.days
                            return (
                              <p className={`text-xs font-medium ${delta <= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {delta <= 0 ? '-' : '+'}${Math.abs(delta).toFixed(0)} over this season
                              </p>
                            )
                          })()}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {proposedPlan && (
                  <p className="mt-3 text-sm">
                    {(() => {
                      const annualDelta = seasonalCompared.reduce(
                        (sum, s) => sum + ((s.proposedDailyCostAud ?? s.avgDailyCostAud) - s.avgDailyCostAud) * s.days,
                        0,
                      ) * (365 / Math.max(1, seasonalCompared.reduce((d, s) => d + s.days, 0)))
                      return (
                        <span className={annualDelta <= 0 ? 'font-medium text-green-600' : 'font-medium text-destructive'}>
                          {annualDelta <= 0
                            ? `Proposed plan saves ~$${Math.abs(annualDelta).toFixed(0)}/year on this usage.`
                            : `Proposed plan costs ~$${annualDelta.toFixed(0)}/year MORE on this usage.`}
                        </span>
                      )
                    })()}
                  </p>
                )}
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proposed bills - price increase projection</CardTitle>
              <CardDescription>
                Assumes your current usage pattern repeats each year, with the daily charge and usage rate compounding
                by the percentages below. Solar feed-in credit is held flat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Projection period (years)</Label>
                  <Input type="number" min={1} max={20} value={years} onChange={(e) => setYears(Number.parseInt(e.target.value, 10) || 1)} />
                </div>
                <div>
                  <Label>Daily charge increase (%/yr)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={dailyChargeIncreasePct}
                    onChange={(e) => setDailyChargeIncreasePct(Number.parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Usage rate increase (%/yr)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={usageRateIncreasePct}
                    onChange={(e) => setUsageRateIncreasePct(Number.parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {firstYear && finalYear && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Year 1 bill</p>
                    <p className="text-xl font-semibold">${firstYear.totalCostAud.toFixed(0)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Year {finalYear.year} bill</p>
                    <p className="text-xl font-semibold">${finalYear.totalCostAud.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">
                      +{(((finalYear.totalCostAud - firstYear.totalCostAud) / firstYear.totalCostAud) * 100).toFixed(0)}% vs year 1
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Total over {years} year(s)</p>
                    <p className="text-xl font-semibold">${cumulativeTotal.toFixed(0)}</p>
                  </div>
                </div>
              )}

              <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-3">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={projection} margin={{ left: 0, right: 12 }}>
                    <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
                    <XAxis dataKey="year" tickFormatter={(y) => `Year ${y}`} stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
                    <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={48} />
                    <Tooltip
                      labelFormatter={(y) => `Year ${y}`}
                      formatter={(v) => `$${Number(v).toFixed(0)}`}
                      contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
                    <Bar dataKey="fixedChargesAud" name="Fixed charges" stackId="a" fill="var(--viz-series-1)" />
                    <Bar dataKey="usageCostAud" name="Usage cost" stackId="a" fill="var(--viz-series-2)" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="totalCostAud" name="Net total" stroke="var(--viz-series-4)" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Fixed charges</TableHead>
                      <TableHead>Usage cost</TableHead>
                      <TableHead>Export credit</TableHead>
                      <TableHead>Total bill</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projection.map((y) => (
                      <TableRow key={y.year}>
                        <TableCell>Year {y.year}</TableCell>
                        <TableCell>${y.fixedChargesAud.toFixed(0)}</TableCell>
                        <TableCell>${y.usageCostAud.toFixed(0)}</TableCell>
                        <TableCell>-${y.exportCreditAud.toFixed(0)}</TableCell>
                        <TableCell className="font-medium">${y.totalCostAud.toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
