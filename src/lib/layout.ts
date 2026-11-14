/** Zero-based page groups, with the front cover displayed alone. */
export function getSpreads(count: number): number[][] {
  if (count < 1) return []
  const spreads = [[0]]
  for (let i = 1; i < count; i += 2) spreads.push(i + 1 < count ? [i, i + 1] : [i])
  return spreads
}

export function getSpreadIndex(page: number, count: number): number {
  return Math.max(0, getSpreads(count).findIndex((spread) => spread.includes(page)))
}

export function fitPage(width: number, height: number, availableWidth: number, availableHeight: number, slots = 2) {
  const scale = Math.min(Math.max(1, availableWidth) / (slots * width), Math.max(1, availableHeight) / height)
  return { width: width * scale, height: height * scale }
}
