import type { Interval } from '@/types/meter'
import type { CostResult, ResolvedRate, RatePeriod, TariffPlan } from '@/types/tariff'
import { isPublicHoliday } from '@/lib/publicHolidays'

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function intervalCoversSlot(startTime: string, endTime: string, slot: number): boolean {
  const intervalStart = slot * 30
  const start = toMinutes(startTime)
  let end = toMinutes(endTime)
  if (end <= start) end += 24 * 60 // wrap past midnight, or 00:00-00:00 meaning the full day

  let t = intervalStart
  if (t < start) t += 24 * 60
  return t >= start && t < end
}

function effectiveWeekday(plan: TariffPlan, interval: Interval): number {
  if (plan.publicHolidaysAsWeekends && isPublicHoliday(interval.date)) return 5 // treat as Saturday
  return interval.weekday
}

function resolveFromPeriods(periods: RatePeriod[], weekday: number, slot: number): ResolvedRate {
  const candidates = periods.filter((p) => p.days[weekday])
  const matched = candidates.find((p) => intervalCoversSlot(p.startTime, p.endTime, slot))
  const chosen = matched ?? periods[0]

  if (!chosen) return { ratePerKwh: 0, periodName: 'No rate defined', isFree: true }
  const effectiveRate = chosen.gstInclusive ? chosen.ratePerKwh : chosen.ratePerKwh * 1.1
  return { ratePerKwh: effectiveRate, periodName: chosen.name, isFree: chosen.ratePerKwh <= 0 }
}

export function resolveRate(plan: TariffPlan, interval: Interval): ResolvedRate {
  return resolveFromPeriods(plan.periods, effectiveWeekday(plan, interval), interval.slot)
}

/** Same slot-matching logic as resolveRate, over feedInPeriods. Returns 0 if feedInPeriods is empty. */
export function resolveFeedInRate(plan: TariffPlan, interval: Interval): ResolvedRate {
  if (plan.feedInPeriods.length === 0) return { ratePerKwh: 0, periodName: 'No feed-in rate', isFree: true }
  return resolveFromPeriods(plan.feedInPeriods, effectiveWeekday(plan, interval), interval.slot)
}

export function calculateCost(intervals: Interval[], plan: TariffPlan): CostResult {
  let importCostAud = 0
  let exportCreditAud = 0
  let cl1CostAud = 0
  const byPeriod: Record<string, { kWh: number; costAud: number }> = {}
  const byMonthMap = new Map<string, { costAud: number; kWh: number }>()
  const dayOfWeekCost = Array(7).fill(0)
  const daysByWeekday: Set<string>[] = Array.from({ length: 7 }, () => new Set())
  const allDays = new Set<string>()

  for (const interval of intervals) {
    const rate = resolveRate(plan, interval)
    const feedInRate = resolveFeedInRate(plan, interval)
    const importCost = interval.gridImport * rate.ratePerKwh
    const exportCredit = interval.gridExport * feedInRate.ratePerKwh
    const cl1Cost = (interval.cl1Import * (plan.controlledLoadRate ?? 0)) / 100
    const cl2Cost = (interval.cl2Import * (plan.controlledLoad2Rate ?? 0)) / 100
    const netCost = importCost - exportCredit + cl1Cost + cl2Cost

    importCostAud += importCost
    exportCreditAud += exportCredit
    cl1CostAud += cl1Cost + cl2Cost

    const periodEntry = byPeriod[rate.periodName] ?? { kWh: 0, costAud: 0 }
    periodEntry.kWh += interval.gridImport
    periodEntry.costAud += importCost
    byPeriod[rate.periodName] = periodEntry

    const monthKey = interval.dateStr.slice(0, 7)
    const monthEntry = byMonthMap.get(monthKey) ?? { costAud: 0, kWh: 0 }
    monthEntry.costAud += netCost
    monthEntry.kWh += interval.gridImport
    byMonthMap.set(monthKey, monthEntry)

    dayOfWeekCost[interval.weekday] += netCost
    daysByWeekday[interval.weekday].add(interval.dateStr)
    allDays.add(interval.dateStr)
  }

  const dailyFixed = plan.fixedCharges.reduce(
    (sum, c) => sum + (c.gstInclusive ? c.amountPerDay : c.amountPerDay * 1.1),
    0,
  )
  const fixedChargesAud = dailyFixed * allDays.size
  const byDayOfWeek = dayOfWeekCost.map((cost, w) => (daysByWeekday[w].size > 0 ? cost / daysByWeekday[w].size : 0))
  const byMonth = Array.from(byMonthMap.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalCostAud: importCostAud - exportCreditAud + cl1CostAud + fixedChargesAud,
    importCostAud,
    exportCreditAud,
    fixedChargesAud,
    cl1CostAud,
    byPeriod,
    byMonth,
    byDayOfWeek,
  }
}
