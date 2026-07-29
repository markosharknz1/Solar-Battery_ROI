import { Link } from 'react-router-dom'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBillsStore } from '@/store/billsStore'
import { Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export function BillsPage() {
  const bills = useBillsStore((s) => s.bills)
  const deleteBill = useBillsStore((s) => s.deleteBill)

  const sorted = [...bills].sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  const chartData = sorted.map((b) => ({
    label: `${format(parseISO(b.periodStart), 'd MMM yy')}`,
    totalCostAud: b.totalCostAud,
    effectiveRate: b.totalUsageKwh > 0 ? (b.totalCostAud / b.totalUsageKwh) * 100 : null,
  }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Bills" description="Bills you've added, either from a PDF import or entered by hand." />
        <Button asChild>
          <Link to="/bills/import">
            <Plus className="mr-1 h-4 w-4" /> Import bill (PDF)
          </Link>
        </Button>
      </div>

      {bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No bills added yet. Import a PDF bill to get started, or add one manually from the Import page's bill
          fallback form.
        </p>
      ) : (
        <div className="space-y-6">
          {sorted.length > 1 && (
            <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
              <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Bill trend</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
                  <YAxis yAxisId="cost" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={44} />
                  <YAxis
                    yAxisId="rate"
                    orientation="right"
                    stroke="var(--viz-axis)"
                    tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `${v}c`}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v, name) => (name === 'Effective rate' ? `${Number(v).toFixed(1)}c/kWh` : `$${Number(v).toFixed(2)}`)}
                    contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
                  />
                  <Line yAxisId="cost" type="monotone" dataKey="totalCostAud" name="Total cost" stroke="var(--viz-series-1)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="rate" type="monotone" dataKey="effectiveRate" name="Effective rate" stroke="var(--viz-series-4)" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Export</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Effective rate</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {format(parseISO(b.periodStart), 'd MMM yy')} - {format(parseISO(b.periodEnd), 'd MMM yy')}
                    </TableCell>
                    <TableCell>{b.provider || '-'}</TableCell>
                    <TableCell>{b.totalUsageKwh.toFixed(0)} kWh</TableCell>
                    <TableCell>{b.totalExportKwh != null ? `${b.totalExportKwh.toFixed(0)} kWh` : '-'}</TableCell>
                    <TableCell>${b.totalCostAud.toFixed(2)}</TableCell>
                    <TableCell>{b.totalUsageKwh > 0 ? `${((b.totalCostAud / b.totalUsageKwh) * 100).toFixed(1)}c/kWh` : '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => deleteBill(b.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
