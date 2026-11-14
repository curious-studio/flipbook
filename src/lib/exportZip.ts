import JSZip from 'jszip'
import type { BookPage } from '../types'

export async function exportImagesZip(title: string, pages: BookPage[]): Promise<Blob> {
  const zip = new JSZip()
  const folder = zip.folder(title || 'book')!
  pages.forEach((p, i) => {
    const base64 = p.dataUrl.split(',')[1]
    const mime = p.dataUrl.slice(5, p.dataUrl.indexOf(';'))
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/bmp': 'bmp' }
    const ext = extensions[mime] || 'bin'
    folder.file(`page-${String(i + 1).padStart(3, '0')}.${ext}`, base64, { base64: true })
  })
  return zip.generateAsync({ type: 'blob' })
}