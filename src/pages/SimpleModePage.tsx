import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataStore } from '@/store/dataStore'
import { useTariffStore } from '@/store/tariffStore'
import { useUiStore } from '@/store/uiStore'
import { MeterUploader } from '@/components/import/MeterUploader'
import { MonthlyBarChart } from '@/components/analytics/MonthlyBarChart'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calculateCost } from '@/lib/tariffCalculator'
import { detectOvernightLoadPattern } from '@/lib/dataProcessor'
import { parseMeterCsv } from '@/lib/csvParser'
import type { TariffPlan } from '@/types/tariff'
import type { HouseholdProfile } from '@/types/meter'

interface SimpleAnalysis {
  monthlyImportKwh: number
  monthlyExportKwh: number
  overnight: ReturnType<typeof detectOvernightLoadPattern>
  // Cost figures are null when no rate/plan is set (the user skipped the rate question).
  monthlyImportCost: number | null
  monthlyExportCredit: number | null
  opportunityCost: number | null
  overnightCostPerNight: number | null
  overnightCostPerYear: number | null
  lowestImportRate: number | null
  highestImportRate: number | null
  feedInRate: number | null
}

function buildQuickRatePlan(quickRate: NonNullable<HouseholdProfile['quickRate']>, state: HouseholdProfile['state']): TariffPlan {
  const everyday = [true, true, true, true, true, true, true]
  return {
    id: 'quick-rate',
    name: 'Your average rate (quick estimate)',
    provider: '',
    state,
    fixedCharges: quickRate.dailySupplyDollars
      ? [{ id: 'qr-1', label: 'Supply charge', amountPerDay: quickRate.dailySupplyDollars, gstInclusive: true }]
      : [],
    periods: [
      {
        id: 'qr-2',
        name: 'Flat rate',
        startTime: '00:00',
        endTime: '00:00',
        ratePerKwh: (quickRate.importCentsPerKwh ?? 0) / 100,
        gstInclusive: true,
        days: everyday,
      },
    ],
    feedInPeriods: [
      {
        id: 'qr-3',
        name: 'FiT',
        startTime: '00:00',
        endTime: '00:00',
        ratePerKwh: (quickRate.feedInCentsPerKwh ?? 0) / 100,
        gstInclusive: true,
        days: everyday,
      },
    ],
    controlledLoadRate: null,
    controlledLoad2Rate: null,
    publicHolidaysAsWeekends: false,
    notes: '',
    isActive: false,
    createdAt: '',
  }
}

