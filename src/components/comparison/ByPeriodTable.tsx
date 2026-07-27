import { useMemo } from 'react'
import type { TariffPlan, CostResult } from '@/types/tariff'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export function ByPeriodTable({ entries }: { entries: Array<{ plan: TariffPlan; cost: CostResult }> }) {
  const periodNames = useMemo(() => {
    const names = new Set<string>()
    for (const { cost } of entries) {
      for (const name of Object.keys(cost.byPeriod)) names.add(name)
    }
    return Array.from(names)
  }, [entries])

  const downloadCsv = () => {
    const header = ['Period', ...entries.flatMap((e) => [`${e.plan.name} kWh`, `${e.plan.name} cost`])]
    const rows = periodNames.map((name) => [
      name,
      ...entries.flatMap((e) => {
        const cell = e.cost.byPeriod[name]
        return [cell ? cell.kWh.toFixed(2) : '0', cell ? cell.costAud.toFixed(2) : '0']
      }),
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plan-comparison.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Usage and cost by rate period</p>
        <Button size="sm" variant="outline" onClick={downloadCsv}>
          <Download className="mr-1 h-3 w-3" /> Download comparison as CSV
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            {entries.map(({ plan }) => (
              <TableHead key={plan.id} colSpan={2}>
                {plan.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {periodNames.map((name) => (
            <TableRow key={name}>
              <TableCell>{name}</TableCell>
              {entries.map(({ plan, cost }) => {
                const cell = cost.byPeriod[name]
                return (
                  <TableCell key={plan.id} colSpan={2}>
                    {cell ? `${cell.kWh.toFixed(1)} kWh / $${cell.costAud.toFixed(2)}` : '-'}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
