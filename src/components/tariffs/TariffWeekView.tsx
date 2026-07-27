import { useMemo } from 'react'
import type { RatePeriod } from '@/types/tariff'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// Fixed categorical order (dataviz skill) - assigned by first-seen period name, never cycled per-instance.
const CATEGORICAL_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
]

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

interface Block {
  startMin: number
  endMin: number
  name: string
  color: string
}

function useBlocksByDay(periods: RatePeriod[]) {
  const colorByName = useMemo(() => {
    const map = new Map<string, string>()
    let i = 0
    for (const p of periods) {
      if (!map.has(p.name)) {
        map.set(p.name, CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length])
        i++
      }
    }
    return map
  }, [periods])

  const blocksByDay = useMemo(() => {
    const days: Block[][] = Array.from({ length: 7 }, () => [])
    for (const p of periods) {
      const start = toMinutes(p.startTime)
      let end = toMinutes(p.endTime)
      const wraps = end <= start
      if (wraps) end += 24 * 60

      p.days.forEach((active, dayIdx) => {
        if (!active) return
        const color = colorByName.get(p.name)!
        if (!wraps) {
          days[dayIdx].push({ startMin: start, endMin: end, name: p.name, color })
        } else {
          days[dayIdx].push({ startMin: start, endMin: 24 * 60, name: p.name, color })
          const nextDay = (dayIdx + 1) % 7
          days[nextDay].push({ startMin: 0, endMin: end - 24 * 60, name: p.name, color })
        }
      })
    }
    return days
  }, [periods, colorByName])

  return { colorByName, blocksByDay }
}

function ScheduleRow({ label, periods, height = 130 }: { label: string; periods: RatePeriod[]; height?: number }) {
  const { colorByName, blocksByDay } = useBlocksByDay(periods)
  if (periods.length === 0) return null

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Array.from(colorByName.entries()).map(([name, color]) => (
            <span key={name} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {name}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1" style={{ height }}>
        {blocksByDay.map((blocks, dayIdx) => (
          <div key={dayIdx} className="relative rounded bg-muted">
            {blocks.map((b, i) => (
              <div
                key={i}
                className="absolute inset-x-0 rounded-sm"
                style={{
                  top: `${(b.startMin / 1440) * 100}%`,
                  height: `${((b.endMin - b.startMin) / 1440) * 100}%`,
                  backgroundColor: b.color,
                }}
                title={b.name}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TariffWeekView({ periods, feedInPeriods = [] }: { periods: RatePeriod[]; feedInPeriods?: RatePeriod[] }) {
  return (
    <div className="space-y-3">
      <ScheduleRow label="Import" periods={periods} />
      <ScheduleRow label="Feed-in" periods={feedInPeriods} height={90} />
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {DAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  )
}
