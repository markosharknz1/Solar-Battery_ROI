import type { BatteryQuote } from '@/types/battery'

/**
 * Lifetime throughput implied by a datasheet cycle-life rating:
 * cycles x usable capacity x depth-of-discharge. Returns MWh, or null if no rating.
 */
export function cycleLifeThroughputMwh(quote: BatteryQuote): number | null {
  if (!quote.ratedCycleLife || quote.ratedCycleLife <= 0) return null
  const dod = (quote.ratedDodPercent ?? 100) / 100
  return (quote.ratedCycleLife * quote.capacityKwh * dod) / 1000
}

/**
 * The throughput figure the warranty maths should use: an explicit MWh figure from the
 * warranty document wins; otherwise it is derived from the cycle-life rating.
 */
export function effectiveThroughputMwh(quote: BatteryQuote): number | null {
  return quote.warrantyThroughputMwh ?? cycleLifeThroughputMwh(quote)
}

/**
 * Capacity fade fraction (0..1) at the END of a given year, blending two aging clocks:
 *
 * - Calendar clock: the quote's total degradation spread straight-line over its lifetime
 *   (the model the app has always used).
 * - Cycle clock: the same total degradation reached when the simulated dispatch has
 *   consumed the battery's rated cycle life (annual equivalent cycles x years / rated
 *   cycle life). Heavy arbitrage cycling therefore ages the battery faster than the
 *   calendar alone would.
 *
 * Whichever clock runs faster wins. With no cycle-life rating this reduces exactly to
 * the original calendar-only model. Fade is capped at 100%.
 */
export function capacityFadeFraction(quote: BatteryQuote, annualEquivCycles: number, year: number): number {
  const totalFade = quote.totalDegradationPercent / 100
  const calendarClock = quote.lifetimeYears > 0 ? year / quote.lifetimeYears : 0
  const cycleClock =
    quote.ratedCycleLife && quote.ratedCycleLife > 0 ? (annualEquivCycles * year) / quote.ratedCycleLife : 0
  return Math.min(1, totalFade * Math.max(calendarClock, cycleClock))
}

/** True when the cycle clock (dispatch intensity) is what limits this battery, not the calendar. */
export function cycleAgingDominates(quote: BatteryQuote, annualEquivCycles: number): boolean {
  if (!quote.ratedCycleLife || quote.ratedCycleLife <= 0 || quote.lifetimeYears <= 0) return false
  return annualEquivCycles / quote.ratedCycleLife > 1 / quote.lifetimeYears
}
