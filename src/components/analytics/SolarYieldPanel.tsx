import { useMemo, useState } from 'react'
import type { Interval, DataSummary, HouseholdProfile } from '@/types/meter'
import { AVERAGE_ANNUAL_YIELD_KWH_PER_KW, resolveStateFromPostcode } from '@/lib/solarYield'
import { solarZoneForPostcode } from '@/lib/solarZones'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

const PRESET_SIZES_KW = [5, 10, 15]

export function SolarYieldPanel({
  intervals,
  summary,
  householdProfile,
}: {
  intervals: Interval[]
  summary: DataSummary
  householdProfile: HouseholdProfile
}) {
  const [systemKw, setSystemKw] = useState('')
  const [inverterKw, setInverterKw] = useState('')
  const [batteryKwh, setBatteryKwh] = useState('')

  const postcodeState = resolveStateFromPostcode(householdProfile.postcode)
  const state = postcodeState ?? householdProfile.state
  // Postcode-precise CER solar zone when available; state-wide average as the fallback.
  const zone = solarZoneForPostcode(householdProfile.postcode)
  const yieldPerKw = zone?.annualKwhPerKw ?? AVERAGE_ANNUAL_YIELD_KWH_PER_KW[state]

  const systemKwNum = Number.parseFloat(systemKw) || 0
  const expectedAnnualKwh = systemKwNum > 0 ? systemKwNum * yieldPerKw : 0
  const expectedDailyKwh = expectedAnnualKwh / 365

  const hasInverterData = intervals.some((i) => i.solarGen > 0)
  const hasGenerationSignal = hasInverterData || summary.hasSolarExport

  const actual = useMemo(() => {
    if (!hasGenerationSignal || systemKwNum <= 0) return null
    const totalKwh = hasInverterData
      ? intervals.reduce((sum, i) => sum + i.solarGen, 0)
      : intervals.reduce((sum, i) => sum + i.gridExport, 0)
    const annualFactor = 365 / Math.max(1, summary.totalDays)
    const annualActualKwh = totalKwh * annualFactor
    const pctOfExpected = expectedAnnualKwh > 0 ? (annualActualKwh / expectedAnnualKwh) * 100 : null
    return { annualActualKwh, pctOfExpected, isExportOnly: !hasInverterData }
  }, [hasGenerationSignal, hasInverterData, intervals, summary.totalDays, systemKwNum, expectedAnnualKwh])

  const inverterKwNum = Number.parseFloat(inverterKw) || 0
  const dcAcRatio = inverterKwNum > 0 && systemKwNum > 0 ? systemKwNum / inverterKwNum : null

  const batteryKwhNum = Number.parseFloat(batteryKwh) || 0
  const batteryDaysOfGeneration = batteryKwhNum > 0 && expectedDailyKwh > 0 ? batteryKwhNum / expectedDailyKwh : null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected solar yield</CardTitle>
          <CardDescription>
            {zone
              ? `Based on the Clean Energy Regulator's official solar zone for postcode ${householdProfile.postcode.trim()} - the same zone table used for STC rebate calculations.`
              : `Rough state-average estimate based on your household profile's state (${state}) - enter your postcode in the household profile for a zone-precise figure.`}{' '}
            Assumes a well-oriented, unshaded system at a typical tilt. Real output varies with orientation, shading
            and weather, so treat this as a sanity check, not a precise forecast.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!zone && householdProfile.postcode.trim() !== '' && (
            <p className="text-xs text-destructive">
              Couldn't recognise postcode "{householdProfile.postcode}" - falling back to the state set in your
              household profile ({householdProfile.state}).
            </p>
          )}
          <p className="text-sm">
            {zone ? `CER solar zone ${zone.zone} (postcode ${householdProfile.postcode.trim()})` : `Estimated yield for ${state}`}:{' '}
            <span className="font-medium">{yieldPerKw} kWh/kW/year</span> (~
            {(yieldPerKw / 365).toFixed(1)} kWh/kW/day average)
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {PRESET_SIZES_KW.map((kw) => (
              <div key={kw} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{kw} kW system</p>
                <p className="text-lg font-semibold">{(kw * yieldPerKw).toLocaleString()} kWh/yr</p>
                <p className="text-xs text-muted-foreground">~{((kw * yieldPerKw) / 365).toFixed(1)} kWh/day average</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Solar system size (kW)</Label>
              <Input type="number" step="0.1" value={systemKw} onChange={(e) => setSystemKw(e.target.value)} placeholder="e.g. 6.6" />
            </div>
            <div>
              <Label>Inverter size (kW, optional)</Label>
              <Input type="number" step="0.1" value={inverterKw} onChange={(e) => setInverterKw(e.target.value)} placeholder="e.g. 5" />
            </div>
            <div>
              <Label>Battery capacity (kWh, optional)</Label>
              <Input type="number" step="0.5" value={batteryKwh} onChange={(e) => setBatteryKwh(e.target.value)} placeholder="e.g. 10" />
            </div>
          </div>

          {systemKwNum > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Expected annual generation</p>
                <p className="text-xl font-semibold">{expectedAnnualKwh.toFixed(0)} kWh/year</p>
                <p className="text-xs text-muted-foreground">~{expectedDailyKwh.toFixed(1)} kWh/day average</p>
              </div>
              {dcAcRatio != null && (
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Panel-to-inverter (DC:AC) ratio</p>
                  <p className="text-xl font-semibold">{dcAcRatio.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {dcAcRatio < 1
                      ? 'Inverter is rated larger than the panels - unusual, but not a problem.'
                      : dcAcRatio <= 1.33
                        ? 'Typical range for AU residential systems.'
                        : 'Panels are heavily oversized relative to the inverter - check it can handle this, output may clip on sunny days.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {batteryDaysOfGeneration != null && (
            <p className="text-sm text-muted-foreground">
              A {batteryKwhNum} kWh battery could store about{' '}
              <span className="font-medium text-foreground">{(batteryDaysOfGeneration * 100).toFixed(0)}%</span> of an
              average day's expected generation for this system size.
            </p>
          )}
        </CardContent>
      </Card>

      {systemKwNum > 0 && actual && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Is it performing as expected?</CardTitle>
            <CardDescription>
              Comparing your {actual.isExportOnly ? 'exported' : 'measured'} solar data (scaled to a full year) against
              the expected output above.
              {actual.isExportOnly && ' Only export data is available (no inverter CSV), so this understates true generation - some solar is self-consumed and never hits the grid meter.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Actual (annualised): <span className="font-medium">{actual.annualActualKwh.toFixed(0)} kWh/year</span>
            </p>
            {actual.pctOfExpected != null && (
              <div className="mt-2 flex items-center gap-2">
                {actual.pctOfExpected >= 85 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : actual.pctOfExpected >= 65 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <p className="text-sm">
                  <span className="font-medium">{actual.pctOfExpected.toFixed(0)}%</span> of expected output
                  {actual.isExportOnly && ' (export-only, so this is a floor, not the full picture)'}.{' '}
                  {actual.pctOfExpected >= 85
                    ? 'Performing within the normal range.'
                    : actual.pctOfExpected >= 65
                      ? 'A bit below expected - could be normal seasonal variation, partial shading, or soiling. Worth a look if it stays low.'
                      : "Well below expected - worth checking for shading, dirty panels, or an inverter fault, unless you know the system is undersized or export-limited."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
