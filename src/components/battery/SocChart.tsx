import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { BatterySimResult } from '@/types/battery'
import { format, parseISO } from 'date-fns'

export function SocChart({ result, capacityKwh }: { result: BatterySimResult; capacityKwh: number }) {
  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">
        Average daily state of charge
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={result.dailySoc} margin={{ left: 0, right: 12 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => format(parseISO(d), 'd MMM')}
            stroke="var(--viz-axis)"
            tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis domain={[0, capacityKwh]} stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={40} />
          <ReferenceLine y={capacityKwh} stroke="var(--viz-axis)" strokeDasharray="4 4" />
          <Tooltip
            labelFormatter={(d) => format(parseISO(String(d)), 'd MMM yyyy')}
            formatter={(v) => `${Number(v).toFixed(2)} kWh`}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Line type="monotone" dataKey="avgSocKwh" name="Avg SoC" stroke="var(--viz-series-1)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
