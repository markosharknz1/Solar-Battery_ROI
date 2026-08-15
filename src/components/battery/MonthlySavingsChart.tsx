import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { BatterySimResult } from '@/types/battery'

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${String(y).slice(2)}`
}

export function MonthlySavingsChart({ result }: { result: BatterySimResult }) {
  const months = result.monthlySavings
  if (!months || months.length === 0) {
    return (
      <p className="rounded-md border p-4 text-sm text-muted-foreground">
        This result was saved by an older version - run the simulation again to see month-by-month savings.
      </p>
    )
  }

  const data = months.map((m) => ({
    name: monthLabel(m.month),
    saving: m.savingsAud,
    perDay: m.days > 0 ? m.savingsAud / m.days : 0,
    days: m.days,
    partial: m.days < 25,
  }))
  const hasPartial = data.some((d) => d.partial)

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <p className="mb-1 text-sm font-medium text-[var(--viz-text-primary)]">Savings by month</p>
      <p className="mb-3 text-xs text-[var(--viz-text-muted)]">
        Measured over your uploaded data, month by month - not annualised. Hover for the average saving per day.
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis dataKey="name" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
          <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
            formatter={(v, key) => (key === 'saving' ? `$${Number(v).toFixed(0)}` : v)}
            labelFormatter={(label) => {
              const d = data.find((x) => x.name === label)
              return d ? `${label} - $${d.perDay.toFixed(2)}/day over ${d.days} day(s)` : label
            }}
          />
          <Bar dataKey="saving" name="Saving" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.saving >= 0 ? 'var(--viz-diverging-pos)' : 'var(--viz-diverging-neg)'}
                fillOpacity={d.partial ? 0.45 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {hasPartial && (
        <p className="mt-2 text-xs text-[var(--viz-text-muted)]">Faded bars are partial months (fewer than 25 days of data).</p>
      )}
    </div>
  )
}
