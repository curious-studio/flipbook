export interface History<T> {
  past: T[]
  future: T[]
}

export function historyShortcut(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'isComposing'>): 'undo' | 'redo' | null {
  if (event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return null
  return event.shiftKey ? 'redo' : 'undo'
}

export function recordEdit<T>(history: History<T>, current: T): History<T> {
  return { past: [...history.past, current].slice(-20), future: [] }
}

export function stepHistory<T>(history: History<T>, current: T, direction: 'undo' | 'redo'): { history: History<T>; value: T } | null {
  const source = direction === 'undo' ? history.past : history.future
  if (!source.length) return null
  const value = source[source.length - 1]
  return {
    value,
    history: direction === 'undo'
      ? { past: history.past.slice(0, -1), future: [...history.future, current].slice(-20) }
      : { past: [...history.past, current].slice(-20), future: history.future.slice(0, -1) },
  }
}
