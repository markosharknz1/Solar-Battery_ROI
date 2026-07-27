import Papa from 'papaparse'

export type MeterFormat = 'generic' | 'ovo' | 'nem12' | 'unknown'

/** One 30-minute bucket produced by any meter format parser, before merging with solar/inverter data */
export interface MeterBucket {
  dateStr: string // YYYY-MM-DD
  slot: number // 0-47
  gridImport: number // kWh
  gridExport: number // kWh
  cl1Import: number // kWh - controlled load 1 (e.g. hot water)
  cl2Import: number // kWh - controlled load 2
}

export interface ParsedMeterData {
  format: MeterFormat
  buckets: MeterBucket[]
  warnings: string[]
}

const SLOTS_PER_DAY = 48
type BucketKind = 'import' | 'export' | 'cl1' | 'cl2'

function slotFromMinutes(hour: number, minute: number): number {
  return Math.min(SLOTS_PER_DAY - 1, Math.floor((hour * 60 + minute) / 30))
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Normalises free-text row-type labels ("Controlled Load 1", "CL1", "Usage", "Solar", ...) into a bucket kind. */
function classifyRowType(text: string): BucketKind {
  const normalized = text.trim().toLowerCase()
  if (normalized.includes('cl1') || normalized === 'controlled load 1' || normalized.includes('controlled load 1'))
    return 'cl1'
  if (normalized.includes('cl2') || normalized.includes('controlled load 2')) return 'cl2'
  if (normalized === 'solar' || normalized.includes('solar')) return 'export'
  return 'import'
}

class BucketMap {
  private map = new Map<string, MeterBucket>()

  add(dateStr: string, slot: number, kind: BucketKind, kWh: number) {
    const key = `${dateStr}|${slot}`
    let bucket = this.map.get(key)
    if (!bucket) {
      bucket = { dateStr, slot, gridImport: 0, gridExport: 0, cl1Import: 0, cl2Import: 0 }
      this.map.set(key, bucket)
    }
    if (kind === 'import') bucket.gridImport += kWh
    else if (kind === 'export') bucket.gridExport += kWh
    else if (kind === 'cl1') bucket.cl1Import += kWh
    else bucket.cl2Import += kWh
  }

  toArray(): MeterBucket[] {
    return Array.from(this.map.values()).sort((a, b) =>
      a.dateStr === b.dateStr ? a.slot - b.slot : a.dateStr.localeCompare(b.dateStr),
    )
  }
}

export function detectMeterFormat(csvText: string): MeterFormat {
  const firstLine = csvText.slice(0, 500).split(/\r?\n/)[0] ?? ''
  const firstCell = firstLine.split(',')[0]?.trim().replace(/"/g, '')

  if (firstCell === '100') return 'nem12'

  const headerLower = firstLine.toLowerCase()
  if (
    headerLower.includes('accountnumber') &&
    headerLower.includes('solarflag') &&
    headerLower.includes('readconsumption') &&
    headerLower.includes('register')
  ) {
    return 'ovo'
  }
  if (
    headerLower.includes('ratetypedescription') &&
    headerLower.includes('startdate') &&
    headerLower.includes('profilereadvalue')
  ) {
    return 'generic'
  }
  return 'unknown'
}

/**
 * OVO Energy (and similar AU retailer) export format:
 * AccountNumber,NMI,Register,ReadConsumption,SolarFlag,ReadUnit,ReadQuality,ReadDate,ReadTime
 * 5-minute granularity, ReadDate=yyyy/mm/dd, ReadTime=HH:MM:SS, SolarFlag true=export/false=import.
 */
function parseOvoFormat(csvText: string, warnings: string[]): MeterBucket[] {
  const buckets = new BucketMap()
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  for (const row of parsed.data) {
    const dateRaw = row.ReadDate
    const timeRaw = row.ReadTime
    const consumption = Number.parseFloat(row.ReadConsumption)
    const isSolar = String(row.SolarFlag).trim().toLowerCase() === 'true'
    if (!dateRaw || !timeRaw || Number.isNaN(consumption)) continue

    const dateStr = dateRaw.trim().replace(/\//g, '-')
    const [hourStr, minuteStr] = timeRaw.trim().split(':')
    const hour = Number.parseInt(hourStr, 10)
    const minute = Number.parseInt(minuteStr, 10)
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue

    const slot = slotFromMinutes(hour, minute)
    const registerText = String(row.Register ?? '').replace(/"/g, '').toLowerCase()
    let kind: BucketKind = 'import'
    if (isSolar) kind = 'export'
    else if (registerText.includes('cl1')) kind = 'cl1'
    else if (registerText.includes('cl2')) kind = 'cl2'
    buckets.add(dateStr, slot, kind, consumption)
  }

  if (parsed.errors.length > 0) {
    warnings.push(`${parsed.errors.length} row(s) skipped due to parse errors.`)
  }

  return buckets.toArray()
}

/**
 * Generic AU retailer interval export:
 * RateTypeDescription, StartDate, EndDate, ProfileReadValue
 * StartDate format: d/m/yyyy H:MM (no leading zeros guaranteed).
 */
function parseGenericFormat(csvText: string, warnings: string[]): MeterBucket[] {
  const buckets = new BucketMap()
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  const dateTimeRe = /(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/
  let maxValue = 0
  const rawRows: Array<{ dateStr: string; slot: number; kind: BucketKind; value: number }> = []

  for (const row of parsed.data) {
    const type = row.RateTypeDescription?.trim()
    const start = row.StartDate
    const value = Number.parseFloat(row.ProfileReadValue)
    if (!type || !start || Number.isNaN(value)) continue

    const match = dateTimeRe.exec(start)
    if (!match) continue
    const [, d, m, y, h, min] = match
    const dateStr = `${y}-${pad2(Number.parseInt(m, 10))}-${pad2(Number.parseInt(d, 10))}`
    const slot = slotFromMinutes(Number.parseInt(h, 10), Number.parseInt(min, 10))
    const kind = classifyRowType(type)

    rawRows.push({ dateStr, slot, kind, value })
    maxValue = Math.max(maxValue, value)
  }

  // Heuristic: interval kWh values shouldn't realistically exceed ~50 for a 30-min slot;
  // if they do, the export is likely in Wh, so normalize.
  const divisor = maxValue > 50 ? 1000 : 1
  if (divisor !== 1) {
    warnings.push('Detected values appear to be in Wh; converted to kWh.')
  }

  for (const r of rawRows) {
    buckets.add(r.dateStr, r.slot, r.kind, r.value / divisor)
  }

  if (parsed.errors.length > 0) {
    warnings.push(`${parsed.errors.length} row(s) skipped due to parse errors.`)
  }

  return buckets.toArray()
}

/**
 * AEMO NEM12 format. 200 records define a register (NMI, register id, uom, interval length);
 * 300 records hold one day's worth of interval values for the most recently seen 200 record.
 * Register ids starting with "B" are export/generation, others ("E"...) are import/consumption.
 */
function parseNem12Format(csvText: string, warnings: string[]): MeterBucket[] {
  const buckets = new BucketMap()
  const lines = csvText.split(/\r?\n/)

  let intervalLength = 30
  let currentKind: BucketKind = 'import'

  for (const line of lines) {
    if (!line.trim()) continue
    const fields = line.split(',').map((f) => f.trim().replace(/^"|"$/g, ''))
    const recordType = fields[0]

    if (recordType === '200') {
      const registerId = (fields[2] ?? '').toUpperCase()
      if (registerId.includes('CL1')) currentKind = 'cl1'
      else if (registerId.includes('CL2')) currentKind = 'cl2'
      else currentKind = registerId.startsWith('B') ? 'export' : 'import'
      const parsedInterval = Number.parseInt(fields[8] ?? '30', 10)
      intervalLength = Number.isNaN(parsedInterval) ? 30 : parsedInterval
      continue
    }

    if (recordType === '300') {
      const dateRaw = fields[1] // yyyymmdd
      if (!dateRaw || dateRaw.length !== 8) continue
      const dateStr = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
      const countPerDay = Math.round((24 * 60) / intervalLength)
      const values = fields.slice(2, 2 + countPerDay).map((v) => Number.parseFloat(v))
      const slotsPerValue = intervalLength / 30 // e.g. 5-min -> 1/6 of a slot

      values.forEach((value, i) => {
        if (Number.isNaN(value)) return
        if (intervalLength === 30) {
          buckets.add(dateStr, i, currentKind, value)
        } else if (intervalLength < 30) {
          // Bucket several sub-30-min readings into the containing 30-min slot.
          const minutesIntoDay = i * intervalLength
          const slot = slotFromMinutes(Math.floor(minutesIntoDay / 60), minutesIntoDay % 60)
          buckets.add(dateStr, slot, currentKind, value)
        } else {
          // Interval longer than 30 min: spread evenly across the slots it covers.
          const startSlot = Math.floor((i * intervalLength) / 30)
          const span = Math.max(1, Math.round(slotsPerValue))
          for (let s = 0; s < span; s++) {
            buckets.add(dateStr, startSlot + s, currentKind, value / span)
          }
        }
      })
    }
  }

  if (buckets.toArray().length === 0) {
    warnings.push('No 300 records found in NEM12 file.')
  }

  return buckets.toArray()
}

export function parseMeterCsv(csvText: string): ParsedMeterData {
  const format = detectMeterFormat(csvText)
  const warnings: string[] = []
  let buckets: MeterBucket[] = []

  switch (format) {
    case 'ovo':
      buckets = parseOvoFormat(csvText, warnings)
      break
    case 'generic':
      buckets = parseGenericFormat(csvText, warnings)
      break
    case 'nem12':
      buckets = parseNem12Format(csvText, warnings)
      break
    default:
      warnings.push('Unrecognised CSV format. Expected an AU retailer interval export or NEM12 file.')
  }

  return { format, buckets, warnings }
}

// ---------------------------------------------------------------------------
// Solar inverter CSV (optional, brand-specific daily totals)
// ---------------------------------------------------------------------------

export interface SolarCsvColumnMapping {
  dateColumn: string
  generationColumn: string
  unit: 'kWh' | 'Wh'
}

export interface SolarDailyTotal {
  dateStr: string // YYYY-MM-DD
  solarGenKwh: number
}

export function detectSolarColumns(headers: string[]): Partial<SolarCsvColumnMapping> {
  const lower = headers.map((h) => h.toLowerCase())
  const findCol = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const idx = lower.findIndex((h) => pattern.test(h))
      if (idx >= 0) return headers[idx]
    }
    return undefined
  }

  const dateColumn = findCol([/^date$/, /date\/time/, /^datum$/, /^time$/])
  const generationColumn = findCol([
    /system production/,
    /energie gesamt/,
    /total yield/,
    /e-day/,
    /e_today/,
    /generation/,
  ])
  const unit: SolarCsvColumnMapping['unit'] = generationColumn?.toLowerCase().includes('wh)') ? 'Wh' : 'kWh'

  return { dateColumn, generationColumn, unit }
}

/** Parses a brand-specific inverter export (usually one row per day) into daily generation totals. */
export function parseSolarCsv(csvText: string, mapping: SolarCsvColumnMapping): SolarDailyTotal[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const results: SolarDailyTotal[] = []
  for (const row of parsed.data) {
    const rawDate = row[mapping.dateColumn]
    const rawValue = row[mapping.generationColumn]
    if (!rawDate || rawValue === undefined) continue

    const value = Number.parseFloat(String(rawValue).replace(/,/g, ''))
    if (Number.isNaN(value)) continue

    const dateStr = normalizeDateString(rawDate)
    if (!dateStr) continue

    const solarGenKwh = mapping.unit === 'Wh' ? value / 1000 : value
    results.push({ dateStr, solarGenKwh })
  }

  return results
}

function normalizeDateString(raw: string): string | null {
  const trimmed = raw.trim().split(' ')[0]
  // yyyy-mm-dd or yyyy/mm/dd
  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed)
  if (match) return `${match[1]}-${pad2(Number(match[2]))}-${pad2(Number(match[3]))}`
  // d/m/yyyy or dd/mm/yyyy
  match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed)
  if (match) return `${match[3]}-${pad2(Number(match[2]))}-${pad2(Number(match[1]))}`
  return null
}
