import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { SolarCsvColumnMapping } from '@/lib/csvParser'

export function ColumnMapper({
  headers,
  initial,
  onConfirm,
}: {
  headers: string[]
  initial: Partial<SolarCsvColumnMapping>
  onConfirm: (mapping: SolarCsvColumnMapping) => void
}) {
  const [dateColumn, setDateColumn] = useState(initial.dateColumn ?? headers[0])
  const [generationColumn, setGenerationColumn] = useState(initial.generationColumn ?? headers[0])
  const [unit, setUnit] = useState<'kWh' | 'Wh'>(initial.unit ?? 'kWh')

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">
        Confirm which columns hold the date and generation values for your inverter export.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Date column</Label>
          <Select value={dateColumn} onValueChange={setDateColumn}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {headers.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Generation column</Label>
          <Select value={generationColumn} onValueChange={setGenerationColumn}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {headers.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Unit</Label>
          <Select value={unit} onValueChange={(v) => setUnit(v as 'kWh' | 'Wh')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kWh">kWh</SelectItem>
              <SelectItem value="Wh">Wh</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={() => onConfirm({ dateColumn, generationColumn, unit })}>Confirm mapping</Button>
    </div>
  )
}
