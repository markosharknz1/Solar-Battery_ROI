export function annualizeFactor(totalDays: number): number {
  return totalDays > 0 ? 365 / totalDays : 0
}
