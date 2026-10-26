import { type Camera, Vector3 } from 'three'

/**
 * Labels pinned to 3D points, for a canvas with no DOM to put them in.
 *
 * React Native has nowhere for drei's `<Html>` to go, so a native label is a
 * `View` drawn over the canvas instead. Each `<SceneLabel>` registers itself
 * here; the frame projects every label once a frame, after the camera has
 * moved, and the overlay beside the canvas reads the result through
 * `useSyncExternalStore`. It only re-renders when a label actually moved, so
 * an orbit costs the overlay a render per visibly changed frame and a still
 * view costs it nothing.
 */

interface LabelSpec {
  position: Vector3 | readonly [number, number, number]
  text: string
  note?: string
  kind: string
  axis?: 'x' | 'y' | 'z'
  color?: string
  onPress?: () => void
  accessibilityHint?: string
}

export interface ProjectedLabel extends Omit<LabelSpec, 'position'> {
  id: string
  /** Layout pixels from the canvas's top-left corner. */
  x: number
  y: number
  visible: boolean
}

export interface LabelStore {
  set(id: string, label: LabelSpec): void
  remove(id: string): void
  /** Writes every label's place for this camera; notifies when any of them changed. */
  project(camera: Camera, size: { width: number; height: number }): void
  subscribe(listener: () => void): () => void
  getSnapshot(): readonly ProjectedLabel[]
}

/**
 * The least a pressable label's touch target spans, in layout pixels: Apple's
 * 44 pt, near enough Android's 48 dp. A 12 pt label is about 17 tall.
 */
const TOUCH_TARGET = 44

/** The least a pressable label's touch target reaches past either side of it. */
const TOUCH_SIDE_SLOP = 8

/**
 * How far past a pressable label of `size` a touch still presses it, so the
 * target is at least {@link TOUCH_TARGET} each way while the label stays the
 * size it is drawn. A touch that misses a label lands on the canvas, where it
 * picks or places a measure point instead.
 */
export const labelHitSlop = (size: {
  width: number
  height: number
}): { top: number; bottom: number; left: number; right: number } => {
  const vertical = Math.max(0, (TOUCH_TARGET - size.height) / 2)
  const horizontal = Math.max(TOUCH_SIDE_SLOP, (TOUCH_TARGET - size.width) / 2)
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal }
}

/** A label moving less than this, in layout pixels, is not worth a render. */
const MOVE_THRESHOLD = 0.5

/** How far past the edge of the view a label may sit and still be drawn: 10 % of the view. */
const EDGE_MARGIN_NDC = 1.2

const sameContent = (a: ProjectedLabel, b: LabelSpec): boolean =>
  a.text === b.text &&
  a.note === b.note &&
  a.kind === b.kind &&
  a.axis === b.axis &&
  a.color === b.color &&
  a.onPress === b.onPress &&
  a.accessibilityHint === b.accessibilityHint

export const createLabelStore = (): LabelStore => {
  const labels = new Map<string, LabelSpec>()
  const listeners = new Set<() => void>()
  const scratch = new Vector3()
  let snapshot: readonly ProjectedLabel[] = []
  /** {@link snapshot} by id: what the overlay was last told, which a move is measured from. */
  const notified = new Map<string, ProjectedLabel>()
  let membershipChanged = false

  // Per-frame state for the two `forEach` callbacks below, which are made once
  // so that projecting a still view allocates nothing: `project` runs in a
  // frame callback.
  let camera: Camera | null = null
  let size = { width: 0, height: 0 }
  const place = { x: 0, y: 0, visible: false }
  let changed = false
  let building: ProjectedLabel[] = []

  const placeOf = (position: LabelSpec['position']): void => {
    if (Array.isArray(position)) scratch.set(position[0], position[1], position[2])
    else scratch.copy(position as Vector3)
    scratch.project(camera!)

    // Outside the depth range is behind the camera, or past its far plane.
    place.visible =
      scratch.z >= -1 &&
      scratch.z <= 1 &&
      Math.abs(scratch.x) <= EDGE_MARGIN_NDC &&
      Math.abs(scratch.y) <= EDGE_MARGIN_NDC
    place.x = ((scratch.x + 1) / 2) * size.width
    place.y = ((1 - scratch.y) / 2) * size.height
  }

  const check = (label: LabelSpec, id: string): void => {
    if (changed) return
    placeOf(label.position)
    const before = notified.get(id)
    if (
      !before ||
      before.visible !== place.visible ||
      !sameContent(before, label) ||
      Math.abs(before.x - place.x) >= MOVE_THRESHOLD ||
      Math.abs(before.y - place.y) >= MOVE_THRESHOLD
    ) {
      changed = true
    }
  }

  const build = (label: LabelSpec, id: string): void => {
    const { position, ...content } = label
    placeOf(position)
    const projected = { id, ...content, x: place.x, y: place.y, visible: place.visible }
    building.push(projected)
    notified.set(id, projected)
  }

  return {
    set(id, label) {
      if (!labels.has(id)) membershipChanged = true
      labels.set(id, label)
    },
    remove(id) {
      if (labels.delete(id)) membershipChanged = true
    },
    project(frameCamera, frameSize) {
      camera = frameCamera
      size = frameSize
      changed = membershipChanged || notified.size !== labels.size
      labels.forEach(check)
      membershipChanged = false

      if (changed) {
        // Only now is a new snapshot made: the overlay renders from it.
        building = []
        notified.clear()
        labels.forEach(build)
        snapshot = building
      }
      camera = null

      if (changed) for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
  }
}
