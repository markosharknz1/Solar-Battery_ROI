import type { DataSeasonality, DataSummary, Interval } from '@/types/meter'
import type { MeterBucket, SolarDailyTotal } from '@/lib/csvParser'
import type { TariffPlan } from '@/types/tariff'
import type { AverageDaySlot } from '@/types/battery'
import { resolveRate, resolveFeedInRate } from '@/lib/tariffCalculator'

const SLOTS_PER_DAY = 48

function slotToHourMinute(slot: number): { hour: number; minute: 0 | 30 } {
  const totalMinutes = slot * 30
  return { hour: Math.floor(totalMinutes / 60), minute: (totalMinutes % 60 === 0 ? 0 : 30) as 0 | 30 }
}

function mondayFirstWeekday(date: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  // JS getDay(): 0=Sun..6=Sat. Convert to 0=Mon..6=Sun.
  return (((date.getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
}

/** Default solar generation shape used to spread a daily total across slots when no export profile exists. */
function defaultSolarWeight(slot: number): number {
  const { hour } = slotToHourMinute(slot)
  if (hour < 6 || hour >= 18) return 0
  return Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12))
}

export function buildIntervals(
  meterBuckets: MeterBucket[],
  solarDailyTotals: SolarDailyTotal[] = [],
): Interval[] {
  // Group meter buckets by day to compute per-day export totals (used to distribute solar).
  const exportTotalsByDay = new Map<string, number>()
  for (const b of meterBuckets) {
    exportTotalsByDay.set(b.dateStr, (exportTotalsByDay.get(b.dateStr) ?? 0) + b.gridExport)
  }

  const solarByDay = new Map<string, number>()
  for (const s of solarDailyTotals) {
    solarByDay.set(s.dateStr, (solarByDay.get(s.dateStr) ?? 0) + s.solarGenKwh)
  }

  // Ensure every day that has solar data also has all 48 slots represented, even if the
  // meter CSV had no rows for a slot (e.g. missing reads).
  const daysNeeded = new Set<string>([...exportTotalsByDay.keys(), ...solarByDay.keys()])
  const bucketIndex = new Map<string, MeterBucket>()
  for (const b of meterBuckets) bucketIndex.set(`${b.dateStr}|${b.slot}`, b)

  const intervals: Interval[] = []

  for (const dateStr of daysNeeded) {
    const dayTotalExport = exportTotalsByDay.get(dateStr) ?? 0
    const dayTotalSolar = solarByDay.get(dateStr) ?? 0

    // Precompute weights for distributing this day's solar total across its 48 slots.
    let weights: number[] = []
    if (dayTotalSolar > 0) {
      if (dayTotalExport > 0) {
        weights = Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
          const b = bucketIndex.get(`${dateStr}|${slot}`)
          return (b?.gridExport ?? 0) / dayTotalExport
        })
      } else {
        const raw = Array.from({ length: SLOTS_PER_DAY }, (_, slot) => defaultSolarWeight(slot))
        const sum = raw.reduce((a, c) => a + c, 0) || 1
        weights = raw.map((w) => w / sum)
      }
    }

    for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
      const bucket = bucketIndex.get(`${dateStr}|${slot}`)
      const gridImport = bucket?.gridImport ?? 0
      const gridExport = bucket?.gridExport ?? 0
      const cl1Import = bucket?.cl1Import ?? 0
      const cl2Import = bucket?.cl2Import ?? 0
      const solarGen = dayTotalSolar > 0 ? dayTotalSolar * (weights[slot] ?? 0) : 0

      if (gridImport === 0 && gridExport === 0 && cl1Import === 0 && cl2Import === 0 && solarGen === 0 && !bucket)
        continue

      const [y, m, d] = dateStr.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      const { hour, minute } = slotToHourMinute(slot)

      intervals.push({
        date,
        dateStr,
        slot,
        hour,
        minute,
        weekday: mondayFirstWeekday(date),
        gridImport,
        gridExport,
        cl1Import,
        cl2Import,
        solarGen,
        homeLoad: gridImport + solarGen - gridExport,
        netLoad: gridImport - gridExport,
      })
    }
  }

  intervals.sort((a, b) => (a.dateStr === b.dateStr ? a.slot - b.slot : a.dateStr.localeCompare(b.dateStr)))
  return intervals
}

