export type AustralianState = 'SA' | 'VIC' | 'NSW' | 'QLD' | 'WA' | 'TAS' | 'ACT' | 'NT'

/** One 30-minute interval row from the smart meter CSV */
export interface IntervalRow {
  type: 'Usage' | 'Solar' | 'CL1' | 'CL2'
  date: Date
  slot: number // 0-47 (30-min slot index in the day)
  kWh: number
}

/** Derived from IntervalRow pairs for the same date+slot */
export interface Interval {
  date: Date
  dateStr: string // YYYY-MM-DD key
  slot: number
  hour: number // 0-23
  minute: 0 | 30
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Mon ... 6=Sun
  gridImport: number // kWh
  gridExport: number // kWh (solar surplus to grid)
  cl1Import: number // kWh - controlled load 1 (e.g. hot water), 0 if absent
  cl2Import: number // kWh - controlled load 2, 0 if absent
  solarGen: number // kWh (from inverter CSV if available, else 0)
  homeLoad: number // gridImport + solarGen - gridExport (needs solarGen)
  netLoad: number // gridImport - gridExport
}

export type DataSeasonality = 'full_year' | 'summer_heavy' | 'winter_heavy' | 'partial'

export interface DataSummary {
  dateRange: { start: Date; end: Date }
  totalDays: number
  totalGridImport: number
  totalGridExport: number
  totalCl1Import: number
  totalSolarGen: number // 0 if no inverter CSV
  hasSolarExport: boolean // gridExport > 0 in any interval
  hasInverterData: boolean // solarGen populated
  hasCl1Data: boolean
  dataSeasonality: DataSeasonality
  /** true when this summary was derived from the daily-bill fallback, not real interval data */
  isFlatEstimate?: boolean
}

export interface HouseholdProfile {
  state: AustralianState
  occupants: number
  floorAreaM2: number | null
  overnightLoads: {
    controlledLoadHotWater: boolean
    evCharger: boolean
    airConOvernight: boolean
    poolHeating: boolean
    otherLargeLoad: boolean
  }
  ev: {
    enabled: boolean
    chargerKw: number
    typicalChargeDurationHours: number
    chargingStartTime: string // 'HH:MM'
    chargingTariffRate: number // c/kWh
    smartChargerScheduling: boolean
  }
  hasPool: boolean
  hasLargeDucted: boolean
  /** User-entered flat rate for Simple mode, used until a real tariff plan is set up. */
  quickRate: {
    importCentsPerKwh: number | null
    feedInCentsPerKwh: number | null
    dailySupplyDollars: number | null
  }
}

export function defaultHouseholdProfile(): HouseholdProfile {
  return {
    state: 'SA',
    occupants: 3,
    floorAreaM2: null,
    overnightLoads: {
      controlledLoadHotWater: false,
      evCharger: false,
      airConOvernight: false,
      poolHeating: false,
      otherLargeLoad: false,
    },
    ev: {
      enabled: false,
      chargerKw: 7,
      typicalChargeDurationHours: 4,
      chargingStartTime: '23:00',
      chargingTariffRate: 8,
      smartChargerScheduling: false,
    },
    hasPool: false,
    hasLargeDucted: false,
    quickRate: { importCentsPerKwh: null, feedInCentsPerKwh: null, dailySupplyDollars: null },
  }
}
