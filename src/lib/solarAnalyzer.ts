import type { Interval } from '@/types/meter'
import type { TariffPlan } from '@/types/tariff'
import { resolveRate } from '@/lib/tariffCalculator'

export interface SolarAnalysis {
  totalGridExportKwh: number
  avgDailyExportKwh: number
  peakExportSlot: number
  exportProfile: number[] // [48] avg kWh per slot
  totalSolarGenKwh: number
  selfConsumptionRate: number
  solarFractionOfLoad: number
  avgDailyExportPeak: number
  batteryOpportunityKwh: number
}

function isPeakLike(name: string): boolean {
  const lower = name.toLowerCase()
  return !lower.includes('off') && !lower.includes('free') && !lower.includes('sponge')
}

/** Fallback when no tariff plan is supplied: treat the common 5pm-9pm window as "peak". */
function isDefaultPeakSlot(slot: number): boolean {
  const hour = Math.floor((slot * 30) / 60)
  return hour >= 17 && hour < 21
}

export function analyzeSolar(intervals: Interval[], activePlan?: TariffPlan): SolarAnalysis {
  const totalDays = new Set(intervals.map((i) => i.dateStr)).size || 1

  const exportSumBySlot = Array(48).fill(0)
  const exportCountBySlot = Array(48).fill(0)
  let totalGridExportKwh = 0
  let totalSolarGenKwh = 0
  let totalHomeLoad = 0
  let peakExportKwh = 0

  for (const i of intervals) {
    exportSumBySlot[i.slot] += i.gridExport
    exportCountBySlot[i.slot] += 1
    totalGridExportKwh += i.gridExport
    totalSolarGenKwh += i.solarGen
    totalHomeLoad += i.homeLoad

    const isPeak = activePlan ? isPeakLike(resolveRate(activePlan, i).periodName) : isDefaultPeakSlot(i.slot)
    if (isPeak) peakExportKwh += i.gridExport
  }

  const exportProfile = exportSumBySlot.map((sum, slot) => (exportCountBySlot[slot] > 0 ? sum / exportCountBySlot[slot] : 0))
  let peakExportSlot = 0
  exportProfile.forEach((v, slot) => {
    if (v > exportProfile[peakExportSlot]) peakExportSlot = slot
  })

  const hasInverterData = totalSolarGenKwh > 0

  return {
    totalGridExportKwh,
    avgDailyExportKwh: totalGridExportKwh / totalDays,
    peakExportSlot,
    exportProfile,
    totalSolarGenKwh,
    selfConsumptionRate: hasInverterData ? (totalSolarGenKwh - totalGridExportKwh) / totalSolarGenKwh : 0,
    solarFractionOfLoad: hasInverterData && totalHomeLoad > 0 ? totalSolarGenKwh / totalHomeLoad : 0,
    avgDailyExportPeak: peakExportKwh / totalDays,
    batteryOpportunityKwh: peakExportKwh / totalDays,
  }
}

export interface CurtailmentAnalysis {
  totalGeneratedKwh: number
  totalSelfConsumedKwh: number
  totalExportedKwh: number
  totalCurtailedKwh: number
  daily: Array<{ dateStr: string; selfConsumed: number; exported: number; curtailed: number }>
}

/** Needs inverter (solarGen) data - curtailment (clipped generation) only shows up when comparing
 * generation against what the network export limit would actually allow through. */
export function analyzeCurtailment(intervals: Interval[], exportLimitKw: number): CurtailmentAnalysis {
  const dailyMap = new Map<string, { selfConsumed: number; exported: number; curtailed: number }>()
  let totalGeneratedKwh = 0
  let totalSelfConsumedKwh = 0
  let totalExportedKwh = 0
  let totalCurtailedKwh = 0
  const maxExport = exportLimitKw * 0.5

  for (const i of intervals) {
    if (i.solarGen <= 0) continue
    const homeLoad = i.gridImport + i.solarGen - i.gridExport
    const potentialExport = i.solarGen - homeLoad
    const curtailed = Math.max(0, potentialExport - maxExport)
    const selfConsumed = Math.min(i.solarGen, homeLoad)

    totalGeneratedKwh += i.solarGen
    totalSelfConsumedKwh += selfConsumed
    totalExportedKwh += i.gridExport
    totalCurtailedKwh += curtailed

    const entry = dailyMap.get(i.dateStr) ?? { selfConsumed: 0, exported: 0, curtailed: 0 }
    entry.selfConsumed += selfConsumed
    entry.exported += i.gridExport
    entry.curtailed += curtailed
    dailyMap.set(i.dateStr, entry)
  }

  const daily = Array.from(dailyMap.entries())
    .map(([dateStr, v]) => ({ dateStr, ...v }))
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr))

  return { totalGeneratedKwh, totalSelfConsumedKwh, totalExportedKwh, totalCurtailedKwh, daily }
}
