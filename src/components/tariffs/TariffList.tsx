import { useRef, useState } from 'react'
import type { TariffPlan } from '@/types/tariff'
import { useTariffStore } from '@/store/tariffStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TariffEditor } from '@/components/tariffs/TariffEditor'
import { Plus, Download, Upload } from 'lucide-react'

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
        gstInclusive: true,
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
        gstInclusive: true,
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
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

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

  const save = (plan: TariffPlan) => {
    if (isNew) addPlan(plan)
    else updatePlan(plan.id, plan)
    setEditingPlan(null)
  }

  const exportPlans = () => {
    const payload = { app: 'solar-battery-advisor', kind: 'tariff-plans', version: 1, plans }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tariff-plans-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importPlans = async (file: File) => {
    setImportMessage(null)
    try {
      const parsed = JSON.parse(await file.text())
      const incoming: unknown = parsed?.kind === 'tariff-plans' ? parsed.plans : Array.isArray(parsed) ? parsed : null
      if (!Array.isArray(incoming)) throw new Error('not a tariff plans file')
      let added = 0
      for (const p of incoming) {
        if (!p || typeof p.name !== 'string' || !Array.isArray(p.periods)) continue
        // Fresh ids so re-importing the same file can't collide with existing plans.
        addPlan({
          ...p,
          id: crypto.randomUUID(),
          isActive: false,
          createdAt: new Date().toISOString(),
        })
        added++
      }
      setImportMessage(added > 0 ? `Imported ${added} plan${added === 1 ? '' : 's'}.` : 'No valid plans found in that file.')
    } catch {
      setImportMessage("Couldn't read that file - expected a tariff plans JSON exported from this app.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Add new plan
          </Button>
          <Button variant="outline" onClick={exportPlans} disabled={plans.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export plans
          </Button>
          <Button variant="outline" onClick={() => importInputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Import plans
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importPlans(file)
              e.target.value = ''
            }}
          />
        </div>
        {plans.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Active plan</Label>
            <Select value={activePlanId ?? ''} onValueChange={setActivePlan}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose active plan..." />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {importMessage && <p className="text-sm text-muted-foreground">{importMessage}</p>}

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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add new plan' : 'Edit plan'}</DialogTitle>
          </DialogHeader>
          {editingPlan && <TariffEditor plan={editingPlan} onSave={save} onCancel={() => setEditingPlan(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
