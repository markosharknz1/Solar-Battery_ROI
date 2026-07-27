import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

export function MonthlyBarChart({ intervals, simple }: { intervals: Interval[]; simple: boolean }) {
  const [period, setPeriod] = useState<Period>('all')
  const hasSolar = intervals.some((i) => i.solarGen > 0)

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
    const byDay = new Map<string, { gridImport: number; gridExport: number; solarGen: number }>()
    for (const i of intervals) {
      const existing = byDay.get(i.dateStr) ?? { gridImport: 0, gridExport: 0, solarGen: 0 }
      existing.gridImport += i.gridImport
      existing.gridExport += i.gridExport
      existing.solarGen += i.solarGen
      byDay.set(i.dateStr, existing)
    }
    return Array.from(byDay.entries())
      .map(([dateStr, v]) => ({ dateStr, ...v }))
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  }, [intervals])

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
      <div className="mb-3 flex items-center justify-between">
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
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={filteredDaily} margin={{ left: 0, right: 12 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis
            dataKey="dateStr"
            tickFormatter={(d: string) => format(parseISO(d), 'd MMM')}
            stroke="var(--viz-axis)"
            tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={40} />
          <Tooltip
            labelFormatter={(d) => format(parseISO(String(d)), 'd MMM yyyy')}
            formatter={(v) => `${Number(v).toFixed(2)} kWh`}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
          <Bar dataKey="gridImport" name="Grid import" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          <Bar dataKey="gridExport" name="Solar export" fill="var(--viz-series-2)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          {hasSolar && (
            <Bar dataKey="solarGen" name="Solar generation" fill="var(--viz-series-3)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
