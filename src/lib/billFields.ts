/**
 * Pure text parsing for PDF bills - no pdfjs imports, so it can be unit-tested in Node.
 * Patterns are tuned against real AGL, GloBird (dual-fuel), and OVO Energy bills plus
 * generic layouts. Anything that can't be confidently matched is left null; the caller
 * must always let the user review and correct every field before saving.
 */

export interface ExtractedTouWindow {
  startTime: string // 'HH:MM'
  endTime: string
}

export interface ExtractedTouRate {
  name: string
  ratePerKwh: number // dollars
  kwh: number
  windows: ExtractedTouWindow[] // empty = all-day / window unknown
}

export interface ExtractedBillData {
  provider: string | null
  periodStart: string | null // YYYY-MM-DD
  periodEnd: string | null
  totalCostAud: number | null
  totalUsageKwh: number | null
  totalExportKwh: number | null
  supplyChargeAud: number | null // $/day
  touRates: ExtractedTouRate[]
  feedInRatePerKwh: number | null // dollars
  /** false when the bill itemises rates ex-GST (AGL does; OVO/GloBird are GST-inclusive) */
  ratesGstInclusive: boolean
  rawText: string
}

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'
const DATE_TEXT = `\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\s+\\d{2,4}` // 16 May 2026, 23 Jan 24 (OVO 2024)
const DATE_HYPHEN = `\\d{1,2}-(?:${MONTHS})[a-z]*-\\d{2,4}` // 14-Nov-2023 (GloBird)
const DATE_NUM = `\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}` // 01/06/2024
const DATE_ALT = `(?:${DATE_TEXT}|${DATE_HYPHEN}|${DATE_NUM})`

// Prefer an explicitly labelled billing period - on dual-fuel bills (e.g. GloBird gas +
// electricity) the electricity section's period appears first in document order.
const LABELED_RANGE_RE = new RegExp(
  `bill(?:ing)?\\s+period:?\\s*(${DATE_ALT})\\s*(?:to|until|[-–—])\\s*(${DATE_ALT})`,
  'i',
)
const GENERIC_RANGE_RE = new RegExp(`(${DATE_ALT})\\s*(?:to|until|[-–—])\\s*(${DATE_ALT})`, 'i')

// Total cost, in priority order. The labelled GST-inclusive totals must win over generic
// "amount due" - OVO's front page says "Amount due $0.00" while the real period total is
// "Total new charges and credits (including GST) = $12.84", and GloBird's "Total amount
// payable" is electricity + gas + carried balance combined.
const TOTAL_PATTERNS: RegExp[] = [
  /total\s+new\s+charges\s+and\s+credits\s*\(including\s+gst\)\s*=?\s*\$\s*([\d,]+\.\d{2})/i, // AGL, OVO 2025
  /total\s+energy\s+charges\s+inclusive\s+of\s+gst\s*\$\s*([\d,]+\.\d{2})/i, // OVO 2024
  /total\s*\(including\s*\$[\d.,]+\s*gst\)\s*\$\s*([\d,]+\.\d{2})/i, // GloBird per-fuel total (electricity first)
  /(?:total\s+amount\s+(?:payable|due)|amount\s+due|total\s+(?:charges|payable|for\s+this\s+bill)|new\s+charges|balance\s+due)\D{0,15}?\$\s*([\d,]+\.\d{2})/i,
]

const TOTAL_USAGE_RE = /total\s+usage:?\D{0,15}?([\d,]+(?:\.\d+)?)\s*kwh/i // GloBird + generic
const LEGACY_USAGE_RE =
  /(?:total\s+(?:consumption|electricity\s+usage)|electricity\s+usage|usage\s+total|you\s+used)\D{0,20}?([\d,]+(?:\.\d+)?)\s*kwh/i
