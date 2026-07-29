export interface Bill {
  id: string
  provider: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string
  totalCostAud: number
  totalUsageKwh: number
  totalExportKwh: number | null
  supplyChargeAud: number | null // $/day, if extracted/entered
  notes: string
  sourceFileName: string | null
  addedAt: string // ISO timestamp
}
