import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { easePageTurns } from './lib/pageTurn'
import { styleTurnShadow } from './lib/turnShadow'
import { observePreview } from './lib/observePreview'
import { isEditingTarget } from './lib/responsive'
import { historyShortcut, recordEdit, stepHistory } from './lib/history'
import type { History } from './lib/history'
import type { CSSProperties } from 'react'
import { saveBook, listBooks, getBook, deleteBook } from './lib/idbStore'
import { fitPage, getSpreads, getSpreadIndex } from './lib/layout'
import type { Book, BookPage, BookSummary, ExportFormat } from './types'
import ThumbnailStrip from './components/ThumbnailStrip'
import EditableTitle from './components/EditableTitle'
import './App.css'

// The flip engine moves DOM nodes outside React's ownership. Recreate it on
// hot updates so preserved React state cannot point at a detached book DOM.
const previewGeneration = import.meta.hot
  ? (import.meta.hot.data.previewGeneration = (import.meta.hot.data.previewGeneration ?? 0) + 1)
  : 0

const uid = () => crypto.randomUUID()
type ClearedBook = { pages: BookPage[]; currentPage: number; arrangePageId: string | null; dirty: boolean }
type BookEdit = { pages: BookPage[]; title: string; currentPage: number; arrangePageId: string | null; clearedBook: ClearedBook | null }
const message = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.'
const isMixed = (pages: BookPage[]) => pages.some((p) => Math.abs(p.width / p.height - pages[0].width / pages[0].height) > 0.01)

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function App() {
  const [pages, setPages] = useState<BookPage[]>([])
  const [clearedBook, setClearedBook] = useState<ClearedBook | null>(null)
  const [history, setHistory] = useState<History<BookEdit>>({ past: [], future: [] })
  const titleEditRecorded = useRef(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [title, setTitle] = useState('Untitled book')
  const [showLaunch, setShowLaunch] = useState(false)
  const [hasBook, setHasBook] = useState(false)
  const [currentBookId, setCurrentBookId] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState(() => Date.now())
  const [books, setBooks] = useState<BookSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState<{ current: number; total: number; file: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [arrangePageId, setArrangePageId] = useState<string | null>(null)
  const arrangeIndex = Math.max(0, pages.findIndex((page) => page.id === arrangePageId))
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [deletedBook, setDeletedBook] = useState<Book | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [mode, setMode] = useState<'spread' | 'single'>('spread')
  const [zoom, setZoom] = useState(1)
  const [shadows, setShadows] = useState(true)
  const [jump, setJump] = useState('')
  const [headerHeight, setHeaderHeight] = useState(88)
  const attachHeader = useCallback((element: HTMLElement | null) => {
    if (element) return observePreview(element, () => setHeaderHeight(element.getBoundingClientRect().height))
  }, [])
  const [area, setArea] = useState({ width: 0, height: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachStage = useCallback((element: HTMLDivElement | null) => {
    if (element) return observePreview(element, setArea)
  }, [])
  const workspaceRef = useRef<HTMLElement>(null)
  const flipRef = useRef<{ pageFlip: () => { turnToPage: (index: number) => void; flipNext: () => void; flipPrev: () => void; update: () => void } }>(null)
  const busy = loading || saving || !!exporting
  const snapshot = (): BookEdit => ({ pages, title, currentPage, arrangePageId, clearedBook })
  const rememberEdit = () => {
    const current = snapshot()
    setHistory((previous) => recordEdit(previous, current))
  }
  const resetHistory = () => setHistory({ past: [], future: [] })
  const travelHistory = useCallback((direction: 'undo' | 'redo') => {
    if (busy) return
    const step = stepHistory(history, { pages, title, currentPage, arrangePageId, clearedBook }, direction)
    if (!step) return
    setHistory(step.history)
    setPages(step.value.pages); setTitle(step.value.title); setCurrentPage(step.value.currentPage)
    setArrangePageId(step.value.arrangePageId); setClearedBook(step.value.clearedBook)
    setDirty(true); setStatus(direction === 'undo' ? 'Edit undone.' : 'Edit redone.')
  }, [busy, history, pages, title, currentPage, arrangePageId, clearedBook])
  const renameBook = (next: string) => {
    if (busy || next === title) return
    rememberEdit(); setTitle(next); setDirty(true)
  }
  const mixed = pages.length > 0 && isMixed(pages)
  const single = mode === 'single' || area.width < 620
  const spreads = getSpreads(pages.length)
  const spreadIndex = getSpreadIndex(currentPage, pages.length)
  const visiblePages = single ? [currentPage] : (spreads[spreadIndex] ?? [])
  const source = pages[single ? currentPage : 0]
  const fitted = source ? fitPage(source.width, source.height, area.width - 48, area.height - 48, single ? 1 : 2) : { width: 1, height: 1 }
  const size = { width: Math.max(1, Math.floor(fitted.width * zoom)), height: Math.max(1, Math.floor(fitted.height * zoom)) }
  const pageElements = useMemo(() => pages.map((p, i) => <div key={p.id} className={'page' + (i > 0 && (i % 2 === 0 || i + 1 < pages.length) ? i % 2 === 1 ? ' gutter-left' : ' gutter-right' : '')}><img src={p.dataUrl} alt={`Page ${i + 1} of ${pages.length}`} draggable={false} /></div>), [pages])
  const atStart = single ? currentPage === 0 : spreadIndex === 0
  const atEnd = single ? currentPage >= pages.length - 1 : spreadIndex >= spreads.length - 1

  useEffect(() => { flipRef.current?.pageFlip()?.update() }, [size.width, size.height])
  useEffect(() => { listBooks().then(setBooks).catch((e) => setError(`Could not open saved books: ${message(e)}`)) }, [])
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const selectPage = useCallback((index: number) => {
    if (index < 0 || index >= pages.length) return
    if (single) setCurrentPage(index)
    else flipRef.current?.pageFlip()?.turnToPage(index)
  }, [single, pages.length])
  const navigate = useCallback((direction: number) => {
    if (single) setCurrentPage((page) => Math.min(pages.length - 1, Math.max(0, page + direction)))
    else if (direction > 0) flipRef.current?.pageFlip()?.flipNext()
    else flipRef.current?.pageFlip()?.flipPrev()
  }, [single, pages.length])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (isEditingTarget(e.target) || showLaunch || !hasBook || busy || e.isComposing) return
      const historyDirection = historyShortcut(e)
      if (historyDirection) {
        e.preventDefault(); e.stopPropagation()
        travelHistory(historyDirection)
        return
      }
      if (!pages.length || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation()
        navigate(e.key === 'ArrowRight' ? 1 : -1)
        return
      }
      if (target.closest('input, select, textarea, button, [contenteditable]')) return
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); selectPage(e.key === 'Home' ? 0 : pages.length - 1) }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [pages.length, busy, navigate, selectPage, showLaunch, hasBook, travelHistory])

  const canReplace = () => !dirty || window.confirm('Discard unsaved changes to this book? Save first to keep them.')
  const handleFiles = async (files: FileList | File[], action: 'replace' | 'append' = 'replace') => {
    const arr = Array.from(files)
    if (!arr.length || busy || (action === 'replace' && !canReplace())) return
    setLoading(true); setError(null); setStatus(''); setProgress(null)
    try {
      const newPages: BookPage[] = []
      for (const file of arr) {
        const report = (p: { current: number; total: number }) => setProgress({ ...p, file: file.name })
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
          const { extractPdf } = await import('./lib/pdfExtract')
          const result = await extractPdf(file, 1.6, report)
          newPages.push(...result.pages.map((p, i) => ({ ...p, id: uid(), name: `${file.name} · ${i + 1}` })))
        } else if (file.type.startsWith('image/')) {
          const { extractImages } = await import('./lib/imageExtract')
          const result = await extractImages([file], report)
          newPages.push(...result.map((p) => ({ ...p, id: uid() })))
        } else throw new Error(`Unsupported file: ${file.name}. Choose PDFs or images.`)
      }
      if (!newPages.length) throw new Error('No pages were found in these files.')
      if (action === 'append') {
        rememberEdit()
        setPages((existing) => [...existing, ...newPages])
        setStatus(`Added ${newPages.length} ${newPages.length === 1 ? 'page' : 'pages'} to the end of this book.`)
      } else {
        resetHistory()
        setPages(newPages); setTitle(arr[0].name.replace(/\.[^.]+$/, '') + (arr.length > 1 ? ' collection' : ''))
        setCurrentBookId(null); setCreatedAt(Date.now()); setCurrentPage(0); setZoom(1)
        setMode(isMixed(newPages) ? 'single' : 'spread')
        setStatus('')
      }
      setClearedBook(null); setDirty(true); setHasBook(true); setShowLaunch(false)
    } catch (e) { setError(message(e)) }
    finally { setLoading(false); setProgress(null) }
  }

  const saveCurrent = async () => {
    if (!pages.length || busy) return
    setSaving(true); setError(null)
    const book: Book = { id: currentBookId || uid(), title: title.trim() || 'Untitled book', pages, createdAt, updatedAt: Date.now() }
    try {
      await saveBook(book)
      setCurrentBookId(book.id); setTitle(book.title); setDirty(false); setStatus('Saved on this device.')
      setBooks(await listBooks())
    } catch (e) { setError(`Could not save this book. ${message(e)}`) }
    finally { setSaving(false) }
  }
  const loadBook = async (id: string) => {
    if (busy || !canReplace()) return
    setLoading(true); setError(null)
    try {
      const book = await getBook(id)
      if (!book) throw new Error('This saved book is no longer available.')
      resetHistory()
      setClearedBook(null); setPages(book.pages); setTitle(book.title); setCurrentBookId(book.id); setCreatedAt(book.createdAt)
      setCurrentPage(0); setDirty(false); setZoom(1); setMode(isMixed(book.pages) ? 'single' : 'spread'); setStatus('Opened saved book.'); setHasBook(true); setShowLaunch(false)
    } catch (e) { setError(message(e)) }
    finally { setLoading(false) }
  }
  const removeBook = async (id: string) => {
    if (busy) return
    setSaving(true); setError(null)
    try {
      const book = await getBook(id)
      if (!book) throw new Error('This saved book is no longer available.')
      await deleteBook(id); setDeletedBook(book)
      if (currentBookId === id) { setCurrentBookId(null); setDirty(true) }
      setBooks(await listBooks()); setStatus('Book removed from the library. Undo is available until the next deletion or reload.')
    } catch (e) { setError(message(e)) }
    finally { setSaving(false) }
  }
  const undoDelete = async () => {
    if (!deletedBook || busy) return
    setSaving(true)
    try { await saveBook(deletedBook); setBooks(await listBooks()); setDeletedBook(null); setStatus('Book restored to the library.') }
    catch (e) { setError(message(e)) }
    finally { setSaving(false) }
  }
  const doExport = async () => {
    if (!pages.length || busy) return
    setExporting(exportFormat); setError(null)
    try {
      let blob: Blob
      if (exportFormat === 'html') {
        const [{ buildStandaloneHtml }, { loadEmbeddedFonts }] = await Promise.all([import('./lib/exportHtml'), import('./lib/embeddedFonts')])
        blob = new Blob([buildStandaloneHtml(title, pages, await loadEmbeddedFonts())], { type: 'text/html' })
      } else if (exportFormat === 'pdf' || exportFormat === 'pdf-single') {
        const { exportSpreadPdf, exportSinglePagePdf } = await import('./lib/exportPdf')
        blob = await (exportFormat === 'pdf-single' ? exportSinglePagePdf : exportSpreadPdf)(title, pages)
      } else {
        const { exportImagesZip } = await import('./lib/exportZip')
        blob = await exportImagesZip(title, pages)
      }
      const filename = (title.trim() || 'Untitled book').replace(/[\\/:*?"<>|]/g, '-')
      const extension = exportFormat === 'pdf-single' ? 'pdf' : exportFormat
      downloadBlob(blob, `${filename}.${extension}`); setStatus(`${extension.toUpperCase()} export ready.`)
    } catch (e) { setError(`Export failed. ${message(e)}`) }
    finally { setExporting(null) }
  }
  const reorderPages = (from: number, to: number) => {
    if (busy || from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return
    rememberEdit()
    const activeId = pages[currentPage].id
    const next = [...pages]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved)
    setPages(next); setCurrentPage(next.findIndex((p) => p.id === activeId)); setDirty(true)
  }
  const removePage = (index: number) => {
    if (busy || index < 0 || index >= pages.length) return
    rememberEdit()
    const next = pages.filter((_, i) => i !== index)
    const nextPage = Math.max(0, Math.min(currentPage - (index < currentPage ? 1 : 0), next.length - 1))
    setPages(next); setCurrentPage(nextPage); setDirty(true)
    if (arrangePageId === pages[index].id) setArrangePageId(next[Math.min(index, next.length - 1)]?.id ?? null)
    setStatus(`Page ${index + 1} removed.`)
  }
  const clearAllPages = () => {
    if (busy || !pages.length) return
    rememberEdit()
    setClearedBook({ pages, currentPage, arrangePageId, dirty })
    setPages([]); setCurrentPage(0); setArrangePageId(null); setDirty(true)
    setStatus('All pages cleared.')
  }
  const restorePages = () => {
    if (busy || !clearedBook || pages.length) return
    rememberEdit()
    setPages(clearedBook.pages); setCurrentPage(clearedBook.currentPage)
    setArrangePageId(clearedBook.arrangePageId); setDirty(clearedBook.dirty)
    setClearedBook(null); setStatus('All pages restored.')
  }
  const newBook = () => {
    if (busy || !canReplace()) return
    resetHistory()
    setClearedBook(null)
    setPages([]); setHasBook(false); setCurrentBookId(null); setCurrentPage(0); setTitle('Untitled book'); setDirty(false); setStatus(''); setError(null)
  }
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await workspaceRef.current?.requestFullscreen()
    } catch { setError('Fullscreen is unavailable in this browser.') }
  }

  return (
    <div className="app" style={{ '--header-height': `${headerHeight}px` } as CSSProperties}>
      <header ref={attachHeader} className="topbar">
        <div className="brand">
          <div className="brand-row">
          <button className="brand-home" aria-label="Flipbook launch screen" onClick={() => setShowLaunch(true)}>
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
            <span className="brand-title">Flipbook</span>
          </button>
          <div className={'return-reveal' + (showLaunch && hasBook ? ' is-open' : '')} inert={!showLaunch || !hasBook} aria-hidden={!showLaunch || !hasBook}>
            <button className="return-to-book" onClick={() => setShowLaunch(false)}>Return to book</button>
          </div>
          </div>
          <span className="brand-subtitle">Visualize your pages in a book layout</span>
        </div>
        {hasBook && !showLaunch && <div className="header-document"><span className="eyebrow">SPREAD PREVIEW</span><EditableTitle title={title} disabled={busy} onCommit={renameBook} /></div>}
        <div className="topbar-actions">
          <button className="primary" onClick={() => fileInputRef.current?.click()} disabled={busy}>Upload</button>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/*" hidden onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = '' }} />
      </header>
      <main className="main">
        <section ref={workspaceRef} className="workspace" aria-label="Book workspace">
          <div className="notifications" aria-live="polite">
            {error && <div className="notice error" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
            {loading && <div className="notice"><span>{progress ? `Importing ${progress.file} · Page ${progress.current} of ${progress.total}` : 'Opening pages…'}</span></div>}
          </div>
          {!hasBook || showLaunch ? (
            <div className="empty-state" onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files) }} onDragOver={(e) => e.preventDefault()}>
              <span className="eyebrow">BOOK PREVIEW</span>
              <h1>See your layout<br />in two-page spreads.</h1>
              <p>Drop in PDFs and images to see a book mockup you can arrange and download. (Files are only stored in your browser.)</p>
              <button className="drop-zone" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                <span className="upload-symbol" aria-hidden="true">↑</span><strong>Choose files or drop them here</strong><span>PDF, PNG, JPEG, WebP, and more · Multiple files welcome</span>
              </button>
              <div className="privacy-note">Processed in your browser. Saved books stay on this device.</div>
            </div>
          ) : (
            <div className="reader-layout">
              <div className="reader-note">{mixed && <p className="layout-note">Single-page view preserves each page’s shape. Spreads fit pages inside the first page’s proportions.</p>}</div>
              <div className="stage" ref={attachStage} aria-label="Document preview" tabIndex={0}>
                <div className="stage-content" style={{ width: Math.max(area.width, size.width * (single ? 1 : 2) + 48), height: Math.max(area.height, size.height + 48) }}>
                  {pages.length > 0 && area.width > 0 && (single ? <div className="single-page" style={{ width: size.width, height: size.height }}><img src={source.dataUrl} alt={`Page ${currentPage + 1} of ${pages.length}`} /></div> :
                    <div className="flip-frame" style={{ width: size.width * 2, height: size.height, pointerEvents: busy ? 'none' : 'auto' }}><HTMLFlipBook key={`${previewGeneration}:${pages.map((p) => p.id).join(',')}:${shadows}`}
                      ref={flipRef} width={pages[0].width} height={pages[0].height} size="stretch" minWidth={1} maxWidth={10000} minHeight={1} maxHeight={10000}
                      drawShadow={shadows} flippingTime={window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 700} usePortrait={false} showCover={true} maxShadowOpacity={0.2}
                      className={'book' + (shadows ? ' with-shadows' : '') + (visiblePages.length === 2 ? ' has-open-spread' : '')} style={{}} startPage={currentPage} startZIndex={0} autoSize={true} mobileScrollSupport={false}
                      clickEventForward={true} useMouseEvents={true} swipeDistance={30} showPageCorners={!busy} disableFlipByClick={busy}
                      onInit={(e: { object: { getRender: () => Parameters<typeof easePageTurns>[0] & Parameters<typeof styleTurnShadow>[0]; getState: () => string; getUI: () => { getDistElement: () => HTMLElement } } }) => {
                        easePageTurns(e.object.getRender(), () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => e.object.getState())
                        styleTurnShadow(e.object.getRender(), e.object.getUI().getDistElement())
                      }}
                      onFlip={(e: { data: number }) => setCurrentPage(e.data)}>
                      {pageElements}
                    </HTMLFlipBook></div>)}
                </div>
              </div>

              <div className="preview-footer">
                <nav className="preview-navigation" aria-label="Page navigation">
                  <button onClick={() => navigate(-1)} disabled={atStart || busy} aria-label="Previous page or spread">← Previous</button>
                  <span className="page-count" aria-live="polite">{visiblePages.length > 1 ? `${visiblePages[0] + 1}–${visiblePages[1] + 1}` : pages.length ? currentPage + 1 : 0} / {pages.length}</span>
                  <button onClick={() => navigate(1)} disabled={atEnd || busy} aria-label="Next page or spread">Next →</button>
                </nav>
                <button className="fullscreen-button" onClick={fullscreen} aria-label="Toggle fullscreen" title="Full screen">⛶</button></div>
              <div className="page-tray"><div className="tray-heading"><span>PAGES <span className="muted">Drag to reorder</span></span></div><ThumbnailStrip pages={pages} visiblePages={visiblePages} onReorder={reorderPages} onRemove={removePage} onSelect={(index) => { setArrangePageId(pages[index].id); selectPage(index) }} onAddFiles={(files) => { void handleFiles(files, 'append') }} disabled={busy} /><div className="export-actions tray-export">
                <div className="clear-pages-actions">
                  <div className="history-actions">
                    <button onClick={() => travelHistory('undo')} disabled={busy || !history.past.length}>Undo</button>
                    <button onClick={() => travelHistory('redo')} disabled={busy || !history.future.length}>Redo</button>
                  </div>
                  <button onClick={clearAllPages} disabled={busy || !pages.length}>Clear all</button>
                  <div className={'return-reveal restore-reveal' + (clearedBook && !pages.length ? ' is-open' : '')} inert={!clearedBook || !!pages.length} aria-hidden={!clearedBook || !!pages.length}>
                    <button className="return-to-book" onClick={restorePages} disabled={busy}>Restore</button>
                  </div>
                </div>
                <label className="sr-only" htmlFor="export-format">Export format</label><select id="export-format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} disabled={busy}><option value="pdf">PDF (Spreads)</option><option value="pdf-single">PDF (Single pages)</option><option value="html">Offline (HTML)</option><option value="zip">Images (ZIP)</option></select><button onClick={doExport} disabled={busy || !pages.length}>{exporting ? 'Exporting…' : 'Export ↓'}</button></div></div>
            </div>
          )}

          <details className="customize">
            <summary>Customize <span aria-hidden="true" className="customize-chevron">⌄</span></summary>
            <div className="customize-content">
              <div className="customize-book">
                <div className="document-title"><label className="customize-label">Book title<input aria-label="Book title" value={title} disabled={!pages.length || busy} onFocus={() => { titleEditRecorded.current = false }} onBlur={() => { titleEditRecorded.current = false }} onChange={(e) => {
                    if (!titleEditRecorded.current) { rememberEdit(); titleEditRecorded.current = true }
                    setTitle(e.target.value); setDirty(true)
                  }} /></label><span className="save-status">{pages.length ? saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved on this device' : ''}</span></div>
                <div className="customize-actions">
                  <button onClick={saveCurrent} disabled={!pages.length || busy || !dirty}>{saving ? 'Saving…' : 'Save book'}</button>
                  <button onClick={() => setLibraryOpen(!libraryOpen)} aria-expanded={libraryOpen} aria-controls="book-library">Library <span className="badge">{books.length}</span></button>
                </div>
              </div>
              {pages.length > 0 && !showLaunch && <>
                <div className="reorder-controls" aria-label="Arrange pages">
                  <label>Arrange page <select aria-label="Page to move" value={pages[arrangeIndex]?.id ?? ''} disabled={busy} onChange={(e) => { setArrangePageId(e.target.value); selectPage(pages.findIndex((page) => page.id === e.target.value)) }}>
                    {pages.map((page, index) => <option key={page.id} value={page.id}>{index + 1}</option>)}
                  </select></label>
                  <button onClick={() => { setArrangePageId(pages[arrangeIndex].id); reorderPages(arrangeIndex, arrangeIndex - 1) }} disabled={busy || arrangeIndex === 0}>← Move earlier</button>
                  <button onClick={() => { setArrangePageId(pages[arrangeIndex].id); reorderPages(arrangeIndex, arrangeIndex + 1) }} disabled={busy || arrangeIndex === pages.length - 1}>Move later →</button>
                </div>
                <div className="reading-toolbar">
                <div className="toolbar-group">
                  <form onSubmit={(e) => { e.preventDefault(); const page = Number(jump || currentPage + 1); if (Number.isInteger(page) && page >= 1 && page <= pages.length) { selectPage(page - 1); setJump('') } }}><label className="sr-only" htmlFor="jump">Go to page</label><input id="jump" type="number" min="1" max={pages.length} value={jump} placeholder={String(currentPage + 1)} onChange={(e) => setJump(e.target.value)} disabled={busy} /><button disabled={busy}>Go</button></form>
                </div>
                <div className="toolbar-group"><div className="segmented" aria-label="Reading mode"><button aria-pressed={single} onClick={() => { setMode('single'); setZoom(1) }}>Single</button><button aria-pressed={!single} disabled={area.width < 620} title={area.width < 620 ? 'Spreads are available in a wider window' : 'Two-page spread'} onClick={() => { setMode('spread'); setZoom(1) }}>Spread</button></div><button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} disabled={zoom <= 0.5} aria-label="Zoom out">−</button><button onClick={() => setZoom(1)} title="Fit entire page">{zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}</button><button onClick={() => setZoom(Math.min(3, zoom + 0.25))} disabled={zoom >= 3} aria-label="Zoom in">+</button></div>
              </div>
                <div className="customize-options"><label><input type="checkbox" checked={shadows} onChange={(e) => setShadows(e.target.checked)} /> Page shadows</label><div className="export-actions"><button className="quiet" onClick={newBook} disabled={busy}>New book</button></div></div>
              </>}
              {(status || deletedBook) && <div className="notice" role="status"><span>{status}</span>{deletedBook && <button onClick={undoDelete} disabled={busy}>Undo deletion</button>}</div>}
              {libraryOpen && <aside id="book-library" className="sidebar"><div className="library-heading"><h2>Your library</h2><button className="quiet" onClick={() => setLibraryOpen(false)} aria-label="Close library">×</button></div><p className="library-description">Saved in this browser, on this device.</p>{!books.length ? <p className="library-empty">Your saved books will appear here.</p> : <ul>{books.map((book) => <li key={book.id} className={currentBookId === book.id ? 'selected' : ''}><button className="book-link" onClick={() => loadBook(book.id)} disabled={busy}><span className="library-book-icon" aria-hidden="true">▤</span><span><strong>{book.title}</strong><small>{book.pageCount} pages · {new Date(book.updatedAt).toLocaleDateString()}</small></span></button><button className="delete-book" onClick={() => removeBook(book.id)} disabled={busy} aria-label={`Delete ${book.title}`}>×</button></li>)}</ul>}</aside>}
            </div>
          </details>
        </section>

      </main>
      <footer className="app-footer">
        <p>Created by Tim Murray · Built with Codex, ChatGPT, and OpenCode · Last updated November 14, 2026</p>
        <p>Files are processed in your browser. Saved books stay in this browser on this device.</p>
        <p className="footer-colophon">Colophon: Set in <a href="https://fonts.google.com/specimen/Fira+Sans" target="_blank" rel="noreferrer">Fira Sans</a>, designed by Carrois Apostrophe; self-hosted under the <a href={`${import.meta.env.BASE_URL}fonts/OFL.txt`} target="_blank" rel="noreferrer">SIL Open Font License</a>.</p>
      </footer>
    </div>
  )
}
