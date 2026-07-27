import type { RatePeriod } from '@/types/tariff'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2 } from 'lucide-react'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIME_OPTIONS = Array.from({ length: 48 }, (_, slot) => {
  const totalMin = slot * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

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
    <div className="grid grid-cols-12 items-center gap-2 rounded-md border p-2 text-sm">
      <Input
        className="col-span-3"
        value={period.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Period name"
      />
      <div className="col-span-3 flex flex-wrap gap-1">
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
        <div className="mt-1 flex gap-1">
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
      </div>
      <Select value={period.startTime} onValueChange={(v) => onChange({ startTime: v })}>
        <SelectTrigger className="col-span-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {TIME_OPTIONS.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={period.endTime} onValueChange={(v) => onChange({ endTime: v })}>
        <SelectTrigger className="col-span-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {TIME_OPTIONS.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="col-span-1"
        type="number"
        step="0.001"
        value={period.ratePerKwh}
        onChange={(e) => onChange({ ratePerKwh: Number.parseFloat(e.target.value) || 0 })}
      />
      <Button variant="ghost" size="icon" className="col-span-1" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
