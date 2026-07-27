import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BatteryQuote, BatterySimResult } from '@/types/battery'

interface BatteryStore {
  quotes: BatteryQuote[]
  results: Record<string, BatterySimResult> // keyed by `${quoteId}_${tariffId}`
  addQuote: (q: BatteryQuote) => void
  updateQuote: (id: string, updates: Partial<BatteryQuote>) => void
  deleteQuote: (id: string) => void
  setResult: (key: string, result: BatterySimResult) => void
}

export const useBatteryStore = create<BatteryStore>()(
  persist(
    (set, get) => ({
      quotes: [],
      results: {},
      addQuote: (q) => set({ quotes: [...get().quotes.filter((existingQuote) => existingQuote.id !== q.id), q] }),
      updateQuote: (id, updates) =>
        set({ quotes: get().quotes.map((q) => (q.id === id ? { ...q, ...updates } : q)) }),
      deleteQuote: (id) => set({ quotes: get().quotes.filter((q) => q.id !== id) }),
      setResult: (key, result) => set({ results: { ...get().results, [key]: result } }),
    }),
    { name: 'sba_battery_v2', version: 2 },
  ),
)
