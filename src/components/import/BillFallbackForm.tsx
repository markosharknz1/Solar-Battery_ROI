import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { buildFlatEstimateIntervals } from '@/lib/dataProcessor'
import { useDataStore } from '@/store/dataStore'

export function BillFallbackForm() {
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [totalUsage, setTotalUsage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const setIntervals = useDataStore((s) => s.setIntervals)

  const submit = () => {
    setError(null)
    const usage = Number.parseFloat(totalUsage)
    if (!periodStart || !periodEnd || Number.isNaN(usage) || usage <= 0) {
      setError('Enter a valid period and usage amount.')
      return
    }
    if (new Date(periodEnd) < new Date(periodStart)) {
      setError('Period end must be after period start.')
      return
    }

    const intervals = buildFlatEstimateIntervals(periodStart, periodEnd, usage)
    setIntervals(intervals, [], true)
    // totalCost is informational only in v1 (no separate bills/budget module in the adopted spec)
    void totalCost
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>No smart meter data? Enter a bill manually</CardTitle>
        <CardDescription>
          A lighter-weight option if you only have a total from a bill. Good enough for budget tracking and
          flat-rate comparison - time-of-use comparison and battery simulation need real interval data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="period-start">Period start</Label>
            <Input id="period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="period-end">Period end</Label>
            <Input id="period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="total-cost">Total cost ($)</Label>
            <Input id="total-cost" type="number" min="0" step="0.01" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="total-usage">Total usage (kWh)</Label>
            <Input id="total-usage" type="number" min="0" step="0.1" value={totalUsage} onChange={(e) => setTotalUsage(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={submit}>Use this bill</Button>
      </CardContent>
    </Card>
  )
}