// Tariff table component rows: "551.618 kWh $0.4409". Summed when no explicit total exists
// (AGL and OVO only itemise per time-of-use rate). Rows preceded by solar/feed-in context
// are export lines, not consumption.
const COMPONENT_ROW_RE = /([\d,]+(?:\.\d+)?)\s*kwh\s+\$/gi
const EXPORT_CONTEXT_RE = /feed[\s-]?in|solar|export|\bfit\b|generation/i
const AVERAGE_DAILY_RE = /average\s+daily/i

const TOTAL_GENERATION_RE = /total\s+solar\s+generation:?\D{0,15}?([\d,]+(?:\.\d+)?)\s*kwh/i // GloBird
// OVO 2024 layout: usage and solar each get a "Total units based on interval data X kWh" line,
// distinguished by whether the preceding meter-reading block is the solar register.
const INTERVAL_TOTAL_RE = /total\s+units\s+based\s+on\s+interval\s+data\s+([\d,]+(?:\.\d+)?)\s*kwh/gi

function intervalTotals(text: string): { usage: number | null; solar: number | null } {
  let usage: number | null = null
  let solar: number | null = null
  for (const m of text.matchAll(INTERVAL_TOTAL_RE)) {
    const value = parseNumber(m[1])
    if (value === null) continue
    // Only the section heading ("Solar readings" / register B1) marks the solar register -
    // a plain "solar" mention isn't enough, the usage total can sit right below the plan
    // summary's "Average daily solar export" line.
    const lookback = text.slice(Math.max(0, m.index - 200), m.index)
    if (/solar\s+readings|register:?\s*b\d/i.test(lookback)) {
      if (solar === null) solar = value
    } else if (usage === null) {
      usage = value
    }
  }
  return { usage, solar }
}
const EXPORT_ROW_RE =
  /(?:solar\s+export|solar\s+fit|solar\s+feed[\s-]?in|feed[\s-]?in(?:\s+tariff)?)\*?\D{0,40}?([\d,]+(?:\.\d+)?)\s*kwh/gi

const SUPPLY_PATTERNS: RegExp[] = [
  /(?<!gas\s)(?:daily|supply)\s+charge\D{0,25}?\d+\s+days?\s+\$\s*([\d.]+)/i, // GloBird "Daily Charge 9 Days $0.946", OVO "Supply Charge 1 days $1.562"
  /\d+\s+days?\s+\$\s*([\d.]+)\s+\$[\d.,]+\s+(?:daily\s+)?supply\s+charge/i, // AGL "31 days $0.9821 $30.45 Daily Supply charge"
]
const SUPPLY_CENTS_PATTERNS: RegExp[] = [
  /(?:supply\s+charge|daily\s+supply|service\s+to\s+property)\D{0,20}?([\d.]+)\s*[c¢](?:ents)?\s*\/\s*day/i,
  /supply\s+charge\s+\d+\s+([\d.]+)\s*[c¢]\s*\/\s*day/i, // OVO 2024 "Supply Charge 31 148.50000¢/day"
]
const SUPPLY_DOLLARS_RE = /(?:supply\s+charge|daily\s+supply|service\s+to\s+property)\D{0,20}?\$\s*([\d.]+)\s*\/\s*day/i

const PROVIDERS: Array<[RegExp, string]> = [
  [/globird/i, 'GloBird'],
  [/ovo\s+energy/i, 'OVO Energy'],
  [/\bagl\b/i, 'AGL'],
  [/origin\s+energy/i, 'Origin'],
  [/energyaustralia/i, 'EnergyAustralia'],
  [/red\s+energy/i, 'Red Energy'],
  [/alinta/i, 'Alinta'],
  [/momentum\s+energy/i, 'Momentum'],
]

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MONTH_INDEX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

