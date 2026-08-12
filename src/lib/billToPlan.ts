import type { AustralianState, RatePeriod, TariffPlan } from '@/types/tariff'
import type { ExtractedBillData } from '@/lib/billFields'

const EVERYDAY = [true, true, true, true, true, true, true]

/**
 * Turns a parsed bill's rate table into a ready-to-use TariffPlan. Windowed rates come
 * first (one RatePeriod per window); rates without a detected window go last as all-day
 * fallbacks, since the calculator picks the first period whose window covers a slot.
 * Days default to all seven - the bills seen so far apply their windows every day.
 */
export function buildPlanFromBill(data: ExtractedBillData, state: AustralianState): TariffPlan {
  const periods: RatePeriod[] = []

  const windowed = data.touRates.filter((r) => r.windows.length > 0)
  const allDay = data.touRates.filter((r) => r.windows.length === 0)

  for (const rate of windowed) {
    for (const w of rate.windows) {
      periods.push({
        id: crypto.randomUUID(),
        name: rate.name,
        startTime: w.startTime,
        endTime: w.endTime,
        ratePerKwh: rate.ratePerKwh,
        gstInclusive: data.ratesGstInclusive,
        days: [...EVERYDAY],
      })
    }
  }
  for (const rate of allDay) {
    periods.push({
      id: crypto.randomUUID(),
      name: rate.name,
      startTime: '00:00',
      endTime: '00:00',
      ratePerKwh: rate.ratePerKwh,
      gstInclusive: data.ratesGstInclusive,
      days: [...EVERYDAY],
    })
  }

  return {
    id: crypto.randomUUID(),
    name: `${data.provider ?? 'Imported'} - from bill${data.periodStart ? ` ${data.periodStart}` : ''}`,
    provider: data.provider ?? '',
    state,
    fixedCharges:
      data.supplyChargeAud != null
        ? [
            {
              id: crypto.randomUUID(),
              label: 'Supply charge',
              amountPerDay: data.supplyChargeAud,
              gstInclusive: data.ratesGstInclusive,
            },
          ]
        : [],
    periods,
    feedInPeriods: [
      {
        id: crypto.randomUUID(),
        name: 'Feed-in',
        startTime: '00:00',
        endTime: '00:00',
        ratePerKwh: data.feedInRatePerKwh ?? 0,
        // FiT is not subject to GST, so never gross it up regardless of how usage rates are quoted.
        gstInclusive: true,
        days: [...EVERYDAY],
      },
    ],
    controlledLoadRate: null,
    controlledLoad2Rate: null,
    publicHolidaysAsWeekends: false,
    notes: 'Created automatically from a PDF bill import - check the rates and time windows before relying on it.',
    isActive: false,
    createdAt: new Date().toISOString(),
  }
}
