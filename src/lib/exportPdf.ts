import { jsPDF } from 'jspdf'
import type { BookPage } from '../types'
import { getSpreads } from './layout.ts'

export async function exportSpreadPdf(title: string, pages: BookPage[]): Promise<Blob> {
  if (!pages.length) throw new Error('No pages to export.')
  // Use the same page frame as the animated viewer; contain mixed-size pages.
  const targetH = 1400
  const pageWidth = Math.round(targetH * pages[0].width / pages[0].height)
  const norm = pages.map((p) => ({ p, w: pageWidth, h: targetH }))

  // Match the viewer: a front cover, then paired interior pages.
  const spreads = getSpreads(pages.length).map((indices) => ({
    left: indices[0] === 0 ? undefined : norm[indices[0]],
    right: indices[0] === 0 ? norm[0] : indices.length > 1 ? norm[indices[1]] : undefined,
  }))
  if (!spreads.length) throw new Error('No pages to export.')

  // Canvas for a spread
  const firstSpread = spreads[0]
  const spreadW = (firstSpread.left?.w ?? firstSpread.right?.w ?? targetH) + (firstSpread.right?.w ?? firstSpread.left?.w ?? targetH)
  const spreadH = targetH

  const pdf = new jsPDF({
    orientation: spreadW > spreadH ? 'landscape' : 'portrait',
    unit: 'px',
    format: [spreadW, spreadH],
  })
  pdf.setProperties({ title })

  for (let si = 0; si < spreads.length; si++) {
    const sp = spreads[si]
    const lw = sp.left?.w ?? sp.right?.w ?? targetH
    const rw = sp.right?.w ?? lw
    const w = lw + rw
    const h = targetH
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)

    // left page
    if (sp.left) {
      const img = await loadImage(sp.left.p.dataUrl)
      drawContained(ctx, img, 0, lw, h)
    }
    // right page
    if (sp.right) {
      const img = await loadImage(sp.right.p.dataUrl)
      drawContained(ctx, img, lw, rw, h)
    } else {
      // blank right page with subtle paper color
      ctx.fillStyle = '#f4f1ea'
      ctx.fillRect(lw, 0, rw, h)
    }

    // Overlay the fold shading on the touching page edges; no spacer between pages.
    const leftInner = ctx.createLinearGradient(lw - 60, 0, lw, 0)
    leftInner.addColorStop(0, 'rgba(0,0,0,0)')
    leftInner.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = leftInner
    ctx.fillRect(lw - 60, 0, 60, h)

    const rightInner = ctx.createLinearGradient(lw, 0, lw + 60, 0)
    rightInner.addColorStop(0, 'rgba(0,0,0,0.18)')
    rightInner.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rightInner
    ctx.fillRect(lw, 0, 60, h)

    // outer page-edge shadows
    const leftOuter = ctx.createLinearGradient(0, 0, 12, 0)
    leftOuter.addColorStop(0, 'rgba(0,0,0,0.12)')
    leftOuter.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = leftOuter
    ctx.fillRect(0, 0, 12, h)

    const rightOuter = ctx.createLinearGradient(w - 12, 0, w, 0)
    rightOuter.addColorStop(0, 'rgba(0,0,0,0)')
    rightOuter.addColorStop(1, 'rgba(0,0,0,0.12)')
    ctx.fillStyle = rightOuter
    ctx.fillRect(w - 12, 0, 12, h)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    if (si > 0) pdf.addPage([w, h], w > h ? 'landscape' : 'portrait')
    pdf.addImage(dataUrl, 'JPEG', 0, 0, w, h)
  }

  return pdf.output('blob')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
function drawContained(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, width: number, height: number) {
  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.drawImage(img, x + (width - w) / 2, (height - h) / 2, w, h)
}
