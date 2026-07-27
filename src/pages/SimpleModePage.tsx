import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataStore } from '@/store/dataStore'
import { useTariffStore } from '@/store/tariffStore'
import { useUiStore } from '@/store/uiStore'
import { MeterUploader } from '@/components/import/MeterUploader'
import { MonthlyBarChart } from '@/components/analytics/MonthlyBarChart'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { calculateCost } from '@/lib/tariffCalculator'
import { simulateBattery } from '@/lib/batterySimulator'
import { detectOvernightLoadPattern } from '@/lib/dataProcessor'
import { STATE_DEFAULTS } from '@/lib/stateDefaults'
import { parseMeterCsv } from '@/lib/csvParser'
import type { TariffPlan } from '@/types/tariff'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

interface SimpleAnalysis {
  monthlyImportKwh: number
  monthlyImportCost: number
  monthlyExportKwh: number
  monthlyExportCredit: number
  opportunityCost: number
  overnight: ReturnType<typeof detectOvernightLoadPattern>
  roughAnnualSavingsLow: number
  roughAnnualSavingsHigh: number
  roughPaybackLow: number
  roughPaybackHigh: number
  verdict: 'green' | 'amber' | 'red'
  highestImportRate: number
  feedInRate: number
}

function buildStateDefaultPlan(state: keyof typeof STATE_DEFAULTS): TariffPlan {
  const rates = STATE_DEFAULTS[state]
  const everyday = [true, true, true, true, true, true, true]
  return {
    id: 'state-default',
    name: `${state} state default (approximate)`,
    provider: '',
    state,
    fixedCharges: [{ id: 'sd-1', label: 'Supply charge', amountPerDay: rates.supplyPerDay, gstInclusive: true }],
    periods: [{ id: 'sd-2', name: 'Flat rate', startTime: '00:00', endTime: '00:00', ratePerKwh: rates.peakRate, days: everyday }],
    feedInPeriods: [{ id: 'sd-3', name: 'FiT', startTime: '00:00', endTime: '00:00', ratePerKwh: rates.fitRate, days: everyday }],
    controlledLoadRate: null,
    controlledLoad2Rate: null,
    publicHolidaysAsWeekends: false,
    notes: '',
    isActive: false,
    createdAt: '',
  }
}

function defaultQuickQuote(): Parameters<typeof simulateBattery>[1] {
  return {
    id: 'quick-estimate',
    name: 'Quick estimate',
    capacityKwh: 10,
    maxChargeKw: 5,
    maxDischargeKw: 5,
    roundTripEfficiency: 0.9,
    totalCostAud: 12000,
    rebatePresetIds: [],
    governmentRebatesAud: 0,
    warrantyYears: 10,
    warrantyThroughputMwh: null,
    lifetimeYears: 10,
    totalDegradationPercent: 20,
    maxDischargePercent: 100,
    reservePercent: 10,
    targetMinDischargePct: 60,
    targetMaxDischargePct: 90,
    backupCapable: false,
    chargePriority: 'solar_then_offpeak',
    dischargePriority: 'peak_only',
    arbitrageTargetPercent: 80,
    arbitrageStartTime: '23:00',
    arbitrageEndTime: '07:00',
    solarSystemKw: null,
    inverterKw: null,
    exportLimitKw: null,
    vppEnrolled: false,
    vppAnnualCreditAud: 0,
  }
}

