import { useMemo, useState } from 'react'
import { Line, LineChart, Scatter, ScatterChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Interval } from '@/types/meter'
import type { TariffPlan } from '@/types/tariff'
import { analyzeSolar, analyzeCurtailment } from '@/lib/solarAnalyzer'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CurtailmentChart } from '@/components/analytics/CurtailmentChart'

function slotLabel(slot: number): string {
  const totalMin = slot * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function SolarAnalysisPanel({ intervals, activePlan }: { intervals: Interval[]; activePlan?: TariffPlan }) {
  const analysis = useMemo(() => analyzeSolar(intervals, activePlan), [intervals, activePlan])
  const hasInverterData = analysis.totalSolarGenKwh > 0
  const [exportLimitKw, setExportLimitKw] = useState<string>('')
  const curtailment = useMemo(() => {
    const limit = Number.parseFloat(exportLimitKw)
    if (!hasInverterData || Number.isNaN(limit) || limit <= 0) return null
    return analyzeCurtailment(intervals, limit)
  }, [intervals, exportLimitKw, hasInverterData])

  const profileData = analysis.exportProfile.map((v, slot) => ({ slot: slotLabel(slot), export: v }))

  const dailyScatter = useMemo(() => {
    const byDay = new Map<string, { importKwh: number; exportKwh: number }>()
    for (const i of intervals) {
      const e = byDay.get(i.dateStr) ?? { importKwh: 0, exportKwh: 0 }
      e.importKwh += i.gridImport
      e.exportKwh += i.gridExport
      byDay.set(i.dateStr, e)
    }
    return Array.from(byDay.values())
  }, [intervals])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Avg daily export</CardTitle>
            <p className="text-xl font-semibold">{analysis.avgDailyExportKwh.toFixed(1)} kWh</p>
          </CardHeader>
        </Card>
        {analysis.totalSolarGenKwh > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-normal text-muted-foreground">Self-consumption rate</CardTitle>
              <p className="text-xl font-semibold">{(analysis.selfConsumptionRate * 100).toFixed(0)}%</p>
            </CardHeader>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Peak export time</CardTitle>
            <p className="text-xl font-semibold">{slotLabel(analysis.peakExportSlot)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Battery opportunity</CardTitle>
            <p className="text-xl font-semibold">{analysis.batteryOpportunityKwh.toFixed(1)} kWh/day</p>
            <p className="text-xs text-muted-foreground">Avg export during peak-rate hours - a battery could capture this instead.</p>
          </CardHeader>
        </Card>
      </div>

      <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Average export profile by time of day</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={profileData} margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="slot" interval={5} stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
            <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={40} />
            <Tooltip
              formatter={(v) => `${Number(v).toFixed(2)} kWh`}
              contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
            />
            <Line type="monotone" dataKey="export" name="Export" stroke="var(--viz-series-3)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Daily export vs import</p>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke="var(--viz-grid)" />
            <XAxis
              dataKey="exportKwh"
              name="Export"
              unit=" kWh"
              stroke="var(--viz-axis)"
              tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
            />
            <YAxis
              dataKey="importKwh"
              name="Import"
              unit=" kWh"
              stroke="var(--viz-axis)"
              tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }}
            />
            <Tooltip
              formatter={(v) => `${Number(v).toFixed(2)} kWh`}
              contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
            />
            <Scatter data={dailyScatter} fill="var(--viz-series-1)" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {hasInverterData && (
        <div className="rounded-lg border p-4">
          <Label>Network export limit (kW)</Label>
          <Input
            type="number"
            placeholder="e.g. 5 (common SA value) - enables curtailment analysis"
            value={exportLimitKw}
            onChange={(e) => setExportLimitKw(e.target.value)}
            className="mt-1 max-w-xs"
          />
        </div>
      )}
      {curtailment && <CurtailmentChart analysis={curtailment} />}
    </div>
  )
}
