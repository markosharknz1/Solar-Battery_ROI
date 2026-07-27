import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { TariffPlan, CostResult } from '@/types/tariff'

export function CostBreakdownChart({ entries }: { entries: Array<{ plan: TariffPlan; cost: CostResult }> }) {
  const data = entries.map(({ plan, cost }) => ({
    name: plan.name,
    'Import cost': cost.importCostAud,
    'Export credit': -cost.exportCreditAud,
    'Controlled load': cost.cl1CostAud,
    'Fixed charges': cost.fixedChargesAud,
  }))

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Cost breakdown by plan</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: 0, right: 12 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis dataKey="name" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
          <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={50} />
          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(2)}`}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
          <Bar dataKey="Import cost" stackId="a" fill="var(--viz-series-1)" maxBarSize={48} />
          <Bar dataKey="Export credit" stackId="a" fill="var(--viz-series-3)" maxBarSize={48} />
          <Bar dataKey="Controlled load" stackId="a" fill="var(--viz-series-2)" maxBarSize={48} />
          <Bar dataKey="Fixed charges" stackId="a" fill="var(--viz-series-4)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
