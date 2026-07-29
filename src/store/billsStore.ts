import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bill } from '@/types/bill'

interface BillsStore {
  bills: Bill[]
  addBill: (b: Bill) => void
  updateBill: (id: string, updates: Partial<Bill>) => void
  deleteBill: (id: string) => void
}

export const useBillsStore = create<BillsStore>()(
  persist(
    (set, get) => ({
      bills: [],
      addBill: (b) => set({ bills: [...get().bills, b] }),
      updateBill: (id, updates) => set({ bills: get().bills.map((x) => (x.id === id ? { ...x, ...updates } : x)) }),
      deleteBill: (id) => set({ bills: get().bills.filter((x) => x.id !== id) }),
    }),
    { name: 'sba_bills', version: 1 },
  ),
)
