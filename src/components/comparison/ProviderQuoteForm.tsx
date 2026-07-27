import type { ProviderQuote } from '@/types/tariff'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function computeProviderTotals(quote: ProviderQuote) {
  const filled = quote.monthlyAmounts.filter((v) => v > 0)
  const monthsEntered = filled.length
  const rawTotal = filled.reduce((a, v) => a + v, 0)
  const annualEstimate = monthsEntered > 0 ? (rawTotal / monthsEntered) * 12 - quote.annualConcessionsAud : 0
  const supplyPerYear = quote.dailySupplyCharge * 365 * (quote.gstInclusive ? 1 : 1.1)
  const energyPerYear = Math.max(0, annualEstimate - supplyPerYear)
  return { monthsEntered, annualEstimate, supplyPerYear, energyPerYear, monthlyAvg: annualEstimate / 12 }
}

export function ProviderQuoteForm({
  quote,
  onChange,
  onRemove,
}: {
  quote: ProviderQuote
  onChange: (updates: Partial<ProviderQuote>) => void
  onRemove: () => void
}) {
  const totals = computeProviderTotals(quote)
  const periodLabel = quote.billingPeriodDays === 30 ? 'Monthly' : quote.billingPeriodDays === 90 ? 'Quarterly' : 'Custom'

  const setMonth = (idx: number, value: string) => {
    const amounts = [...quote.monthlyAmounts]
    amounts[idx] = Number.parseFloat(value) || 0
    onChange({ monthlyAmounts: amounts })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="text-base">Provider quote</CardTitle>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Provider name</Label>
          <Input value={quote.providerName} onChange={(e) => onChange({ providerName: e.target.value })} />
        </div>
        <div>
          <Label>Plan name</Label>
          <Input value={quote.planName} onChange={(e) => onChange({ planName: e.target.value })} />
        </div>

        <div className="flex items-center justify-between">
          <Label>Amounts include GST</Label>
          <Switch checked={quote.gstInclusive} onCheckedChange={(v) => onChange({ gstInclusive: v })} />
        </div>
        {!quote.gstInclusive && <p className="text-xs text-muted-foreground">+10% GST will be added to the supply charge total.</p>}

        <div>
          <Label>Billing period</Label>
          <Select
            value={periodLabel}
            onValueChange={(v) => onChange({ billingPeriodDays: v === 'Monthly' ? 30 : v === 'Quarterly' ? 90 : quote.billingPeriodDays })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Monthly">Monthly (30 days)</SelectItem>
              <SelectItem value="Quarterly">Quarterly (90 days)</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {periodLabel === 'Custom' && (
            <Input
              type="number"
              className="mt-1"
              value={quote.billingPeriodDays}
              onChange={(e) => onChange({ billingPeriodDays: Number(e.target.value) || 30 })}
            />
          )}
        </div>

        <div>
          <Label>Daily supply charge ($/day)</Label>
          <Input type="number" step="0.01" value={quote.dailySupplyCharge} onChange={(e) => onChange({ dailySupplyCharge: Number(e.target.value) || 0 })} />
        </div>

        <div>
          <Label className="mb-1 block">Bill amounts ($) - enter what you have, leave 0 for no data</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_LABELS.map((m, idx) => (
              <div key={m}>
                <span className="text-[10px] text-muted-foreground">{m}</span>
                <Input type="number" step="0.01" className="h-8 text-xs" value={quote.monthlyAmounts[idx] || ''} onChange={(e) => setMonth(idx, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>Annual concessions/rebates ($)</Label>
          <Input type="number" value={quote.annualConcessionsAud} onChange={(e) => onChange({ annualConcessionsAud: Number(e.target.value) || 0 })} />
        </div>

        <div className="rounded-md bg-accent px-3 py-2 text-xs">
          <p>Months entered: {totals.monthsEntered}</p>
          <p>Annual estimate: ${totals.annualEstimate.toFixed(0)}</p>
          <p>Supply/energy split: ${totals.supplyPerYear.toFixed(0)} / ${totals.energyPerYear.toFixed(0)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
