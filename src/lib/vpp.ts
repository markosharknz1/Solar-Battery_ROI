import type { VppProgram } from '@/types/battery'

/** Net annual value of a VPP program: fixed credit + export credits - import charges. */
export function vppNetAnnualAud(p: VppProgram): number {
  const credits = p.exportCredits.reduce((sum, c) => sum + c.ratePerKwh * c.kwhPerYear, 0)
  const charges = p.importCharges.reduce((sum, c) => sum + c.ratePerKwh * c.kwhPerYear, 0)
  return p.fixedAnnualCreditAud + credits - charges
}
