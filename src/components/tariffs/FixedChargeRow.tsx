import type { FixedCharge } from '@/types/tariff'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

export function FixedChargeRow({
  charge,
  onChange,
  onDelete,
}: {
  charge: FixedCharge
  onChange: (updates: Partial<FixedCharge>) => void
  onDelete: () => void
}) {
  return (
    <div className="grid grid-cols-12 items-center gap-2 rounded-md border p-2 text-sm">
      <Input
        className="col-span-6"
        value={charge.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Description"
      />
      <Input
        className="col-span-3"
        type="number"
        step="0.0001"
        value={charge.amountPerDay}
        onChange={(e) => onChange({ amountPerDay: Number.parseFloat(e.target.value) || 0 })}
      />
      <label className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox checked={charge.gstInclusive} onCheckedChange={(v) => onChange({ gstInclusive: v === true })} />
        GST incl.
      </label>
      <Button variant="ghost" size="icon" className="col-span-1" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
