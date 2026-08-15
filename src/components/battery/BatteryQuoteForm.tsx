import type { BatteryQuote } from '@/types/battery'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useTariffStore } from '@/store/tariffStore'
import { useBatteryStore } from '@/store/batteryStore'

export function BatteryQuoteForm({
  onRun,
}: {
  onRun: (quote: BatteryQuote, tariffId: string) => void
}) {
  // The draft lives in the persisted store and is shared with the Strategy Planner tab -
  // edits here show there and vice versa, and nothing is lost switching tabs or restarting.
  const quote = useBatteryStore((s) => s.draftQuote)
  const update = useBatteryStore((s) => s.updateDraftQuote)
  const addQuote = useBatteryStore((s) => s.addQuote)
  const draftTariffId = useBatteryStore((s) => s.draftTariffId)
  const setTariffId = useBatteryStore((s) => s.setDraftTariffId)
  const plans = useTariffStore((s) => s.plans)
  const tariffId = draftTariffId && plans.some((p) => p.id === draftTariffId) ? draftTariffId : (plans[0]?.id ?? '')

  const usesArbitrage = quote.chargePriority === 'solar_then_arbitrage' || quote.chargePriority === 'arbitrage_only'
  const midLifeCapacity = quote.capacityKwh * (1 - (quote.totalDegradationPercent / 100) * 0.5)
  const endOfLifeCapacity = quote.capacityKwh * (1 - quote.totalDegradationPercent / 100)

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <Label>Quote name</Label>
        <Input value={quote.name} onChange={(e) => update({ name: e.target.value })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="capacity-kwh">Battery capacity</Label>
          <div className="flex items-center gap-2">
            <Input
              id="capacity-kwh"
              type="number"
              min={1}
              step={0.5}
              value={quote.capacityKwh}
              onChange={(e) => update({ capacityKwh: Number.parseFloat(e.target.value) || 0 })}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">kWh usable capacity</span>
          </div>
        </div>
        <div>
          <Label>Max charge/discharge power (kW)</Label>
          <Input type="number" value={quote.maxChargeKw} onChange={(e) => update({ maxChargeKw: Number(e.target.value) || 0, maxDischargeKw: Number(e.target.value) || 0 })} />
        </div>
      </div>

      <div>
        <Label htmlFor="installed-cost">Installed cost ($)</Label>
        <Input id="installed-cost" type="number" value={quote.totalCostAud} onChange={(e) => update({ totalCostAud: Number(e.target.value) || 0 })} />
        <p className="mt-1 text-xs text-muted-foreground">
          Enter the final price from your quote - after any rebates or incentives your installer has already applied.
        </p>
      </div>

      <div>
        <Label>Round-trip efficiency: {(quote.roundTripEfficiency * 100).toFixed(0)}%</Label>
        <Slider min={80} max={98} step={1} value={[quote.roundTripEfficiency * 100]} onValueChange={([v]) => update({ roundTripEfficiency: v / 100 })} />
        <p className="mt-1 text-xs text-muted-foreground">
          Typical: ~90% for AC-coupled systems (e.g. Powerwall), ~95% for DC-coupled / hybrid-inverter systems. Check
          the battery's datasheet.
        </p>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Warranty</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Warranty years</Label>
            <Input type="number" value={quote.warrantyYears} onChange={(e) => update({ warrantyYears: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>Warranty throughput (MWh, optional)</Label>
            <Input
              type="number"
              placeholder="Check warranty document"
              value={quote.warrantyThroughputMwh ?? ''}
              onChange={(e) => update({ warrantyThroughputMwh: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Lifetime</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Expected lifetime (years)</Label>
            <Select value={String(quote.lifetimeYears)} onValueChange={(v) => update({ lifetimeYears: Number(v) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y} years
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Capacity loss over lifetime (%)</Label>
            <Input type="number" min={0} max={50} value={quote.totalDegradationPercent} onChange={(e) => update({ totalDegradationPercent: Number(e.target.value) || 0 })} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Mid-life capacity: {midLifeCapacity.toFixed(1)} kWh | End of life: {endOfLifeCapacity.toFixed(1)} kWh
        </p>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Discharge limits</p>
        <div className="space-y-3">
          <div>
            <Label>Maximum discharge: {quote.maxDischargePercent}% (manufacturer health limit)</Label>
            <Slider min={0} max={100} step={1} value={[quote.maxDischargePercent]} onValueChange={([v]) => update({ maxDischargePercent: v })} />
            <p className="mt-1 text-xs text-muted-foreground">
              LFP batteries (BYD, newer Powerwalls) can safely go to 100%. NMC batteries benefit from staying above 20%
              depth.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Target min daily discharge %</Label>
              <Input type="number" value={quote.targetMinDischargePct} onChange={(e) => update({ targetMinDischargePct: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Target max daily discharge %</Label>
              <Input type="number" value={quote.targetMaxDischargePct} onChange={(e) => update({ targetMaxDischargePct: Number(e.target.value) || 0 })} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between">
          <Label>Installer confirmed backup power capability</Label>
          <Switch checked={quote.backupCapable} onCheckedChange={(v) => update({ backupCapable: v })} />
        </div>
        {!quote.backupCapable && (
          <p className="mt-2 text-xs text-muted-foreground">
            Most grid-tied inverters don't support backup power during an outage unless specifically installed with
            backup circuits. Confirm with your installer.
          </p>
        )}
        {quote.backupCapable && (
          <div className="mt-2">
            <Label>Backup reserve: {quote.reservePercent}%</Label>
            <Slider min={0} max={30} step={1} value={[quote.reservePercent]} onValueChange={([v]) => update({ reservePercent: v })} />
          </div>
        )}
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Solar system</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Solar panel capacity (kW)</Label>
            <Input type="number" placeholder="Optional" value={quote.solarSystemKw ?? ''} onChange={(e) => update({ solarSystemKw: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div>
            <Label>Inverter rating (kW)</Label>
            <Input type="number" placeholder="Optional" value={quote.inverterKw ?? ''} onChange={(e) => update({ inverterKw: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div>
            <Label>Network export limit (kW)</Label>
            <Input type="number" placeholder="e.g. 5 (common SA value)" value={quote.exportLimitKw ?? ''} onChange={(e) => update({ exportLimitKw: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Strategy</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Charge from</Label>
            <Select value={quote.chargePriority} onValueChange={(v) => update({ chargePriority: v as BatteryQuote['chargePriority'] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solar_only">Solar only</SelectItem>
                <SelectItem value="solar_then_offpeak">Solar + off-peak top-up</SelectItem>
                <SelectItem value="solar_then_arbitrage">Solar + grid arbitrage</SelectItem>
                <SelectItem value="arbitrage_only">Arbitrage only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Discharge when</Label>
            <Select value={quote.dischargePriority} onValueChange={(v) => update({ dischargePriority: v as BatteryQuote['dischargePriority'] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="peak_only">Peak hours only</SelectItem>
                <SelectItem value="any_import">Any grid import</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {usesArbitrage && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Arbitrage start</Label>
              <Input type="time" value={quote.arbitrageStartTime} onChange={(e) => update({ arbitrageStartTime: e.target.value })} />
            </div>
            <div>
              <Label>Arbitrage end</Label>
              <Input type="time" value={quote.arbitrageEndTime} onChange={(e) => update({ arbitrageEndTime: e.target.value })} />
            </div>
            <div>
              <Label>Overnight target: {quote.arbitrageTargetPercent}%</Label>
              <Slider min={0} max={100} step={5} value={[quote.arbitrageTargetPercent]} onValueChange={([v]) => update({ arbitrageTargetPercent: v })} />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Simulate against tariff plan</Label>
        <Select value={tariffId} onValueChange={setTariffId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a plan" />
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

      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between">
          <Label>Enrol in VPP program</Label>
          <Switch checked={quote.vppEnrolled} onCheckedChange={(v) => update({ vppEnrolled: v })} />
        </div>
        {quote.vppEnrolled && (
          <div className="mt-2 space-y-2">
            <div>
              <Label>Fixed annual credit ($/yr)</Label>
              <Input type="number" value={quote.vppAnnualCreditAud} onChange={(e) => update({ vppAnnualCreditAud: Number(e.target.value) || 0 })} />
              <p className="mt-1 text-xs text-muted-foreground">Sign-up or membership credits the program pays regardless of events.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Event credit rate (c/kWh)</Label>
                <Input
                  type="number"
                  value={((quote.vppEventRatePerKwh ?? 0) * 100).toString()}
                  onChange={(e) => update({ vppEventRatePerKwh: (Number(e.target.value) || 0) / 100 })}
                />
              </div>
              <div>
                <Label>Est. event energy (kWh/yr)</Label>
                <Input
                  type="number"
                  value={quote.vppEventKwhPerYear ?? 0}
                  onChange={(e) => update({ vppEventKwhPerYear: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            {(quote.vppEventRatePerKwh ?? 0) * (quote.vppEventKwhPerYear ?? 0) > 0 && (
              <p className="text-xs font-medium">
                Total VPP credit: $
                {(quote.vppAnnualCreditAud + (quote.vppEventRatePerKwh ?? 0) * (quote.vppEventKwhPerYear ?? 0)).toFixed(0)}/yr
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter the rate your program pays per kWh drawn from your battery during grid events, and roughly how much
              event energy it expects per year (both are in the program's terms). VPPs may affect battery availability
              and warranty - check before enrolling.
            </p>
          </div>
        )}
      </div>

      <Button disabled={!tariffId} onClick={() => onRun(quote, tariffId)} className="w-full">
        Run simulation
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          const id = crypto.randomUUID()
          update({ id })
          addQuote({ ...quote, id })
        }}
      >
        Save as new quote
      </Button>
      <p className="text-xs text-muted-foreground">
        Running a simulation saves/updates this quote in the Saved quotes list below. "Save as new quote" starts a
        separate copy, leaving the previous quote untouched - use it to compare several batteries side by side.
      </p>
    </div>
  )
}
