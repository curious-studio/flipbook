import { useState } from 'react'
import type { BookPage } from '../types'
import { getSpreads } from '../lib/layout'

interface Props {
  pages: BookPage[]
  visiblePages: number[]
  onReorder: (from: number, to: number) => void
  onSelect: (index: number) => void
  disabled?: boolean
}

export default function ThumbnailStrip({ pages, visiblePages, onReorder, onSelect, disabled }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  return (
    <div className="thumb-strip" aria-label="Pages. Drag to reorder, or use Alt and arrow keys.">
      {getSpreads(pages.length).map((spread) => (
        <div key={spread[0]} className="thumb-spread" role="group" aria-label={spread.length === 1 ? `Page ${spread[0] + 1}` : `Spread: pages ${spread[0] + 1} and ${spread[1] + 1}`}>
        {spread.map((i) => {
          const p = pages[i]
          return (
        <button key={p.id} type="button" disabled={disabled} style={{ width: 88 * p.width / p.height }}
          className={'thumb' + (visiblePages.includes(i) ? ' active' : '') + (dragIndex === i ? ' dragging' : '') + (overIndex === i ? ' over' : '')}
          draggable={!disabled} aria-label={`Page ${i + 1}${p.name ? `: ${p.name}` : ''}`} aria-pressed={visiblePages.includes(i)}
          onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) }}
          onDragOver={(e) => { if (dragIndex !== null) { e.preventDefault(); setOverIndex(i) } }}
          onDragLeave={() => setOverIndex(null)}
          onDrop={(e) => {
            e.preventDefault()
            if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i)
            setDragIndex(null); setOverIndex(null)
          }}
          onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
          onKeyDown={(e) => {
            if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
              e.preventDefault(); e.stopPropagation()
              const to = i + (e.key === 'ArrowLeft' ? -1 : 1)
              if (to >= 0 && to < pages.length) onReorder(i, to)
            }
          }}
          onClick={() => onSelect(i)} title={`Page ${i + 1} · Drag or Alt + arrow keys to reorder`}>
          <img src={p.dataUrl} alt="" loading="lazy" />
          <span className="thumb-num">{i + 1}</span>
        </button>
          )
        })}
        </div>
      ))}
    </div>
  )
}
