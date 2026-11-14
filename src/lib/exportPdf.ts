import { jsPDF } from 'jspdf'
import type { BookPage } from '../types'

export async function exportSpreadPdf(title: string, pages: BookPage[]): Promise<Blob> {
  // Normalize page dimensions to a common height
  const targetH = 1400
  const norm = pages.map((p) => {
    const scale = targetH / p.height
    return { p, w: Math.round(p.width * scale), h: targetH }
  })

  // Build spreads
  const spreads: { left?: typeof norm[0]; right?: typeof norm[0] }[] = []
  for (let i = 0; i < norm.length; i += 2) {
    spreads.push({ left: norm[i], right: norm[i + 1] })
  }

  // Canvas for a spread
  const spineW = 24
  const firstSpread = spreads[0]
  const spreadW = (firstSpread.left?.w ?? targetH) + spineW + (firstSpread.right?.w ?? firstSpread.left?.w ?? targetH)
  const spreadH = targetH

  const pdf = new jsPDF({
    orientation: spreadW > spreadH ? 'landscape' : 'portrait',
    unit: 'px',
    format: [spreadW, spreadH],
  })
  pdf.setProperties({ title })

  for (let si = 0; si < spreads.length; si++) {
    const sp = spreads[si]
    const lw = sp.left?.w ?? spreadW / 2
    const rw = sp.right?.w ?? lw
    const w = lw + spineW + rw
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
      ctx.drawImage(img, 0, 0, lw, h)
    }
    // right page
    if (sp.right) {
      const img = await loadImage(sp.right.p.dataUrl)
      ctx.drawImage(img, lw + spineW, 0, rw, h)
    } else {
      // blank right page with subtle paper color
      ctx.fillStyle = '#f4f1ea'
      ctx.fillRect(lw + spineW, 0, rw, h)
    }

    // spine shadow (center)
    const grad = ctx.createLinearGradient(lw, 0, lw + spineW, 0)
    grad.addColorStop(0, 'rgba(0,0,0,0.45)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0.05)')
    grad.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = grad
    ctx.fillRect(lw, 0, spineW, h)

    // inner-edge shadows on each page (curl near spine)
    const leftInner = ctx.createLinearGradient(lw - 60, 0, lw, 0)
    leftInner.addColorStop(0, 'rgba(0,0,0,0)')
    leftInner.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = leftInner
    ctx.fillRect(lw - 60, 0, 60, h)

    const rightInner = ctx.createLinearGradient(lw + spineW, 0, lw + spineW + 60, 0)
    rightInner.addColorStop(0, 'rgba(0,0,0,0.18)')
    rightInner.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rightInner
    ctx.fillRect(lw + spineW, 0, 60, h)

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