import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { detectSolarColumns, parseSolarCsv, type SolarCsvColumnMapping } from '@/lib/csvParser'
import { useDataStore } from '@/store/dataStore'
import { ColumnMapper } from '@/components/import/ColumnMapper'
import { Upload } from 'lucide-react'

export function SolarUploader() {
  const [headers, setHeaders] = useState<string[] | null>(null)
  const [detected, setDetected] = useState<Partial<SolarCsvColumnMapping>>({})
  const [rawText, setRawText] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addSolarDailyTotals = useDataStore((s) => s.addSolarDailyTotals)

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, preview: 5 })
    const hdrs = parsed.meta.fields ?? []
    setHeaders(hdrs)
    setDetected(detectSolarColumns(hdrs))
    setRawText(text)
    setImportedCount(null)
  }

  const confirmMapping = (mapping: SolarCsvColumnMapping) => {
    if (!rawText) return
    const totals = parseSolarCsv(rawText, mapping)
    addSolarDailyTotals(totals)
    setImportedCount(totals.length)
    setHeaders(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solar inverter data</CardTitle>
        <CardDescription>Optional - improves battery simulation accuracy.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!headers && (
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag and drop your inverter CSV, or click to browse</p>
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
        )}
        {headers && <ColumnMapper headers={headers} initial={detected} onConfirm={confirmMapping} />}
        {importedCount !== null && (
          <p className="text-sm text-muted-foreground">
            Imported {importedCount} day(s) of generation data and matched it to your meter intervals.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
