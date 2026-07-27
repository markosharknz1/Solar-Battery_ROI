import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppMode = 'simple' | 'advanced'

interface UiStore {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      mode: 'simple',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'sba_mode' },
  ),
)
