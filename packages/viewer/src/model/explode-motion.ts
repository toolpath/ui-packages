import { readExplodeAmount, type ExplodeAmount } from './explode-amount.js'

/**
 * Where an explosion is, as a React readout takes it. `getSnapshot` returns the same object
 * until something a readout shows changes, at most ten times a second while moving.
 */
export interface ExplodeMotionSnapshot {
  readonly amount: number
  /**
   * `idle` at rest; `waiting` while a requested move holds for attached pieces to warm up;
   * `moving` while it runs.
   */
  readonly mode: 'idle' | 'waiting' | 'moving'
  /** Pieces are apart or on their way: draw them in place of the assembled part. */
  readonly active: boolean
  /** An attached `<ExplodedPart>` is still warming its shaders and buffers. */
  readonly preparing: boolean
}

/**
 * An explode amount that animates itself. Pass it as `explode.amount`; `<ExplodedPart>` reads
 * it every frame and holds a requested move until its pieces are warm.
 */
export interface ExplodeMotion extends ExplodeAmount {
  /** Ease to an amount; `immediate` jumps once attached pieces are warm. */
  moveTo: (target: number, options?: { readonly immediate?: boolean }) => void
  /** Jump to an amount now, stopping any move. */
  set: (amount: number) => void
  getSnapshot: () => ExplodeMotionSnapshot
  hold: () => () => void
}

export interface ExplodeMotionOptions {
  /** Milliseconds for a full move from assembled to apart; shorter moves take their share. */
  readonly durationMs?: number
  /**
   * Whether moves jump instead of easing. Read at each move. Defaults to the person's
   * `prefers-reduced-motion` setting.
   */
  readonly reducedMotion?: () => boolean
  /** The frame clock, for tests. Defaults to `requestAnimationFrame`. */
  readonly requestFrame?: (callback: (timestamp: number) => void) => number
  readonly cancelFrame?: (handle: number) => void
}

const DURATION_MS = 1800
/** React readouts receive at most ten updates a second while moving. */
const READOUT_MS = 100
// Zero velocity and acceleration at each end, without overshooting the part's geometry.
const ease = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

const prefersReducedMotion = (): boolean =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const hidden = (): boolean => globalThis.document?.hidden ?? false

/**
 * Animation for an explosion: easing, real elapsed time, a pause while the tab is hidden, and
 * the person's reduced-motion setting. The application still decides when to move.
 */
export const createExplodeMotion = (
  initial = 0,
  {
    durationMs = DURATION_MS,
    reducedMotion = prefersReducedMotion,
    requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
    cancelFrame = (handle) => globalThis.cancelAnimationFrame(handle),
  }: ExplodeMotionOptions = {},
): ExplodeMotion => {
  let value = readExplodeAmount(initial)
  let mode: ExplodeMotionSnapshot['mode'] = 'idle'
  let holds = 0
  let from = value
  let to = value
  let immediate = false
  let elapsed = 0
  let lastFrame: number | null = null
  let lastReadout = -Infinity
  let frame: number | null = null
  const listeners = new Set<() => void>()
  const snapshotOf = (): ExplodeMotionSnapshot => ({
    amount: value,
    mode,
    active: value > 0 || mode === 'moving',
    preparing: holds > 0,
  })
  let snapshot = snapshotOf()
  const notify = (readout: boolean) => {
    if (readout) {
      snapshot = snapshotOf()
    }
    for (const listener of listeners) {
      listener()
    }
  }
  const stopFrames = () => {
    if (frame !== null) {
      cancelFrame(frame)
      frame = null
    }
    lastFrame = null
  }
  // A hidden tab neither draws nor counts towards the move.
  const visibility = () => {
    stopFrames()
    schedule()
  }
  // Rest at `amount`: no frames, no visibility listener, and readouts told.
  const finish = (amount: number) => {
    value = amount
    mode = 'idle'
    stopFrames()
    globalThis.document?.removeEventListener('visibilitychange', visibility)
    notify(true)
  }
  const schedule = () => {
    if (frame === null && mode !== 'idle' && !(mode === 'waiting' && holds > 0) && !hidden()) {
      frame = requestFrame(tick)
    }
  }
  const tick = (timestamp: number) => {
    frame = null
    if (mode === 'waiting') {
      if (holds > 0) {
        return
      }
      if (immediate || reducedMotion()) {
        finish(to)
        return
      }
      mode = 'moving'
      lastFrame = timestamp
      lastReadout = timestamp
      notify(true)
      schedule()
      return
    }
    if (mode !== 'moving') {
      return
    }
    // Slow frames change how many frames a move takes, not how long it takes.
    elapsed += lastFrame === null ? 0 : Math.max(0, timestamp - lastFrame)
    lastFrame = timestamp
    const duration = Math.max(1, Math.abs(to - from) * durationMs)
    const progress = Math.min(1, elapsed / duration)
    value = from + (to - from) * ease(progress)
    if (progress === 1) {
      finish(to)
      return
    }
    const readout = timestamp - lastReadout >= READOUT_MS
    if (readout) {
      lastReadout = timestamp
    }
    notify(readout)
    schedule()
  }
  return {
    get value() {
      return value
    },
    set: (next) => {
      const target = readExplodeAmount(next)
      if (target === value && mode === 'idle') {
        return
      }
      finish(target)
    },
    moveTo: (target, options = {}) => {
      to = readExplodeAmount(target)
      if (to === value && mode === 'idle') {
        return
      }
      from = value
      immediate = options.immediate ?? false
      elapsed = 0
      stopFrames()
      // Moves wait one frame for pieces that mount in response to this same request.
      mode = 'waiting'
      globalThis.document?.addEventListener('visibilitychange', visibility)
      notify(true)
      schedule()
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      // Two components in the same canvas may subscribe with the same invalidate function.
      const subscription = () => listener()
      listeners.add(subscription)
      return () => {
        listeners.delete(subscription)
      }
    },
    hold: () => {
      holds += 1
      notify(true)
      let held = true
      return () => {
        if (!held) {
          return
        }
        held = false
        holds -= 1
        notify(true)
        schedule()
      }
    },
  }
}
