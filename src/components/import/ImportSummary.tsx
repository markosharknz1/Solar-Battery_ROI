import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/store/dataStore'
import { Link } from 'react-router-dom'

export function ImportSummary() {
  const summary = useDataStore((s) => s.summary)
  const warnings = useDataStore((s) => s.csvWarnings)
  const clearData = useDataStore((s) => s.clearData)

  if (!summary) return null

  const selfConsumptionRate =
    summary.hasInverterData && summary.totalSolarGen > 0
      ? ((summary.totalSolarGen - summary.totalGridExport) / summary.totalSolarGen) * 100
      : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Import summary</CardTitle>
        <Button variant="outline" size="sm" onClick={clearData}>
          Clear and re-upload
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.isFlatEstimate && (
          <p className="rounded-md bg-accent px-3 py-2 text-xs text-muted-foreground">
            This is a flat estimate from a manually entered bill. Time-of-use comparison and battery
            simulation need real interval data from a CSV.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Date range" value={`${format(summary.dateRange.start, 'd MMM yyyy')} - ${format(summary.dateRange.end, 'd MMM yyyy')}`} />
          <Stat label="Days" value={summary.totalDays.toLocaleString()} />
          <Stat label="Grid import" value={`${summary.totalGridImport.toFixed(1)} kWh`} />
          <Stat label="Grid export" value={`${summary.totalGridExport.toFixed(1)} kWh`} />
          {summary.hasInverterData && <Stat label="Solar generation" value={`${summary.totalSolarGen.toFixed(1)} kWh`} />}
          {selfConsumptionRate !== null && (
            <Stat label="Self-consumption" value={`${selfConsumptionRate.toFixed(0)}%`} />
          )}
        </div>
        {warnings.length > 0 && (
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <Button asChild>
          <Link to="/analytics">Go to Analytics →</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
