import { useMemo } from 'react'
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { TariffPlan, CostResult } from '@/types/tariff'

const SERIES_COLORS = ['var(--viz-series-1)', 'var(--viz-series-2)', 'var(--viz-series-3)', 'var(--viz-series-4)']

export function MonthlyCostChart({ entries }: { entries: Array<{ plan: TariffPlan; cost: CostResult }> }) {
  const data = useMemo(() => {
    const monthMap = new Map<string, Record<string, number | string>>()
    for (const { plan, cost } of entries) {
      for (const m of cost.byMonth) {
        const row = monthMap.get(m.month) ?? { month: m.month }
        row[plan.name] = m.costAud
        monthMap.set(m.month, row)
      }
    }
    return Array.from(monthMap.values()).sort((a, b) => String(a.month).localeCompare(String(b.month)))
  }, [entries])

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Monthly cost by plan</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ left: 0, right: 12 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
          <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={50} />
          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(2)}`}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
          {entries.map(({ plan }, idx) => (
            <Line
              key={plan.id}
              type="monotone"
              dataKey={plan.name}
              stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
