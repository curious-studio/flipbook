/** Bind measurement to the actual preview node, not to whether a book exists.
 * React may replace that node during layout edits or a view transition. */
export function observePreview(element: HTMLElement, onSize: (size: { width: number; height: number }) => void) {
  const update = (width: number, height: number) => {
    if (width > 0 && height > 0) onSize({ width, height })
  }
  update(element.clientWidth, element.clientHeight)
  const observer = new ResizeObserver(([entry]) => {
    if (entry) update(entry.contentRect.width, entry.contentRect.height)
  })
  observer.observe(element)
  return () => observer.disconnect()
}
