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
import type { Interval } from '@/types/meter'
import type { TariffPlan } from '@/types/tariff'
import { resolveRate, resolveFeedInRate } from '@/lib/tariffCalculator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { format, parseISO, subDays, subMonths, subYears } from 'date-fns'

type Period = '7d' | '30d' | '3m' | '6m' | '1y' | 'all'
const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '1y': 'Last year',
  all: 'All time',
}

/** Rough estimate of monthly self-consumption a battery could add - an upper bound (min of import/export)
 * scaled down by a realistic capture factor. Not a substitute for the full battery simulator. */
function estimateBatterySelfConsumption(importKwh: number, exportKwh: number): number {
  return Math.min(importKwh, exportKwh) * 0.7
}

export function MonthlyBarChart({
  intervals,
  simple,
  tariff,
}: {
  intervals: Interval[]
  simple: boolean
  tariff?: TariffPlan
}) {
  const [period, setPeriod] = useState<Period>('all')
  const hasSolar = intervals.some((i) => i.solarGen > 0)

  const [showImport, setShowImport] = useState(true)
  const [showExport, setShowExport] = useState(true)
  const [showSolarGen, setShowSolarGen] = useState(true)
  const [showCost, setShowCost] = useState(false)

  const monthly = useMemo(() => {
    const byMonth = new Map<string, { gridImport: number; gridExport: number }>()
    for (const i of intervals) {
      const month = i.dateStr.slice(0, 7)
      const e = byMonth.get(month) ?? { gridImport: 0, gridExport: 0 }
      e.gridImport += i.gridImport
      e.gridExport += i.gridExport
      byMonth.set(month, e)
    }
    return Array.from(byMonth.entries())
      .map(([month, v]) => ({
        month,
        gridImport: v.gridImport,
        gridExport: v.gridExport,
        estimatedSelfConsumption: estimateBatterySelfConsumption(v.gridImport, v.gridExport),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [intervals])

  const daily = useMemo(() => {
    const byDay = new Map<string, { gridImport: number; gridExport: number; solarGen: number; costAud: number }>()
    for (const i of intervals) {
      const existing = byDay.get(i.dateStr) ?? { gridImport: 0, gridExport: 0, solarGen: 0, costAud: 0 }
      existing.gridImport += i.gridImport
      existing.gridExport += i.gridExport
      existing.solarGen += i.solarGen
      if (tariff) {
        const importCost = i.gridImport * resolveRate(tariff, i).ratePerKwh
        const exportCredit = i.gridExport * resolveFeedInRate(tariff, i).ratePerKwh
        existing.costAud += importCost - exportCredit
      }
      byDay.set(i.dateStr, existing)
    }
    return Array.from(byDay.entries())
      .map(([dateStr, v]) => ({ dateStr, ...v }))
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  }, [intervals, tariff])

  const filteredDaily = useMemo(() => {
    if (period === 'all' || daily.length === 0) return daily
    const lastDate = parseISO(daily[daily.length - 1].dateStr)
    const cutoff =
      period === '7d'
        ? subDays(lastDate, 7)
        : period === '30d'
          ? subDays(lastDate, 30)
          : period === '3m'
            ? subMonths(lastDate, 3)
            : period === '6m'
              ? subMonths(lastDate, 6)
              : subYears(lastDate, 1)
    return daily.filter((d) => parseISO(d.dateStr) >= cutoff)
  }, [daily, period])

  if (simple) {
    return (
      <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Monthly usage</p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={monthly} margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => format(parseISO(`${m}-01`), 'MMM yy')}
              stroke="var(--viz-axis)"
              tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
            />
            <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={40} />
            <Tooltip
              formatter={(v) => `${Number(v).toFixed(1)} kWh`}
              labelFormatter={(m) => format(parseISO(`${m}-01`), 'MMMM yyyy')}
              contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
            <Bar dataKey="gridImport" name="Grid import" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="gridExport" name="Solar export" fill="var(--viz-series-2)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Line
              type="monotone"
              dataKey="estimatedSelfConsumption"
              name="Est. self-consumption with battery"
              stroke="var(--viz-text-muted)"
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--viz-text-primary)]">Daily usage over time</p>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-[var(--viz-text-secondary)]">
        <label className="flex items-center gap-1.5">
          <Checkbox checked={showImport} onCheckedChange={(v) => setShowImport(v === true)} /> Grid import
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={showExport} onCheckedChange={(v) => setShowExport(v === true)} /> Solar export
        </label>
        {hasSolar && (
          <label className="flex items-center gap-1.5">
            <Checkbox checked={showSolarGen} onCheckedChange={(v) => setShowSolarGen(v === true)} /> Solar generation
          </label>
        )}
        {tariff && (
          <label className="flex items-center gap-1.5">
            <Checkbox checked={showCost} onCheckedChange={(v) => setShowCost(v === true)} /> Cost $/day
          </label>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={filteredDaily} margin={{ left: 0, right: 12 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis
            dataKey="dateStr"
            tickFormatter={(d: string) => format(parseISO(d), 'd MMM')}
            stroke="var(--viz-axis)"
            tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis yAxisId="kwh" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={40} />
          {showCost && (
            <YAxis
              yAxisId="cost"
              orientation="right"
              stroke="var(--viz-axis)"
              tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
              width={44}
            />
          )}
          <Tooltip
            labelFormatter={(d) => format(parseISO(String(d)), 'd MMM yyyy')}
            formatter={(v, name) => (name === 'Cost' ? `$${Number(v).toFixed(2)}` : `${Number(v).toFixed(2)} kWh`)}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
          {showImport && (
            <Bar yAxisId="kwh" dataKey="gridImport" name="Grid import" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          )}
          {showExport && (
            <Bar yAxisId="kwh" dataKey="gridExport" name="Solar export" fill="var(--viz-series-2)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          )}
          {hasSolar && showSolarGen && (
            <Bar yAxisId="kwh" dataKey="solarGen" name="Solar generation" fill="var(--viz-series-3)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          )}
          {showCost && (
            <Line yAxisId="cost" type="monotone" dataKey="costAud" name="Cost" stroke="var(--viz-series-4)" strokeWidth={2} dot={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
