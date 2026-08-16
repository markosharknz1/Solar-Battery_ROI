import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import type { BatteryQuote, BatterySimResult } from '@/types/battery'
import type { TariffPlan } from '@/types/tariff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDataStore } from '@/store/dataStore'

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`
}

const STRATEGY_LABELS: Record<BatteryQuote['chargePriority'], string> = {
  solar_only: 'Charge from solar surplus only',
  solar_then_offpeak: 'Solar first, top up off-peak',
  solar_then_arbitrage: 'Solar first, plus overnight grid charging',
  arbitrage_only: 'Overnight grid charging (arbitrage)',
}

/**
 * Print-oriented savings report. Renders as a full-screen overlay (portalled to body so
 * print CSS can hide the rest of the app); "Print / Save as PDF" uses the system print
 * dialog, where Windows' "Microsoft Print to PDF" / the browser's "Save as PDF" produce the file.
 */
export function BatteryReport({
  result,
  quote,
  plan,
  onClose,
}: {
  result: BatterySimResult
  quote: BatteryQuote
  plan: TariffPlan
  onClose: () => void
}) {
  const summary = useDataStore((s) => s.summary)
  const [growthPct, setGrowthPct] = useState(3)

  useEffect(() => {
    document.body.classList.add('report-open')
    return () => document.body.classList.remove('report-open')
  }, [])

  const vppCredit = result.vppCreditAud
  const vppRebate = result.vppRebateAud ?? 0
  const effectiveCostAud = Math.max(0, quote.totalCostAud - vppRebate)
  const annualBenefit = result.annualSavingsAud + vppCredit

  // Forward projection: measured annual saving grown by the user's electricity-price
  // assumption, shrunk by straight-line battery degradation (same model as the simulator's
  // lifetime figure). VPP credit is program-set, so it is not grown with prices.
  const projection = Array.from({ length: quote.lifetimeYears }, (_, i) => {
    const y = i + 1
    const degradationFactor = 1 - (quote.totalDegradationPercent / 100) * (y / quote.lifetimeYears)
    const saving = result.annualSavingsAud * Math.pow(1 + growthPct / 100, y - 1) * degradationFactor + vppCredit
    return { y, saving }
  })
  let running = 0
  const projectionRows = projection.map((p) => {
    running += p.saving
    return { ...p, cumulative: running, net: running - effectiveCostAud }
  })
  const paybackYear = projectionRows.find((r) => r.cumulative >= effectiveCostAud)?.y ?? null

  const dataWindow = summary
    ? `${format(summary.dateRange.start, 'd MMM yyyy')} to ${format(summary.dateRange.end, 'd MMM yyyy')} (${summary.totalDays} days of half-hourly meter data)`
    : 'imported meter data'

  const quoteFacts: Array<[string, string]> = [
    ['Battery', `${quote.capacityKwh} kWh usable, ${quote.maxChargeKw} kW charge / ${quote.maxDischargeKw} kW discharge`],
    [
      'Installed cost',
      vppRebate > 0
        ? `$${quote.totalCostAud.toFixed(0)} - $${vppRebate.toFixed(0)} VPP rebate = $${effectiveCostAud.toFixed(0)} effective`
        : `$${quote.totalCostAud.toFixed(0)}`,
    ],
    ['Round-trip efficiency', `${(quote.roundTripEfficiency * 100).toFixed(0)}%`],
    ['Strategy', `${STRATEGY_LABELS[quote.chargePriority]}; discharge ${quote.dischargePriority === 'peak_only' ? 'during peak rates only' : 'on any grid import'}`],
    ['Tariff plan', plan.name],
    [
      'Warranty',
      `${quote.warrantyYears} years${quote.warrantyThroughputMwh ? ` / ${quote.warrantyThroughputMwh} MWh throughput` : ''}`,
    ],
    ['Assumed degradation', `${quote.totalDegradationPercent}% over ${quote.lifetimeYears} years (straight-line)`],
    ...(vppCredit !== 0 || vppRebate > 0
      ? ([['VPP program', `$${vppCredit.toFixed(0)}/yr net credit${vppRebate > 0 ? ` + $${vppRebate.toFixed(0)} upfront rebate` : ''}`]] as Array<[string, string]>)
      : []),
  ]

  const overlay = (
    <div id="battery-report" className="fixed inset-0 z-[100] overflow-y-auto bg-white text-neutral-900 print:static print:overflow-visible">
      <div className="mx-auto max-w-3xl p-8 print:max-w-none print:p-0">
        {/* Controls - never printed */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-neutral-300 p-3 print:hidden">
          <label className="flex items-center gap-2 text-sm">
            Assumed electricity price increase
            <Input
              type="number"
              className="w-20"
              value={growthPct}
              onChange={(e) => setGrowthPct(Number(e.target.value) || 0)}
            />
            %/yr
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => window.print()}>Print / Save as PDF</Button>
          </div>
        </div>

        <h1 className="text-2xl font-bold">Battery savings report</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {quote.name} - generated {format(new Date(), 'd MMM yyyy')} by Solar &amp; Battery Advisor
        </p>

        <h2 className="mt-6 border-b border-neutral-300 pb-1 text-lg font-semibold">The quote</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {quoteFacts.map(([label, value]) => (
              <tr key={label} className="border-b border-neutral-200">
                <td className="w-56 py-1.5 pr-4 font-medium">{label}</td>
                <td className="py-1.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-6 border-b border-neutral-300 pb-1 text-lg font-semibold">Measured performance</h2>
        <p className="mt-2 text-sm text-neutral-600">Simulated against {dataWindow}.</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md border border-neutral-300 p-3">
            <p className="text-xs text-neutral-600">Annual saving</p>
            <p className="text-xl font-bold">${annualBenefit.toFixed(0)}</p>
          </div>
          <div className="rounded-md border border-neutral-300 p-3">
            <p className="text-xs text-neutral-600">Simple payback</p>
            <p className="text-xl font-bold">
              {Number.isFinite(result.simplePaybackYears) ? `${result.simplePaybackYears.toFixed(1)} yrs` : 'N/A'}
            </p>
          </div>
          <div className="rounded-md border border-neutral-300 p-3">
            <p className="text-xs text-neutral-600">Grid import reduction</p>
            <p className="text-xl font-bold">{(result.annualGridImportKwhBase - result.annualGridImportKwh).toFixed(0)} kWh/yr</p>
          </div>
        </div>

        {result.monthlySavings && result.monthlySavings.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold">Savings by month (measured, not annualised)</h3>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left">
                  <th className="py-1">Month</th>
                  <th className="py-1 text-right">Days of data</th>
                  <th className="py-1 text-right">Saving</th>
                  <th className="py-1 text-right">Avg per day</th>
                </tr>
              </thead>
              <tbody>
                {result.monthlySavings.map((m) => (
                  <tr key={m.month} className="border-b border-neutral-200">
                    <td className="py-1">{monthLabel(m.month)}{m.days < 25 ? ' *' : ''}</td>
                    <td className="py-1 text-right">{m.days}</td>
                    <td className="py-1 text-right">${m.savingsAud.toFixed(0)}</td>
                    <td className="py-1 text-right">${m.days > 0 ? (m.savingsAud / m.days).toFixed(2) : '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.monthlySavings.some((m) => m.days < 25) && (
              <p className="mt-1 text-xs text-neutral-500">* partial month - compare on the per-day column.</p>
            )}
          </>
        )}

        <h2 className="mt-6 border-b border-neutral-300 pb-1 text-lg font-semibold">
          Forward projection ({growthPct}%/yr price increase)
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Measured annual saving grown by {growthPct}% per year for electricity prices and reduced by straight-line
          battery degradation ({quote.totalDegradationPercent}% over {quote.lifetimeYears} years).
          {paybackYear
            ? ` On these assumptions the battery pays itself off during year ${paybackYear}.`
            : ` On these assumptions the battery does not reach payback within its ${quote.lifetimeYears}-year lifetime.`}
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="py-1">Year</th>
              <th className="py-1 text-right">Projected saving</th>
              <th className="py-1 text-right">Cumulative</th>
              <th className="py-1 text-right">Net vs ${effectiveCostAud.toFixed(0)} cost</th>
            </tr>
          </thead>
          <tbody>
            {projectionRows.map((r) => (
              <tr key={r.y} className={`border-b border-neutral-200 ${r.y === paybackYear ? 'font-bold' : ''}`}>
                <td className="py-1">
                  {r.y}
                  {r.y === paybackYear ? ' - payback' : ''}
                </td>
                <td className="py-1 text-right">${r.saving.toFixed(0)}</td>
                <td className="py-1 text-right">${r.cumulative.toFixed(0)}</td>
                <td className={`py-1 text-right ${r.net >= 0 ? '' : 'text-neutral-500'}`}>
                  {r.net >= 0 ? '+' : '-'}${Math.abs(r.net).toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-6 text-xs text-neutral-500">
          Estimates are based on your own imported meter data and the tariff shown; actual results depend on future
          prices, usage, and battery behaviour. Generated entirely on your device - no usage data leaves this computer.
        </p>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
