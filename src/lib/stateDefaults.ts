import type { AustralianState } from '@/types/meter'

export interface StateDefaultRates {
  peakRate: number
  fitRate: number
  supplyPerDay: number
}

export const STATE_DEFAULTS: Record<AustralianState, StateDefaultRates> = {
  SA: { peakRate: 0.385, fitRate: 0.06, supplyPerDay: 0.95 },
  VIC: { peakRate: 0.31, fitRate: 0.05, supplyPerDay: 0.88 },
  NSW: { peakRate: 0.33, fitRate: 0.05, supplyPerDay: 0.85 },
  QLD: { peakRate: 0.28, fitRate: 0.052, supplyPerDay: 0.83 },
  WA: { peakRate: 0.31, fitRate: 0.025, supplyPerDay: 0.99 },
  TAS: { peakRate: 0.298, fitRate: 0.088, supplyPerDay: 0.9 },
  ACT: { peakRate: 0.22, fitRate: 0.055, supplyPerDay: 0.88 },
  NT: { peakRate: 0.268, fitRate: 0, supplyPerDay: 0.73 },
}

export const STATE_LABELS: Record<AustralianState, string> = {
  SA: 'South Australia',
  VIC: 'Victoria',
  NSW: 'New South Wales',
  QLD: 'Queensland',
  WA: 'Western Australia',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
  NT: 'Northern Territory',
}
