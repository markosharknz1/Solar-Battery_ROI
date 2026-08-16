import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVppStore } from '@/store/vppStore'
import { vppNetAnnualAud } from '@/lib/vpp'
import type { VppLineItem, VppProgram } from '@/types/battery'

function LineItemTable({
  title,
  hint,
  items,
  onChange,
}: {
  title: string
  hint: string
  items: VppLineItem[]
  onChange: (items: VppLineItem[]) => void
}) {
  const update = (id: string, updates: Partial<VppLineItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...updates } : i)))

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { id: crypto.randomUUID(), label: '', ratePerKwh: 0, kwhPerYear: 0 }])}
        >
          Add
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {items.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground">
            <span className="col-span-5">Description</span>
            <span className="col-span-3">Rate (c/kWh)</span>
            <span className="col-span-3">Est. kWh/yr</span>
            <span className="col-span-1" />
          </div>
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 items-center gap-2">
              <Input
                className="col-span-5"
                placeholder="e.g. Event exports"
                value={item.label}
                onChange={(e) => update(item.id, { label: e.target.value })}
              />
              <Input
                className="col-span-3"
                type="number"
                value={(item.ratePerKwh * 100).toString()}
                onChange={(e) => update(item.id, { ratePerKwh: (Number(e.target.value) || 0) / 100 })}
              />
              <Input
                className="col-span-3"
                type="number"
                value={item.kwhPerYear}
                onChange={(e) => update(item.id, { kwhPerYear: Number(e.target.value) || 0 })}
              />
              <Button variant="ghost" size="sm" className="col-span-1" onClick={() => onChange(items.filter((i) => i.id !== item.id))}>
                ✕
              </Button>
            </div>
          ))}
          <p className="text-right text-xs text-muted-foreground">
            Subtotal: ${items.reduce((s, i) => s + i.ratePerKwh * i.kwhPerYear, 0).toFixed(0)}/yr
          </p>
        </div>
      )}
    </div>
  )
}

function ProgramCard({ program }: { program: VppProgram }) {
  const updateProgram = useVppStore((s) => s.updateProgram)
  const deleteProgram = useVppStore((s) => s.deleteProgram)
  const update = (updates: Partial<VppProgram>) => updateProgram(program.id, updates)
  const net = vppNetAnnualAud(program)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Program name</Label>
            <Input value={program.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div>
            <Label>Provider</Label>
            <Input placeholder="e.g. AGL, Amber, Tesla" value={program.provider} onChange={(e) => update({ provider: e.target.value })} />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="ml-3" onClick={() => deleteProgram(program.id)}>
          Delete
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Upfront rebate ($)</Label>
            <Input
              type="number"
              value={program.upfrontRebateAud}
              onChange={(e) => update({ upfrontRebateAud: Number(e.target.value) || 0 })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              One-off signup rebate - subtracted from the battery's cost when calculating payback.
            </p>
          </div>
          <div>
            <Label>Fixed annual credit ($/yr)</Label>
            <Input
              type="number"
              value={program.fixedAnnualCreditAud}
              onChange={(e) => update({ fixedAnnualCreditAud: Number(e.target.value) || 0 })}
            />
            <p className="mt-1 text-xs text-muted-foreground">Membership or sign-on credits paid regardless of events.</p>
          </div>
        </div>

        <LineItemTable
          title="Export credits - you get paid"
          hint="Each rate the program pays for energy drawn from your battery, with the yearly energy its terms suggest (e.g. event exports, peak demand response, spot-price exports)."
          items={program.exportCredits}
          onChange={(exportCredits) => update({ exportCredits })}
        />
        <LineItemTable
          title="Import charges - you pay"
          hint="Extra energy you buy under the program's terms (e.g. mandated recharge after events, program-controlled charging at a set rate)."
          items={program.importCharges}
          onChange={(importCharges) => update({ importCharges })}
        />

        <p className="text-sm font-semibold">
          Net annual value: <span className={net >= 0 ? 'text-primary' : 'text-destructive'}>${net.toFixed(0)}/yr</span>
          {program.upfrontRebateAud > 0 && (
            <span className="ml-2 font-normal text-muted-foreground">+ ${program.upfrontRebateAud.toFixed(0)} upfront rebate</span>
          )}
        </p>
      </CardContent>
    </Card>
  )
}

export function VppPage() {
  const programs = useVppStore((s) => s.programs)
  const addProgram = useVppStore((s) => s.addProgram)

  return (
    <>
      <PageHeader
        title="VPP programs"
        description="Model Virtual Power Plant offers: rebates, credits, and the program's import/export rates. Select a program on the Battery page to include it in simulations."
      />
      <div className="mb-4">
        <Button onClick={() => addProgram()}>Add VPP program</Button>
      </div>
      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No VPP programs yet. Add one to model what joining a VPP would do to your battery's payback - the upfront
          rebate, ongoing credits, and any energy the program makes you buy or lets you sell.
        </p>
      ) : (
        <div className="space-y-4">
          {programs.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </div>
      )}
    </>
  )
}
