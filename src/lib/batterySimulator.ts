import type { Interval } from '@/types/meter'
import type { TariffPlan } from '@/types/tariff'
import type { AverageDaySlot, BatteryQuote, BatterySimResult, ChargeWindow, VppProgram } from '@/types/battery'
import { calculateCost, resolveRate } from '@/lib/tariffCalculator'
import { annualizeFactor } from '@/lib/annualize'
import { vppNetAnnualAud } from '@/lib/vpp'

function isOffPeakPeriod(name: string): boolean {
  return name.toLowerCase().includes('off') || name.toLowerCase().includes('free') || name.toLowerCase().includes('sponge')
}

// "peak_only" discharge means "don't waste stored energy during a cheap/off-peak period" -
// defined as the negation of off-peak (rather than requiring the literal word "peak" in the
// period name) so it still behaves sensibly for flat-rate plans with a single all-day period.
function isDischargeableWindow(name: string): boolean {
  return !isOffPeakPeriod(name)
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function slotInWindow(startTime: string, endTime: string, slot: number): boolean {
  const intervalStart = slot * 30
  const start = toMinutes(startTime)
  let end = toMinutes(endTime)
  if (end <= start) end += 24 * 60
  let t = intervalStart
  if (t < start) t += 24 * 60
  return t >= start && t < end
}

const usesSolar = (chargePriority: BatteryQuote['chargePriority']) =>
  chargePriority === 'solar_only' || chargePriority === 'solar_then_offpeak' || chargePriority === 'solar_then_arbitrage'
const usesArbitrage = (chargePriority: BatteryQuote['chargePriority']) =>
  chargePriority === 'solar_then_arbitrage' || chargePriority === 'arbitrage_only'
const usesOffPeak = (chargePriority: BatteryQuote['chargePriority']) => chargePriority === 'solar_then_offpeak'

export function simulateBattery(
  intervals: Interval[],
  quote: BatteryQuote,
  plan: TariffPlan,
  vpp?: VppProgram | null,
): BatterySimResult {
  const sorted = [...intervals].sort((a, b) => (a.dateStr === b.dateStr ? a.slot - b.slot : a.dateStr.localeCompare(b.dateStr)))
  const rates = sorted.map((i) => resolveRate(plan, i))

  const midLifeFraction = 1 - (quote.totalDegradationPercent / 100) * 0.5
  const effectiveCapacity = quote.capacityKwh * midLifeFraction
  const floorSoc = (effectiveCapacity * Math.max(quote.reservePercent, 100 - quote.maxDischargePercent)) / 100
  const maxChargePerInterval = quote.maxChargeKw * 0.5
  const maxDischargePerInterval = quote.maxDischargeKw * 0.5
  const hasInverterData = sorted.some((i) => i.solarGen > 0)
  const captureCurtailment = quote.exportLimitKw !== null && hasInverterData

  // Hold-for-peak dispatch pre-pass. On plans with a shoulder rate, greedy "discharge at any
  // non-off-peak rate" drains the battery at the morning shoulder and leaves it empty for the
  // evening peak. The simulator has the whole day's data, so per interval we know how much
  // top-rate import is still to come today (capped at deliverable power) - during cheaper
  // dischargeable periods the battery keeps that much in reserve and only spends the surplus.
  const RATE_EPS = 1e-6
  const dayMaxRate = new Array<number>(sorted.length)
  const topDemandAfter = new Array<number>(sorted.length)
  for (let start = 0; start < sorted.length; ) {
    let end = start
    while (end < sorted.length && sorted[end].dateStr === sorted[start].dateStr) end++
    let maxRate = 0
    for (let i = start; i < end; i++) maxRate = Math.max(maxRate, rates[i].ratePerKwh)
    let demand = 0
    for (let i = end - 1; i >= start; i--) {
      topDemandAfter[i] = demand
      dayMaxRate[i] = maxRate
      if (rates[i].ratePerKwh >= maxRate - RATE_EPS) demand += Math.min(sorted[i].gridImport, maxDischargePerInterval)
    }
    start = end
  }

  let soc = floorSoc

  const modified: Interval[] = []
  const dailySocSamples = new Map<string, number[]>()
  const dailyCharged = new Map<string, number>()
  const dailyMaxSoc = new Map<string, { maxBefore4pm: number; minAfter: number }>()
  const curtailmentBySlot = Array(48).fill(0)
  const curtailmentCountBySlot = Array(48).fill(0)

  let totalKwhCharged = 0
  let totalCurtailedKwh = 0
  let totalCurtailmentCapturedKwh = 0
  let totalArbitrageChargedKwh = 0
  let eveningLoadSum = 0
  let eveningLoadCount = 0

  for (let idx = 0; idx < sorted.length; idx++) {
    const interval = sorted[idx]
    const rate = rates[idx]
    let gridImport = interval.gridImport
    let gridExport = interval.gridExport
    let chargedThisInterval = 0

    // Step 1: grid arbitrage charging
    if (usesArbitrage(quote.chargePriority) && slotInWindow(quote.arbitrageStartTime, quote.arbitrageEndTime, interval.slot)) {
      const headroom = (effectiveCapacity * quote.arbitrageTargetPercent) / 100 - soc
      if (headroom > 0) {
        const charge = Math.min(headroom / quote.roundTripEfficiency, maxChargePerInterval)
        soc += charge * quote.roundTripEfficiency
        gridImport += charge
        totalArbitrageChargedKwh += charge
        chargedThisInterval += charge
      }
    }
    // Legacy off-peak charging (by tariff period name) for the 'solar_then_offpeak' strategy.
    if (usesOffPeak(quote.chargePriority) && isOffPeakPeriod(rate.periodName)) {
      const headroom = effectiveCapacity - soc
      if (headroom > 0) {
        const charge = Math.min(headroom / quote.roundTripEfficiency, maxChargePerInterval)
        soc += charge * quote.roundTripEfficiency
        gridImport += charge
        chargedThisInterval += charge
      }
    }

    // Step 2: curtailment capture (needs inverter data + an export limit configured)
    if (captureCurtailment && quote.exportLimitKw !== null) {
      const potentialExport = interval.solarGen - interval.homeLoad
      const maxExport = quote.exportLimitKw * 0.5
      const curtailed = Math.max(0, potentialExport - maxExport)
      if (curtailed > 0) {
        totalCurtailedKwh += curtailed
        curtailmentBySlot[interval.slot] += curtailed
        curtailmentCountBySlot[interval.slot] += 1

        const headroom = effectiveCapacity - soc
        const charge = Math.min(curtailed, maxChargePerInterval, headroom / quote.roundTripEfficiency)
        if (charge > 0) {
          soc += charge * quote.roundTripEfficiency
          totalCurtailmentCapturedKwh += charge
          chargedThisInterval += charge
        }
      }
    }

    // Step 3: solar surplus charging
    if (gridExport > 0 && usesSolar(quote.chargePriority)) {
      const headroom = effectiveCapacity - soc
      const charge = Math.min(gridExport, maxChargePerInterval, headroom / quote.roundTripEfficiency)
      if (charge > 0) {
        soc += charge * quote.roundTripEfficiency
        gridExport -= charge
        totalKwhCharged += charge
        chargedThisInterval += charge
      }
    }

    // Step 4: peak discharge. In peak_only mode, cheaper-but-dischargeable periods (shoulder)
    // only get the surplus above what today's remaining top-rate imports will need.
    if (gridImport > 0) {
      const shouldDischarge = quote.dischargePriority === 'any_import' || (quote.dischargePriority === 'peak_only' && isDischargeableWindow(rate.periodName))
      if (shouldDischarge) {
        const isTopRate = rate.ratePerKwh >= dayMaxRate[idx] - RATE_EPS
        const holdForPeak = quote.dischargePriority === 'peak_only' && !isTopRate ? topDemandAfter[idx] : 0
        const available = Math.max(0, soc - floorSoc - holdForPeak)
        const discharge = Math.min(gridImport, available, maxDischargePerInterval)
        if (discharge > 0) {
          soc -= discharge
          gridImport -= discharge
        }
      }
    }

    modified.push({ ...interval, gridImport, gridExport, netLoad: gridImport - gridExport, homeLoad: gridImport + interval.solarGen - gridExport })

    const daySamples = dailySocSamples.get(interval.dateStr) ?? []
    daySamples.push(soc)
    dailySocSamples.set(interval.dateStr, daySamples)
    dailyCharged.set(interval.dateStr, (dailyCharged.get(interval.dateStr) ?? 0) + chargedThisInterval)

    const dayStats = dailyMaxSoc.get(interval.dateStr) ?? { maxBefore4pm: 0, minAfter: effectiveCapacity }
    if (interval.hour < 16) dayStats.maxBefore4pm = Math.max(dayStats.maxBefore4pm, soc)
    if (interval.hour >= 22 || interval.hour < 6) dayStats.minAfter = Math.min(dayStats.minAfter, soc)
    dailyMaxSoc.set(interval.dateStr, dayStats)

    if (interval.slot >= 36 && interval.slot < 44) {
      eveningLoadSum += interval.gridImport
      eveningLoadCount += 1
    }
  }

  const baseline = calculateCost(sorted, plan)
  const withBattery = calculateCost(modified, plan)

  // Measured saving per calendar month of uploaded data. Fixed charges are identical in both
  // runs, so the per-month net-cost delta is purely the battery's doing.
  const withBatteryByMonth = new Map(withBattery.byMonth.map((m) => [m.month, m.costAud]))
  const daysByMonth = new Map<string, Set<string>>()
  for (const i of sorted) {
    const key = i.dateStr.slice(0, 7)
    const set = daysByMonth.get(key) ?? new Set()
    set.add(i.dateStr)
    daysByMonth.set(key, set)
  }
  const monthlySavings = baseline.byMonth.map((m) => ({
    month: m.month,
    savingsAud: m.costAud - (withBatteryByMonth.get(m.month) ?? m.costAud),
    days: daysByMonth.get(m.month)?.size ?? 0,
  }))

  const totalDays = new Set(sorted.map((i) => i.dateStr)).size
  const factor = annualizeFactor(totalDays)

  const totalGridImportBase = sorted.reduce((a, i) => a + i.gridImport, 0)
  const totalGridImportBattery = modified.reduce((a, i) => a + i.gridImport, 0)
  const totalGridExportBase = sorted.reduce((a, i) => a + i.gridExport, 0)
  const totalGridExportBattery = modified.reduce((a, i) => a + i.gridExport, 0)
  const totalSolarGen = sorted.reduce((a, i) => a + i.solarGen, 0)

  const selfConsumptionRate =
    totalSolarGen > 0
      ? (totalSolarGen - totalGridExportBattery) / totalSolarGen
      : totalGridExportBase > 0
        ? 1 - totalGridExportBattery / totalGridExportBase
        : 0

  // Daily cycle depth = kWh charged that day (from all sources) / effective capacity.
  // Derived from consecutive-day SoC deltas plus a floor at 0 (SoC also drops from discharge/idle).
  const dailyDateKeys = Array.from(dailySocSamples.keys()).sort()
  const dailySoc = dailyDateKeys.map((date) => {
    const samples = dailySocSamples.get(date)!
    return { date, avgSocKwh: samples.reduce((a, s) => a + s, 0) / samples.length, cyclesFraction: 0 }
  })

  const totalChargedAllSources = totalKwhCharged + totalCurtailmentCapturedKwh + totalArbitrageChargedKwh
  dailySoc.forEach((d) => {
    const chargedThatDay = dailyCharged.get(d.date) ?? 0
    d.cyclesFraction = effectiveCapacity > 0 ? chargedThatDay / effectiveCapacity : 0
  })
  const dailyCycleDepths = dailySoc.map((d) => d.cyclesFraction)

  const daysFull = Array.from(dailyMaxSoc.values()).filter((d) => d.maxBefore4pm >= effectiveCapacity * 0.99).length
  const daysEmpty = Array.from(dailyMaxSoc.values()).filter((d) => d.minAfter <= floorSoc * 1.05).length
  const daysUnderMinDischarge = dailyCycleDepths.filter((d) => d * 100 < quote.targetMinDischargePct).length
  const daysOverMaxDischarge = dailyCycleDepths.filter((d) => d * 100 > quote.targetMaxDischargePct).length
  const avgDailyCycles = dailyCycleDepths.length > 0 ? dailyCycleDepths.reduce((a, d) => a + d, 0) / dailyCycleDepths.length : 0
  const totalEquivCycles = totalChargedAllSources / (effectiveCapacity || 1)
  const annualEquivCycles = avgDailyCycles * 365

  const annualSavingsAud = (baseline.totalCostAud - withBattery.totalCostAud) * factor
  // VPP: a selected program supplies the annual credit (fixed + export credits - import
  // charges) and an upfront rebate that reduces the cost the battery has to pay back.
  // Quotes from older versions without a program fall back to their inline legacy fields.
  const vppCreditAud = vpp
    ? vppNetAnnualAud(vpp)
    : quote.vppEnrolled
      ? quote.vppAnnualCreditAud + (quote.vppEventRatePerKwh ?? 0) * (quote.vppEventKwhPerYear ?? 0)
      : 0
  const vppRebateAud = vpp?.upfrontRebateAud ?? 0
  const effectiveCostAud = Math.max(0, quote.totalCostAud - vppRebateAud)
  const totalAnnualBenefit = annualSavingsAud + vppCreditAud
  const simplePaybackYears = totalAnnualBenefit > 0 ? effectiveCostAud / totalAnnualBenefit : Number.POSITIVE_INFINITY

  const annualKwhCycled = annualEquivCycles * effectiveCapacity
  const yearsTillThroughputExpiry = quote.warrantyThroughputMwh
    ? (quote.warrantyThroughputMwh * 1000) / (annualKwhCycled || 1)
    : null
  const yearsTillYearWarrantyExpiry = quote.warrantyYears
  const effectiveWarrantyYears = yearsTillThroughputExpiry
    ? Math.min(quote.warrantyYears, yearsTillThroughputExpiry)
    : quote.warrantyYears

  let lifetimeKwhStoredAtWarranty = 0
  for (let y = 1; y <= Math.max(1, Math.round(effectiveWarrantyYears)); y++) {
    const capAtYear = quote.capacityKwh * (1 - (quote.totalDegradationPercent / 100) * (y / quote.lifetimeYears))
    lifetimeKwhStoredAtWarranty += annualEquivCycles * capAtYear
  }
  const costPerKwhStored = lifetimeKwhStoredAtWarranty > 0 ? quote.totalCostAud / lifetimeKwhStoredAtWarranty : 0

  let lifetimeSavingsAud = 0
  for (let y = 1; y <= quote.lifetimeYears; y++) {
    const degradedSavings = annualSavingsAud * (1 - (quote.totalDegradationPercent / 100) * (y / quote.lifetimeYears))
    lifetimeSavingsAud += degradedSavings + vppCreditAud
  }

  const avgEveningKw = eveningLoadCount > 0 ? (eveningLoadSum / eveningLoadCount) * 2 : 0
  const reserveKwh = (effectiveCapacity * quote.reservePercent) / 100
  const estimatedBackupHoursAvg = avgEveningKw > 0 ? reserveKwh / avgEveningKw : 0
  const estimatedBackupHoursMax = avgEveningKw > 0 ? effectiveCapacity / avgEveningKw : 0

  let peakCurtailmentSlot = 0
  let peakCurtailmentAvg = 0
  curtailmentBySlot.forEach((sum, slot) => {
    const avg = curtailmentCountBySlot[slot] > 0 ? sum / curtailmentCountBySlot[slot] : 0
    if (avg > peakCurtailmentAvg) {
      peakCurtailmentAvg = avg
      peakCurtailmentSlot = slot
    }
  })

  // Arbitrage value: kWh charged during the arbitrage window valued at the spread between the
  // plan's peak-period rate and the arbitrage-window rate (a proxy - the simulator doesn't track
  // provenance of stored energy through to discharge).
  const peakRates = sorted.map((_, i) => i).filter((i) => rates[i].ratePerKwh >= dayMaxRate[i] - RATE_EPS).map((i) => rates[i].ratePerKwh)
  const arbitrageRates = sorted
    .map((_, i) => i)
    .filter((i) => slotInWindow(quote.arbitrageStartTime, quote.arbitrageEndTime, sorted[i].slot))
    .map((i) => rates[i].ratePerKwh)
  const avgPeakRate = peakRates.length > 0 ? peakRates.reduce((a, r) => a + r, 0) / peakRates.length : 0
  const avgArbitrageRate = arbitrageRates.length > 0 ? arbitrageRates.reduce((a, r) => a + r, 0) / arbitrageRates.length : 0
  const arbitrageAnnualValueAud = totalArbitrageChargedKwh * factor * Math.max(0, avgPeakRate - avgArbitrageRate)

  return {
    quoteId: quote.id,
    tariffId: plan.id,
    annualSavingsAud,
    annualGridImportKwh: totalGridImportBattery * factor,
    annualGridImportKwhBase: totalGridImportBase * factor,
    annualSolarExportKwh: totalGridExportBattery * factor,
    annualSolarExportKwhBase: totalGridExportBase * factor,
    selfConsumptionRate,
    simplePaybackYears,
    lifetimeSavingsAud,
    costPerKwhStored,
    vppCreditAud,
    totalEquivCycles,
    annualEquivCycles,
    avgDailyCycles,
    dailyCycleDepths,
    yearsTillThroughputExpiry,
    yearsTillYearWarrantyExpiry,
    effectiveWarrantyYears,
    lifetimeKwhStoredAtWarranty,
    daysFull,
    daysEmpty,
    avgDailyCycleDepthPercent: avgDailyCycles * 100,
    daysUnderMinDischarge,
    daysOverMaxDischarge,
    estimatedCurtailmentKwhAnnual: totalCurtailedKwh * factor,
    curtailmentCaptureKwhAnnual: totalCurtailmentCapturedKwh * factor,
    curtailmentCapturePercent: totalCurtailedKwh > 0 ? (totalCurtailmentCapturedKwh / totalCurtailedKwh) * 100 : 0,
    peakCurtailmentSlot,
    dailySoc,
    monthlySavings,
    arbitrageAnnualValueAud,
    vppRebateAud,
    estimatedBackupHoursAvg,
    estimatedBackupHoursMax,
    importCostSavedAud: (baseline.importCostAud - withBattery.importCostAud) * factor,
    exportCreditLostAud: (baseline.exportCreditAud - withBattery.exportCreditAud) * factor,
    fixedChargesAud: withBattery.fixedChargesAud * factor,
  }
}

export function getSizingAdvice(result: BatterySimResult, totalDays: number): string[] {
  const advice: string[] = []
  if (totalDays === 0) return advice

  if (result.daysFull / totalDays > 0.3) {
    advice.push('Battery is likely too small for your solar output - it fills up most days before the evening peak.')
  }
  if (result.daysEmpty / totalDays > 0.2) {
    advice.push('Consider a larger battery - it runs out before your overnight/evening off-peak window on many days.')
  }
  if (result.avgDailyCycleDepthPercent < 30) {
    advice.push('Battery may be oversized for your usage - it cycles through less than a third of its capacity on an average day.')
  }
  if (result.daysUnderMinDischarge > totalDays * 0.3) {
    advice.push('Battery is under-utilised most days relative to your target discharge range - a smaller battery may suit better.')
  }
  if (result.daysOverMaxDischarge > totalDays * 0.3) {
    advice.push('Battery is being pushed beyond your target discharge range most days - consider a larger capacity.')
  }
  if (advice.length === 0) {
    advice.push('Battery size looks well matched to your usage and solar generation.')
  }
  return advice
}

/**
 * Instant preview of a charge/discharge strategy applied to a single synthetic "average day"
 * (from computeAverageDay). This is the Strategy Planner's fast, approximate preview - not a
 * substitute for simulateBattery(), which runs the full 4-step loop over every real interval.
 */
export function previewStrategyOnAverageDay(
  avgDay: AverageDaySlot[],
  quote: Pick<
    BatteryQuote,
    'capacityKwh' | 'totalDegradationPercent' | 'reservePercent' | 'maxDischargePercent' | 'roundTripEfficiency' | 'maxChargeKw' | 'maxDischargeKw'
  >,
  chargeWindows: ChargeWindow[],
  dischargeStrategy: 'peak_only' | 'any_import' = 'peak_only',
  useSolar = true,
): AverageDaySlot[] {
  const effectiveCapacity = quote.capacityKwh * (1 - (quote.totalDegradationPercent / 100) * 0.5)
  const floorSoc = (effectiveCapacity * Math.max(quote.reservePercent, 100 - quote.maxDischargePercent)) / 100
  const maxChargePerSlot = quote.maxChargeKw * 0.5
  const maxDischargePerSlot = quote.maxDischargeKw * 0.5

  // Same hold-for-peak logic as simulateBattery: at cheaper dischargeable slots, keep enough
  // in reserve to cover the rest of the day's top-rate imports; spend only the surplus.
  const RATE_EPS = 1e-6
  const maxRate = avgDay.reduce((a, s) => Math.max(a, s.tariffRate), 0)
  const topDemandAfter = new Array<number>(avgDay.length).fill(0)
  for (let i = avgDay.length - 2; i >= 0; i--) {
    const next = avgDay[i + 1]
    topDemandAfter[i] =
      topDemandAfter[i + 1] + (next.tariffRate >= maxRate - RATE_EPS ? Math.min(next.avgGridImport, maxDischargePerSlot) : 0)
  }
  const inChargeWindow = (s: number) => chargeWindows.some((w) => slotInWindow(w.fromTime, w.toTime, s))

  let soc = floorSoc

  return avgDay.map((slot, idx) => {
    // Charge windows (grid arbitrage)
    for (const w of chargeWindows) {
      if (slotInWindow(w.fromTime, w.toTime, slot.slot)) {
        const headroom = (effectiveCapacity * w.targetPercent) / 100 - soc
        if (headroom > 0) {
          const charge = Math.min(headroom / quote.roundTripEfficiency, maxChargePerSlot)
          soc += charge * quote.roundTripEfficiency
        }
      }
    }

    // Solar surplus charging
    if (useSolar && slot.avgGridExport > 0) {
      const headroom = effectiveCapacity - soc
      const charge = Math.min(slot.avgGridExport, maxChargePerSlot, headroom / quote.roundTripEfficiency)
      if (charge > 0) soc += charge * quote.roundTripEfficiency
    }

    // Discharge to meet import
    if (slot.avgGridImport > 0) {
      const shouldDischarge = dischargeStrategy === 'any_import' || !inChargeWindow(slot.slot)
      if (shouldDischarge) {
        const isTopRate = slot.tariffRate >= maxRate - RATE_EPS
        const holdForPeak = dischargeStrategy === 'peak_only' && !isTopRate ? topDemandAfter[idx] : 0
        const available = Math.max(0, soc - floorSoc - holdForPeak)
        const discharge = Math.min(slot.avgGridImport, available, maxDischargePerSlot)
        soc -= discharge
      }
    }

    return { ...slot, projectedSoc: soc }
  })
}
