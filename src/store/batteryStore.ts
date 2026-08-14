import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BatteryQuote, BatterySimResult, ChargeWindow } from '@/types/battery'

export function defaultDraftQuote(): BatteryQuote {
  return {
    id: crypto.randomUUID(),
    name: 'Battery quote',
    capacityKwh: 10,
    maxChargeKw: 5,
    maxDischargeKw: 5,
    roundTripEfficiency: 0.9,
    totalCostAud: 10000,
    warrantyYears: 10,
    warrantyThroughputMwh: null,
    lifetimeYears: 10,
    totalDegradationPercent: 30,
    maxDischargePercent: 80,
    reservePercent: 10,
    targetMinDischargePct: 60,
    targetMaxDischargePct: 90,
    backupCapable: false,
    chargePriority: 'solar_then_offpeak',
    dischargePriority: 'peak_only',
    arbitrageTargetPercent: 80,
    arbitrageStartTime: '23:00',
    arbitrageEndTime: '07:00',
    solarSystemKw: null,
    inverterKw: null,
    exportLimitKw: null,
    vppEnrolled: false,
    vppAnnualCreditAud: 0,
  }
}

export interface PlannerDraft {
  chargeWindows: ChargeWindow[]
  dischargeStrategy: 'peak_only' | 'any_import'
  useSolar: boolean
  presetId: string | null
}

interface BatteryStore {
  quotes: BatteryQuote[]
  results: Record<string, BatterySimResult> // keyed by `${quoteId}_${tariffId}`
  /** The single in-progress battery configuration, shared by the Strategy Planner and the
   * Configure & simulate form so edits in either place show in both - and persisted, so
   * nothing is lost switching tabs, navigating away, or restarting the app. */
  draftQuote: BatteryQuote
  draftTariffId: string | null
  planner: PlannerDraft
  addQuote: (q: BatteryQuote) => void
  updateQuote: (id: string, updates: Partial<BatteryQuote>) => void
  deleteQuote: (id: string) => void
  setResult: (key: string, result: BatterySimResult) => void
  updateDraftQuote: (updates: Partial<BatteryQuote>) => void
  setDraftTariffId: (id: string) => void
  updatePlanner: (updates: Partial<PlannerDraft>) => void
}

export const useBatteryStore = create<BatteryStore>()(
  persist(
    (set, get) => ({
      quotes: [],
      results: {},
      draftQuote: defaultDraftQuote(),
      draftTariffId: null,
      planner: { chargeWindows: [], dischargeStrategy: 'peak_only', useSolar: true, presetId: null },
      addQuote: (q) => set({ quotes: [...get().quotes.filter((existingQuote) => existingQuote.id !== q.id), q] }),
      updateQuote: (id, updates) =>
        set({ quotes: get().quotes.map((q) => (q.id === id ? { ...q, ...updates } : q)) }),
      deleteQuote: (id) => set({ quotes: get().quotes.filter((q) => q.id !== id) }),
      setResult: (key, result) => set({ results: { ...get().results, [key]: result } }),
      updateDraftQuote: (updates) => set({ draftQuote: { ...get().draftQuote, ...updates } }),
      setDraftTariffId: (id) => set({ draftTariffId: id }),
      updatePlanner: (updates) => set({ planner: { ...get().planner, ...updates } }),
    }),
    { name: 'sba_battery_v2', version: 2 },
  ),
)