/** full_year = >=10 distinct months represented; summer_heavy/winter_heavy = >60% of days fall in that half; else partial. */
export function computeSeasonality(intervals: Interval[]): DataSeasonality {
  const days = new Set(intervals.map((i) => i.dateStr))
  const monthsSeen = new Set<number>()
  let summerDays = 0
  let winterDays = 0

  for (const dateStr of days) {
    const month = Number(dateStr.slice(5, 7)) // 1-12
    monthsSeen.add(month)
    // AU summer = Oct-Mar (10,11,12,1,2,3), winter = Apr-Sep (4-9)
    if (month >= 10 || month <= 3) summerDays++
    else winterDays++
  }

  if (monthsSeen.size >= 10) return 'full_year'
  const total = days.size || 1
  if (summerDays / total > 0.6) return 'summer_heavy'
  if (winterDays / total > 0.6) return 'winter_heavy'
  return 'partial'
}

/**
 * Overnight (slots 44-47 = 10pm-midnight, plus 0-11 = midnight-6am) vs daytime (slots 12-35 = 6am-6pm)
 * average usage ratio. A ratio > 2.0 suggests a large controlled load (EV, hot water, aircon) running overnight.
 */
export function detectOvernightLoadPattern(intervals: Interval[]): {
  overnightAvgKwh: number // avg per 30-min slot in the overnight window - for the significance ratio
  avgNightlyKwh: number // avg TOTAL kWh per night (10pm-6am summed) - for display
  middayAvgKwh: number
  overnightToMiddayRatio: number
  isSignificant: boolean
} {
  let overnightSum = 0
  let overnightCount = 0
  let middaySum = 0
  let middayCount = 0
  // Group by "night": the evening half (slots 44-47, same date) and the following
  // morning half (slots 0-11, next date) belong to the same night.
  const nightlyTotals = new Map<string, number>()

  for (const i of intervals) {
    const isEveningHalf = i.slot >= 44
    const isMorningHalf = i.slot <= 11
    const isMidday = i.slot >= 12 && i.slot <= 35
    const overnightKwh = i.gridImport + i.cl1Import + i.cl2Import

    if (isEveningHalf || isMorningHalf) {
      overnightSum += overnightKwh
      overnightCount++

      let nightKey = i.dateStr
      if (isMorningHalf) {
        const prevDate = new Date(i.date)
        prevDate.setDate(prevDate.getDate() - 1)
        nightKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`
      }
      nightlyTotals.set(nightKey, (nightlyTotals.get(nightKey) ?? 0) + overnightKwh)
    } else if (isMidday) {
      middaySum += overnightKwh
      middayCount++
    }
  }

  const overnightAvgKwh = overnightCount > 0 ? overnightSum / overnightCount : 0
  const nights = Array.from(nightlyTotals.values())
  const avgNightlyKwh = nights.length > 0 ? nights.reduce((a, v) => a + v, 0) / nights.length : 0
  const middayAvgKwh = middayCount > 0 ? middaySum / middayCount : 0
  const ratio = middayAvgKwh > 0 ? overnightAvgKwh / middayAvgKwh : overnightAvgKwh > 0 ? Number.POSITIVE_INFINITY : 0

  return {
    overnightAvgKwh,
    avgNightlyKwh,
    middayAvgKwh,
    overnightToMiddayRatio: ratio,
    isSignificant: ratio > 2.0,
  }
}

export function summarizeIntervals(intervals: Interval[]): DataSummary | null {
  if (intervals.length === 0) return null

  let totalGridImport = 0
  let totalGridExport = 0
  let totalCl1Import = 0
  let totalSolarGen = 0
  let hasSolarExport = false
  let hasInverterData = false
  let hasCl1Data = false

  for (const i of intervals) {
    totalGridImport += i.gridImport
    totalGridExport += i.gridExport
    totalCl1Import += i.cl1Import
    totalSolarGen += i.solarGen
    if (i.gridExport > 0) hasSolarExport = true
    if (i.solarGen > 0) hasInverterData = true
    if (i.cl1Import > 0) hasCl1Data = true
  }

  const start = intervals[0].date
  const end = intervals[intervals.length - 1].date
  const totalDays = new Set(intervals.map((i) => i.dateStr)).size

  return {
    dateRange: { start, end },
    totalDays,
    totalGridImport,
    totalGridExport,
    totalCl1Import,
    totalSolarGen,
    hasSolarExport,
    hasInverterData,
    hasCl1Data,
    dataSeasonality: computeSeasonality(intervals),
  }
}

/**
 * Builds a flat-estimate Interval[] from a single manually-entered bill (daily-bill fallback mode).
 * Spreads total usage evenly across every 30-min slot for every day in the period -- sufficient for
 * budget tracking and flat-rate plan comparison, but not for time-of-use comparison or battery simulation.
 */
export function buildFlatEstimateIntervals(
  periodStart: string,
  periodEnd: string,
  totalUsageKwh: number,
): Interval[] {
  const [sy, sm, sd] = periodStart.split('-').map(Number)
  const [ey, em, ed] = periodEnd.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)

  const days: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push(dateStr)
  }
  if (days.length === 0) return []

  const perSlotKwh = totalUsageKwh / (days.length * SLOTS_PER_DAY)
  const intervals: Interval[] = []

  for (const dateStr of days) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
      const { hour, minute } = slotToHourMinute(slot)
      intervals.push({
        date,
        dateStr,
        slot,
        hour,
        minute,
        weekday: mondayFirstWeekday(date),
        gridImport: perSlotKwh,
        gridExport: 0,
        cl1Import: 0,
        cl2Import: 0,
        solarGen: 0,
        homeLoad: perSlotKwh,
        netLoad: perSlotKwh,
      })
    }
  }

  return intervals
}

/**
 * Averages real intervals into a single synthetic 48-slot "typical day", used by the
 * Strategy Planner's instant preview. Rate resolution uses a representative weekday
 * (Monday for all/weekday, Saturday for weekend) since this is a single averaged day,
 * not tied to any specific calendar date - the full battery simulator resolves rates
 * per real interval and is the source of truth for an actual simulation.
 */
export function computeAverageDay(
  intervals: Interval[],
  plan: TariffPlan,
  filter: 'all' | 'weekday' | 'weekend' = 'all',
): AverageDaySlot[] {
  const filtered = intervals.filter((i) => {
    if (filter === 'weekday') return i.weekday < 5
    if (filter === 'weekend') return i.weekday >= 5
    return true
  })

  const sums = Array.from({ length: SLOTS_PER_DAY }, () => ({ gridImport: 0, gridExport: 0, solarGen: 0, homeLoad: 0, count: 0 }))
  for (const i of filtered) {
    const s = sums[i.slot]
    s.gridImport += i.gridImport
    s.gridExport += i.gridExport
    s.solarGen += i.solarGen
    s.homeLoad += i.homeLoad
    s.count++
  }

  const representativeWeekday = filter === 'weekend' ? 5 : 0
  const referenceDate = new Date(2024, 0, 1 + representativeWeekday) // a Monday-based reference week

  return Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
    const s = sums[slot]
    const { hour, minute } = slotToHourMinute(slot)
    const syntheticInterval: Interval = {
      date: referenceDate,
      dateStr: '2024-01-01',
      slot,
      hour,
      minute,
      weekday: representativeWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      gridImport: 0,
      gridExport: 0,
      cl1Import: 0,
      cl2Import: 0,
      solarGen: 0,
      homeLoad: 0,
      netLoad: 0,
    }

    return {
      slot,
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      avgGridImport: s.count > 0 ? s.gridImport / s.count : 0,
      avgGridExport: s.count > 0 ? s.gridExport / s.count : 0,
      avgSolarGen: s.count > 0 ? s.solarGen / s.count : 0,
      avgHomeLoad: s.count > 0 ? s.homeLoad / s.count : 0,
      tariffRate: resolveRate(plan, syntheticInterval).ratePerKwh,
      fitRate: resolveFeedInRate(plan, syntheticInterval).ratePerKwh,
      projectedSoc: 0,
    }
  })
}
