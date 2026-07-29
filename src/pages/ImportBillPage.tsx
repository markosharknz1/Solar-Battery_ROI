import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { extractTextFromPdf, extractBillFields } from '@/lib/billPdfParser'
import { useBillsStore } from '@/store/billsStore'
import type { Bill } from '@/types/bill'
import { Upload, ChevronDown } from 'lucide-react'

interface DraftBill {
  provider: string
  periodStart: string
  periodEnd: string
  totalCostAud: string
  totalUsageKwh: string
  totalExportKwh: string
  supplyChargeAud: string
  notes: string
}

function blankDraft(): DraftBill {
  return { provider: '', periodStart: '', periodEnd: '', totalCostAud: '', totalUsageKwh: '', totalExportKwh: '', supplyChargeAud: '', notes: '' }
}

export function ImportBillPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'extracting' | 'error' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rawText, setRawText] = useState('')
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [draft, setDraft] = useState<DraftBill>(blankDraft())
  const inputRef = useRef<HTMLInputElement>(null)
  const addBill = useBillsStore((s) => s.addBill)
  const navigate = useNavigate()

  const update = (updates: Partial<DraftBill>) => setDraft((d) => ({ ...d, ...updates }))

  const handleFile = async (file: File) => {
    setError(null)
    setStatus('extracting')
    setFileName(file.name)
    try {
      const text = await extractTextFromPdf(file)
      const extracted = extractBillFields(text)
      setRawText(text)

      const missing: string[] = []
      if (!extracted.periodStart || !extracted.periodEnd) missing.push('billing period')
      if (extracted.totalCostAud == null) missing.push('total cost')
      if (extracted.totalUsageKwh == null) missing.push('total usage')

      setMissingFields(missing)
      setDraft({
        provider: '',
        periodStart: extracted.periodStart ?? '',
        periodEnd: extracted.periodEnd ?? '',
        totalCostAud: extracted.totalCostAud != null ? String(extracted.totalCostAud) : '',
        totalUsageKwh: extracted.totalUsageKwh != null ? String(extracted.totalUsageKwh) : '',
        totalExportKwh: extracted.totalExportKwh != null ? String(extracted.totalExportKwh) : '',
        supplyChargeAud: extracted.supplyChargeAud != null ? String(extracted.supplyChargeAud) : '',
        notes: '',
      })
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? `Couldn't read this PDF: ${err.message}` : "Couldn't read this PDF.")
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const isValid = draft.periodStart && draft.periodEnd && draft.totalCostAud !== '' && draft.totalUsageKwh !== ''

  const save = () => {
    if (!isValid) return
    const bill: Bill = {
      id: crypto.randomUUID(),
      provider: draft.provider,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
      totalCostAud: Number.parseFloat(draft.totalCostAud) || 0,
      totalUsageKwh: Number.parseFloat(draft.totalUsageKwh) || 0,
      totalExportKwh: draft.totalExportKwh === '' ? null : Number.parseFloat(draft.totalExportKwh) || 0,
      supplyChargeAud: draft.supplyChargeAud === '' ? null : Number.parseFloat(draft.supplyChargeAud) || 0,
      notes: draft.notes,
      sourceFileName: fileName,
      addedAt: new Date().toISOString(),
    }
    addBill(bill)
    navigate('/bills')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Import bill (PDF)"
        description="Upload a bill PDF and we'll try to pull out the key numbers. Bill layouts vary a lot between retailers, so always check the fields below before adding it."
      />

      {status !== 'done' && (
        <Card>
          <CardHeader>
            <CardTitle>Bill PDF</CardTitle>
            <CardDescription>Nothing leaves your browser - the PDF is read locally to extract text.</CardDescription>
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
                {status === 'extracting' ? 'Reading PDF...' : (fileName ?? 'Drag and drop a bill PDF here, or click to browse')}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
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
      )}

      {status === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle>Check the details</CardTitle>
            <CardDescription>
              {missingFields.length > 0
                ? `Couldn't confidently read: ${missingFields.join(', ')}. Please fill those in yourself.`
                : "Looks like we found everything - double check it matches your bill before adding."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Provider (optional)</Label>
              <Input value={draft.provider} onChange={(e) => update({ provider: e.target.value })} placeholder="e.g. AGL, Origin" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Period start</Label>
                <Input type="date" value={draft.periodStart} onChange={(e) => update({ periodStart: e.target.value })} />
              </div>
              <div>
                <Label>Period end</Label>
                <Input type="date" value={draft.periodEnd} onChange={(e) => update({ periodEnd: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Total cost ($)</Label>
                <Input type="number" step="0.01" value={draft.totalCostAud} onChange={(e) => update({ totalCostAud: e.target.value })} />
              </div>
              <div>
                <Label>Total usage (kWh)</Label>
                <Input type="number" step="0.1" value={draft.totalUsageKwh} onChange={(e) => update({ totalUsageKwh: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Solar export (kWh, optional)</Label>
                <Input type="number" step="0.1" value={draft.totalExportKwh} onChange={(e) => update({ totalExportKwh: e.target.value })} />
              </div>
              <div>
                <Label>Daily supply charge ($, optional)</Label>
                <Input type="number" step="0.01" value={draft.supplyChargeAud} onChange={(e) => update({ supplyChargeAud: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={draft.notes} onChange={(e) => update({ notes: e.target.value })} />
            </div>

            {rawText && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    Show extracted text (for checking missed fields)
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted p-2 text-xs text-muted-foreground">
                    {rawText}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStatus('idle')
                  setFileName(null)
                  setRawText('')
                  setDraft(blankDraft())
                }}
              >
                Start over
              </Button>
              <Button disabled={!isValid} onClick={save}>
                Add to bills
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
