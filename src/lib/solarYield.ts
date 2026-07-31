import type { AustralianState } from '@/types/meter'

/**
 * Rough average annual specific yield (kWh generated per kW of installed panel capacity per
 * year) by state, assuming a well-oriented, unshaded system at a typical tilt - the standard
 * ballpark figures used by AU solar calculators (Clean Energy Council / Solar Choice style
 * guides). This is climate/geography data, not pricing, so unlike tariff rates it doesn't need
 * regular upkeep - but it's still a rough regional average, not a location-precise forecast.
 */
export const AVERAGE_ANNUAL_YIELD_KWH_PER_KW: Record<AustralianState, number> = {
  NSW: 1400,
  VIC: 1350,
  QLD: 1500,
  SA: 1500,
  WA: 1550,
  TAS: 1250,
  NT: 1650,
  ACT: 1450,
}

/** AU postcode ranges by state. Approximate - a handful of PO-box/LPO ranges near state borders
 * can cross these boundaries, but this covers the vast majority of residential postcodes. */
function postcodeToState(postcode: number): AustralianState | null {
  if (postcode >= 200 && postcode <= 299) return 'ACT'
  if (postcode >= 2600 && postcode <= 2618) return 'ACT'
  if (postcode >= 2900 && postcode <= 2920) return 'ACT'
  if (postcode >= 1000 && postcode <= 2599) return 'NSW'
  if (postcode >= 2619 && postcode <= 2899) return 'NSW'
  if (postcode >= 2921 && postcode <= 2999) return 'NSW'
  if (postcode >= 800 && postcode <= 999) return 'NT'
  if (postcode >= 4000 && postcode <= 4999) return 'QLD'
  if (postcode >= 9000 && postcode <= 9999) return 'QLD'
  if (postcode >= 5000 && postcode <= 5999) return 'SA'
  if (postcode >= 7000 && postcode <= 7999) return 'TAS'
  if (postcode >= 3000 && postcode <= 3999) return 'VIC'
  if (postcode >= 8000 && postcode <= 8999) return 'VIC'
  if (postcode >= 6000 && postcode <= 6999) return 'WA'
  return null
}

export function resolveStateFromPostcode(postcode: string): AustralianState | null {
  if (!/^\d{4}$/.test(postcode.trim())) return null
  return postcodeToState(Number(postcode))
}

export function estimateAnnualGenerationKwh(systemKw: number, state: AustralianState): number {
  return systemKw * AVERAGE_ANNUAL_YIELD_KWH_PER_KW[state]
}
