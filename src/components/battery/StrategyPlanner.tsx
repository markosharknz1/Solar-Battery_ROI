import { useMemo, useState } from 'react'
import type { Interval } from '@/types/meter'
import type { TariffPlan } from '@/types/tariff'
import type { BatteryQuote, ChargeWindow } from '@/types/battery'
import { computeAverageDay } from '@/lib/dataProcessor'
import { previewStrategyOnAverageDay, simulateBattery } from '@/lib/batterySimulator'
import { useBatteryStore } from '@/store/batteryStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Plus } from 'lucide-react'
import {
  Area,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'

type DischargeStrategy = 'peak_only' | 'any_import'
type DayFilter = 'all' | 'weekday' | 'weekend'

/** The full simulation quote is the shared draft plus the planner's strategy choices. */
function quoteFromDraft(
  draft: BatteryQuote,
  chargeWindows: ChargeWindow[],
  dischargeStrategy: DischargeStrategy,
  useSolar: boolean,
): BatteryQuote {
  const window = chargeWindows[0]
  return {
    ...draft,
    chargePriority: window ? (useSolar ? 'solar_then_arbitrage' : 'arbitrage_only') : useSolar ? 'solar_only' : 'arbitrage_only',
    dischargePriority: dischargeStrategy,
    arbitrageTargetPercent: window?.targetPercent ?? draft.arbitrageTargetPercent,
    arbitrageStartTime: window?.fromTime ?? draft.arbitrageStartTime,
    arbitrageEndTime: window?.toTime ?? draft.arbitrageEndTime,
  }
}

const PRESETS = [
  {
    id: 'solar_only',
    name: 'Solar self-consumption only',
    description: 'Charge from solar surplus, discharge at peak.',
    chargeWindows: [] as ChargeWindow[],
    dischargeStrategy: 'peak_only' as DischargeStrategy,
    useSolar: true,
  },
  {
    id: 'arbitrage_solar',
    name: 'Grid arbitrage + solar',
    description: 'Charge overnight at cheap rate, top up from solar, discharge at peak. Recommended for cheap overnight rate users.',
    chargeWindows: [{ id: 'preset-window', fromTime: '23:00', toTime: '07:00', targetPercent: 80 }] as ChargeWindow[],
    dischargeStrategy: 'peak_only' as DischargeStrategy,
    useSolar: true,
  },
  {
    id: 'arbitrage_only',
    name: 'Grid arbitrage only',
    description: 'Charge overnight at cheap rate, discharge at peak. Ignores solar priority.',
    chargeWindows: [{ id: 'preset-window', fromTime: '23:00', toTime: '07:00', targetPercent: 80 }] as ChargeWindow[],
    dischargeStrategy: 'any_import' as DischargeStrategy,
    useSolar: false,
  },
]

export function StrategyPlanner({
  intervals,
  plans,
  onApplyAndRun,
}: {
  intervals: Interval[]
  plans: TariffPlan[]
  onApplyAndRun: (quote: BatteryQuote, tariffId: string) => void
}) {
  // All planner state lives in the persisted battery store, shared with the Configure &
  // simulate tab - capacity typed here is the capacity there, and tab switches lose nothing.
  const params = useBatteryStore((s) => s.draftQuote)
  const updateDraft = useBatteryStore((s) => s.updateDraftQuote)
  const { chargeWindows, dischargeStrategy, useSolar, presetId: selectedPreset } = useBatteryStore((s) => s.planner)
  const updatePlanner = useBatteryStore((s) => s.updatePlanner)
  const draftTariffId = useBatteryStore((s) => s.draftTariffId)
  const setTariffId = useBatteryStore((s) => s.setDraftTariffId)
  const tariffId = draftTariffId && plans.some((p) => p.id === draftTariffId) ? draftTariffId : (plans[0]?.id ?? '')
  const plan = plans.find((p) => p.id === tariffId)

  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [showRateOverlay, setShowRateOverlay] = useState(true)
  const [showSolarLayer, setShowSolarLayer] = useState(true)

  const hasSolar = intervals.some((i) => i.solarGen > 0 || i.gridExport > 0)

  const setChargeWindows = (windows: ChargeWindow[]) => updatePlanner({ chargeWindows: windows })

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    updatePlanner({
      presetId,
      chargeWindows: preset.chargeWindows.map((w) => ({ ...w, id: crypto.randomUUID() })),
      dischargeStrategy: preset.dischargeStrategy,
      useSolar: preset.useSolar,
    })
  }

  const avgDay = useMemo(() => (plan ? computeAverageDay(intervals, plan, dayFilter) : []), [intervals, plan, dayFilter])

  const preview = useMemo(
    () => previewStrategyOnAverageDay(avgDay, params, chargeWindows, dischargeStrategy, useSolar),
    [avgDay, params, chargeWindows, dischargeStrategy, useSolar],
  )

  const chartData = preview.map((s) => ({
    time: s.time,
    homeLoad: s.avgHomeLoad,
    solarGen: s.avgSolarGen,
    gridImport: s.avgGridImport,
    gridExport: s.avgGridExport,
    soc: s.projectedSoc,
    rate: s.tariffRate * 100,
  }))

  const chargeRegions = chargeWindows.map((w) => ({ x1: w.fromTime, x2: w.toTime, label: `Charging` }))

  const quickResult = useMemo(() => {
    if (!plan) return null
    const quote = quoteFromDraft(params, chargeWindows, dischargeStrategy, useSolar)
    return simulateBattery(intervals, quote, plan)
  }, [intervals, plan, params, chargeWindows, dischargeStrategy, useSolar])

  const addWindow = () =>
    setChargeWindows([...chargeWindows, { id: crypto.randomUUID(), fromTime: '23:00', toTime: '07:00', targetPercent: 80 }])
  const updateWindow = (id: string, updates: Partial<ChargeWindow>) =>
    setChargeWindows(chargeWindows.map((win) => (win.id === id ? { ...win, ...updates } : win)))
  const removeWindow = (id: string) => setChargeWindows(chargeWindows.filter((win) => win.id !== id))

  const autoSuggestWindow = () => {
    if (!plan || plan.periods.length === 0) return
    const cheapest = [...plan.periods].sort((a, b) => a.ratePerKwh - b.ratePerKwh)[0]
    setChargeWindows([{ id: crypto.randomUUID(), fromTime: cheapest.startTime, toTime: cheapest.endTime, targetPercent: 80 }])
  }

  const rateAtWindowStart = (fromTime: string): { rate: number; name: string } | null => {
    if (!plan) return null
    const [h, m] = fromTime.split(':').map(Number)
    const slot = Math.floor((h * 60 + m) / 30)
    const match = avgDay.find((s) => s.slot === slot)
    if (!match) return null
    const period = plan.periods.find((p) => p.days.some((d) => d))
    return { rate: match.tariffRate, name: period?.name ?? '' }
  }

  if (!plan) {
    return <p className="text-sm text-muted-foreground">Add a tariff plan on the Tariffs page first.</p>
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Label>Simulate against tariff plan</Label>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left panel */}
        <div className="space-y-4">
          <div className="space-y-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                  selectedPreset === preset.id ? 'border-primary bg-accent' : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 shrink-0 rounded-full border-2 ${selectedPreset === preset.id ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                  <span className="font-medium">{preset.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
              </button>
            ))}
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Battery parameters</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Capacity (kWh)</Label>
                <Input type="number" value={params.capacityKwh} onChange={(e) => updateDraft({ capacityKwh: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs">Reserve (%)</Label>
                <Input type="number" value={params.reservePercent} onChange={(e) => updateDraft({ reservePercent: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Charge windows</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={autoSuggestWindow}>
                  Auto-suggest from tariff
                </Button>
                <Button size="sm" variant="outline" onClick={addWindow}>
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
            </div>
            {chargeWindows.length === 0 && <p className="text-xs text-muted-foreground">No grid charge windows - battery only charges from solar surplus.</p>}
            {chargeWindows.length > 0 && (
              <div className="grid grid-cols-12 gap-2 px-2 text-[10px] text-muted-foreground">
                <span className="col-span-3">From</span>
                <span className="col-span-3">To</span>
                <span className="col-span-2">Charge to %</span>
                <span className="col-span-3">Rate in window</span>
                <span className="col-span-1" />
              </div>
            )}
            <div className="space-y-2">
              {chargeWindows.map((w) => {
                const detected = rateAtWindowStart(w.fromTime)
                return (
                  <div key={w.id} className="grid grid-cols-12 items-center gap-2 rounded border p-2 text-xs">
                    <Input type="time" step={1800} className="col-span-3" value={w.fromTime} onChange={(e) => updateWindow(w.id, { fromTime: e.target.value })} />
                    <Input type="time" step={1800} className="col-span-3" value={w.toTime} onChange={(e) => updateWindow(w.id, { toTime: e.target.value })} />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      title="Charge from the grid during this window until the battery reaches this percentage, then stop"
                      className="col-span-2"
                      value={w.targetPercent}
                      onChange={(e) => updateWindow(w.id, { targetPercent: Number(e.target.value) || 0 })}
                    />
                    <span className="col-span-3 text-muted-foreground">{detected ? `${(detected.rate * 100).toFixed(0)}c/kWh` : ''}</span>
                    <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeWindow(w.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
            {chargeWindows.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                "Charge to %" caps grid charging in the window - e.g. 80 means charge overnight to 80% full, leaving
                headroom to top up free from solar the next day.
              </p>
            )}
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Discharge strategy</p>
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={dischargeStrategy === 'peak_only'} onChange={() => updatePlanner({ dischargeStrategy: 'peak_only' })} />
                During peak rate only
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={dischargeStrategy === 'any_import'} onChange={() => updatePlanner({ dischargeStrategy: 'any_import' })} />
                Any grid import
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              "Peak rate only" holds enough charge to cover the rest of the day's top-rate usage, and only spends the surplus during
              cheaper shoulder periods - so the battery is never empty when the peak rate starts.
            </p>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <Checkbox checked={useSolar} onCheckedChange={(v) => updatePlanner({ useSolar: v === true })} />
              Charge from solar surplus
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Reserve: {((params.capacityKwh * params.reservePercent) / 100).toFixed(1)} kWh - battery will not discharge below this.
          </p>

          <Button
            className="w-full"
            onClick={() => {
              const quote = quoteFromDraft(params, chargeWindows, dischargeStrategy, useSolar)
              // Persist the strategy choice into the shared draft so the Configure tab's
              // Strategy section reflects what was applied here.
              updateDraft({
                chargePriority: quote.chargePriority,
                dischargePriority: quote.dischargePriority,
                arbitrageTargetPercent: quote.arbitrageTargetPercent,
                arbitrageStartTime: quote.arbitrageStartTime,
                arbitrageEndTime: quote.arbitrageEndTime,
              })
              onApplyAndRun(quote, tariffId)
            }}
          >
            Apply and run full simulation
          </Button>
        </div>

        {/* Right panel */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <Checkbox checked={showRateOverlay} onCheckedChange={(v) => setShowRateOverlay(v === true)} /> Show rate overlay
            </label>
            {hasSolar && (
              <label className="flex items-center gap-1.5">
                <Checkbox checked={showSolarLayer} onCheckedChange={(v) => setShowSolarLayer(v === true)} /> Show solar
              </label>
            )}
            <Select value={dayFilter} onValueChange={(v) => setDayFilter(v as DayFilter)}>
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All days</SelectItem>
                <SelectItem value="weekday">Weekday</SelectItem>
                <SelectItem value="weekend">Weekend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-3">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
                <XAxis dataKey="time" interval={5} stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 10 }} />
                <YAxis yAxisId="kwh" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 10 }} width={36} />
                {showRateOverlay && (
                  <YAxis yAxisId="rate" orientation="right" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 10 }} tickFormatter={(v) => `${v}c`} width={36} />
                )}
                {chargeRegions.map((r, i) => (
                  <ReferenceArea key={i} yAxisId="kwh" x1={r.x1} x2={r.x2} fill="var(--viz-series-3)" fillOpacity={0.1} />
                ))}
                <Tooltip
                  formatter={(v, name) => (name === 'Tariff rate' ? `${Number(v).toFixed(1)}c` : `${Number(v).toFixed(2)} kWh`)}
                  contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 11 }}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: 'var(--viz-text-secondary)' }} />
                <Area yAxisId="kwh" type="monotone" dataKey="homeLoad" name="Home load" stroke="none" fill="var(--viz-text-muted)" fillOpacity={0.25} />
                {showSolarLayer && (
                  <Area yAxisId="kwh" type="monotone" dataKey="solarGen" name="Solar" stroke="none" fill="var(--viz-series-4)" fillOpacity={0.3} />
                )}
                <Area yAxisId="kwh" type="monotone" dataKey="gridImport" name="Grid import" stroke="none" fill="var(--viz-series-1)" fillOpacity={0.35} />
                <Area yAxisId="kwh" type="monotone" dataKey="gridExport" name="Grid export" stroke="none" fill="var(--viz-series-2)" fillOpacity={0.35} />
                <Line yAxisId="kwh" type="monotone" dataKey="soc" name="Battery SoC" stroke="var(--viz-series-3)" strokeWidth={2.5} dot={false} />
                {showRateOverlay && (
                  <Line yAxisId="rate" type="stepAfter" dataKey="rate" name="Tariff rate" stroke="var(--viz-diverging-neg)" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {quickResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost comparison</CardTitle>
            <CardDescription>Quick estimate - use "Apply and run full simulation" for an accurate figure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-2xl font-semibold text-primary">
              ${(quickResult.annualSavingsAud + quickResult.vppCreditAud).toFixed(0)} / year saving
            </p>
            <p className="text-xs text-muted-foreground">
              Grid import reduced by {(quickResult.annualGridImportKwhBase - quickResult.annualGridImportKwh).toFixed(0)} kWh/yr
            </p>
            <p className="text-xs text-muted-foreground">
              Import cost saved: ${quickResult.importCostSavedAud.toFixed(0)} - Export credit lost: $
              {quickResult.exportCreditLostAud.toFixed(0)}
              {quickResult.arbitrageAnnualValueAud > 0 && ` - Arbitrage value: $${quickResult.arbitrageAnnualValueAud.toFixed(0)}`}
            </p>
            {chargeWindows.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Note: the accurate simulator currently uses only the first charge window ({chargeWindows[0].fromTime}-{chargeWindows[0].toTime}); the chart
                preview above reflects all {chargeWindows.length} windows.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
