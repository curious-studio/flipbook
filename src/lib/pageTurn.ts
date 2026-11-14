type Frame = () => void
interface AnimationRenderer {
  startAnimation: (frames: Frame[], duration: number, onEnd: () => void) => void
}

const configured = new WeakSet<AnimationRenderer>()

/** The flip engine schedules linear frames; remap those frames without changing
 * its geometry, drag tracking, completion callback, or animation clock. */
export function easePageTurns(renderer: AnimationRenderer, reduceMotion = () => false, getState = () => 'flipping') {
  if (configured.has(renderer)) return
  configured.add(renderer)
  const start = renderer.startAnimation.bind(renderer)
  renderer.startAnimation = (frames, duration, onEnd) => {
    if (reduceMotion()) {
      start(frames, 1, onEnd)
      return
    }
    const last = frames.length - 1
    const eased = last > 0 ? frames.map((_, index) => {
      const t = index / last
      const progress = t * t * (3 - 2 * t)
      return frames[Math.round(progress * last)]
    }) : frames
    // Corner previews otherwise inherit a very short distance-based duration.
    // Their return animation starts after the engine switches back to read.
    const state = getState()
    const hover = state === 'fold_corner' || state === 'read'
    start(eased, hover ? 250 : duration, onEnd)
  }
}
