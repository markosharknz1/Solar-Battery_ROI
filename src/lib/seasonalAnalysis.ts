import type { Interval } from '@/types/meter'
import type { TariffPlan } from '@/types/tariff'
import { resolveRate, resolveFeedInRate, calculateCost } from '@/lib/tariffCalculator'

export type Season = 'Summer' | 'Autumn' | 'Winter' | 'Spring'

export const SEASON_ORDER: Season[] = ['Summer', 'Autumn', 'Winter', 'Spring']

/** Southern hemisphere (Australia) season boundaries. */
const SEASON_BY_MONTH: Record<number, Season> = {
  12: 'Summer', 1: 'Summer', 2: 'Summer',
  3: 'Autumn', 4: 'Autumn', 5: 'Autumn',
  6: 'Winter', 7: 'Winter', 8: 'Winter',
  9: 'Spring', 10: 'Spring', 11: 'Spring',
}

/** dateStr is 'YYYY-MM-DD'. */
export function seasonOf(dateStr: string): Season {
  return SEASON_BY_MONTH[Number(dateStr.slice(5, 7))]
}

export interface SeasonalBreakdown {
  season: Season
  days: number
  totalImportKwh: number
  totalExportKwh: number
  totalCostAud: number
  avgDailyCostAud: number
  avgDailyImportKwh: number
}

/** Real per-season usage/cost from the loaded intervals - only seasons actually present in the
 * data are returned (no extrapolation for missing seasons). */
export function computeSeasonalBreakdown(intervals: Interval[], plan: TariffPlan): SeasonalBreakdown[] {
  const bySeasons = new Map<Season, { importKwh: number; exportKwh: number; usageCostAud: number; days: Set<string> }>()

  const dailyFixed = plan.fixedCharges.reduce(
    (sum, c) => sum + (c.gstInclusive ? c.amountPerDay : c.amountPerDay * 1.1),
    0,
  )

  for (const interval of intervals) {
    const season = seasonOf(interval.dateStr)
    const entry = bySeasons.get(season) ?? { importKwh: 0, exportKwh: 0, usageCostAud: 0, days: new Set<string>() }

    const rate = resolveRate(plan, interval)
    const feedIn = resolveFeedInRate(plan, interval)
    entry.importKwh += interval.gridImport
    entry.exportKwh += interval.gridExport
    entry.usageCostAud += interval.gridImport * rate.ratePerKwh - interval.gridExport * feedIn.ratePerKwh
    entry.days.add(interval.dateStr)

    bySeasons.set(season, entry)
  }

  return SEASON_ORDER.filter((s) => bySeasons.has(s)).map((season) => {
    const e = bySeasons.get(season)!
    const days = e.days.size
    const totalCostAud = e.usageCostAud + dailyFixed * days
    return {
      season,
      days,
      totalImportKwh: e.importKwh,
      totalExportKwh: e.exportKwh,
      totalCostAud,
      avgDailyCostAud: days > 0 ? totalCostAud / days : 0,
      avgDailyImportKwh: days > 0 ? e.importKwh / days : 0,
    }
  })
}

export interface BillProjectionYear {
  year: number
  fixedChargesAud: number
  usageCostAud: number // import cost + controlled load cost
  exportCreditAud: number
  totalCostAud: number
}

/**
 * Projects annual bills forward assuming today's usage pattern repeats, with compounding
 * annual increases applied to the daily supply charge and the usage (import + CL) rate.
 * Feed-in credit is held flat - escalating it in the same direction as usage rates would
 * assume the retailer raises what they pay you, which isn't a realistic default.
 */
export function projectBills(
  intervals: Interval[],
  totalDays: number,
  plan: TariffPlan,
  years: number,
  dailyChargeIncreasePct: number,
  usageRateIncreasePct: number,
): BillProjectionYear[] {
  const cost = calculateCost(intervals, plan)
  const annualFactor = 365 / Math.max(1, totalDays)
  const baseFixed = cost.fixedChargesAud * annualFactor
  const baseUsage = (cost.importCostAud + cost.cl1CostAud) * annualFactor
  const baseExport = cost.exportCreditAud * annualFactor

  return Array.from({ length: years }, (_, idx) => {
    const fixedMult = Math.pow(1 + dailyChargeIncreasePct / 100, idx)
    const usageMult = Math.pow(1 + usageRateIncreasePct / 100, idx)
    const fixedChargesAud = baseFixed * fixedMult
    const usageCostAud = baseUsage * usageMult
    const exportCreditAud = baseExport
    return {
      year: idx + 1,
      fixedChargesAud,
      usageCostAud,
      exportCreditAud,
      totalCostAud: fixedChargesAud + usageCostAud - exportCreditAud,
    }
  })
}
