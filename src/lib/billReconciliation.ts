import type { Bill } from '@/types/bill'
import type { Interval } from '@/types/meter'
import type { TariffPlan } from '@/types/tariff'
import { calculateCost } from '@/lib/tariffCalculator'

export interface BillReconciliation {
  status: 'good' | 'fair' | 'poor' | 'insufficient_data'
  computedCostAud: number | null
  /** (computed - billed) / billed, as a percentage; positive = plan computes higher than the bill */
  variancePct: number | null
  coveredDays: number
  billDays: number
}

const MIN_COVERAGE = 0.9

/**
 * Sanity-checks a bill against the modelled tariff: runs the imported interval data for the
 * bill's period through the plan and compares the computed total to what was actually charged.
 * A close match means the tariff plan is configured correctly (and the interval data is
 * complete); a large variance means one of them is off and downstream simulations shouldn't
 * be trusted until it's resolved.
 */
export function reconcileBill(bill: Bill, intervals: Interval[], plan: TariffPlan): BillReconciliation {
  const inPeriod = intervals.filter((i) => i.dateStr >= bill.periodStart && i.dateStr <= bill.periodEnd)
  const coveredDays = new Set(inPeriod.map((i) => i.dateStr)).size

  const msPerDay = 24 * 60 * 60 * 1000
  const billDays =
    Math.round((new Date(bill.periodEnd).getTime() - new Date(bill.periodStart).getTime()) / msPerDay) + 1

  if (billDays <= 0 || coveredDays / billDays < MIN_COVERAGE) {
    return { status: 'insufficient_data', computedCostAud: null, variancePct: null, coveredDays, billDays }
  }

  const computedCostAud = calculateCost(inPeriod, plan).totalCostAud
  const variancePct = bill.totalCostAud > 0 ? ((computedCostAud - bill.totalCostAud) / bill.totalCostAud) * 100 : null

  const abs = variancePct === null ? Number.POSITIVE_INFINITY : Math.abs(variancePct)
  const status = abs <= 5 ? 'good' : abs <= 15 ? 'fair' : 'poor'

  return { status, computedCostAud, variancePct, coveredDays, billDays }
}
