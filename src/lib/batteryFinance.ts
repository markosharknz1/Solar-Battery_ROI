import type { BatteryQuote, BatterySimResult } from '@/types/battery'
import { capacityFadeFraction } from '@/lib/batteryAging'

/**
 * The battery's yearly dollar benefit over its lifetime: the measured annual saving
 * grown by the electricity-price assumption and shrunk by the blended aging model
 * (same formula as the PDF report's projection), plus the VPP credit (program-set,
 * so not grown with prices).
 */
export function benefitStream(quote: BatteryQuote, result: BatterySimResult, priceGrowthPct: number): number[] {
  return Array.from({ length: quote.lifetimeYears }, (_, i) => {
    const y = i + 1
    const degradationFactor = Math.max(0, 1 - capacityFadeFraction(quote, result.annualEquivCycles, y))
    return result.annualSavingsAud * Math.pow(1 + priceGrowthPct / 100, y - 1) * degradationFactor + result.vppCreditAud
  })
}

export interface FinanceYearRow {
  year: number
  benefitAud: number // battery saving that year
  outlayAud: number // loan repayments that year (0 for cash purchase, and after the term)
  netAud: number // running position vs the alternative at end of this year
}

export interface FinanceOutcome {
  mode: 'cash' | 'loan'
  rows: FinanceYearRow[]
  tcoAud: number // lifetime total cost of ownership
  totalBenefitAud: number // what the savings are worth by end of lifetime (same basis as tcoAud)
  netAud: number // totalBenefit - tco
  breakevenYear: number | null // first year the running position reaches >= 0
  // cash mode
  foregoneInterestAud?: number // mortgage interest the purchase money would have avoided
  // loan mode
  monthlyRepaymentAud?: number
  totalRepaidAud?: number
  totalInterestAud?: number
}

/**
 * Cash purchase, with the money otherwise sitting in the mortgage/offset at `mortgageRatePct`.
 * Both sides compound at the mortgage rate: the purchase price grows as foregone interest,
 * and each year's battery saving is treated as swept back into the offset.
 * net(T) = sum of savings future-valued to T, minus cost x (1+r)^T.
 */
export function cashOutcome(effectiveCostAud: number, benefits: number[], mortgageRatePct: number): FinanceOutcome {
  const r = mortgageRatePct / 100
  const rows: FinanceYearRow[] = []
  let breakevenYear: number | null = null
  for (let t = 1; t <= benefits.length; t++) {
    let savingsFv = 0
    for (let y = 1; y <= t; y++) savingsFv += benefits[y - 1] * Math.pow(1 + r, t - y)
    const net = savingsFv - effectiveCostAud * Math.pow(1 + r, t)
    rows.push({ year: t, benefitAud: benefits[t - 1], outlayAud: 0, netAud: net })
    if (breakevenYear === null && net >= 0) breakevenYear = t
  }
  const T = benefits.length
  const tcoAud = effectiveCostAud * Math.pow(1 + r, T)
  const totalBenefitAud = tcoAud + (rows[T - 1]?.netAud ?? -tcoAud)
  return {
    mode: 'cash',
    rows,
    tcoAud,
    totalBenefitAud,
    netAud: rows[T - 1]?.netAud ?? 0,
    breakevenYear,
    foregoneInterestAud: tcoAud - effectiveCostAud,
  }
}

/**
 * Financed purchase: a standard monthly annuity over `termYears` at `loanRatePct`.
 * The running position is the plain cumulative cash flow (savings minus repayments) -
 * no discounting, so "breakeven" answers "when am I actually in front, dollar for dollar".
 */
export function loanOutcome(
  effectiveCostAud: number,
  benefits: number[],
  loanRatePct: number,
  termYears: number,
): FinanceOutcome {
  const months = Math.max(1, Math.round(termYears * 12))
  const i = loanRatePct / 100 / 12
  const monthly = i > 0 ? (effectiveCostAud * i) / (1 - Math.pow(1 + i, -months)) : effectiveCostAud / months
  const totalRepaidAud = monthly * months

  const rows: FinanceYearRow[] = []
  let cumulative = 0
  let breakevenYear: number | null = null
  for (let t = 1; t <= benefits.length; t++) {
    const monthsThisYear = Math.min(12, Math.max(0, months - (t - 1) * 12))
    const outlay = monthly * monthsThisYear
    cumulative += benefits[t - 1] - outlay
    rows.push({ year: t, benefitAud: benefits[t - 1], outlayAud: outlay, netAud: cumulative })
    if (breakevenYear === null && cumulative >= 0) breakevenYear = t
  }
  const totalBenefitAud = benefits.reduce((a, b) => a + b, 0)
  return {
    mode: 'loan',
    rows,
    tcoAud: totalRepaidAud,
    totalBenefitAud,
    netAud: totalBenefitAud - totalRepaidAud,
    breakevenYear,
    monthlyRepaymentAud: monthly,
    totalRepaidAud,
    totalInterestAud: totalRepaidAud - effectiveCostAud,
  }
}
