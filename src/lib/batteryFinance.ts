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
  benefitAud: number // battery saving that year (0 beyond the battery's lifetime)
  outlayAud: number // loan repayments that year, plus any upfront cash in year 1 (0 for cash purchase)
  netAud: number // running position vs the alternative at end of this year
}

/** A real-world battery finance offer: an interest-free component and an
 * interest-bearing component, each with its own amount and payback period.
 * Anything the two components don't cover is paid upfront in cash. */
export interface LoanSplit {
  interestFreeAud: number
  interestFreeTermYears: number
  interestBearingAud: number
  interestBearingRatePct: number
  interestBearingTermYears: number
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
  upfrontAud?: number // cash paid day one (the part neither loan component covers)
  interestFreeMonthlyAud?: number
  interestBearingMonthlyAud?: number
  monthlyRepaymentAud?: number // combined, while both components are running
  totalRepaidAud?: number // upfront + both components in full
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

function monthlyAnnuity(principalAud: number, ratePct: number, months: number): number {
  if (principalAud <= 0 || months <= 0) return 0
  const i = ratePct / 100 / 12
  return i > 0 ? (principalAud * i) / (1 - Math.pow(1 + i, -months)) : principalAud / months
}

/**
 * Financed purchase, modelled the way battery offers are actually structured: an
 * interest-free component and an interest-bearing component (standard monthly annuity),
 * each with its own amount and payback period. Whatever the two components don't cover
 * is paid upfront in cash (counted in year 1). The running position is plain cumulative
 * cash flow - no discounting, so "breakeven" answers "when am I actually in front,
 * dollar for dollar". Rows run to the later of the battery lifetime and the longest
 * term, so repayments outliving the battery still count.
 */
export function loanOutcome(effectiveCostAud: number, benefits: number[], split: LoanSplit): FinanceOutcome {
  const ifMonths = split.interestFreeAud > 0 ? Math.max(1, Math.round(split.interestFreeTermYears * 12)) : 0
  const ibMonths = split.interestBearingAud > 0 ? Math.max(1, Math.round(split.interestBearingTermYears * 12)) : 0
  const ifMonthly = ifMonths > 0 ? split.interestFreeAud / ifMonths : 0
  const ibMonthly = monthlyAnnuity(split.interestBearingAud, split.interestBearingRatePct, ibMonths)
  const upfrontAud = Math.max(0, effectiveCostAud - split.interestFreeAud - split.interestBearingAud)
  const totalRepaidAud = upfrontAud + split.interestFreeAud + ibMonthly * ibMonths
  const totalInterestAud = ibMonthly * ibMonths - split.interestBearingAud

  const totalYears = Math.max(benefits.length, Math.ceil(ifMonths / 12), Math.ceil(ibMonths / 12))
  const rows: FinanceYearRow[] = []
  let cumulative = 0
  let breakevenYear: number | null = null
  for (let t = 1; t <= totalYears; t++) {
    const monthsOf = (total: number) => Math.min(12, Math.max(0, total - (t - 1) * 12))
    const outlay = ifMonthly * monthsOf(ifMonths) + ibMonthly * monthsOf(ibMonths) + (t === 1 ? upfrontAud : 0)
    const benefit = benefits[t - 1] ?? 0
    cumulative += benefit - outlay
    rows.push({ year: t, benefitAud: benefit, outlayAud: outlay, netAud: cumulative })
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
    upfrontAud,
    interestFreeMonthlyAud: ifMonthly,
    interestBearingMonthlyAud: ibMonthly,
    monthlyRepaymentAud: ifMonthly + ibMonthly,
    totalRepaidAud,
    totalInterestAud,
  }
}
