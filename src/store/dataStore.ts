import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DataSummary, HouseholdProfile, Interval } from '@/types/meter'
import { defaultHouseholdProfile } from '@/types/meter'
import type { MeterBucket, SolarDailyTotal } from '@/lib/csvParser'
import { mergeMeterBuckets } from '@/lib/csvParser'
import { buildIntervals, summarizeIntervals } from '@/lib/dataProcessor'

interface DataStore {
  intervals: Interval[]
  summary: DataSummary | null
  csvWarnings: string[]
  meterBuckets: MeterBucket[]
  solarDailyTotals: SolarDailyTotal[]
  householdProfile: HouseholdProfile
  /** Opt-in: persist imported meter data in localStorage so it survives restarts. Off by default
   * to honour the "nothing is stored" privacy stance - the user chooses to keep it. */
  keepDataOnDevice: boolean
  setIntervals: (rows: Interval[], warnings?: string[], isFlatEstimate?: boolean) => void
  setMeterBuckets: (buckets: MeterBucket[], warnings?: string[]) => void
  addMeterBuckets: (buckets: MeterBucket[], warnings?: string[]) => void
  addSolarDailyTotals: (totals: SolarDailyTotal[]) => void
  setProfile: (updates: Partial<HouseholdProfile>) => void
  setKeepDataOnDevice: (keep: boolean) => void
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
      keepDataOnDevice: false,
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
      addMeterBuckets: (buckets, warnings = []) => {
        const merged = mergeMeterBuckets(get().meterBuckets, buckets)
        const intervals = buildIntervals(merged, get().solarDailyTotals)
        set({ meterBuckets: merged, intervals, summary: summarizeIntervals(intervals), csvWarnings: warnings })
      },
      addSolarDailyTotals: (totals) => {
        const solarDailyTotals = [...get().solarDailyTotals, ...totals]
        const intervals = buildIntervals(get().meterBuckets, solarDailyTotals)
        set({ solarDailyTotals, intervals, summary: summarizeIntervals(intervals) })
      },
      setProfile: (updates) => set({ householdProfile: { ...get().householdProfile, ...updates } }),
      setKeepDataOnDevice: (keep) => set({ keepDataOnDevice: keep }),
      clearData: () =>
        set({ intervals: [], summary: null, csvWarnings: [], meterBuckets: [], solarDailyTotals: [] }),
    }),
    {
      name: 'sba_household',
      version: 2,
      partialize: (state) => ({
        householdProfile: state.householdProfile,
        keepDataOnDevice: state.keepDataOnDevice,
        // Meter buckets are plain JSON (dateStr strings, numbers) so they round-trip safely;
        // intervals hold Date objects and are cheap to rebuild, so they are never persisted.
        ...(state.keepDataOnDevice
          ? { meterBuckets: state.meterBuckets, solarDailyTotals: state.solarDailyTotals }
          : {}),
      }),
      // Rebuild the derived intervals/summary from persisted buckets during hydration - done in
      // merge() rather than onRehydrateStorage so the store is never visible in a half-hydrated
      // state (buckets present, intervals empty).
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<DataStore>) }
        if (merged.meterBuckets.length > 0) {
          merged.intervals = buildIntervals(merged.meterBuckets, merged.solarDailyTotals)
          merged.summary = summarizeIntervals(merged.intervals)
        }
        return merged
      },
    },
  ),
)
