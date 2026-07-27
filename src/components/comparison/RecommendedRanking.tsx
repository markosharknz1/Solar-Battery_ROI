import { useMemo } from 'react'
import type { Interval } from '@/types/meter'
import { useTariffStore } from '@/store/tariffStore'
import { calculateCost } from '@/lib/tariffCalculator'
import { annualizeFactor } from '@/lib/annualize'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function RecommendedRanking({ intervals, totalDays }: { intervals: Interval[]; totalDays: number }) {
  const plans = useTariffStore((s) => s.plans)
  const factor = annualizeFactor(totalDays)

  const ranked = useMemo(() => {
    return plans
      .map((plan) => {
        const cost = calculateCost(intervals, plan)
        return { plan, cost, annualCostAud: cost.totalCostAud * factor }
      })
      .sort((a, b) => a.annualCostAud - b.annualCostAud)
  }, [plans, intervals, factor])

  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">No saved tariff plans yet - add one on the Tariffs page.</p>
  }

  const cheapest = ranked[0]
  const mostExpensive = ranked[ranked.length - 1]

  return (
    <div className="space-y-4">
      {ranked.length > 1 && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{cheapest.plan.name}</CardTitle>
              <Badge>Cheapest</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${cheapest.annualCostAud.toFixed(0)}/yr</p>
            <p className="text-sm text-muted-foreground">
              ${(mostExpensive.annualCostAud - cheapest.annualCostAud).toFixed(0)}/yr cheaper than your most
              expensive saved plan ({mostExpensive.plan.name}).
            </p>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Est. annual cost</TableHead>
            <TableHead>vs cheapest</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((r, idx) => (
            <TableRow key={r.plan.id} className={idx === 0 ? 'bg-accent/50' : undefined}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell className="font-medium">
                {r.plan.name}
                {r.plan.isActive && (
                  <Badge variant="outline" className="ml-2">
                    Your current plan
                  </Badge>
                )}
              </TableCell>
              <TableCell>${r.annualCostAud.toFixed(0)}</TableCell>
              <TableCell>{idx === 0 ? '-' : `+$${(r.annualCostAud - cheapest.annualCostAud).toFixed(0)}`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
