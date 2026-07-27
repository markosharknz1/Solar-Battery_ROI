import { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { parseMeterCsv } from '@/lib/csvParser'
import { useDataStore } from '@/store/dataStore'
import { Upload } from 'lucide-react'

export function MeterUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const setMeterBuckets = useDataStore((s) => s.setMeterBuckets)

  const handleFile = async (file: File) => {
    setError(null)
    setFileName(file.name)
    const text = await file.text()
    const { format, buckets, warnings } = parseMeterCsv(text)

    if (format === 'unknown' || buckets.length === 0) {
      setError(
        "Couldn't recognise this file. Expected an AU retailer interval export (e.g. OVO Energy) or an AEMO NEM12 file.",
      )
      return
    }

    setMeterBuckets(buckets, warnings)
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
            }}
          />
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
