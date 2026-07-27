import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { TariffPlan } from '@/types/tariff'
import type { BatteryQuote } from '@/types/battery'

export interface SharePayload {
  plans: TariffPlan[]
  quote: BatteryQuote | null
}

const PARAM = 'share'

/** Builds a shareable URL encoding only tariff plans + a battery quote/strategy - never usage data. */
export function buildShareLink(plans: TariffPlan[], quote: BatteryQuote | null): string {
  const payload: SharePayload = { plans, quote }
  const encoded = compressToEncodedURIComponent(JSON.stringify(payload))
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set(PARAM, encoded)
  return url.toString()
}

export function readShareLinkFromLocation(): SharePayload | null {
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get(PARAM)
  if (!encoded) return null

  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json) as SharePayload
  } catch {
    return null
  }
}

export function clearShareLinkFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete(PARAM)
  window.history.replaceState({}, '', url.toString())
}
