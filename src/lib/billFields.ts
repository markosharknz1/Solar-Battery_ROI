/**
 * Pure text parsing for PDF bills - no pdfjs imports, so it can be unit-tested in Node.
 * Patterns are tuned against real AGL, GloBird (dual-fuel), and OVO Energy bills plus
 * generic layouts. Anything that can't be confidently matched is left null; the caller
 * must always let the user review and correct every field before saving.
 */

export interface ExtractedBillData {
  provider: string | null
  periodStart: string | null // YYYY-MM-DD
  periodEnd: string | null
  totalCostAud: number | null
  totalUsageKwh: number | null
  totalExportKwh: number | null
  supplyChargeAud: number | null // $/day
  rawText: string
}

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'
const DATE_TEXT = `\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\s+\\d{4}` // 16 May 2026
const DATE_HYPHEN = `\\d{1,2}-(?:${MONTHS})[a-z]*-\\d{4}` // 14-Nov-2023 (GloBird)
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
  /total\s+new\s+charges\s+and\s+credits\s*\(including\s+gst\)\s*=?\s*\$\s*([\d,]+\.\d{2})/i, // AGL, OVO
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
const EXPORT_ROW_RE =
  /(?:solar\s+export|solar\s+fit|solar\s+feed[\s-]?in|feed[\s-]?in(?:\s+tariff)?)\*?\D{0,40}?([\d,]+(?:\.\d+)?)\s*kwh/gi

const SUPPLY_PATTERNS: RegExp[] = [
  /(?<!gas\s)(?:daily|supply)\s+charge\D{0,25}?\d+\s+days?\s+\$\s*([\d.]+)/i, // GloBird "Daily Charge 9 Days $0.946", OVO "Supply Charge 1 days $1.562"
  /\d+\s+days?\s+\$\s*([\d.]+)\s+\$[\d.,]+\s+(?:daily\s+)?supply\s+charge/i, // AGL "31 days $0.9821 $30.45 Daily Supply charge"
]
const SUPPLY_CENTS_RE = /(?:supply\s+charge|daily\s+supply|service\s+to\s+property)\D{0,20}?([\d.]+)\s*c(?:ents)?\s*\/\s*day/i
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

function parseBillDate(raw: string): string | null {
  const numMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (numMatch) {
    const [, d, m, yRaw] = numMatch
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
    // AU bills are DD/MM/YYYY, not the US MM/DD/YYYY.
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return Number.isNaN(date.getTime()) ? null : toIsoDateLocal(date)
  }
  // "14-Nov-2023" parses fine once the hyphens are spaces.
  const date = new Date(raw.replace(/-/g, ' '))
  return Number.isNaN(date.getTime()) ? null : toIsoDateLocal(date)
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

  const totalUsageKwh =
    parseNumber(normalized.match(TOTAL_USAGE_RE)?.[1]) ??
    parseNumber(normalized.match(LEGACY_USAGE_RE)?.[1]) ??
    sumUsageComponents(normalized)

  const totalExportKwh = findExport(normalized)

  const supplyCents = normalized.match(SUPPLY_CENTS_RE)?.[1]
  const supplyChargeAud =
    firstMatch(normalized, SUPPLY_PATTERNS) ??
    (supplyCents ? parseNumber(supplyCents)! / 100 : parseNumber(normalized.match(SUPPLY_DOLLARS_RE)?.[1]))

  return { provider, periodStart, periodEnd, totalCostAud, totalUsageKwh, totalExportKwh, supplyChargeAud, rawText: text }
}
