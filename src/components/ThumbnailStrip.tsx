import { useState } from 'react'
import type { BookPage } from '../types'

interface Props {
  pages: BookPage[]
  currentIndex: number
  onReorder: (from: number, to: number) => void
  onSelect: (index: number) => void
}

export default function ThumbnailStrip({ pages, currentIndex, onReorder, onSelect }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div className="thumb-strip">
      {pages.map((p, i) => (
        <div
          key={p.id}
          className={
            'thumb' +
            (i === currentIndex ? ' active' : '') +
            (dragIndex === i ? ' dragging' : '') +
            (overIndex === i ? ' over' : '')
          }
          draggable
          onDragStart={(e) => {
            setDragIndex(i)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', String(i))
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setOverIndex(i)
          }}
          onDragLeave={() => setOverIndex(null)}
          onDrop={(e) => {
            e.preventDefault()
            const from = dragIndex ?? Number(e.dataTransfer.getData('text/plain'))
            if (!isNaN(from) && from !== i) onReorder(from, i)
            setDragIndex(null)
            setOverIndex(null)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
          onClick={() => onSelect(i)}
          title={`Page ${i + 1}`}
        >
          <img src={p.dataUrl} alt={`Page ${i + 1}`} />
          <span className="thumb-num">{i + 1}</span>
        </div>
      ))}
    </div>
  )
}