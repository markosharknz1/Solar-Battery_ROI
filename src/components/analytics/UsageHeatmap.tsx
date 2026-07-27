import { useMemo, useState } from 'react'
import type { Interval } from '@/types/meter'
import { sequentialScale, useIsDarkMode } from '@/lib/colorScale'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
type Metric = 'usage' | 'export' | 'net'

function metricValue(i: Interval, metric: Metric): number {
  if (metric === 'usage') return i.gridImport
  if (metric === 'export') return i.gridExport
  return i.netLoad
}

function slotLabel(slot: number): string {
  const totalMin = slot * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function UsageHeatmap({
  intervals,
  evWindow,
}: {
  intervals: Interval[]
  evWindow?: { startSlot: number; endSlot: number }
}) {
  const [metric, setMetric] = useState<Metric>('usage')
  const [hover, setHover] = useState<{ x: number; y: number; weekday: number; slot: number; value: number } | null>(
    null,
  )
  const isDark = useIsDarkMode()

  const { grid, max } = useMemo(() => {
    const sums = Array.from({ length: 7 }, () => Array(48).fill(0))
    const counts = Array.from({ length: 7 }, () => Array(48).fill(0))
    for (const i of intervals) {
      sums[i.weekday][i.slot] += metricValue(i, metric)
      counts[i.weekday][i.slot] += 1
    }
    let maxVal = 0
    const grid = sums.map((row, w) =>
      row.map((sum, s) => {
        const avg = counts[w][s] > 0 ? sum / counts[w][s] : 0
        maxVal = Math.max(maxVal, avg)
        return avg
      }),
    )
    return { grid, max: maxVal || 1 }
  }, [intervals, metric])

  const isInEvWindow = (slot: number) => {
    if (!evWindow) return false
    if (evWindow.startSlot <= evWindow.endSlot) return slot >= evWindow.startSlot && slot < evWindow.endSlot
    return slot >= evWindow.startSlot || slot < evWindow.endSlot // wraps past midnight
  }

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--viz-text-primary)]">Average kWh by time of day</p>
          {evWindow && (
            <p className="text-xs text-[var(--viz-text-muted)]">
              <span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ backgroundColor: 'var(--viz-series-4)' }} />
              EV charging window
            </p>
          )}
        </div>
        <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="usage">Usage</SelectItem>
            <SelectItem value="export">Solar export</SelectItem>
            <SelectItem value="net">Net load</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block" role="img" aria-label={`Heatmap of average ${metric} by weekday and time of day`}>
          {grid.map((row, w) => (
            <div key={w} className="flex items-center gap-[2px]">
              <span className="w-8 shrink-0 text-xs text-[var(--viz-text-muted)]">{WEEKDAY_LABELS[w]}</span>
              {row.map((value, s) => (
                <div
                  key={s}
                  className="h-4 w-3 shrink-0"
                  style={{
                    backgroundColor: sequentialScale(value / max, isDark),
                    borderBottom: isInEvWindow(s) ? '2px solid var(--viz-series-4)' : undefined,
                  }}
                  onMouseEnter={(e) =>
                    setHover({ x: e.clientX, y: e.clientY, weekday: w, slot: s, value })
                  }
                  onMouseMove={(e) => setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </div>
          ))}
          <div className="mt-1 flex pl-8 text-[10px] text-[var(--viz-text-muted)]">
            {[0, 6, 12, 18, 23].map((h) => (
              <span key={h} style={{ width: `${(6 * 48) / 5}px` }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
        </div>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border bg-[var(--viz-surface)] px-2 py-1 text-xs text-[var(--viz-text-primary)] shadow-md"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {WEEKDAY_LABELS[hover.weekday]} {slotLabel(hover.slot)} - {hover.value.toFixed(2)} kWh
        </div>
      )}
    </div>
  )
}
