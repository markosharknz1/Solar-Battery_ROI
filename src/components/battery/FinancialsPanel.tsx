import { useMemo } from 'react'
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { BatteryQuote, BatterySimResult } from '@/types/battery'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBatteryStore } from '@/store/batteryStore'
import { benefitStream, cashOutcome, loanOutcome } from '@/lib/batteryFinance'

/**
 * True total-cost-of-ownership view: what the battery really costs once the money's
 * alternative use is counted - either cash that would otherwise sit in the mortgage/
 * offset, or a loan with its interest.
 */
export function FinancialsPanel({ result, quote }: { result: BatterySimResult; quote: BatteryQuote }) {
  const financing = useBatteryStore((s) => s.financing)
  const update = useBatteryStore((s) => s.updateFinancing)

  const effectiveCost = Math.max(0, quote.totalCostAud - (result.vppRebateAud ?? 0))

  const outcome = useMemo(() => {
    const benefits = benefitStream(quote, result, financing.priceGrowthPct)
    return financing.mode === 'cash'
      ? cashOutcome(effectiveCost, benefits, financing.mortgageRatePct)
      : loanOutcome(effectiveCost, benefits, financing.loanRatePct, financing.loanTermYears)
  }, [quote, result, financing, effectiveCost])

  const ahead = outcome.netAud >= 0
  const chartData = outcome.rows.map((r) => ({ year: `Yr ${r.year}`, net: Math.round(r.netAud) }))

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">How is the battery paid for?</p>
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <div className="space-y-1">
            <label className="flex items-center gap-2">
              <input type="radio" checked={financing.mode === 'cash'} onChange={() => update({ mode: 'cash' })} />
              Cash (money from mortgage/offset)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={financing.mode === 'loan'} onChange={() => update({ mode: 'loan' })} />
              Finance (loan)
            </label>
          </div>
          {financing.mode === 'cash' ? (
            <div>
              <Label>Mortgage/offset rate (%/yr)</Label>
              <Input
                type="number"
                step="0.1"
                className="w-28"
                value={financing.mortgageRatePct}
                onChange={(e) => update({ mortgageRatePct: Number(e.target.value) || 0 })}
              />
            </div>
          ) : (
            <>
              <div>
                <Label>Loan rate (%/yr)</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="w-28"
                  value={financing.loanRatePct}
                  onChange={(e) => update({ loanRatePct: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Loan term (years)</Label>
                <Input
                  type="number"
                  min={1}
                  max={quote.lifetimeYears}
                  className="w-28"
                  value={financing.loanTermYears}
                  onChange={(e) => update({ loanTermYears: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
            </>
          )}
          <div>
            <Label>Electricity price growth (%/yr)</Label>
            <Input
              type="number"
              step="0.5"
              className="w-28"
              value={financing.priceGrowthPct}
              onChange={(e) => update({ priceGrowthPct: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Total cost of ownership ({quote.lifetimeYears} yrs)
            </CardTitle>
            <p className="text-xl font-semibold">${outcome.tcoAud.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">
              {outcome.mode === 'cash'
                ? `$${effectiveCost.toFixed(0)} price + $${(outcome.foregoneInterestAud ?? 0).toFixed(0)} mortgage interest the money would have saved`
                : `$${(outcome.monthlyRepaymentAud ?? 0).toFixed(0)}/month for ${financing.loanTermYears} yrs - $${effectiveCost.toFixed(0)} price + $${(outcome.totalInterestAud ?? 0).toFixed(0)} interest`}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Savings over {quote.lifetimeYears} yrs</CardTitle>
            <p className="text-xl font-semibold">${outcome.totalBenefitAud.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">
              {outcome.mode === 'cash' ? 'each year swept into the offset, compounding at your rate' : 'plain sum of each year'}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Net position at end of life</CardTitle>
            <p className={`text-xl font-semibold ${ahead ? 'text-green-600' : 'text-destructive'}`}>
              {ahead ? '+' : '-'}${Math.abs(outcome.netAud).toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {outcome.breakevenYear
                ? `in front from year ${outcome.breakevenYear}`
                : `never in front within ${quote.lifetimeYears} years on these assumptions`}
            </p>
          </CardHeader>
        </Card>
      </div>

      <div className="viz-root rounded-lg border bg-[var(--viz-surface)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">
          Position vs {outcome.mode === 'cash' ? 'leaving the money in the mortgage' : 'not buying at all'} - year by year
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="year" stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} />
            <YAxis stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text-muted)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(v) => `$${Number(v).toFixed(0)}`}
              contentStyle={{ background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="var(--viz-text-muted)" strokeDasharray="4 3" />
            <Line type="monotone" dataKey="net" name="Net position" stroke="var(--viz-series-1)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        {outcome.mode === 'cash'
          ? 'Assumes the purchase money would otherwise sit in your mortgage/offset at the rate above (interest avoided there is effectively tax-free), and that each year of battery savings goes back into the offset. '
          : 'Standard monthly repayments over the loan term; the running position is plain dollars in vs out. '}
        Savings use the simulated annual figure grown by the electricity-price assumption and reduced by battery aging -
        the same model as the Payback tab and PDF report.
      </p>
    </div>
  )
}