function parseBillDate(raw: string): string | null {
  const numMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (numMatch) {
    const [, d, m, yRaw] = numMatch
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
    // AU bills are DD/MM/YYYY, not the US MM/DD/YYYY.
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return Number.isNaN(date.getTime()) ? null : toIsoDateLocal(date)
  }
  // "16 May 2026", "14-Nov-2023", "23 Jan 24" - parsed explicitly so two-digit years
  // can't be misread by the Date constructor.
  const textMatch = raw.match(/^(\d{1,2})[\s-]+([a-z]{3})[a-z]*[\s-]+(\d{2,4})$/i)
  if (textMatch) {
    const [, d, monRaw, yRaw] = textMatch
    const month = MONTH_INDEX[monRaw.toLowerCase()]
    if (month === undefined) return null
    const y = yRaw.length === 2 ? Number(`20${yRaw}`) : Number(yRaw)
    const date = new Date(y, month, Number(d))
    return Number.isNaN(date.getTime()) ? null : toIsoDateLocal(date)
  }
  return null
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number.parseFloat(raw.replace(/,/g, ''))
  return Number.isNaN(n) ? null : n
}

function firstMatch(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const value = parseNumber(text.match(p)?.[1])
    if (value !== null) return value
  }
  return null
}

// ---------------------------------------------------------------------------
// Time-of-use rate table extraction
// ---------------------------------------------------------------------------

const TIME_RANGE_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi

function to24h(hourRaw: string, minuteRaw: string | undefined, ampm: string): string {
  let h = Number(hourRaw) % 12
  if (ampm.toLowerCase() === 'pm') h += 12
  return `${String(h).padStart(2, '0')}:${minuteRaw ?? '00'}`
}

function parseWindows(text: string): ExtractedTouWindow[] {
  const windows: ExtractedTouWindow[] = []
  for (const m of text.matchAll(TIME_RANGE_RE)) {
    const startTime = to24h(m[1], m[2], m[3])
    const endTime = to24h(m[4], m[5], m[6])
    if (startTime !== endTime) windows.push({ startTime, endTime })
  }
  return windows
}

/** Space-insensitive comparison key - PDF extraction splits ligatures ("Off" -> "O ff"). */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

interface RateRow {
  kwh: number
  rate: number
  isFeedIn: boolean
  index: number
  end: number
}

/**
 * Extracts the time-of-use rate table. Two real-world layouts:
 * - label BEFORE the numbers ("Usage - Peak 14.564 kWh $0.5852" - OVO, GloBird), with time
 *   windows either absent (flat rate) or in a separate "When your rates apply" block;
 * - label AFTER the numbers ("551.618 kWh $0.4409 $243.21 6am-10am and 3pm-12am every day
 *   Peak" - AGL), with the window text and name trailing each row.
 */
