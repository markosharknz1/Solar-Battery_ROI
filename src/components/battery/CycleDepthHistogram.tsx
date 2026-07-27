import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

export function CycleDepthHistogram({
  dailyCycleDepths,
  targetMinPct,
  targetMaxPct,
}: {
  dailyCycleDepths: number[]
  targetMinPct: number
  targetMaxPct: number
}) {
  const buckets = useMemo(() => {
    const counts = Array(11).fill(0) // 0-10%, 10-20%, ..., 100%+
    for (const depth of dailyCycleDepths) {
      const pct = depth * 100
      const idx = Math.min(10, Math.floor(pct / 10))
      counts[idx]++
    }
    return counts.map((count, i) => ({ bucket: i === 10 ? '100%+' : `${i * 10}-${i * 10 + 10}%`, count }))
  }, [dailyCycleDepths])

  const minBucketIndex = Math.min(10, Math.floor(targetMinPct / 10))
  const maxBucketIndex = Math.min(10, Math.floor(targetMaxPct / 10))

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Daily cycle depth distribution</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={buckets} margin={{ left: 0, right: 12 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis dataKey="bucket" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 10 }} />
          <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={30} allowDecimals={false} />
          <ReferenceLine
            x={buckets[minBucketIndex]?.bucket}
            stroke="var(--viz-series-4)"
            strokeDasharray="4 4"
            label={{ value: 'Target min', position: 'top', fill: 'var(--viz-text-muted)', fontSize: 10 }}
          />
          <ReferenceLine
            x={buckets[maxBucketIndex]?.bucket}
            stroke="var(--viz-series-2)"
            strokeDasharray="4 4"
            label={{ value: 'Target max', position: 'top', fill: 'var(--viz-text-muted)', fontSize: 10 }}
          />
          <Tooltip
            formatter={(v) => `${v} day(s)`}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Bar dataKey="count" name="Days" fill="var(--viz-series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
