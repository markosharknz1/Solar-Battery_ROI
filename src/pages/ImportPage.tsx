import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { MeterUploader } from '@/components/import/MeterUploader'
import { SolarUploader } from '@/components/import/SolarUploader'
import { BillFallbackForm } from '@/components/import/BillFallbackForm'
import { ImportSummary } from '@/components/import/ImportSummary'
import { KeepDataToggle } from '@/components/import/KeepDataToggle'
import { useDataStore } from '@/store/dataStore'
import { parseMeterCsv } from '@/lib/csvParser'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

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
        title="NEM data input"
        description="Import your smart meter (NEM12 or retailer CSV) and solar inverter data. Everything stays on this device - nothing is ever uploaded to a server."
      />
      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <MeterUploader />
        <SolarUploader />
      </div>
      <div className="mb-6">
        <KeepDataToggle />
      </div>
      <div className="mb-6 flex justify-center">
        <Button variant="outline" onClick={() => void loadSample()}>
          Or try it with sample data
        </Button>
      </div>
      <div className="mb-6">
        <BillFallbackForm />
        <div className="mt-3 flex justify-center">
          <Button variant="link" asChild>
            <Link to="/bills/import">
              <FileText className="mr-1 h-4 w-4" /> Prefer to upload a bill PDF instead?
            </Link>
          </Button>
        </div>
      </div>
      {summary && <ImportSummary />}
    </div>
  )
}
