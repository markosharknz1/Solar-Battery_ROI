import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceArea, ResponsiveContainer } from 'recharts'
import type { Interval } from '@/types/meter'
import { seasonOf, SEASON_ORDER, type Season } from '@/lib/seasonalAnalysis'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type SeasonFilter = 'all' | Season

export function DailyProfileChart({
  intervals,
  evWindow,
}: {
  intervals: Interval[]
  evWindow?: { startHour: number; endHour: number }
}) {
  const [season, setSeason] = useState<SeasonFilter>('all')

  const availableSeasons = useMemo(
    () => SEASON_ORDER.filter((s) => intervals.some((i) => seasonOf(i.dateStr) === s)),
    [intervals],
  )

  const filteredIntervals = useMemo(
    () => (season === 'all' ? intervals : intervals.filter((i) => seasonOf(i.dateStr) === season)),
    [intervals, season],
  )

  const data = useMemo(() => {
    const weekdaySum = Array(24).fill(0)
    const weekdayCount = Array(24).fill(0)
    const weekendSum = Array(24).fill(0)
    const weekendCount = Array(24).fill(0)

    for (const i of filteredIntervals) {
      const isWeekend = i.weekday >= 5
      if (isWeekend) {
        weekendSum[i.hour] += i.gridImport
        weekendCount[i.hour] += 1
      } else {
        weekdaySum[i.hour] += i.gridImport
        weekdayCount[i.hour] += 1
      }
    }

    return Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      weekday: weekdayCount[hour] > 0 ? weekdaySum[hour] / weekdayCount[hour] : 0,
      weekend: weekendCount[hour] > 0 ? weekendSum[hour] / weekendCount[hour] : 0,
    }))
  }, [filteredIntervals])

  const evRanges = useMemo(() => {
    if (!evWindow) return []
    const hourLabel = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
    if (evWindow.startHour <= evWindow.endHour) {
      return [{ x1: hourLabel(evWindow.startHour), x2: hourLabel(evWindow.endHour) }]
    }
    // wraps past midnight - split into two shaded ranges
    return [
      { x1: hourLabel(evWindow.startHour), x2: hourLabel(23) },
      { x1: hourLabel(0), x2: hourLabel(evWindow.endHour) },
    ]
  }, [evWindow])

  const peakHour = useMemo(() => {
    let max = -1
    let peak = 0
    data.forEach((d, i) => {
      const avg = (d.weekday + d.weekend) / 2
      if (avg > max) {
        max = avg
        peak = i
      }
    })
    return data[peak]?.hour
  }, [data])

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--viz-text-primary)]">Average usage by hour of day</p>
        <div className="flex items-center gap-3">
          {peakHour && (
            <span className="text-xs text-[var(--viz-text-muted)]">Peak hour: {peakHour}</span>
          )}
          {availableSeasons.length > 1 && (
            <Select value={season} onValueChange={(v) => setSeason(v as SeasonFilter)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All seasons</SelectItem>
                {availableSeasons.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: 0, right: 12 }} barGap={2}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis
            dataKey="hour"
            interval={2}
            stroke="var(--viz-axis)"
            tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
          />
          <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={40} />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(2)} kWh`}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
          {evRanges.map((r, i) => (
            <ReferenceArea key={i} x1={r.x1} x2={r.x2} fill="var(--viz-series-4)" fillOpacity={0.12} label={i === 0 ? { value: 'EV charging window', position: 'insideTop', fontSize: 10, fill: 'var(--viz-text-muted)' } : undefined} />
          ))}
          <Bar dataKey="weekday" name="Weekday" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Bar dataKey="weekend" name="Weekend" fill="var(--viz-series-2)" radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
