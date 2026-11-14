interface ShadowRenderer {
  setShadowData: (position: { x: number; y: number }, angle: number, progress: number, direction: number) => void
  getSettings: () => { maxShadowOpacity: number }
}

const configured = new WeakSet<ShadowRenderer>()

/** Keep the custom cast shadow in sync with the engine's turn progress.
 * Geometry and visibility remain controlled by the flip engine. */
export function styleTurnShadow(renderer: ShadowRenderer, surface: HTMLElement) {
  if (configured.has(renderer)) return
  configured.add(renderer)
  const setShadow = renderer.setShadowData.bind(renderer)
  renderer.setShadowData = (position, angle, progress, direction) => {
    setShadow(position, angle, progress, direction)
    const fade = Math.max(0, Math.min(1, 1 - progress / 100))
    const opacity = Math.min(1, renderer.getSettings().maxShadowOpacity * 1.25 * fade)
    surface.style.setProperty('--turn-shadow-opacity', String(opacity))
  }
}