export function SimpleModePage() {
  const summary = useDataStore((s) => s.summary)
  const intervals = useDataStore((s) => s.intervals)
  const householdProfile = useDataStore((s) => s.householdProfile)
  const setProfile = useDataStore((s) => s.setProfile)
  const plans = useTariffStore((s) => s.plans)
  const setMode = useUiStore((s) => s.setMode)
  const navigate = useNavigate()
  const setMeterBuckets = useDataStore((s) => s.setMeterBuckets)

  const activePlan = plans.find((p) => p.isActive)
  const hasQuickRate = householdProfile.quickRate.importCentsPerKwh != null
  const rateSkipped = householdProfile.quickRate.skipped === true
  const usingQuickRate = !activePlan && hasQuickRate
  const plan = activePlan ?? (hasQuickRate ? buildQuickRatePlan(householdProfile.quickRate, householdProfile.state) : null)

  const goToBillImport = () => {
    // Navigate before flipping the mode - see the CTA button note below.
    navigate('/bills/import')
    setMode('advanced')
  }

  const loadSample = async () => {
    const res = await fetch('/sample/sample-meter.csv')
    const text = await res.text()
    const { buckets, warnings } = parseMeterCsv(text)
    setMeterBuckets(buckets, warnings)
  }

  const analysis = useMemo((): SimpleAnalysis | null => {
    if (!summary || intervals.length === 0) return null

    const months = Math.max(1, summary.totalDays / 30.44)
    const monthlyImportKwh = summary.totalGridImport / months
    const monthlyExportKwh = summary.totalGridExport / months
    const overnight = detectOvernightLoadPattern(intervals)

    if (!plan) {
      return {
        monthlyImportKwh,
        monthlyExportKwh,
        overnight,
        monthlyImportCost: null,
        monthlyExportCredit: null,
        opportunityCost: null,
        overnightCostPerNight: null,
        overnightCostPerYear: null,
        lowestImportRate: null,
        highestImportRate: null,
        feedInRate: null,
      }
    }

    const cost = calculateCost(intervals, plan)
    const monthlyImportCost = cost.totalCostAud / months
    const feedInRate = plan.feedInPeriods[0]?.ratePerKwh ?? 0
    const monthlyExportCredit = monthlyExportKwh * feedInRate
    const highestImportRate = Math.max(...plan.periods.map((p) => p.ratePerKwh), 0)
    const lowestImportRate = Math.min(...plan.periods.map((p) => p.ratePerKwh))
    const opportunityCost = monthlyExportKwh * highestImportRate
    const overnightCostPerNight = overnight.avgNightlyKwh * lowestImportRate

    return {
      monthlyImportKwh,
      monthlyExportKwh,
      overnight,
      monthlyImportCost,
      monthlyExportCredit,
      opportunityCost,
      overnightCostPerNight,
      overnightCostPerYear: overnightCostPerNight * 365,
      lowestImportRate,
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

  if (!plan && !rateSkipped) {
    return (
      <div className="mx-auto max-w-2xl">
        <QuickRateForm
          onSave={(quickRate) => setProfile({ quickRate })}
          onSkip={() => setProfile({ quickRate: { ...householdProfile.quickRate, skipped: true } })}
          onImportBill={goToBillImport}
        />
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span>📄 {summary.totalDays} day(s) of usage data loaded</span>
      </div>

      {!plan && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="text-base">Cost estimates are hidden - no rate set</CardTitle>
            <CardDescription>
              Usage figures below are complete, but dollar amounts need a rate. Enter a rough average rate, or import
              a bill PDF and we'll build your tariff from it automatically.
            </CardDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setProfile({ quickRate: { ...householdProfile.quickRate, skipped: false } })}
              >
                Enter a rate
              </Button>
              <Button size="sm" variant="outline" onClick={goToBillImport}>
                Import a bill PDF
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">☁ Grid power purchased</CardTitle>
            <p className="text-2xl font-semibold">{analysis.monthlyImportKwh.toFixed(0)} kWh / month avg</p>
            {analysis.monthlyImportCost != null && (
              <CardDescription>
                ${analysis.monthlyImportCost.toFixed(0)} / month - ${(analysis.monthlyImportCost * 12).toFixed(0)} / year
              </CardDescription>
            )}
            {usingQuickRate && analysis.lowestImportRate != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Using your average rate ({(analysis.lowestImportRate * 100).toFixed(1)}c/kWh) - set up a full tariff
                plan in Advanced mode for accuracy.
              </p>
            )}
          </CardHeader>
        </Card>

        {summary.hasSolarExport && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">☀ Solar sent to grid</CardTitle>
              <p className="text-2xl font-semibold">{analysis.monthlyExportKwh.toFixed(0)} kWh / month avg</p>
              {analysis.monthlyExportCredit != null && analysis.feedInRate != null && (
                <CardDescription>
                  ${analysis.monthlyExportCredit.toFixed(0)} / month (at {(analysis.feedInRate * 100).toFixed(1)}c FiT)
                </CardDescription>
              )}
              {analysis.opportunityCost != null && analysis.highestImportRate != null && (
                <p className="mt-2 text-sm font-medium text-primary">
                  Worth ${analysis.opportunityCost.toFixed(0)}/month if self-consumed instead (at your{' '}
                  {(analysis.highestImportRate * 100).toFixed(1)}c peak rate)
                </p>
              )}
            </CardHeader>
          </Card>
        )}

        {analysis.overnight.isSignificant && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🌙 Cheap overnight usage</CardTitle>
              <p className="text-2xl font-semibold">{analysis.overnight.avgNightlyKwh.toFixed(1)} kWh / night avg</p>
              {analysis.overnightCostPerNight != null && analysis.lowestImportRate != null && analysis.overnightCostPerYear != null && (
                <CardDescription>
                  ${analysis.overnightCostPerNight.toFixed(2)} / night (at {(analysis.lowestImportRate * 100).toFixed(0)}c) - $
                  {analysis.overnightCostPerYear.toFixed(0)} / year
                </CardDescription>
              )}
              {(householdProfile.overnightLoads.evCharger || householdProfile.overnightLoads.airConOvernight) && (
                <p className="text-sm">
                  {[
                    householdProfile.overnightLoads.evCharger && 'EV charging',
                    householdProfile.overnightLoads.airConOvernight && 'air conditioning',
                  ]
                    .filter(Boolean)
                    .join(' + ')}{' '}
                  detected
                </p>
              )}
              {analysis.lowestImportRate != null && analysis.lowestImportRate <= 0.12 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  You're already on the cheapest rate for this usage. A battery is better used to offset peak-rate
                  consumption.
                </p>
              )}
            </CardHeader>
          </Card>
        )}
      </div>

      <MonthlyBarChart intervals={intervals} simple />

      <Card>
        <CardHeader>
          <CardTitle>Want to know if a battery pays off?</CardTitle>
          <CardDescription>
            Enter a real battery quote in Advanced mode for an accurate savings and payback estimate based on your
            actual usage data.
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

function QuickRateForm({
  onSave,
  onSkip,
  onImportBill,
}: {
  onSave: (quickRate: HouseholdProfile['quickRate']) => void
  onSkip: () => void
  onImportBill: () => void
}) {
  const [importCents, setImportCents] = useState('')
  const [feedInCents, setFeedInCents] = useState('')
  const [supplyDollars, setSupplyDollars] = useState('')

  const submit = () => {
    const importVal = Number.parseFloat(importCents)
    if (!importVal || importVal <= 0) return
    onSave({
      importCentsPerKwh: importVal,
      feedInCentsPerKwh: feedInCents ? Number.parseFloat(feedInCents) || 0 : 0,
      dailySupplyDollars: supplyDollars ? Number.parseFloat(supplyDollars) || 0 : 0,
      skipped: false,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What's your average electricity rate?</CardTitle>
        <CardDescription>
          We use this for a quick cost estimate. Check your latest bill for a c/kWh usage rate - a rough figure is
          fine. Got a bill as a PDF? Import it instead and we'll read the rates for you. You can also skip this and
          just see your usage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Average usage rate (c/kWh)</Label>
          <Input type="number" step="0.1" value={importCents} onChange={(e) => setImportCents(e.target.value)} placeholder="e.g. 32" />
        </div>
        <div>
          <Label>Solar feed-in rate (c/kWh, optional)</Label>
          <Input type="number" step="0.1" value={feedInCents} onChange={(e) => setFeedInCents(e.target.value)} placeholder="e.g. 6" />
        </div>
        <div>
          <Label>Daily supply charge ($, optional)</Label>
          <Input type="number" step="0.01" value={supplyDollars} onChange={(e) => setSupplyDollars(e.target.value)} placeholder="e.g. 0.95" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={!importCents}>
            Continue
          </Button>
          <Button variant="outline" onClick={onImportBill}>
            Import a bill PDF instead
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
