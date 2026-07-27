import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { BatterySimResult } from '@/types/battery'

export function SavingsBreakdownChart({ result }: { result: BatterySimResult }) {
  // Curtailment $ value is approximated using the implied average import rate from the actual
  // savings/import-reduction ratio, since the simulator doesn't track a per-kWh curtailment price directly.
  const impliedImportRate =
    result.annualGridImportKwhBase - result.annualGridImportKwh > 0
      ? result.importCostSavedAud / (result.annualGridImportKwhBase - result.annualGridImportKwh)
      : 0
  const curtailmentValueAud = result.curtailmentCaptureKwhAnnual * impliedImportRate

  const data = [
    { name: 'Import cost saved', value: result.importCostSavedAud },
    { name: 'Export credit lost', value: -result.exportCreditLostAud },
    ...(result.curtailmentCaptureKwhAnnual > 0 ? [{ name: 'Curtailment capture', value: curtailmentValueAud }] : []),
    ...(result.vppCreditAud > 0 ? [{ name: 'VPP credit', value: result.vppCreditAud }] : []),
    { name: 'Net saving', value: result.annualSavingsAud + result.vppCreditAud },
  ]

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Annual savings breakdown</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
          <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
          <XAxis type="number" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
          <YAxis dataKey="name" type="category" width={140} stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(0)}`}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? 'var(--viz-diverging-pos)' : 'var(--viz-diverging-neg)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
