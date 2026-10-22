/**
 * Touch camera input for a canvas with no DOM element: React Native's.
 *
 * {@link createTouchOrbit} turns the fingers that are down into camera
 * operations and knows nothing of three or of where the touches came from. The
 * native frame feeds it, and applies what it returns through
 * `ExtendedCameraControls`' `orbitBy`, `zoomAt` and `panBy` once per frame.
 */

import type { ViewportSize } from './camera.js'

/** One finger, in layout pixels local to the canvas. */
export interface TouchPoint {
  id: number
  x: number
  y: number
}

/** A React Native touch, as far as {@link localPoint} reads it. */
interface PageTouch {
  identifier: string | number
  pageX: number
  pageY: number
}

/** A finger in page coordinates, made local to a canvas whose window origin is `origin`. */
export const localPoint = (finger: PageTouch, origin: { x: number; y: number }): TouchPoint => ({
  id: Number(finger.identifier),
  x: finger.pageX - origin.x,
  y: finger.pageY - origin.y,
})

type TouchOp =
  | { kind: 'orbit'; dx: number; dy: number }
  | { kind: 'zoom'; scale: number; x: number; y: number }
  | { kind: 'pan'; dx: number; dy: number }

export interface TouchOrbit {
  /** Every finger down now. */
  update(touches: readonly TouchPoint[]): TouchOp[]
  reset(): void
}

const sameIds = (a: readonly TouchPoint[], b: readonly TouchPoint[]): boolean =>
  a.length === b.length && a.every((touch) => b.some((other) => other.id === touch.id))

