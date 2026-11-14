import { useCallback, useEffect, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { extractPdf } from './lib/pdfExtract'
import { extractImages } from './lib/imageExtract'
import { saveBook, listBooks, getBook, deleteBook } from './lib/idbStore'
import { buildStandaloneHtml } from './lib/exportHtml'
import { exportSpreadPdf } from './lib/exportPdf'
import { exportImagesZip } from './lib/exportZip'
import type { Book, BookPage } from './types'
import ThumbnailStrip from './components/ThumbnailStrip'
import './App.css'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function App() {
  const [pages, setPages] = useState<BookPage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [title, setTitle] = useState('My Flipbook')
  const [bookSize, setBookSize] = useState({ width: 700, height: 500 })
  const [currentBookId, setCurrentBookId] = useState<string | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const flipRef = useRef<any>(null)

  useEffect(() => {
    listBooks().then(setBooks).catch(() => {})
  }, [])

  useEffect(() => {
    const compute = () => {
      const aspect = pages.length > 0 ? (2 * pages[0].width) / pages[0].height : 2 * (210 / 297)
      const availW = Math.min(window.innerWidth * 0.88, 1100)
      const availH = window.innerHeight * 0.62
      let w: number, h: number
      if (availW / availH > aspect) {
        h = availH
        w = h * aspect
      } else {
        w = availW
        h = w / aspect
      }
      setBookSize({ width: Math.round(w), height: Math.round(h) })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [pages])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setLoading(true)
    setError(null)
    setProgress(null)
    try {
      let newPages: BookPage[] = []
      let newTitle = title
      const pdfs = arr.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      const imgs = arr.filter((f) => f.type.startsWith('image/'))
      if (pdfs.length > 0) {
        const r = await extractPdf(pdfs[0], 1.6, (p) => setProgress(p))
        newPages = r.pages.map((pg) => ({ id: uid(), dataUrl: pg.dataUrl, width: pg.width, height: pg.height }))
        newTitle = r.title
      }
      if (imgs.length > 0) {
        const r = await extractImages(imgs, (p) => setProgress(p))
        const imgPages = r.map((pg) => ({ id: uid(), dataUrl: pg.dataUrl, width: pg.width, height: pg.height, name: pg.name }))
        newPages = newPages.concat(imgPages)
        if (pdfs.length === 0) newTitle = imgs.length === 1 ? imgs[0].name : 'Image Book'
      }
      if (newPages.length === 0) {
        setError('No supported files found. Upload a PDF or images.')
        return
      }
      setPages(newPages)
      setTitle(newTitle)
      setCurrentBookId(null)
      setCurrentPage(0)
    } catch (e: any) {
      setError(e?.message || 'Failed to process files')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [title])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const saveCurrent = async () => {
    if (pages.length === 0) return
    const book: Book = {
      id: currentBookId || uid(),
      title,
      pages,
      createdAt: Date.now(),
    }
    await saveBook(book)
    setCurrentBookId(book.id)
    setBooks(await listBooks())
  }

  const loadBook = async (id: string) => {
    const b = await getBook(id)
    if (b) {
      setPages(b.pages)
      setTitle(b.title)
      setCurrentBookId(b.id)
      setCurrentPage(0)
    }
  }

  const removeBook = async (id: string) => {
    await deleteBook(id)
    setBooks(await listBooks())
    if (currentBookId === id) {
      setPages([])
      setCurrentBookId(null)
    }
  }

  const doExport = async (kind: 'html' | 'pdf' | 'zip') => {
    if (pages.length === 0) return
    setExporting(kind)
    try {
      if (kind === 'html') {
        const html = buildStandaloneHtml(title, pages)
        downloadBlob(new Blob([html], { type: 'text/html' }), `${title}.html`)
      } else if (kind === 'zip') {
        const blob = await exportImagesZip(title, pages)
        downloadBlob(blob, `${title}.zip`)
      } else {
        const blob = await exportSpreadPdf(title, pages)
        downloadBlob(blob, `${title}.pdf`)
      }
    } catch (e: any) {
      setError(e?.message || 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  const flipNext = () => flipRef.current?.pageFlip?.()?.flipNext()
  const flipPrev = () => flipRef.current?.pageFlip?.()?.flipPrev()
  const flipTo = (index: number) => {
    // Jump to the spread that contains the clicked page.
    // In landscape mode pages are paired; snap to the spread's first page.
    const target = index <= 0 ? 0 : index % 2 === 0 ? index : index - 1
    try { flipRef.current?.pageFlip?.()?.flip(target) } catch {}
    setCurrentPage(index)
  }
  const reorderPages = (from: number, to: number) => {
    setPages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Flipbook Generator</h1>
        <div className="topbar-actions">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="title-input"
            placeholder="Book title"
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={loading}>
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            hidden
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <button onClick={saveCurrent} disabled={pages.length === 0}>Save</button>
        </div>
      </header>

      <main className="main">
        {pages.length === 0 ? (
          <div className="uploader" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
            <div className="uploader-inner">
              <div className="uploader-icon">📖</div>
              <h2>Drop a PDF or images here</h2>
              <p>or click Upload to choose files</p>
              {loading && (
                <div className="progress">
                  Processing… {progress ? `${progress.current}/${progress.total}` : ''}
                </div>
              )}
              {error && <div className="error">{error}</div>}
            </div>
          </div>
        ) : (
          <div className="viewer-area">
            <div className="viewer" style={{ position: 'relative' }}>
              <HTMLFlipBook
                ref={flipRef}
                width={bookSize.width}
                height={bookSize.height}
                size="fixed"
                minWidth={320}
                maxWidth={1100}
                minHeight={220}
                maxHeight={700}
                drawShadow={true}
                flippingTime={800}
                usePortrait={false}
                showCover={true}
                maxShadowOpacity={0.5}
                className="book"
                style={{}}
                startPage={0}
                startZIndex={0}
                autoSize={true}
                mobileScrollSupport={true}
                clickEventForward={true}
                useMouseEvents={true}
                swipeDistance={30}
                showPageCorners={true}
                disableFlipByClick={false}
                onFlip={(e: any) => setCurrentPage(e?.data ?? 0)}
              >
                {pages.map((p) => (
                  <div key={p.id} className="page">
                    <img src={p.dataUrl} alt="" />
                  </div>
                ))}
              </HTMLFlipBook>
              <button className="nav-arrow nav-arrow-left" onClick={flipPrev} aria-label="Previous spread">◀</button>
              <button className="nav-arrow nav-arrow-right" onClick={flipNext} aria-label="Next spread">▶</button>
            </div>
            <div className="controls">
              <button onClick={flipPrev}>◀ Prev</button>
              <button onClick={flipNext}>Next ▶</button>
              <span className="page-count">{pages.length} pages</span>
              <button onClick={() => doExport('html')} disabled={!!exporting}>
                {exporting === 'html' ? 'Exporting…' : 'Export HTML'}
              </button>
              <button onClick={() => doExport('pdf')} disabled={!!exporting}>
                {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
              </button>
              <button onClick={() => doExport('zip')} disabled={!!exporting}>
                {exporting === 'zip' ? 'Exporting…' : 'Export ZIP'}
              </button>
              <button onClick={() => { setPages([]); setCurrentBookId(null); setCurrentPage(0) }}>New</button>
            </div>
            <ThumbnailStrip
              pages={pages}
              currentIndex={currentPage}
              onReorder={reorderPages}
              onSelect={flipTo}
            />
          </div>
        )}

        {books.length > 0 && (
          <aside className="sidebar">
            <h3>Saved books</h3>
            <ul>
              {books.map((b) => (
                <li key={b.id}>
                  <button className="link" onClick={() => loadBook(b.id)}>{b.title}</button>
                  <span className="muted">{b.pages.length}p</span>
                  <button className="icon" onClick={() => removeBook(b.id)} title="Delete">✕</button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>
    </div>
  )
}