export function SimpleModePage() {
  const summary = useDataStore((s) => s.summary)
  const intervals = useDataStore((s) => s.intervals)
  const householdProfile = useDataStore((s) => s.householdProfile)
  const plans = useTariffStore((s) => s.plans)
  const setMode = useUiStore((s) => s.setMode)
  const navigate = useNavigate()
  const setMeterBuckets = useDataStore((s) => s.setMeterBuckets)

  const activePlan = plans.find((p) => p.isActive)
  const usingStateDefault = !activePlan
  const plan = activePlan ?? buildStateDefaultPlan(householdProfile.state)

  const loadSample = async () => {
    const res = await fetch('/sample/sample-meter.csv')
    const text = await res.text()
    const { buckets, warnings } = parseMeterCsv(text)
    setMeterBuckets(buckets, warnings)
  }

  const analysis = useMemo((): SimpleAnalysis | null => {
    if (!summary || intervals.length === 0) return null

    const cost = calculateCost(intervals, plan)
    const months = Math.max(1, summary.totalDays / 30.44)
    const monthlyImportKwh = summary.totalGridImport / months
    const monthlyImportCost = cost.totalCostAud / months
    const monthlyExportKwh = summary.totalGridExport / months
    const feedInRate = plan.feedInPeriods[0]?.ratePerKwh ?? 0
    const monthlyExportCredit = monthlyExportKwh * feedInRate
    const highestImportRate = Math.max(...plan.periods.map((p) => p.ratePerKwh), 0)
    const opportunityCost = monthlyExportKwh * highestImportRate

    const overnight = detectOvernightLoadPattern(intervals)

    const quickResult = simulateBattery(intervals, defaultQuickQuote(), plan)
    const roughAnnualSavingsLow = quickResult.annualSavingsAud * 0.75
    const roughAnnualSavingsHigh = quickResult.annualSavingsAud * 1.35
    const roughPaybackLow = roughAnnualSavingsHigh > 0 ? 12000 / roughAnnualSavingsHigh : Number.POSITIVE_INFINITY
    const roughPaybackHigh = roughAnnualSavingsLow > 0 ? 12000 / roughAnnualSavingsLow : Number.POSITIVE_INFINITY

    let verdict: 'green' | 'amber' | 'red'
    if (monthlyExportKwh < 30) verdict = 'red'
    else if (roughPaybackHigh > 20) verdict = 'amber'
    else verdict = 'green'

    return {
      monthlyImportKwh,
      monthlyImportCost,
      monthlyExportKwh,
      monthlyExportCredit,
      opportunityCost,
      overnight,
      roughAnnualSavingsLow,
      roughAnnualSavingsHigh,
      roughPaybackLow,
      roughPaybackHigh,
      verdict,
      highestImportRate,
      feedInRate,
    }
  }, [summary, intervals, plan])

  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Solar &amp; Battery Advisor</h1>
          <p className="mt-2 text-muted-foreground">
            Upload your smart meter data to find out if a battery is worth it - entirely in your browser.
          </p>
        </div>
        <div className="mb-4">
          <MeterUploader />
        </div>
        <div className="text-center">
          <Button variant="outline" onClick={() => void loadSample()}>
            Try with sample data
          </Button>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span>📄 {summary.totalDays} day(s) of usage data loaded</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">☁ Grid power purchased</CardTitle>
            <p className="text-2xl font-semibold">{analysis.monthlyImportKwh.toFixed(0)} kWh / month avg</p>
            <CardDescription>
              ${analysis.monthlyImportCost.toFixed(0)} / month - ${(analysis.monthlyImportCost * 12).toFixed(0)} / year
            </CardDescription>
            {usingStateDefault && (
              <p className="mt-1 text-xs text-muted-foreground">
                Using approximate {plan.state} rates - configure your tariff for accuracy.
              </p>
            )}
          </CardHeader>
        </Card>

        {summary.hasSolarExport && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">☀ Solar sent to grid</CardTitle>
              <p className="text-2xl font-semibold">{analysis.monthlyExportKwh.toFixed(0)} kWh / month avg</p>
              <CardDescription>
                ${analysis.monthlyExportCredit.toFixed(0)} / month (at {(analysis.feedInRate * 100).toFixed(1)}c FiT)
              </CardDescription>
              <p className="mt-2 text-sm font-medium text-primary">
                Worth ${analysis.opportunityCost.toFixed(0)}/month if self-consumed instead (at your{' '}
                {(analysis.highestImportRate * 100).toFixed(1)}c peak rate)
              </p>
            </CardHeader>
          </Card>
        )}

        {analysis.overnight.isSignificant && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🌙 Cheap overnight usage</CardTitle>
              <p className="text-2xl font-semibold">{analysis.overnight.overnightAvgKwh.toFixed(1)} kWh / night avg</p>
              <CardDescription>
                {(householdProfile.overnightLoads.evCharger || householdProfile.overnightLoads.airConOvernight) &&
                  [
                    householdProfile.overnightLoads.evCharger && 'EV charging',
                    householdProfile.overnightLoads.airConOvernight && 'air conditioning',
                  ]
                    .filter(Boolean)
                    .join(' + ') + ' detected'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <VerdictCard analysis={analysis} />

      <MonthlyBarChart intervals={intervals} simple />

      <Card>
        <CardHeader>
          <CardTitle>Ready for a real number?</CardTitle>
          <CardDescription>
            Enter your battery quote in Advanced mode for an accurate payback calculation based on your actual usage
            data.
          </CardDescription>
          <Button
            className="mt-3 w-fit"
            onClick={() => {
              // Navigate before flipping the mode: the root route redirects to /overview
              // whenever mode is 'advanced', so setting mode first would race that redirect
              // and override this destination.
              navigate('/battery')
              setMode('advanced')
            }}
          >
            Switch to Advanced mode →
          </Button>
        </CardHeader>
      </Card>
    </div>
  )
}