function extractTouRates(text: string): { touRates: ExtractedTouRate[]; feedInRatePerKwh: number | null } {
  const rows: RateRow[] = []
  for (const m of text.matchAll(/([\d,]+(?:\.\d+)?)\s*kwh\s+(-?)\$\s*([\d.]+)/gi)) {
    const kwh = parseNumber(m[1])
    const rate = parseNumber(m[3])
    if (kwh === null || rate === null) continue
    const lookback = text.slice(Math.max(0, m.index - 60), m.index)
    const isFeedIn = m[2] === '-' || EXPORT_CONTEXT_RE.test(lookback)
    rows.push({ kwh, rate, isFeedIn, index: m.index, end: m.index + m[0].length })
  }
  // OVO 2024 layout: "EV Charging 702.73 7.99997¢/kWh $56.22" - units without a kWh suffix,
  // rate in cents. A feed-in row shows as a negative dollar amount ("Solar FiT ... -$50.53").
  for (const m of text.matchAll(/([\d,]+(?:\.\d+)?)\s+([\d.]+)\s*¢\s*\/\s*kwh\s+(-?)\$/gi)) {
    const kwh = parseNumber(m[1])
    const cents = parseNumber(m[2])
    if (kwh === null || cents === null) continue
    const lookback = text.slice(Math.max(0, m.index - 60), m.index)
    const isFeedIn = m[3] === '-' || EXPORT_CONTEXT_RE.test(lookback)
    rows.push({ kwh, rate: cents / 100, isFeedIn, index: m.index, end: m.index + m[0].length })
  }
  rows.sort((a, b) => a.index - b.index)

  const feedInRatePerKwh = rows.find((r) => r.isFeedIn)?.rate ?? null
  const usageRows = rows.filter((r) => !r.isFeedIn)
  if (usageRows.length === 0) return { touRates: [], feedInRatePerKwh }

  // Text trailing each row, up to the next row / a "N days" supply line / a length cap,
  // with the row's own $-amount stripped off the front.
  const postText = (row: RateRow): string => {
    const nextIndex = rows.find((r) => r.index > row.end)?.index ?? row.end + 140
    let seg = text.slice(row.end, Math.min(nextIndex, row.end + 140))
    seg = seg.replace(/^\s*-?\$\s*[\d.,]+\s*(?:cr)?/i, '')
    const daysCut = seg.search(/\d[\d,]*\s+days?\b/i)
    if (daysCut >= 0) seg = seg.slice(0, daysCut)
    return seg
  }

  const labelAfterMode = usageRows.some((row) => {
    const seg = postText(row)
    return new RegExp(TIME_RANGE_RE.source, 'i').test(seg) || /not applicable/i.test(seg)
  })

  const touRates: ExtractedTouRate[] = []

  if (labelAfterMode) {
    for (const row of usageRows) {
      const seg = postText(row)
      const windows = parseWindows(seg)
      const name = seg
        .replace(TIME_RANGE_RE, ' ')
        .replace(/\bevery ?day\b|\bnot applicable\b|\band\b/gi, ' ')
        .replace(/[^a-z0-9&/\- ]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      touRates.push({ name: name || 'Rate', ratePerKwh: row.rate, kwh: row.kwh, windows })
    }
  } else {
    for (const row of usageRows) {
      // Name is the trailing text run just before the quantity, with any table-header
      // words ("Units Price Amount"...) and section headings peeled off the front.
      const pre = text.slice(Math.max(0, row.index - 90), row.index)
      let name = (pre.match(/[A-Za-z][A-Za-z0-9&/\- ]*$/)?.[0] ?? '').replace(/\s+/g, ' ').trim()
      const HEADERS = new Set(['units', 'price', 'amount', 'description', 'quantity', 'rates', 'rate', 'total', 'credits', 'new', 'and', 'charges'])
      for (;;) {
        const stripped = name.replace(/^usage and supply charges\s+/i, '')
        if (stripped !== name) {
          name = stripped
          continue
        }
        const words = name.split(' ')
        if (words.length > 1 && HEADERS.has(words[0].toLowerCase())) {
          name = words.slice(1).join(' ')
          continue
        }
        break
      }
      touRates.push({ name: name || 'Rate', ratePerKwh: row.rate, kwh: row.kwh, windows: [] })
    }

    // OVO-style "When your rates apply:" block - windows listed separately, keyed by name.
    const blockMatch = text.match(/when your rates apply:?\s*(.{0,600})/i)
    if (blockMatch) {
      const block = blockMatch[1]
      const entries: Array<{ key: string; start: number; textStart: number }> = []
      for (const m of block.matchAll(/([A-Za-z][A-Za-z /]{1,40}?)\s*\([^)]*\)\s*[-–]\s*/g)) {
        entries.push({ key: nameKey(m[1]), start: m.index, textStart: m.index + m[0].length })
      }
      const windowsByKey = entries.map((e, i) => ({
        key: e.key,
        windows: parseWindows(block.slice(e.textStart, entries[i + 1]?.start ?? Math.min(block.length, e.textStart + 120))),
      }))
      // Longest key first so "Super Off Peak" wins over "Peak".
      windowsByKey.sort((a, b) => b.key.length - a.key.length)
      for (const rate of touRates) {
        if (rate.windows.length > 0) continue
        // Pass 1: full name. Pass 2: filler words stripped, so "EV Charging" matches "EV Off peak".
        const fullKey = nameKey(rate.name)
        const strippedKey = nameKey(rate.name.replace(/\b(usage|charging|charge|energy)\b/gi, ' '))
        for (const rateKey of [fullKey, strippedKey]) {
          if (rateKey.length < 2) continue
          const hit = windowsByKey.find((w) => rateKey.includes(w.key) || w.key.includes(rateKey))
          if (hit) {
            rate.windows = hit.windows
            break
          }
        }
      }
    }
  }

  return { touRates, feedInRatePerKwh }
}

