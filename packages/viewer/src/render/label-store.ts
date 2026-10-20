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
  a.onPress === b.onPress

export const createLabelStore = (): LabelStore => {
  const labels = new Map<string, LabelSpec>()
  const listeners = new Set<() => void>()
  const scratch = new Vector3()
  let snapshot: readonly ProjectedLabel[] = []
  let membershipChanged = false

  return {
    set(id, label) {
      if (!labels.has(id)) membershipChanged = true
      labels.set(id, label)
    },
    remove(id) {
      if (labels.delete(id)) membershipChanged = true
    },
    project(camera, size) {
      const previous = new Map(snapshot.map((label) => [label.id, label]))
      let changed = membershipChanged || previous.size !== labels.size
      const next: ProjectedLabel[] = []

      for (const [id, label] of labels) {
        const { position, ...content } = label
        if (Array.isArray(position)) scratch.set(position[0], position[1], position[2])
        else scratch.copy(position as Vector3)
        scratch.project(camera)

        // Outside the depth range is behind the camera, or past its far plane.
        const visible =
          scratch.z >= -1 &&
          scratch.z <= 1 &&
          Math.abs(scratch.x) <= EDGE_MARGIN_NDC &&
          Math.abs(scratch.y) <= EDGE_MARGIN_NDC
        const x = ((scratch.x + 1) / 2) * size.width
        const y = ((1 - scratch.y) / 2) * size.height

        const before = previous.get(id)
        if (
          !before ||
          before.visible !== visible ||
          !sameContent(before, label) ||
          Math.abs(before.x - x) >= MOVE_THRESHOLD ||
          Math.abs(before.y - y) >= MOVE_THRESHOLD
        ) {
          changed = true
        }
        next.push({ id, ...content, x, y, visible })
      }

      membershipChanged = false
      if (!changed) return
      snapshot = next
      for (const listener of listeners) listener()
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
