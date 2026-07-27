import { useState } from 'react'
import type { TariffPlan } from '@/types/tariff'
import { useTariffStore } from '@/store/tariffStore'
import { TARIFF_PRESETS } from '@/lib/tariffPresets'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TariffEditor } from '@/components/tariffs/TariffEditor'
import { Plus } from 'lucide-react'

function blankPlan(): TariffPlan {
  return {
    id: crypto.randomUUID(),
    name: 'New plan',
    provider: '',
    state: 'SA',
    fixedCharges: [{ id: crypto.randomUUID(), label: 'Supply charge', amountPerDay: 1.0, gstInclusive: true }],
    periods: [
      {
        id: crypto.randomUUID(),
        name: 'All hours',
        startTime: '00:00',
        endTime: '00:00',
        ratePerKwh: 0.3,
        days: [true, true, true, true, true, true, true],
      },
    ],
    feedInPeriods: [
      {
        id: crypto.randomUUID(),
        name: 'Standard FiT',
        startTime: '00:00',
        endTime: '00:00',
        ratePerKwh: 0.05,
        days: [true, true, true, true, true, true, true],
      },
    ],
    controlledLoadRate: null,
    controlledLoad2Rate: null,
    publicHolidaysAsWeekends: false,
    notes: '',
    isActive: false,
    createdAt: new Date().toISOString(),
  }
}

export function TariffList() {
  const plans = useTariffStore((s) => s.plans)
  const addPlan = useTariffStore((s) => s.addPlan)
  const updatePlan = useTariffStore((s) => s.updatePlan)
  const deletePlan = useTariffStore((s) => s.deletePlan)
  const activePlanId = useTariffStore((s) => s.activePlanId)
  const setActivePlan = useTariffStore((s) => s.setActivePlan)

  const [editingPlan, setEditingPlan] = useState<TariffPlan | null>(null)
  const [isNew, setIsNew] = useState(false)

  const openNew = () => {
    setEditingPlan(blankPlan())
    setIsNew(true)
  }

  const openEdit = (plan: TariffPlan) => {
    setEditingPlan(plan)
    setIsNew(false)
  }

  const duplicate = (plan: TariffPlan) => {
    addPlan({ ...plan, id: crypto.randomUUID(), name: `${plan.name} (copy)`, createdAt: new Date().toISOString(), isActive: false })
  }

  const loadPreset = (presetId: string) => {
    const preset = TARIFF_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    addPlan({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), isActive: false, ...preset.build() })
  }

  const save = (plan: TariffPlan) => {
    if (isNew) addPlan(plan)
    else updatePlan(plan.id, plan)
    setEditingPlan(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add new plan
        </Button>
        <Select onValueChange={loadPreset}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Load preset..." />
          </SelectTrigger>
          <SelectContent>
            {TARIFF_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {activePlanId === plan.id && <Badge>Active</Badge>}
              </div>
              <CardDescription>
                {plan.provider || 'No provider set'} ({plan.state}) - $
                {plan.fixedCharges.reduce((a, c) => a + c.amountPerDay, 0).toFixed(2)}/day - {plan.periods.length} rate
                period(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => duplicate(plan)}>
                Duplicate
              </Button>
              {activePlanId !== plan.id && (
                <Button size="sm" variant="outline" onClick={() => setActivePlan(plan.id)}>
                  Set active
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => deletePlan(plan.id)}>
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editingPlan !== null} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add new plan' : 'Edit plan'}</DialogTitle>
          </DialogHeader>
          {editingPlan && <TariffEditor plan={editingPlan} onSave={save} onCancel={() => setEditingPlan(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
