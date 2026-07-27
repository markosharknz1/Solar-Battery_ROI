import { useEffect, useState } from 'react'
import { readShareLinkFromLocation, clearShareLinkFromUrl } from '@/lib/shareLink'
import { useTariffStore } from '@/store/tariffStore'
import { useBatteryStore } from '@/store/batteryStore'

export function useImportSharedLink() {
  const [imported, setImported] = useState<{ planCount: number; hasQuote: boolean } | null>(null)
  const addPlan = useTariffStore((s) => s.addPlan)
  const addQuote = useBatteryStore((s) => s.addQuote)

  useEffect(() => {
    const payload = readShareLinkFromLocation()
    if (!payload) return

    for (const plan of payload.plans) {
      addPlan({ ...plan, id: crypto.randomUUID(), createdAt: new Date().toISOString(), isActive: false })
    }
    if (payload.quote) {
      addQuote({ ...payload.quote, id: crypto.randomUUID() })
    }

    setImported({ planCount: payload.plans.length, hasQuote: payload.quote !== null })
    clearShareLinkFromUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return imported
}
