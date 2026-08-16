import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VppProgram } from '@/types/battery'

export function defaultVppProgram(): VppProgram {
  return {
    id: crypto.randomUUID(),
    name: 'VPP program',
    provider: '',
    upfrontRebateAud: 0,
    fixedAnnualCreditAud: 0,
    exportCredits: [],
    importCharges: [],
    notes: '',
  }
}

interface VppStore {
  programs: VppProgram[]
  addProgram: () => string
  updateProgram: (id: string, updates: Partial<VppProgram>) => void
  deleteProgram: (id: string) => void
}

export const useVppStore = create<VppStore>()(
  persist(
    (set, get) => ({
      programs: [],
      addProgram: () => {
        const program = defaultVppProgram()
        set({ programs: [...get().programs, program] })
        return program.id
      },
      updateProgram: (id, updates) =>
        set({ programs: get().programs.map((p) => (p.id === id ? { ...p, ...updates } : p)) }),
      deleteProgram: (id) => set({ programs: get().programs.filter((p) => p.id !== id) }),
    }),
    { name: 'sba_vpp_v1', version: 1 },
  ),
)
