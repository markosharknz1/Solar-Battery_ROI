import { useState } from 'react'
import type { AustralianState, TariffPlan } from '@/types/tariff'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RatePeriodRow } from '@/components/tariffs/RatePeriodRow'
import { FeedInPeriodRow } from '@/components/tariffs/FeedInPeriodRow'
import { FixedChargeRow } from '@/components/tariffs/FixedChargeRow'
import { TariffWeekView } from '@/components/tariffs/TariffWeekView'
import { STATE_LABELS } from '@/lib/stateDefaults'
import { Plus } from 'lucide-react'

const blankPeriod = (rate = 0.3) => ({
  id: crypto.randomUUID(),
  name: 'New period',
  startTime: '00:00',
  endTime: '00:00',
  ratePerKwh: rate,
  days: [true, true, true, true, true, true, true],
})

export function TariffEditor({
  plan,
  onSave,
  onCancel,
}: {
  plan: TariffPlan
  onSave: (plan: TariffPlan) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<TariffPlan>(plan)

  const updatePeriod = (id: string, updates: Partial<TariffPlan['periods'][number]>) => {
    setDraft({ ...draft, periods: draft.periods.map((p) => (p.id === id ? { ...p, ...updates } : p)) })
  }
  const deletePeriod = (id: string) => setDraft({ ...draft, periods: draft.periods.filter((p) => p.id !== id) })
  const addPeriod = () => setDraft({ ...draft, periods: [...draft.periods, blankPeriod()] })

  const updateFeedIn = (id: string, updates: Partial<TariffPlan['feedInPeriods'][number]>) => {
    setDraft({ ...draft, feedInPeriods: draft.feedInPeriods.map((p) => (p.id === id ? { ...p, ...updates } : p)) })
  }
  const deleteFeedIn = (id: string) => setDraft({ ...draft, feedInPeriods: draft.feedInPeriods.filter((p) => p.id !== id) })
  const addFeedIn = () => setDraft({ ...draft, feedInPeriods: [...draft.feedInPeriods, blankPeriod(0.06)] })

  const updateCharge = (id: string, updates: Partial<TariffPlan['fixedCharges'][number]>) => {
    setDraft({ ...draft, fixedCharges: draft.fixedCharges.map((c) => (c.id === id ? { ...c, ...updates } : c)) })
  }
  const deleteCharge = (id: string) => setDraft({ ...draft, fixedCharges: draft.fixedCharges.filter((c) => c.id !== id) })
  const addCharge = () =>
    setDraft({
      ...draft,
      fixedCharges: [...draft.fixedCharges, { id: crypto.randomUUID(), label: 'New charge', amountPerDay: 0, gstInclusive: true }],
    })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Plan name</Label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <Label>Provider</Label>
          <Input value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} />
        </div>
        <div>
          <Label>State</Label>
          <Select value={draft.state} onValueChange={(v) => setDraft({ ...draft, state: v as AustralianState })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATE_LABELS) as AustralianState[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {s} - {STATE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Fixed daily charges</Label>
          <Button size="sm" variant="outline" onClick={addCharge}>
            <Plus className="mr-1 h-3 w-3" /> Add charge
          </Button>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Check your bill for "supply charge", "service to property", "metering" or "network charges".
        </p>
        <div className="space-y-2">
          {draft.fixedCharges.map((c) => (
            <FixedChargeRow key={c.id} charge={c} onChange={(u) => updateCharge(c.id, u)} onDelete={() => deleteCharge(c.id)} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Import rate periods</Label>
          <Button size="sm" variant="outline" onClick={addPeriod}>
            <Plus className="mr-1 h-3 w-3" /> Add period
          </Button>
        </div>
        <div className="space-y-2">
          {draft.periods.map((p) => (
            <RatePeriodRow key={p.id} period={p} onChange={(u) => updatePeriod(p.id, u)} onDelete={() => deletePeriod(p.id)} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Solar export (feed-in) rates</Label>
          <Button size="sm" variant="outline" onClick={addFeedIn}>
            <Plus className="mr-1 h-3 w-3" /> Add period
          </Button>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Leave as one all-day row for a flat feed-in rate. Set to 0 for periods your retailer pays nothing.
        </p>
        <div className="space-y-2">
          {draft.feedInPeriods.map((p) => (
            <FeedInPeriodRow key={p.id} period={p} onChange={(u) => updateFeedIn(p.id, u)} onDelete={() => deleteFeedIn(p.id)} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Controlled load 1 rate (c/kWh)</Label>
          <Input
            type="number"
            step="0.01"
            value={draft.controlledLoadRate ?? ''}
            placeholder="Leave blank if not applicable"
            onChange={(e) => setDraft({ ...draft, controlledLoadRate: e.target.value === '' ? null : Number.parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <Label>Controlled load 2 rate (c/kWh)</Label>
          <Input
            type="number"
            step="0.01"
            value={draft.controlledLoad2Rate ?? ''}
            placeholder="Leave blank if not applicable"
            onChange={(e) => setDraft({ ...draft, controlledLoad2Rate: e.target.value === '' ? null : Number.parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <Label>Treat public holidays as weekends</Label>
        <Switch
          checked={draft.publicHolidaysAsWeekends}
          onCheckedChange={(v) => setDraft({ ...draft, publicHolidaysAsWeekends: v })}
        />
      </div>

      {(draft.periods.length > 0 || draft.feedInPeriods.length > 0) && (
        <div>
          <Label className="mb-2 block">Weekly schedule preview</Label>
          <TariffWeekView periods={draft.periods} feedInPeriods={draft.feedInPeriods} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(draft)}>Save plan</Button>
      </div>
    </div>
  )
}
