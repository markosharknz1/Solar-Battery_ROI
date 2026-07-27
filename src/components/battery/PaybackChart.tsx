import { useMemo } from 'react'
import { Area, ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { BatteryQuote, BatterySimResult } from '@/types/battery'

export function PaybackChart({ result, quote }: { result: BatterySimResult; quote: BatteryQuote }) {
  const netCostAud = quote.totalCostAud - quote.governmentRebatesAud

  const { data, breakEvenYear } = useMemo(() => {
    let conservativeCumulative = 0
    let optimisticCumulative = 0
    let breakEven: number | null = null

    const points = Array.from({ length: quote.lifetimeYears }, (_, i) => {
      const year = i + 1
      const degradationFactor = 1 - (quote.totalDegradationPercent / 100) * (year / quote.lifetimeYears)
      const conservativeSavings = result.annualSavingsAud * degradationFactor + result.vppCreditAud
      const optimisticSavings = result.annualSavingsAud + result.vppCreditAud

      conservativeCumulative += conservativeSavings
      optimisticCumulative += optimisticSavings
      if (breakEven === null && conservativeCumulative >= netCostAud) breakEven = year

      return {
        year,
        conservative: conservativeCumulative,
        optimistic: optimisticCumulative,
        optimisticDelta: Math.max(0, optimisticCumulative - conservativeCumulative),
        upfrontCost: netCostAud,
      }
    })
    return { data: points, breakEvenYear: breakEven }
  }, [result, quote, netCostAud])

  return (
    <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--viz-text-primary)]">Payback over {quote.lifetimeYears} years</p>
        {breakEvenYear && <span className="text-xs text-[var(--viz-text-muted)]">Break-even: year {breakEvenYear}</span>}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ left: 0, right: 12 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis dataKey="year" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
          <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} width={50} />
          {breakEvenYear && <ReferenceLine x={breakEvenYear} stroke="var(--viz-diverging-pos)" strokeDasharray="4 4" />}
          <ReferenceLine
            x={Math.round(result.effectiveWarrantyYears)}
            stroke="var(--viz-series-4)"
            strokeDasharray="2 2"
            label={{ value: 'Warranty end', position: 'insideTopRight', fill: 'var(--viz-text-muted)', fontSize: 10 }}
          />
          <Tooltip
            formatter={(v) => `$${Number(v).toFixed(0)}`}
            contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
          />
          <Area dataKey="conservative" stackId="range" fill="transparent" stroke="none" legendType="none" tooltipType="none" />
          <Area dataKey="optimisticDelta" name="Range" stackId="range" fill="var(--viz-series-1)" fillOpacity={0.1} stroke="none" />
          <Line type="monotone" dataKey="optimistic" name="Optimistic (year-1 capacity)" stroke="var(--viz-series-3)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="conservative" name="Conservative (degraded capacity)" stroke="var(--viz-series-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="upfrontCost" name="Upfront cost" stroke="var(--viz-series-2)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
