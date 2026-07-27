import { useMemo } from 'react'
import type { Interval } from '@/types/meter'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function slotLabel(slot: number): string {
  const totalMin = slot * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function PeakTimesRanking({ intervals }: { intervals: Interval[] }) {
  const ranked = useMemo(() => {
    const sum = new Map<number, { total: number; weekdayTotal: number; weekdayCount: number; weekendTotal: number; weekendCount: number }>()
    for (const i of intervals) {
      const entry = sum.get(i.slot) ?? { total: 0, weekdayTotal: 0, weekdayCount: 0, weekendTotal: 0, weekendCount: 0 }
      entry.total += i.gridImport
      if (i.weekday >= 5) {
        entry.weekendTotal += i.gridImport
        entry.weekendCount += 1
      } else {
        entry.weekdayTotal += i.gridImport
        entry.weekdayCount += 1
      }
      sum.set(i.slot, entry)
    }

    return Array.from(sum.entries())
      .map(([slot, v]) => ({
        slot,
        avgWeekday: v.weekdayCount > 0 ? v.weekdayTotal / v.weekdayCount : 0,
        avgWeekend: v.weekendCount > 0 ? v.weekendTotal / v.weekendCount : 0,
      }))
      .sort((a, b) => b.avgWeekday + b.avgWeekend - (a.avgWeekday + a.avgWeekend))
      .slice(0, 10)
  }, [intervals])

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 text-sm font-medium">Top 10 highest-usage half-hour slots</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Avg weekday kWh</TableHead>
            <TableHead>Avg weekend kWh</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((r, idx) => (
            <TableRow key={r.slot}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell>{slotLabel(r.slot)}</TableCell>
              <TableCell>{r.avgWeekday.toFixed(3)}</TableCell>
              <TableCell>{r.avgWeekend.toFixed(3)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
