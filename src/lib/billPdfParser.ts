import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Field parsing lives in billFields.ts (pure text logic, no pdfjs) so it can be
// unit-tested in Node - this module only owns the browser-side PDF text extraction.
export { extractBillFields, type ExtractedBillData } from '@/lib/billFields'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pageTexts: string[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    pageTexts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  return pageTexts.join('\n')
}
