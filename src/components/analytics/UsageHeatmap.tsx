import { Fragment, useMemo, useState } from 'react'
import type { Interval } from '@/types/meter'
import { sequentialScale, useIsDarkMode } from '@/lib/colorScale'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
type Metric = 'usage' | 'export' | 'net'

// Shared column template so the cell grid and the time-label row are guaranteed to
// align by construction (both are the same CSS grid, not two independently-sized rows).
const GRID_TEMPLATE_COLUMNS = '2rem repeat(48, 12px)'
const LABEL_SLOTS: Record<number, string> = { 0: '00:00', 12: '06:00', 24: '12:00', 36: '18:00', 47: '23:30' }

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

/** 95th-percentile normalization so one outlier day/slot doesn't wash out the whole colour range. */
function percentile(values: number[], p: number): number {
  const positive = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (positive.length === 0) return 1
  const idx = Math.min(positive.length - 1, Math.floor(positive.length * p))
  return positive[idx] || 1
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

  const { grid, p95 } = useMemo(() => {
    const sums = Array.from({ length: 7 }, () => Array(48).fill(0))
    const counts = Array.from({ length: 7 }, () => Array(48).fill(0))
    for (const i of intervals) {
      sums[i.weekday][i.slot] += metricValue(i, metric)
      counts[i.weekday][i.slot] += 1
    }
    const grid = sums.map((row, w) => row.map((sum, s) => (counts[w][s] > 0 ? sum / counts[w][s] : 0)))
    const p95 = percentile(grid.flat(), 0.95)
    return { grid, p95 }
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
        <div
          className="inline-grid items-center gap-[2px]"
          style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
          role="img"
          aria-label={`Heatmap of average ${metric} by weekday and time of day`}
        >
          {grid.map((row, w) => (
            <Fragment key={w}>
              <span className="text-xs text-[var(--viz-text-muted)]">{WEEKDAY_LABELS[w]}</span>
              {row.map((value, s) => (
                <div
                  key={s}
                  className="h-4 w-3"
                  style={{
                    backgroundColor: sequentialScale(Math.min(1, value / p95), isDark),
                    borderBottom: isInEvWindow(s) ? '2px solid var(--viz-series-4)' : undefined,
                  }}
                  onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, weekday: w, slot: s, value })}
                  onMouseMove={(e) => setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </Fragment>
          ))}

          <span />
          {Array.from({ length: 48 }, (_, s) => (
            <span key={`time-${s}`} className="text-[10px] text-[var(--viz-text-muted)]">
              {LABEL_SLOTS[s] ?? ''}
            </span>
          ))}
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
