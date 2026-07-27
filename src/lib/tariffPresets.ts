import type { AustralianState, RatePeriod, TariffPlan } from '@/types/tariff'

const WEEKDAYS = [true, true, true, true, true, false, false]
const WEEKENDS = [false, false, false, false, false, true, true]
const EVERYDAY = [true, true, true, true, true, true, true]

function period(name: string, startTime: string, endTime: string, ratePerKwh: number, days: boolean[]): RatePeriod {
  return { id: crypto.randomUUID(), name, startTime, endTime, ratePerKwh, days }
}

function flatFeedIn(rate: number): RatePeriod[] {
  return [period('Standard FiT', '00:00', '00:00', rate, EVERYDAY)]
}

function supplyCharge(amountPerDay: number) {
  return [{ id: crypto.randomUUID(), label: 'Supply charge', amountPerDay, gstInclusive: true }]
}

export interface TariffPresetTemplate {
  id: string
  name: string
  build: () => Omit<TariffPlan, 'id' | 'createdAt' | 'isActive'>
}

function base(
  name: string,
  provider: string,
  state: AustralianState,
  dailySupplyCharge: number,
  feedInRate: number,
  periods: RatePeriod[],
  notes: string,
  publicHolidaysAsWeekends = false,
): Omit<TariffPlan, 'id' | 'createdAt' | 'isActive'> {
  return {
    name,
    provider,
    state,
    fixedCharges: supplyCharge(dailySupplyCharge),
    periods,
    feedInPeriods: flatFeedIn(feedInRate),
    controlledLoadRate: null,
    controlledLoad2Rate: null,
    publicHolidaysAsWeekends,
    notes,
  }
}

export const TARIFF_PRESETS: TariffPresetTemplate[] = [
  {
    id: 'sa-flat',
    name: 'SA - Flat rate',
    build: () => base('SA - Flat rate', '', 'SA', 0.95, 0.06, [period('Flat rate', '00:00', '00:00', 0.305, EVERYDAY)], ''),
  },
  {
    id: 'sa-tou',
    name: 'SA - Time of Use with cheap overnight',
    build: () =>
      base(
        'SA - Time of Use with cheap overnight',
        '',
        'SA',
        0.95,
        0.06,
        [
          period('Peak', '07:00', '23:00', 0.385, WEEKDAYS),
          period('Off-peak', '23:00', '07:00', 0.08, EVERYDAY),
        ],
        'SAPN Residential ToU style plan.',
        true,
      ),
  },
  {
    id: 'sa-agl-savers',
    name: 'SA - AGL Savers',
    build: () =>
      base(
        'SA - AGL Savers',
        'AGL',
        'SA',
        0.95,
        0.05,
        [
          period('Free solar sponge', '10:00', '15:00', 0, WEEKENDS),
          period('Peak', '07:00', '23:00', 0.42, WEEKDAYS),
          period('Off-peak', '23:00', '07:00', 0.21, EVERYDAY),
          period('Weekend standard', '00:00', '10:00', 0.21, WEEKENDS),
          period('Weekend evening', '15:00', '23:59', 0.21, WEEKENDS),
        ],
        'Off-peak solar sponge window on weekends.',
      ),
  },
  {
    id: 'vic-flat',
    name: 'VIC - Flat rate',
    build: () => base('VIC - Flat rate', '', 'VIC', 0.88, 0.033, [period('Flat rate', '00:00', '00:00', 0.31, EVERYDAY)], ''),
  },
  {
    id: 'vic-tou',
    name: 'VIC - Time of Use',
    build: () =>
      base(
        'VIC - Time of Use',
        '',
        'VIC',
        0.88,
        0.033,
        [
          period('Peak', '15:00', '21:00', 0.39, WEEKDAYS),
          period('Shoulder', '07:00', '15:00', 0.25, WEEKDAYS),
          period('Shoulder evening', '21:00', '23:00', 0.25, WEEKDAYS),
          period('Off-peak', '23:00', '07:00', 0.18, EVERYDAY),
          period('Weekend', '07:00', '23:00', 0.22, WEEKENDS),
        ],
        '',
      ),
  },
  {
    id: 'nsw-flat',
    name: 'NSW - Flat rate',
    build: () => base('NSW - Flat rate', '', 'NSW', 0.85, 0.05, [period('Flat rate', '00:00', '00:00', 0.33, EVERYDAY)], ''),
  },
  {
    id: 'nsw-ausgrid-tou',
    name: 'NSW - Ausgrid ToU',
    build: () =>
      base(
        'NSW - Ausgrid ToU',
        'Ausgrid',
        'NSW',
        0.85,
        0.05,
        [
          period('Peak', '15:00', '21:00', 0.45, EVERYDAY),
          period('Shoulder', '07:00', '15:00', 0.26, EVERYDAY),
          period('Shoulder evening', '21:00', '22:00', 0.26, EVERYDAY),
          period('Off-peak', '22:00', '07:00', 0.16, EVERYDAY),
        ],
        '',
      ),
  },
  {
    id: 'qld-flat',
    name: 'QLD - Flat rate',
    build: () => base('QLD - Flat rate', '', 'QLD', 0.83, 0.052, [period('Flat rate', '00:00', '00:00', 0.28, EVERYDAY)], ''),
  },
]
