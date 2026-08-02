import { useState } from 'react'
import type { AustralianState } from '@/types/meter'
import { useDataStore } from '@/store/dataStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { STATE_LABELS } from '@/lib/stateDefaults'
import { resolveStateFromPostcode } from '@/lib/solarYield'
import { ChevronDown } from 'lucide-react'

export function HouseholdProfileForm() {
  const profile = useDataStore((s) => s.householdProfile)
  const setProfile = useDataStore((s) => s.setProfile)
  const [open, setOpen] = useState(false)

  const onPostcodeChange = (postcode: string) => {
    const detected = resolveStateFromPostcode(postcode)
    setProfile(detected ? { postcode, state: detected } : { postcode })
  }

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Household profile (optional)</CardTitle>
              <CardDescription>
                Used to tailor advice and estimates, e.g. expected solar yield. Skip this if you just want to see
                your usage - you can fill it in anytime.
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                {open ? 'Hide' : 'Add details'}
                <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <div>
              <Label>Postcode</Label>
              <Input
                value={profile.postcode}
                onChange={(e) => onPostcodeChange(e.target.value)}
                placeholder="e.g. 5000"
                maxLength={4}
              />
            </div>
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
