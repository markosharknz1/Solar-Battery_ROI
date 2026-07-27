import type { RebatePreset } from '@/types/battery'

export const REBATE_PRESETS: RebatePreset[] = [
  {
    id: 'federal-cheaper-home-batteries',
    name: 'Federal Cheaper Home Batteries Program',
    jurisdiction: 'Federal',
    description: 'Commonwealth battery rebate delivered as a discount per kWh of installed capacity.',
    perKwhAud: 330,
  },
  {
    id: 'vic-solar-battery-loan',
    name: 'VIC Solar Battery Loan',
    jurisdiction: 'VIC',
    description: 'Interest-free loan (not a rebate) - included here as a placeholder to remind you it affects cash flow, not sticker price.',
    amountAud: 0,
  },
  {
    id: 'nsw-peak-demand-saver',
    name: 'NSW Peak Demand Battery Rebate',
    jurisdiction: 'NSW',
    description: 'State battery incentive for eligible households.',
    amountAud: 1600,
  },
  {
    id: 'qld-battery-booster',
    name: 'QLD Battery Booster Program',
    jurisdiction: 'QLD',
    description: 'State rebate for eligible households installing a battery alongside solar.',
    amountAud: 3000,
  },
  {
    id: 'sa-home-battery-scheme',
    name: 'SA Home Battery Scheme',
    jurisdiction: 'SA',
    description: 'Point-of-sale discount for South Australian households.',
    perKwhAud: 200,
  },
]

export function computeRebateTotal(presetIds: string[], capacityKwh: number): number {
  let total = 0
  for (const id of presetIds) {
    const preset = REBATE_PRESETS.find((p) => p.id === id)
    if (!preset) continue
    if (preset.amountAud) total += preset.amountAud
    if (preset.perKwhAud) total += preset.perKwhAud * capacityKwh
  }
  return total
}
