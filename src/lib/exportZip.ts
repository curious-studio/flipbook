import JSZip from 'jszip'
import type { BookPage } from '../types'

export async function exportImagesZip(title: string, pages: BookPage[]): Promise<Blob> {
  const zip = new JSZip()
  const folder = zip.folder(title || 'book')!
  pages.forEach((p, i) => {
    const base64 = p.dataUrl.split(',')[1]
    const ext = p.dataUrl.includes('image/png') ? 'png' : 'jpg'
    folder.file(`page-${String(i + 1).padStart(3, '0')}.${ext}`, base64, { base64: true })
  })
  return zip.generateAsync({ type: 'blob' })
}