import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export interface ExtractProgress {
  current: number
  total: number
}

export async function extractPdf(
  file: File,
  scale = 1.6,
  onProgress?: (p: ExtractProgress) => void
): Promise<{ pages: { dataUrl: string; width: number; height: number }[]; title: string }> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pages: { dataUrl: string; width: number; height: number }[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    pages.push({
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      width: viewport.width,
      height: viewport.height,
    })
    onProgress?.({ current: i, total: pdf.numPages })
    page.cleanup()
  }
  return { pages, title: file.name.replace(/\.pdf$/i, '') }
}