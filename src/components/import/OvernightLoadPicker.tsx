import { useDataStore } from '@/store/dataStore'
import { detectOvernightLoadPattern } from '@/lib/dataProcessor'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export function OvernightLoadPicker() {
  const intervals = useDataStore((s) => s.intervals)
  const profile = useDataStore((s) => s.householdProfile)
  const setProfile = useDataStore((s) => s.setProfile)

  const pattern = detectOvernightLoadPattern(intervals)
  if (!pattern.isSignificant) return null

  const toggle = (key: keyof typeof profile.overnightLoads) => {
    const overnightLoads = { ...profile.overnightLoads, [key]: !profile.overnightLoads[key] }
    setProfile({ overnightLoads, ev: key === 'evCharger' ? { ...profile.ev, enabled: overnightLoads.evCharger } : profile.ev })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Large overnight usage detected</CardTitle>
        <CardDescription>
          {pattern.overnightAvgKwh.toFixed(2)} kWh avg between 10pm-6am, compared to {pattern.middayAvgKwh.toFixed(2)} kWh
          midday. What's driving this?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={profile.overnightLoads.controlledLoadHotWater} onCheckedChange={() => toggle('controlledLoadHotWater')} />
            Hot water (controlled load circuit)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={profile.overnightLoads.evCharger} onCheckedChange={() => toggle('evCharger')} />
            EV charger
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={profile.overnightLoads.airConOvernight} onCheckedChange={() => toggle('airConOvernight')} />
            Air conditioning
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={profile.overnightLoads.poolHeating} onCheckedChange={() => toggle('poolHeating')} />
            Pool
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={profile.overnightLoads.otherLargeLoad} onCheckedChange={() => toggle('otherLargeLoad')} />
            Other
          </label>
        </div>

        {profile.overnightLoads.controlledLoadHotWater && (
          <p className="rounded-md bg-accent px-3 py-2 text-xs text-muted-foreground">
            Set a controlled load rate on the Tariffs page to price this circuit separately from your general usage.
          </p>
        )}

        {profile.overnightLoads.evCharger && (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">EV charging details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Charger power (kW)</Label>
                <Input type="number" value={profile.ev.chargerKw} onChange={(e) => setProfile({ ev: { ...profile.ev, chargerKw: Number(e.target.value) || 0 } })} />
              </div>
              <div>
                <Label>Typical charge duration (hrs)</Label>
                <Input type="number" value={profile.ev.typicalChargeDurationHours} onChange={(e) => setProfile({ ev: { ...profile.ev, typicalChargeDurationHours: Number(e.target.value) || 0 } })} />
              </div>
              <div>
                <Label>Charging start time</Label>
                <Input type="time" value={profile.ev.chargingStartTime} onChange={(e) => setProfile({ ev: { ...profile.ev, chargingStartTime: e.target.value } })} />
              </div>
              <div>
                <Label>Charging tariff rate (c/kWh)</Label>
                <Input type="number" value={profile.ev.chargingTariffRate} onChange={(e) => setProfile({ ev: { ...profile.ev, chargingTariffRate: Number(e.target.value) || 0 } })} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Label>Smart charger scheduling</Label>
              <Switch checked={profile.ev.smartChargerScheduling} onCheckedChange={(v) => setProfile({ ev: { ...profile.ev, smartChargerScheduling: v } })} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
