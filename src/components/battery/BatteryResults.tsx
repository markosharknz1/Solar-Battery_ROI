import type { BatteryQuote, BatterySimResult } from '@/types/battery'
import type { TariffPlan } from '@/types/tariff'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SavingsBreakdownChart } from '@/components/battery/SavingsBreakdownChart'
import { MonthlySavingsChart } from '@/components/battery/MonthlySavingsChart'
import { SocChart } from '@/components/battery/SocChart'
import { PaybackChart } from '@/components/battery/PaybackChart'
import { CycleWarrantyPanel } from '@/components/battery/CycleWarrantyPanel'
import { CycleDepthHistogram } from '@/components/battery/CycleDepthHistogram'
import { getSizingAdvice } from '@/lib/batterySimulator'

export function BatteryResults({
  result,
  quote,
  plan,
  totalDays,
}: {
  result: BatterySimResult
  quote: BatteryQuote
  plan: TariffPlan
  totalDays: number
}) {
  const advice = getSizingAdvice(result, totalDays)
  const importReductionPct =
    result.annualGridImportKwhBase > 0
      ? ((result.annualGridImportKwhBase - result.annualGridImportKwh) / result.annualGridImportKwhBase) * 100
      : 0

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Annual grid import reduction</CardTitle>
            <p className="text-xl font-semibold">
              {(result.annualGridImportKwhBase - result.annualGridImportKwh).toFixed(0)} kWh ({importReductionPct.toFixed(0)}%)
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Annual saving</CardTitle>
            <p className="text-xl font-semibold">${(result.annualSavingsAud + result.vppCreditAud).toFixed(0)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Simple payback</CardTitle>
            <p className="text-xl font-semibold">
              {Number.isFinite(result.simplePaybackYears) ? `${result.simplePaybackYears.toFixed(1)} yrs` : 'N/A'}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Self-consumption rate</CardTitle>
            <p className="text-xl font-semibold">{(result.selfConsumptionRate * 100).toFixed(0)}%</p>
          </CardHeader>
        </Card>
      </div>

      {quote.exportLimitKw !== null && (
        <div className="rounded-md border p-3 text-sm">
          {result.estimatedCurtailmentKwhAnnual > 0 ? (
            <p>
              Estimated curtailment: <strong>{result.estimatedCurtailmentKwhAnnual.toFixed(0)} kWh/yr</strong> would be
              lost without a battery. This battery captures{' '}
              <strong>{result.curtailmentCaptureKwhAnnual.toFixed(0)} kWh/yr</strong> ({result.curtailmentCapturePercent.toFixed(0)}%) of it.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Upload solar inverter generation data on the Import page to see curtailment analysis for this export limit.
            </p>
          )}
        </div>
      )}

      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList>
          <TabsTrigger value="breakdown">Savings breakdown</TabsTrigger>
          <TabsTrigger value="monthly">Monthly savings</TabsTrigger>
          <TabsTrigger value="soc">State of charge</TabsTrigger>
          <TabsTrigger value="payback">Payback</TabsTrigger>
          <TabsTrigger value="cycles">Cycles &amp; warranty</TabsTrigger>
          <TabsTrigger value="sizing">Sizing advice</TabsTrigger>
          {quote.backupCapable && <TabsTrigger value="backup">Backup</TabsTrigger>}
        </TabsList>
        <TabsContent value="breakdown">
          <SavingsBreakdownChart result={result} />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlySavingsChart result={result} />
        </TabsContent>
        <TabsContent value="soc">
          <SocChart result={result} capacityKwh={quote.capacityKwh} />
        </TabsContent>
        <TabsContent value="payback">
          <PaybackChart result={result} quote={quote} />
        </TabsContent>
        <TabsContent value="cycles" className="space-y-4">
          <CycleWarrantyPanel result={result} quote={quote} plan={plan} />
          <CycleDepthHistogram
            dailyCycleDepths={result.dailyCycleDepths}
            targetMinPct={quote.targetMinDischargePct}
            targetMaxPct={quote.targetMaxDischargePct}
          />
        </TabsContent>
        <TabsContent value="sizing">
          <ul className="list-inside list-disc space-y-1 text-sm">
            {advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </TabsContent>
        {quote.backupCapable && (
          <TabsContent value="backup">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs font-normal text-muted-foreground">Reserve</CardTitle>
                  <p className="text-xl font-semibold">{((quote.capacityKwh * quote.reservePercent) / 100).toFixed(1)} kWh</p>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs font-normal text-muted-foreground">Avg backup hours</CardTitle>
                  <p className="text-xl font-semibold">{result.estimatedBackupHoursAvg.toFixed(1)} hrs</p>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs font-normal text-muted-foreground">Max backup hours</CardTitle>
                  <p className="text-xl font-semibold">{result.estimatedBackupHoursMax.toFixed(1)} hrs</p>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
