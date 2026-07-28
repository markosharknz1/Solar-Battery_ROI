import type { RatePeriod } from '@/types/tariff'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function RatePeriodRow({
  period,
  onChange,
  onDelete,
}: {
  period: RatePeriod
  onChange: (updates: Partial<RatePeriod>) => void
  onDelete: () => void
}) {
  const toggleDay = (idx: number) => {
    const days = [...period.days]
    days[idx] = !days[idx]
    onChange({ days })
  }

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <div className="flex items-center gap-2">
        <Input
          className="flex-1"
          value={period.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Period name"
        />
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {DAY_LABELS.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => toggleDay(idx)}
            className={`rounded px-1.5 py-0.5 text-xs ${
              period.days[idx] ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className="text-[10px] text-muted-foreground underline" onClick={() => onChange({ days: [true, true, true, true, true, false, false] })}>
          Weekdays
        </button>
        <button type="button" className="text-[10px] text-muted-foreground underline" onClick={() => onChange({ days: [false, false, false, false, false, true, true] })}>
          Weekends
        </button>
        <button type="button" className="text-[10px] text-muted-foreground underline" onClick={() => onChange({ days: [true, true, true, true, true, true, true] })}>
          All
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Start</Label>
          <Input type="time" step={1800} className="w-28" value={period.startTime} onChange={(e) => onChange({ startTime: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">End</Label>
          <Input type="time" step={1800} className="w-28" value={period.endTime} onChange={(e) => onChange({ endTime: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Rate (c/kWh)</Label>
          <Input
            type="number"
            step="0.1"
            className="w-24"
            value={Math.round(period.ratePerKwh * 1000) / 10}
            onChange={(e) => onChange({ ratePerKwh: (Number.parseFloat(e.target.value) || 0) / 100 })}
          />
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
          <Checkbox checked={period.gstInclusive} onCheckedChange={(v) => onChange({ gstInclusive: v === true })} />
          GST incl.
        </label>
      </div>
    </div>
  )
}
