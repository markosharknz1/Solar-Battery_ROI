import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ProviderQuote } from '@/types/tariff'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { computeProviderTotals } from '@/components/comparison/ProviderQuoteForm'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SERIES_COLORS = ['var(--viz-series-1)', 'var(--viz-series-2)', 'var(--viz-series-3)']

export function ProviderComparisonTable({ quotes }: { quotes: ProviderQuote[] }) {
  const rows = useMemo(
    () => quotes.map((q) => ({ quote: q, totals: computeProviderTotals(q) })).filter((r) => r.totals.monthsEntered > 0),
    [quotes],
  )
  const sorted = [...rows].sort((a, b) => a.totals.annualEstimate - b.totals.annualEstimate)
  const cheapestId = sorted[0]?.quote.id
  const mostExpensiveId = sorted[sorted.length - 1]?.quote.id

  const monthlyChartData = MONTH_LABELS.map((label, idx) => {
    const row: Record<string, string | number> = { month: label }
    for (const q of quotes) {
      row[q.providerName || 'Unnamed'] = q.monthlyAmounts[idx] || 0
    }
    return row
  })

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Enter at least one month of bill amounts for a quote to see the comparison.</p>
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead>Annual (est.)</TableHead>
            <TableHead>Supply/yr</TableHead>
            <TableHead>Energy/yr</TableHead>
            <TableHead>Monthly avg</TableHead>
            <TableHead>vs cheapest</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow
              key={r.quote.id}
              className={r.quote.id === cheapestId ? 'bg-green-500/10' : r.quote.id === mostExpensiveId ? 'bg-destructive/10' : undefined}
            >
              <TableCell className="font-medium">{r.quote.providerName || 'Unnamed'} - {r.quote.planName}</TableCell>
              <TableCell>${r.totals.annualEstimate.toFixed(0)}</TableCell>
              <TableCell>${r.totals.supplyPerYear.toFixed(0)}</TableCell>
              <TableCell>${r.totals.energyPerYear.toFixed(0)}</TableCell>
              <TableCell>${r.totals.monthlyAvg.toFixed(0)}</TableCell>
              <TableCell>
                {r.quote.id === cheapestId ? '-' : `+$${(r.totals.annualEstimate - sorted[0].totals.annualEstimate).toFixed(0)}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Monthly bill by provider</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyChartData} margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
            <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={50} />
            <Tooltip
              formatter={(v) => `$${Number(v).toFixed(0)}`}
              contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
            {quotes.map((q, idx) => (
              <Bar key={q.id} dataKey={q.providerName || 'Unnamed'} fill={SERIES_COLORS[idx % SERIES_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={16} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        These are actual bill amounts. Use Tariff Comparison to model what you'd pay under a different rate structure.
      </p>
    </div>
  )
}