/** Sums tariff-table consumption rows, skipping export/feed-in rows and per-day averages. */
function sumUsageComponents(text: string): number | null {
  let sum = 0
  let found = false
  for (const m of text.matchAll(COMPONENT_ROW_RE)) {
    const lookback = text.slice(Math.max(0, m.index - 60), m.index)
    if (EXPORT_CONTEXT_RE.test(lookback) || AVERAGE_DAILY_RE.test(lookback)) continue
    const value = parseNumber(m[1])
    if (value === null) continue
    sum += value
    found = true
  }
  return found ? Math.round(sum * 1000) / 1000 : null
}

function findExport(text: string): number | null {
  const explicit = parseNumber(text.match(TOTAL_GENERATION_RE)?.[1])
  if (explicit !== null) return explicit
  for (const m of text.matchAll(EXPORT_ROW_RE)) {
    // "Average daily solar export for this bill 0.10 kWh" is a per-day figure, not the total.
    const lookback = text.slice(Math.max(0, m.index - 30), m.index)
    if (AVERAGE_DAILY_RE.test(lookback)) continue
    const value = parseNumber(m[1])
    if (value !== null) return value
  }
  return null
}

export function extractBillFields(text: string): ExtractedBillData {
  const normalized = text.replace(/\s+/g, ' ').trim()

  const provider = PROVIDERS.find(([re]) => re.test(normalized))?.[1] ?? null

  let periodStart: string | null = null
  let periodEnd: string | null = null
  const rangeMatch = normalized.match(LABELED_RANGE_RE) ?? normalized.match(GENERIC_RANGE_RE)
  if (rangeMatch) {
    periodStart = parseBillDate(rangeMatch[1])
    periodEnd = parseBillDate(rangeMatch[2])
  }

  const totalCostAud = firstMatch(normalized, TOTAL_PATTERNS)

  const fromIntervals = intervalTotals(normalized)
  const totalUsageKwh =
    parseNumber(normalized.match(TOTAL_USAGE_RE)?.[1]) ??
    parseNumber(normalized.match(LEGACY_USAGE_RE)?.[1]) ??
    fromIntervals.usage ??
    sumUsageComponents(normalized)

  const totalExportKwh = findExport(normalized) ?? fromIntervals.solar

  const supplyDollars = firstMatch(normalized, SUPPLY_PATTERNS)
  const supplyCents = firstMatch(normalized, SUPPLY_CENTS_PATTERNS)
  const supplyChargeAud =
    supplyDollars ?? (supplyCents !== null ? supplyCents / 100 : parseNumber(normalized.match(SUPPLY_DOLLARS_RE)?.[1]))

  const { touRates, feedInRatePerKwh } = extractTouRates(normalized)
  // Bills that show an explicit ex-GST subtotal (AGL) itemise their rates ex-GST too.
  const ratesGstInclusive = !/\(excluding\s+gst\)/i.test(normalized)

  return {
    provider,
    periodStart,
    periodEnd,
    totalCostAud,
    totalUsageKwh,
    totalExportKwh,
    supplyChargeAud,
    touRates,
    feedInRatePerKwh,
    ratesGstInclusive,
    rawText: text,
  }
}
