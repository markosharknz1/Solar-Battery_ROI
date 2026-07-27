import type { AustralianState } from '@/types/meter'
import { useDataStore } from '@/store/dataStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATE_LABELS } from '@/lib/stateDefaults'

export function HouseholdProfileForm() {
  const profile = useDataStore((s) => s.householdProfile)
  const setProfile = useDataStore((s) => s.setProfile)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Household profile</CardTitle>
        <CardDescription>
          Used to pre-fill state-default tariff rates and tailor advice. Saved on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>State</Label>
          <Select value={profile.state} onValueChange={(v) => setProfile({ state: v as AustralianState })}>
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
        <div>
          <Label>Occupants</Label>
          <Input
            type="number"
            min={1}
            value={profile.occupants}
            onChange={(e) => setProfile({ occupants: Number(e.target.value) || 1 })}
          />
        </div>
        <div>
          <Label>Floor area (m², optional)</Label>
          <Input
            type="number"
            placeholder="Optional"
            value={profile.floorAreaM2 ?? ''}
            onChange={(e) => setProfile({ floorAreaM2: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