const centroid = (a: TouchPoint, b: TouchPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

const spread = (a: TouchPoint, b: TouchPoint): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Ordered by id, so a pair is the same pair from one update to the next. */
const byId = (touches: readonly TouchPoint[]): TouchPoint[] =>
  [...touches].sort((a, b) => a.id - b.id)

/**
 * One finger orbits. Two zoom by the change in their spread, about their
 * centroid, and pan by the centroid's travel. Three or more mean nothing.
 *
 * Any change in which fingers are down makes that update the new baseline and
 * emits nothing for it: lifting one of two fingers would otherwise read as the
 * remaining one jumping from the old centroid to where it is.
 */
export const createTouchOrbit = (): TouchOrbit => {
  let last: TouchPoint[] = []

  return {
    update(touches) {
      const now = byId(touches)
      const before = last
      last = now
      if (!sameIds(now, before)) return []

      const [first, second] = now
      const [firstBefore, secondBefore] = before
      if (!first || !firstBefore) return []

      if (now.length === 1) {
        const dx = first.x - firstBefore.x
        const dy = first.y - firstBefore.y
        return dx === 0 && dy === 0 ? [] : [{ kind: 'orbit', dx, dy }]
      }

      if (now.length === 2 && second && secondBefore) {
        const ops: TouchOp[] = []
        const from = centroid(firstBefore, secondBefore)
        const to = centroid(first, second)
        const previous = spread(firstBefore, secondBefore)
        if (previous > 0) {
          const scale = spread(first, second) / previous
          if (scale !== 1) ops.push({ kind: 'zoom', scale, x: to.x, y: to.y })
        }
        if (to.x !== from.x || to.y !== from.y) {
          ops.push({ kind: 'pan', dx: to.x - from.x, dy: to.y - from.y })
        }
        return ops
      }

      return []
    },
    reset() {
      last = []
    },
  }
}

export interface FingerTracker {
  update(
    kind: 'start' | 'move' | 'end' | 'cancel',
    changed: readonly TouchPoint[],
    touches: readonly TouchPoint[],
  ): TouchPoint[]
  reset(): void
}

/**
 * The fingers that are down, kept from each event's `changedTouches` rather
 * than read from its `touches`.
 *
 * Feeding the orbit React Native's `touches` jumped and drifted more on an
 * iPhone than tracking the fingers from what changed: after an interruption
 * iOS can report a finger in `touches` that it never ended. A finger that did
 * not change this event still takes its position from `touches`. A lost end
 * is forgotten when the next gesture starts.
 */
export const createFingerTracker = (): FingerTracker => {
  const fingers = new Map<number, TouchPoint>()
  return {
    update(kind, changed, touches) {
      // A gesture starting with none of the fingers this remembers means their
      // ends were lost — an interruption swallowed them — and they would
      // otherwise count as down forever.
      if (kind === 'start' && touches.every((touch) => !fingers.has(touch.id))) fingers.clear()
      const ending = kind === 'end' || kind === 'cancel'
      for (const touch of changed) {
        if (ending) fingers.delete(touch.id)
        else fingers.set(touch.id, touch)
      }
      for (const touch of touches) if (fingers.has(touch.id)) fingers.set(touch.id, touch)
      return [...fingers.values()]
    },
    reset() {
      fingers.clear()
    },
  }
}

/**
 * Operations held until the frame applies them.
 *
 * Touch events arrive faster than frames, and in uneven bursts. Applied one
 * event at a time, a burst moved the camera by several events' worth between
 * two frames, which reads as a jump. This merges what arrived since the last
 * frame — orbits and pans add, zooms multiply about the latest centroid — so
 * the camera moves once per frame by everything the fingers did.
 *
 * The pan comes out before the zoom. The pan carries the point that was under
 * the fingers to where the fingers are now, and the zoom about that centroid
 * then leaves it there; the other way round, the zoom is about a point the pan
 * is about to move.
 */
export interface TouchOps {
  push(ops: readonly TouchOp[]): void
  /** Everything since the last call, merged; empty when nothing arrived. */
  take(): TouchOp[]
}

export const createTouchOps = (): TouchOps => {
  let orbit: { dx: number; dy: number } | null = null
  let pan: { dx: number; dy: number } | null = null
  let zoom: { scale: number; x: number; y: number } | null = null

  return {
    push(ops) {
      for (const op of ops) {
        if (op.kind === 'orbit') {
          orbit = { dx: (orbit?.dx ?? 0) + op.dx, dy: (orbit?.dy ?? 0) + op.dy }
        } else if (op.kind === 'pan') {
          pan = { dx: (pan?.dx ?? 0) + op.dx, dy: (pan?.dy ?? 0) + op.dy }
        } else {
          zoom = { scale: (zoom?.scale ?? 1) * op.scale, x: op.x, y: op.y }
        }
      }
    },
    take() {
      const ops: TouchOp[] = []
      if (orbit) ops.push({ kind: 'orbit', ...orbit })
      if (pan) ops.push({ kind: 'pan', ...pan })
      if (zoom) ops.push({ kind: 'zoom', ...zoom })
      orbit = null
      pan = null
      zoom = null
      return ops
    },
  }
}

/** The controls' touch methods: `ExtendedCameraControls`' own. */
export interface TouchControls {
  enabled: boolean
  orbitBy(dx: number, dy: number, viewportMin: number): void
  zoomAt(scale: number, at: { x: number; y: number }, viewport: ViewportSize): void
  panBy(dx: number, dy: number, viewport: ViewportSize): void
}

/**
 * Moves the camera by a frame's merged operations, and says whether it did.
 *
 * While the controls are off — a drag owns the gesture, the section handle's —
 * the operations are dropped and the orbit forgets the fingers, so it starts
 * from where they are when the controls come back rather than from where they
 * were.
 */
export const applyTouchOps = (
  ops: readonly TouchOp[],
  controls: TouchControls,
  size: ViewportSize,
  orbit: TouchOrbit,
): boolean => {
  if (ops.length === 0) return false
  if (!controls.enabled) {
    orbit.reset()
    return false
  }
  for (const op of ops) {
    if (op.kind === 'orbit') controls.orbitBy(op.dx, op.dy, Math.min(size.width, size.height))
    else if (op.kind === 'zoom') controls.zoomAt(op.scale, { x: op.x, y: op.y }, size)
    else controls.panBy(op.dx, op.dy, size)
  }
  return true
}
