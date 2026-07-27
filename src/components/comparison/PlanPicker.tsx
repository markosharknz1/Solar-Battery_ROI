import type { TariffPlan } from '@/types/tariff'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export function PlanPicker({
  plans,
  selectedIds,
  onChange,
  max = 4,
}: {
  plans: TariffPlan[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  max?: number
}) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else if (selectedIds.length < max) {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="flex flex-wrap gap-4 rounded-lg border p-4">
      {plans.map((plan) => {
        const checked = selectedIds.includes(plan.id)
        const disabled = !checked && selectedIds.length >= max
        return (
          <label key={plan.id} className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-40' : ''}`}>
            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(plan.id)} />
            <span>{plan.name}</span>
          </label>
        )
      })}
      {plans.length === 0 && <p className="text-sm text-muted-foreground">No saved plans yet.</p>}
      <Label className="sr-only">Select 2-4 plans to compare</Label>
    </div>
  )
}
