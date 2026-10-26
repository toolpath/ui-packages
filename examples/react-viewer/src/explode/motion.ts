type Mode = 'idle' | 'transition'

interface MotionSnapshot {
  readonly amount: number
  readonly mode: Mode
}

/** Scene frames read amount directly; React readouts receive at most ten updates a second. */
export interface ExplosionMotion {
  readonly amount: number
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => MotionSnapshot
  advance: (timestamp: number) => boolean
  /** Exclude time while the app's animation driver is suspended. Keeps current progress. */
  resetClock: () => void
  /** Jump to an amount without animating. */
  seek: (amount: number) => void
  /** Animate to an amount. */
  moveTo: (amount: number) => void
}

const DURATION_MS = 1800
const clamp = (value: number): number => Math.max(0, Math.min(1, value))
// Zero velocity and acceleration at each end, without overshooting the part's geometry.
const ease = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

/** `now` reads the clock animation-frame timestamps use. */
export const createExplosionMotion = (
  initial: number,
  now: () => number = () => performance.now(),
): ExplosionMotion => {
  let amount = clamp(initial)
  let mode: Mode = 'idle'
  let from = amount
  let to = amount
  let elapsed = 0
  let lastFrame: number | null = null
  let lastPublished = -Infinity
  const listeners = new Set<() => void>()
  let snapshot: MotionSnapshot = { amount, mode }
  const publish = () => {
    snapshot = { amount, mode }
    for (const listener of listeners) {
      listener()
    }
  }
  const start = (next: number) => {
    from = amount
    to = clamp(next)
    elapsed = 0
    // Count from the request, so time before the first frame belongs to the run.
    lastFrame = now()
    lastPublished = -Infinity
    mode = from === to ? 'idle' : 'transition'
    publish()
  }
  const seek = (next: number) => {
    amount = clamp(next)
    mode = 'idle'
    lastFrame = null
    publish()
  }
  return {
    get amount() {
      return amount
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    seek,
    resetClock: () => {
      lastFrame = null
    },
    moveTo: start,
    advance: (timestamp) => {
      if (mode === 'idle') {
        return false
      }
      // Slow rendering changes the number of frames, not the transition's duration.
      // The driver resets the clock when suspending for a hidden tab.
      elapsed += lastFrame === null ? 0 : Math.max(0, timestamp - lastFrame)
      lastFrame = timestamp
      const duration = Math.max(1, Math.abs(to - from) * DURATION_MS)
      const progress = clamp(elapsed / duration)
      amount = from + (to - from) * ease(progress)
      if (progress === 1) {
        amount = to
        mode = 'idle'
      }
      if (progress === 1 || timestamp - lastPublished >= 100) {
        lastPublished = timestamp
        publish()
      }
      return mode !== 'idle'
    },
  }
}
