export function thumbnailWidth(width: number, height: number): number {
  return Math.min(132, Math.max(44, 88 * width / height))
}

/** Scroll only the horizontal thumbnail strip, never the whole document. */
export function revealOffset(left: number, right: number, viewportWidth: number): number {
  if (left < 0) return left
  if (right > viewportWidth) return right - viewportWidth
  return 0
}

export function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
}
