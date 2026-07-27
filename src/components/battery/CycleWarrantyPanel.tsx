import type { BatteryQuote, BatterySimResult } from '@/types/battery'
import type { TariffPlan } from '@/types/tariff'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function WarrantyTimeline({ quote, result }: { quote: BatteryQuote; result: BatterySimResult }) {
  const maxYear = Math.max(quote.warrantyYears, result.yearsTillThroughputExpiry ?? 0, result.effectiveWarrantyYears) + 2
  const width = 600
  const height = 70
  const yearToX = (y: number) => (y / maxYear) * width

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Battery warranty timeline">
      <line x1={0} y1={10} x2={width} y2={10} stroke="var(--muted-foreground)" strokeWidth={1} />
      {Array.from({ length: Math.floor(maxYear / 2) + 1 }, (_, i) => i * 2).map((y) => (
        <text key={y} x={yearToX(y)} y={8} fontSize={9} fill="currentColor" className="text-muted-foreground">
          {y}
        </text>
      ))}
      <rect x={0} y={18} width={yearToX(quote.warrantyYears)} height={14} fill="#1baf7a" rx={3} />
      <text x={4} y={28} fontSize={9} fill="white">
        Year warranty ({quote.warrantyYears} yr)
      </text>
      {result.yearsTillThroughputExpiry !== null && (
        <>
          <rect x={0} y={38} width={yearToX(result.yearsTillThroughputExpiry)} height={14} fill="#2a78d6" rx={3} />
          <text x={4} y={48} fontSize={9} fill="white">
            Throughput warranty ({result.yearsTillThroughputExpiry.toFixed(1)} yr)
          </text>
        </>
      )}
      <line x1={yearToX(result.effectiveWarrantyYears)} y1={14} x2={yearToX(result.effectiveWarrantyYears)} y2={58} stroke="#e34948" strokeWidth={2} strokeDasharray="3 2" />
      <text x={yearToX(result.effectiveWarrantyYears) + 4} y={66} fontSize={9} fill="currentColor" className="text-muted-foreground">
        Effective end: year {result.effectiveWarrantyYears.toFixed(1)}
      </text>
    </svg>
  )
}

export function CycleWarrantyPanel({
  result,
  quote,
  plan,
}: {
  result: BatterySimResult
  quote: BatteryQuote
  plan: TariffPlan
}) {
  const throughputExpiresFirst =
    result.yearsTillThroughputExpiry !== null && result.yearsTillThroughputExpiry < quote.warrantyYears

  const importRates = plan.periods.map((p) => p.ratePerKwh)
  const highestImportRate = importRates.length > 0 ? Math.max(...importRates) : 0
  const lowestImportRate = importRates.length > 0 ? Math.min(...importRates) : 0
  const feedInRates = plan.feedInPeriods.map((p) => p.ratePerKwh)
  const avgFeedInRate = feedInRates.length > 0 ? feedInRates.reduce((a, r) => a + r, 0) / feedInRates.length : 0

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Avg daily cycles</CardTitle>
            <p className="text-xl font-semibold">{result.avgDailyCycles.toFixed(2)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Annual cycles</CardTitle>
            <p className="text-xl font-semibold">{result.annualEquivCycles.toFixed(0)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Effective warranty</CardTitle>
            <p className="text-xl font-semibold">{result.effectiveWarrantyYears.toFixed(1)} yrs</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">Cost per kWh stored</CardTitle>
            <p className="text-xl font-semibold">${result.costPerKwhStored.toFixed(3)}</p>
          </CardHeader>
        </Card>
      </div>

      {throughputExpiresFirst && (
        <Badge variant="destructive" className="w-fit">
          Throughput warranty expires before the year warranty
        </Badge>
      )}

      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm font-medium">Warranty timeline</p>
        <WarrantyTimeline quote={quote} result={result} />
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <p className="mb-2 font-medium">Lifecycle cost breakdown</p>
        <div className="grid grid-cols-2 gap-y-1">
          <span className="text-muted-foreground">Installed cost</span>
          <span className="text-right">${quote.totalCostAud.toFixed(0)}</span>
          <span className="text-muted-foreground">Lifetime kWh stored</span>
          <span className="text-right">{result.lifetimeKwhStoredAtWarranty.toFixed(0)} kWh</span>
          <span className="text-muted-foreground">Cost per kWh stored</span>
          <span className="text-right font-medium">${result.costPerKwhStored.toFixed(3)}/kWh</span>
        </div>
        <p className="mb-1 mt-3 text-xs text-muted-foreground">Compare with:</p>
        <div className="grid grid-cols-2 gap-y-1 text-xs">
          <span>Highest import rate</span>
          <span className={`text-right ${result.costPerKwhStored < highestImportRate ? 'text-green-600' : 'text-destructive'}`}>
            ${highestImportRate.toFixed(3)}/kWh {result.costPerKwhStored < highestImportRate ? '✓ cheaper' : '✗ more expensive'}
          </span>
          <span>Lowest import rate</span>
          <span className={`text-right ${result.costPerKwhStored < lowestImportRate ? 'text-green-600' : 'text-destructive'}`}>
            ${lowestImportRate.toFixed(3)}/kWh {result.costPerKwhStored < lowestImportRate ? '✓ cheaper' : '✗ more expensive'}
          </span>
          <span>Feed-in tariff</span>
          <span className={`text-right ${result.costPerKwhStored < avgFeedInRate ? 'text-green-600' : 'text-destructive'}`}>
            ${avgFeedInRate.toFixed(3)}/kWh {result.costPerKwhStored < avgFeedInRate ? '✓ cheaper' : '✗ more expensive'}
          </span>
        </div>
      </div>
    </div>
  )
}
