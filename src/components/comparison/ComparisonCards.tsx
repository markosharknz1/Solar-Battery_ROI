import type { TariffPlan, CostResult } from '@/types/tariff'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ComparisonCards({
  entries,
  factor,
}: {
  entries: Array<{ plan: TariffPlan; cost: CostResult }>
  factor: number
}) {
  const activeEntry = entries.find((e) => e.plan.isActive)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(({ plan, cost }) => {
        const annual = cost.totalCostAud * factor
        const diff = activeEntry && activeEntry.plan.id !== plan.id ? annual - activeEntry.cost.totalCostAud * factor : null
        return (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {plan.isActive && <Badge variant="outline">Current</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${annual.toFixed(0)}/yr</p>
              {diff !== null && (
                <p className={`text-sm ${diff < 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {diff < 0 ? '-' : '+'}${Math.abs(diff).toFixed(0)}/yr vs current plan
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
