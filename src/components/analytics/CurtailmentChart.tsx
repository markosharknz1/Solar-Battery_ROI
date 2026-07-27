import { Area, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { CurtailmentAnalysis } from '@/lib/solarAnalyzer'
import { format, parseISO } from 'date-fns'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function CurtailmentChart({ analysis }: { analysis: CurtailmentAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Total generated</CardTitle>
            <p className="text-xl font-semibold">{analysis.totalGeneratedKwh.toFixed(0)} kWh</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Self-consumed</CardTitle>
            <p className="text-xl font-semibold">{analysis.totalSelfConsumedKwh.toFixed(0)} kWh</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Exported</CardTitle>
            <p className="text-xl font-semibold">{analysis.totalExportedKwh.toFixed(0)} kWh</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xs font-normal text-muted-foreground">Curtailed</CardTitle>
              {analysis.totalCurtailedKwh > 0 && <Badge variant="destructive">Lost</Badge>}
            </div>
            <p className="text-xl font-semibold">{analysis.totalCurtailedKwh.toFixed(0)} kWh</p>
          </CardHeader>
        </Card>
      </div>

      <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Daily solar disposition</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={analysis.daily} margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis
              dataKey="dateStr"
              tickFormatter={(d: string) => format(parseISO(d), 'd MMM')}
              stroke="var(--viz-axis)"
              tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
              minTickGap={24}
            />
            <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={40} />
            <Tooltip
              labelFormatter={(d) => format(parseISO(String(d)), 'd MMM yyyy')}
              formatter={(v) => `${Number(v).toFixed(2)} kWh`}
              contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--viz-text-secondary)' }} />
            <Area type="monotone" dataKey="selfConsumed" name="Self-consumed" stackId="1" stroke="none" fill="var(--viz-series-1)" fillOpacity={0.7} />
            <Area type="monotone" dataKey="exported" name="Exported" stackId="1" stroke="none" fill="var(--viz-series-3)" fillOpacity={0.7} />
            <Area type="monotone" dataKey="curtailed" name="Curtailed" stackId="1" stroke="none" fill="var(--viz-diverging-neg)" fillOpacity={0.7} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
