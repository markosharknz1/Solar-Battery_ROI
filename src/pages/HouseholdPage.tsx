import { PageHeader } from '@/components/layout/PageHeader'
import { HouseholdSummaryCard } from '@/components/layout/HouseholdSummaryCard'
import { HouseholdProfileForm } from '@/components/import/HouseholdProfileForm'
import { OvernightLoadPicker } from '@/components/import/OvernightLoadPicker'
import { useDataStore } from '@/store/dataStore'

export function HouseholdPage() {
  const summary = useDataStore((s) => s.summary)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Household settings"
        description="Postcode, energy supply, EV charger, and occupancy - used across the analytics and battery simulations."
      />
      {summary && (
        <div className="mb-6">
          <HouseholdSummaryCard />
        </div>
      )}
      <div className="mb-6">
        <HouseholdProfileForm defaultOpen />
      </div>
      {summary && !summary.isFlatEstimate && (
        <div className="mb-6">
          <OvernightLoadPicker />
        </div>
      )}
    </div>
  )
}
