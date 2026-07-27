import { useState } from 'react'
import type { TariffPlan } from '@/types/tariff'
import type { BatteryQuote } from '@/types/battery'
import { buildShareLink } from '@/lib/shareLink'
import { Button } from '@/components/ui/button'
import { Link2 } from 'lucide-react'

export function ShareLinkButton({ plans, quote }: { plans: TariffPlan[]; quote: BatteryQuote | null }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const link = buildShareLink(plans, quote)
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void share()}>
      <Link2 className="mr-1 h-3 w-3" />
      {copied ? 'Link copied!' : 'Share comparison link'}
    </Button>
  )
}
