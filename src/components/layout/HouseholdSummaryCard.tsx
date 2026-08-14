import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/store/dataStore'
import { solarZoneForPostcode } from '@/lib/solarZones'

/** At-a-glance household facts, shown on both the main Overview and Analytics Overview. */
export function HouseholdSummaryCard() {
  const summary = useDataStore((s) => s.summary)
  const householdProfile = useDataStore((s) => s.householdProfile)

  const zone = solarZoneForPostcode(householdProfile.postcode)
  const ev = householdProfile.ev

  const facts: Array<{ label: string; value: string }> = [
    {
      label: 'Location',
      value: householdProfile.postcode.trim()
        ? `${householdProfile.postcode.trim()} (${householdProfile.state})${zone ? ` - solar zone ${zone.zone}` : ''}`
        : `${householdProfile.state} (no postcode set)`,
    },
    { label: 'Energy supply', value: householdProfile.hasGasSupply ? 'Electricity + gas' : 'Electricity only' },
    { label: 'EV charger', value: ev.enabled ? `Yes (${ev.chargerKw} kW)` : 'No' },
    ...(ev.enabled
      ? [
          {
            label: 'EV charging window',
            value: `From ${ev.chargingStartTime} for ~${ev.typicalChargeDurationHours}h${ev.smartChargerScheduling ? ' (smart-scheduled)' : ''}`,
          },
        ]
      : []),
    { label: 'Solar', value: summary?.hasSolarExport ? 'Yes - exporting to grid' : 'None detected' },
    { label: 'Occupants', value: String(householdProfile.occupants) },
    ...(householdProfile.floorAreaM2 ? [{ label: 'Floor area', value: `${householdProfile.floorAreaM2} m²` }] : []),
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle>Household summary</CardTitle>
        <Link to="/import" className="text-sm text-primary hover:underline">
          Edit →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-sm font-medium">{f.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
