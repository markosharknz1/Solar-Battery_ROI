import { PageHeader } from '@/components/layout/PageHeader'
import { MeterUploader } from '@/components/import/MeterUploader'
import { SolarUploader } from '@/components/import/SolarUploader'
import { BillFallbackForm } from '@/components/import/BillFallbackForm'
import { ImportSummary } from '@/components/import/ImportSummary'
import { HouseholdProfileForm } from '@/components/import/HouseholdProfileForm'
import { OvernightLoadPicker } from '@/components/import/OvernightLoadPicker'
import { useDataStore } from '@/store/dataStore'
import { parseMeterCsv } from '@/lib/csvParser'
import { Button } from '@/components/ui/button'

export function ImportPage() {
  const summary = useDataStore((s) => s.summary)
  const setMeterBuckets = useDataStore((s) => s.setMeterBuckets)

  const loadSample = async () => {
    const res = await fetch('/sample/sample-meter.csv')
    const text = await res.text()
    const { buckets, warnings } = parseMeterCsv(text)
    setMeterBuckets(buckets, warnings)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Import your usage data"
        description="Everything below stays in your browser - nothing is ever uploaded to a server."
      />
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <MeterUploader />
        <SolarUploader />
      </div>
      <div className="mb-6 flex justify-center">
        <Button variant="outline" onClick={() => void loadSample()}>
          Or try it with sample data
        </Button>
      </div>
      <div className="mb-6">
        <BillFallbackForm />
      </div>
      <div className="mb-6">
        <HouseholdProfileForm />
      </div>
      {summary && !summary.isFlatEstimate && (
        <div className="mb-6">
          <OvernightLoadPicker />
        </div>
      )}
      {summary && <ImportSummary />}
    </div>
  )
}
