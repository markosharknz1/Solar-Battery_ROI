import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export interface ExtractedBillData {
  periodStart: string | null // YYYY-MM-DD
  periodEnd: string | null
  totalCostAud: number | null
  totalUsageKwh: number | null
  totalExportKwh: number | null
  supplyChargeAud: number | null // $/day
  rawText: string
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pageTexts: string[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    pageTexts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  return pageTexts.join('\n')
}

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'
const DATE_TEXT = `\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\s+\\d{4}`
const DATE_NUM = `\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}`
const DATE_ALT = `(?:${DATE_TEXT}|${DATE_NUM})`

const DATE_RANGE_RE = new RegExp(`(${DATE_ALT})\\s*(?:to|-|–|—|until)\\s*(${DATE_ALT})`, 'i')

const TOTAL_COST_RE =
  /(?:total\s+amount\s+(?:payable|due)|amount\s+due|total\s+(?:charges|payable|for\s+this\s+bill)|new\s+charges|balance\s+due)\D{0,15}?\$\s*([\d,]+\.\d{2})/i
const USAGE_KWH_RE =
  /(?:total\s+(?:usage|consumption|electricity\s+usage)|electricity\s+usage|usage\s+total|you\s+used)\D{0,20}?([\d,]+(?:\.\d+)?)\s*kwh/i
const EXPORT_KWH_RE =
  /(?:solar\s+export|feed[\s-]?in|exported\s+to\s+grid|export(?:ed)?\s+energy)\D{0,20}?([\d,]+(?:\.\d+)?)\s*kwh/i
const SUPPLY_CHARGE_CENTS_RE = /(?:supply\s+charge|daily\s+supply|service\s+to\s+property)\D{0,20}?([\d.]+)\s*c(?:ents)?\s*\/\s*day/i
const SUPPLY_CHARGE_DOLLARS_RE = /(?:supply\s+charge|daily\s+supply|service\s+to\s+property)\D{0,20}?\$\s*([\d.]+)\s*\/\s*day/i

// Builds YYYY-MM-DD from a Date's *local* calendar fields - never .toISOString(), which
// converts through UTC and rolls the date back a day for any timezone ahead of UTC
// (all of Australia), turning a bill dated 15 Dec into 14 Dec.
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
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : toIsoDateLocal(date)
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number.parseFloat(raw.replace(/,/g, ''))
  return Number.isNaN(n) ? null : n
}

/**
 * Best-effort keyword/regex extraction over a bill's raw PDF text. Retailer bill layouts vary
 * enormously, so any field this can't confidently match is left null rather than guessed -
 * the caller should always let the user review and correct every field before saving.
 */
export function extractBillFields(text: string): ExtractedBillData {
  const normalized = text.replace(/\s+/g, ' ').trim()

  let periodStart: string | null = null
  let periodEnd: string | null = null
  const rangeMatch = normalized.match(DATE_RANGE_RE)
  if (rangeMatch) {
    periodStart = parseBillDate(rangeMatch[1])
    periodEnd = parseBillDate(rangeMatch[2])
  }

  const totalCostAud = parseNumber(normalized.match(TOTAL_COST_RE)?.[1])
  const totalUsageKwh = parseNumber(normalized.match(USAGE_KWH_RE)?.[1])
  const totalExportKwh = parseNumber(normalized.match(EXPORT_KWH_RE)?.[1])

  const supplyCents = normalized.match(SUPPLY_CHARGE_CENTS_RE)?.[1]
  const supplyDollars = normalized.match(SUPPLY_CHARGE_DOLLARS_RE)?.[1]
  const supplyChargeAud = supplyCents ? parseNumber(supplyCents)! / 100 : parseNumber(supplyDollars)

  return { periodStart, periodEnd, totalCostAud, totalUsageKwh, totalExportKwh, supplyChargeAud, rawText: text }
}
