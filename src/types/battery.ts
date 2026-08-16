/** One rate x estimated-energy line of a VPP program (an export credit or an import charge). */
export interface VppLineItem {
  id: string
  label: string // e.g. "Event exports", "Peak demand response"
  ratePerKwh: number // dollars/kWh
  kwhPerYear: number // estimated energy per year at this rate
}

/** A Virtual Power Plant program, configured on the VPP page and selectable per battery quote. */
export interface VppProgram {
  id: string
  name: string
  provider: string
  upfrontRebateAud: number // one-off signup rebate - reduces the battery's effective cost for payback
  fixedAnnualCreditAud: number // membership/sign-on credits paid regardless of events
  exportCredits: VppLineItem[] // energy the program draws/exports from your battery - you get paid
  importCharges: VppLineItem[] // extra energy you buy under the program's terms - you pay
  notes: string
}

export interface BatteryQuote {
  id: string
  name: string // e.g. "Tesla Powerwall 2 quote"

  // Capacity
  capacityKwh: number // usable (nameplate) capacity
  maxChargeKw: number
  maxDischargeKw: number
  roundTripEfficiency: number // 0-1, typically 0.90

  // Cost
  totalCostAud: number // installed cost - enter the final price after any rebates/incentives already applied

  // Warranty
  warrantyYears: number
  warrantyThroughputMwh: number | null

  // Lifetime & degradation
  lifetimeYears: number // 1-15
  totalDegradationPercent: number // 0-50, straight-line over lifetimeYears

  // Discharge limits
  maxDischargePercent: number // 0-100, health limit
  reservePercent: number // 0-30, backup reserve
  targetMinDischargePct: number // sizing target lower bound
  targetMaxDischargePct: number // sizing target upper bound

  // Backup
  backupCapable: boolean

  // Charge/discharge strategy
  chargePriority: 'solar_only' | 'solar_then_offpeak' | 'solar_then_arbitrage' | 'arbitrage_only'
  dischargePriority: 'peak_only' | 'any_import'
  arbitrageTargetPercent: number // % of capacity to charge from grid overnight
  arbitrageStartTime: string // 'HH:MM'
  arbitrageEndTime: string

  // Solar system
  solarSystemKw: number | null
  inverterKw: number | null
  exportLimitKw: number | null

  // VPP: quotes reference a program configured on the VPP page. The legacy inline fields
  // below are kept so quotes saved by older versions still simulate the same way; the UI
  // no longer edits them.
  vppProgramId?: string | null
  vppEnrolled: boolean
  vppAnnualCreditAud: number
  vppEventRatePerKwh?: number
  vppEventKwhPerYear?: number
}

export interface BatterySimResult {
  quoteId: string
  tariffId: string

  // Annual projections
  annualSavingsAud: number
  annualGridImportKwh: number // with battery
  annualGridImportKwhBase: number // without battery
  annualSolarExportKwh: number // with battery
  annualSolarExportKwhBase: number
  selfConsumptionRate: number
  simplePaybackYears: number
  lifetimeSavingsAud: number
  costPerKwhStored: number
  vppCreditAud: number

  // Cycle statistics
  totalEquivCycles: number
  annualEquivCycles: number
  avgDailyCycles: number
  dailyCycleDepths: number[] // one value per day (0.0-1.0+)

  // Warranty comparison
  yearsTillThroughputExpiry: number | null
  yearsTillYearWarrantyExpiry: number
  effectiveWarrantyYears: number
  lifetimeKwhStoredAtWarranty: number

  // Sizing
  daysFull: number // days battery was 100% full before evening
  daysEmpty: number // days battery was depleted before midnight
  avgDailyCycleDepthPercent: number
  daysUnderMinDischarge: number
  daysOverMaxDischarge: number

  // Curtailment (0 if no inverter data or no export limit set)
  estimatedCurtailmentKwhAnnual: number
  curtailmentCaptureKwhAnnual: number
  curtailmentCapturePercent: number
  peakCurtailmentSlot: number

  // Day-by-day for SoC chart
  dailySoc: Array<{ date: string; avgSocKwh: number; cyclesFraction: number }>

  // Month-by-month measured savings over the uploaded data (not annualised).
  // Optional: absent on results persisted before this field existed - re-run to populate.
  monthlySavings?: Array<{ month: string; savingsAud: number; days: number }>

  // Arbitrage
  arbitrageAnnualValueAud: number

  // VPP upfront rebate applied to this simulation (reduces effective cost for payback).
  // Optional: absent on results saved before VPP programs existed.
  vppRebateAud?: number

  // Backup
  estimatedBackupHoursAvg: number
  estimatedBackupHoursMax: number

  // Savings breakdown (annualised, kept from Phase 1 for the breakdown chart)
  importCostSavedAud: number
  exportCreditLostAud: number
  fixedChargesAud: number
}

/** One slot of a synthetic "typical day" built by averaging real intervals - used by the
 * Strategy Planner's instant preview, not the full simulator. */
export interface AverageDaySlot {
  slot: number
  time: string // 'HH:MM'
  avgGridImport: number
  avgGridExport: number
  avgSolarGen: number
  avgHomeLoad: number
  tariffRate: number
  fitRate: number
  projectedSoc: number // filled by previewStrategyOnAverageDay()
}

export interface ChargeWindow {
  id: string
  fromTime: string
  toTime: string
  targetPercent: number
}
