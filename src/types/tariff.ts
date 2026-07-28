import type { AustralianState } from '@/types/meter'

export type { AustralianState }

export type DayGroup = 'weekday' | 'weekend' | 'everyday' | 'custom'

/** A single named rate period within a day */
export interface RatePeriod {
  id: string
  name: string // e.g. "Peak", "Off-peak", "Free solar sponge"
  startTime: string // "HH:MM" 24h
  endTime: string // "HH:MM" 24h - can wrap past midnight
  ratePerKwh: number // dollars - 0 for free periods
  gstInclusive: boolean // if false, ratePerKwh is grossed up by 10% when resolved
  days: boolean[] // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
}

/** Feed-in period - same shape as RatePeriod, kept separate for clarity */
export type FeedInPeriod = RatePeriod

export interface FixedCharge {
  id: string
  label: string // e.g. 'Supply charge', 'Metering charge'
  amountPerDay: number // dollars/day
  gstInclusive: boolean
}

export interface TariffPlan {
  id: string
  name: string
  provider: string
  state: AustralianState
  fixedCharges: FixedCharge[]
  periods: RatePeriod[] // import rate periods
  feedInPeriods: FeedInPeriod[] // export/feed-in rate periods
  controlledLoadRate: number | null // flat c/kWh for CL1 circuit
  controlledLoad2Rate: number | null
  publicHolidaysAsWeekends: boolean
  notes: string
  isActive: boolean // the plan currently being paid
  createdAt: string
}

/** Resolved rate for a single interval, used internally */
export interface ResolvedRate {
  ratePerKwh: number
  periodName: string
  isFree: boolean
}

export interface CostResult {
  totalCostAud: number
  importCostAud: number
  exportCreditAud: number
  fixedChargesAud: number
  cl1CostAud: number
  byPeriod: Record<string, { kWh: number; costAud: number }>
  byMonth: Array<{ month: string; costAud: number; kWh: number }>
  byDayOfWeek: number[] // 0=Mon, average daily cost
}

export interface ProviderQuote {
  id: string
  providerName: string
  planName: string
  gstInclusive: boolean
  billingPeriodDays: number // 30=monthly, 90=quarterly, custom
  dailySupplyCharge: number // $/day for breakdown display
  monthlyAmounts: number[] // 12 slots Jan-Dec; 0 = no data
  annualConcessionsAud: number
  notes: string
}
