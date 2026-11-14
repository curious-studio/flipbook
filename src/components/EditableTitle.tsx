import { useCallback, useRef, useState } from 'react'

interface Props {
  title: string
  disabled?: boolean
  onCommit: (title: string) => void
}

export default function EditableTitle({ title, disabled, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const finished = useRef(false)
  const focusEditor = useCallback((input: HTMLInputElement | null) => { input?.focus(); input?.select() }, [])
  const finish = (cancel = false) => {
    if (finished.current || draft === null) return
    finished.current = true
    if (!cancel) {
      const next = draft.trim() || title
      if (next !== title) onCommit(next)
    }
    setDraft(null)
  }

  return <h1 className="preview-title">
    {draft === null ? <button className="editable-title" disabled={disabled} aria-label={`Edit book title: ${title}`} title="Click to edit title"
      onClick={() => { finished.current = false; setDraft(title) }}>{title}</button> :
      <input className="title-editor" aria-label="Edit book title" maxLength={200} value={draft}
        ref={focusEditor}
        onChange={(e) => setDraft(e.target.value)} onBlur={() => finish()}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation(); finish(e.key === 'Escape')
          }
        }} />}
  </h1>
}
