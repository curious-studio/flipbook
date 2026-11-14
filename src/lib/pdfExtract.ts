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
  const task = pdfjsLib.getDocument({ data: buf })
  const pages: { dataUrl: string; width: number; height: number }[] = []
  try {
    const pdf = await task.promise
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      pages.push({
        dataUrl: canvas.toDataURL('image/jpeg', 0.9),
        width: viewport.width,
        height: viewport.height,
      })
      onProgress?.({ current: i, total: pdf.numPages })
      canvas.width = 0
      canvas.height = 0
      page.cleanup()
    }
    return { pages, title: file.name.replace(/\.pdf$/i, '') }
  } finally {
    await task.destroy()
  }
}