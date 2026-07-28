import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProviderQuote, TariffPlan } from '@/types/tariff'

interface TariffStore {
  plans: TariffPlan[]
  activePlanId: string | null
  providerQuotes: ProviderQuote[]
  addPlan: (plan: TariffPlan) => void
  updatePlan: (id: string, updates: Partial<TariffPlan>) => void
  deletePlan: (id: string) => void
  setActivePlan: (id: string) => void
  addProviderQuote: (quote: ProviderQuote) => void
  updateProviderQuote: (id: string, updates: Partial<ProviderQuote>) => void
  deleteProviderQuote: (id: string) => void
}

export const useTariffStore = create<TariffStore>()(
  persist(
    (set, get) => ({
      plans: [],
      activePlanId: null,
      providerQuotes: [],
      addPlan: (plan) => set({ plans: [...get().plans, plan] }),
      updatePlan: (id, updates) =>
        set({ plans: get().plans.map((p) => (p.id === id ? { ...p, ...updates } : p)) }),
      deletePlan: (id) =>
        set({
          plans: get().plans.filter((p) => p.id !== id),
          activePlanId: get().activePlanId === id ? null : get().activePlanId,
        }),
      setActivePlan: (id) =>
        set({
          activePlanId: id,
          plans: get().plans.map((p) => ({ ...p, isActive: p.id === id })),
        }),
      addProviderQuote: (quote) => set({ providerQuotes: [...get().providerQuotes, quote] }),
      updateProviderQuote: (id, updates) =>
        set({ providerQuotes: get().providerQuotes.map((q) => (q.id === id ? { ...q, ...updates } : q)) }),
      deleteProviderQuote: (id) => set({ providerQuotes: get().providerQuotes.filter((q) => q.id !== id) }),
    }),
    { name: 'sba_tariffs_v2', version: 3 },
  ),
)