function VerdictCard({ analysis }: { analysis: SimpleAnalysis }) {
  if (analysis.verdict === 'green') {
    return (
      <Card className="border-green-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5 text-green-600" /> A battery looks worthwhile for your usage
          </CardTitle>
          <CardDescription className="space-y-1">
            <p>
              You export {analysis.monthlyExportKwh.toFixed(0)} kWh/month of solar but buy back{' '}
              {analysis.monthlyImportKwh.toFixed(0)} kWh. A battery could self-consume a large share of that instead.
            </p>
            <p>
              Rough annual saving: ${analysis.roughAnnualSavingsLow.toFixed(0)} - ${analysis.roughAnnualSavingsHigh.toFixed(0)}
            </p>
            <p>Typical battery cost: $10,000 - $14,000</p>
            <p>
              Rough payback: {Number.isFinite(analysis.roughPaybackLow) ? analysis.roughPaybackLow.toFixed(0) : '?'} -{' '}
              {Number.isFinite(analysis.roughPaybackHigh) ? analysis.roughPaybackHigh.toFixed(0) : '?'} years
            </p>
            <p className="pt-1 text-xs">Use Advanced mode for an accurate figure from a real quote.</p>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (analysis.verdict === 'amber') {
    return (
      <Card className="border-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> A battery might work - it depends on the price
          </CardTitle>
          <CardDescription className="space-y-1">
            <p>
              Rough annual saving: ${analysis.roughAnnualSavingsLow.toFixed(0)} - ${analysis.roughAnnualSavingsHigh.toFixed(0)}
            </p>
            <p>
              Rough payback: {Number.isFinite(analysis.roughPaybackLow) ? analysis.roughPaybackLow.toFixed(0) : '20+'} -{' '}
              {Number.isFinite(analysis.roughPaybackHigh) ? `${analysis.roughPaybackHigh.toFixed(0)}+` : '35+'} years
            </p>
            <p className="pt-1 text-xs">Marginal at current prices. Advanced mode can check a specific quote.</p>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <XCircle className="h-5 w-5 text-destructive" /> A battery is hard to justify at current prices
        </CardTitle>
        <CardDescription className="space-y-1">
          <p>{analysis.monthlyExportKwh < 5 ? "You don't have much solar export to work with." : 'Your solar export is too low to justify a battery.'}</p>
          <p>A battery may still make sense for blackout backup or a VPP program.</p>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
