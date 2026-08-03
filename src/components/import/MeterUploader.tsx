import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { parseMeterCsv, type MeterBucket } from '@/lib/csvParser'
import { useDataStore } from '@/store/dataStore'
import { Upload } from 'lucide-react'

interface PendingImport {
  buckets: MeterBucket[]
  warnings: string[]
  fileName: string
  firstDay: string
  lastDay: string
}

export function MeterUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const setMeterBuckets = useDataStore((s) => s.setMeterBuckets)
  const addMeterBuckets = useDataStore((s) => s.addMeterBuckets)
  const hasExistingData = useDataStore((s) => s.meterBuckets.length > 0)

  const handleFile = async (file: File) => {
    setError(null)
    setPending(null)
    setFileName(file.name)
    const text = await file.text()
    const { format: detected, buckets, warnings } = parseMeterCsv(text)

    if (detected === 'unknown' || buckets.length === 0) {
      setError(
        "Couldn't recognise this file. Expected an AU retailer interval export (e.g. OVO Energy) or an AEMO NEM12 file.",
      )
      return
    }

    if (!hasExistingData) {
      setMeterBuckets(buckets, warnings)
      return
    }

    // Data already loaded - let the user choose whether this file replaces it or extends it
    // (e.g. a new export after switching providers, covering a different period).
    const days = buckets.map((b) => b.dateStr)
    setPending({
      buckets,
      warnings,
      fileName: file.name,
      firstDay: days.reduce((a, b) => (a < b ? a : b)),
      lastDay: days.reduce((a, b) => (a > b ? a : b)),
    })
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart meter data</CardTitle>
        <CardDescription>Required. Upload your retailer's usage/export CSV, or a NEM12 file.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging ? 'border-primary bg-accent' : 'border-border'
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {fileName ?? 'Drag and drop a CSV here, or click to browse'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = '' // allow re-selecting the same file
            }}
          />
        </div>
        {pending && (
          <div className="mt-3 space-y-2 rounded-md border border-primary/40 bg-accent p-3">
            <p className="text-sm">
              You already have data loaded. "{pending.fileName}" covers{' '}
              <span className="font-medium">
                {format(parseISO(pending.firstDay), 'd MMM yyyy')} - {format(parseISO(pending.lastDay), 'd MMM yyyy')}
              </span>
              . Add it to your existing data, or start over with just this file?
            </p>
            <p className="text-xs text-muted-foreground">
              Adding merges by day - useful for stitching together exports from different periods or a previous
              provider. Days appearing in both keep the new file's readings.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  addMeterBuckets(pending.buckets, pending.warnings)
                  setPending(null)
                }}
              >
                Add to existing data
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMeterBuckets(pending.buckets, pending.warnings)
                  setPending(null)
                }}
              >
                Replace everything
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
