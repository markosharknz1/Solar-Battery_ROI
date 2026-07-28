import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DataSummary, HouseholdProfile, Interval } from '@/types/meter'
import { defaultHouseholdProfile } from '@/types/meter'
import type { MeterBucket, SolarDailyTotal } from '@/lib/csvParser'
import { buildIntervals, summarizeIntervals } from '@/lib/dataProcessor'

interface DataStore {
  intervals: Interval[]
  summary: DataSummary | null
  csvWarnings: string[]
  meterBuckets: MeterBucket[]
  solarDailyTotals: SolarDailyTotal[]
  householdProfile: HouseholdProfile
  setIntervals: (rows: Interval[], warnings?: string[], isFlatEstimate?: boolean) => void
  setMeterBuckets: (buckets: MeterBucket[], warnings?: string[]) => void
  addSolarDailyTotals: (totals: SolarDailyTotal[]) => void
  setProfile: (updates: Partial<HouseholdProfile>) => void
  clearData: () => void
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      intervals: [],
      summary: null,
      csvWarnings: [],
      meterBuckets: [],
      solarDailyTotals: [],
      householdProfile: defaultHouseholdProfile(),
      setIntervals: (rows, warnings = [], isFlatEstimate = false) => {
        const summary = summarizeIntervals(rows)
        set({
          intervals: rows,
          summary: summary && isFlatEstimate ? { ...summary, isFlatEstimate: true } : summary,
          csvWarnings: warnings,
          meterBuckets: [],
          solarDailyTotals: [],
        })
      },
      setMeterBuckets: (buckets, warnings = []) => {
        const intervals = buildIntervals(buckets, get().solarDailyTotals)
        set({ meterBuckets: buckets, intervals, summary: summarizeIntervals(intervals), csvWarnings: warnings })
      },
      addSolarDailyTotals: (totals) => {
        const solarDailyTotals = [...get().solarDailyTotals, ...totals]
        const intervals = buildIntervals(get().meterBuckets, solarDailyTotals)
        set({ solarDailyTotals, intervals, summary: summarizeIntervals(intervals) })
      },
      setProfile: (updates) => set({ householdProfile: { ...get().householdProfile, ...updates } }),
      clearData: () =>
        set({ intervals: [], summary: null, csvWarnings: [], meterBuckets: [], solarDailyTotals: [] }),
    }),
    {
      name: 'sba_household',
      version: 1,
      partialize: (state) => ({ householdProfile: state.householdProfile }),
    },
  ),
)
