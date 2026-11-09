import { Vector3, type Matrix4, type Object3D } from 'three'
import { readExplodeAmount, type ExplodeAmount } from '../model/explode-amount.js'
import type { Vec3 } from '../model/types.js'

/**
 * Where a collection's items are drawn: each item's group at its own placement, moved by its
 * offset times an amount.
 */
export interface CollectionPlacement {
  /**
   * Moves `group` for `id` from the next `place`, from `frame`, a rigid transform, or from the
   * origin for `null`; the returned function lets it go.
   */
  add(id: string, group: Object3D, frame?: Matrix4 | null): () => void
  /**
   * Puts every group at its frame moved by its offset times the amount, or at its frame for
   * `null` offsets. The offset is in the collection's frame, not the item's. Returns whether
   * anything was written, so a frame with nothing new writes nothing.
   */
  place(offsets: ReadonlyMap<string, Vec3> | null, amount: number | ExplodeAmount): boolean
}

const SCRATCH = new Vector3()

interface Placed {
  group: Object3D
  frame: Matrix4 | null
}

export const createCollectionPlacement = (): CollectionPlacement => {
  const groups = new Map<string, Placed>()
  let placed: { offsets: ReadonlyMap<string, Vec3> | null; amount: number } | null = null
  return {
    add(id, group, frame = null) {
      const entry = { group, frame }
      groups.set(id, entry)
      placed = null
      return () => {
        if (groups.get(id) === entry) {
          groups.delete(id)
        }
      }
    },
    place(offsets, amount) {
      const at = offsets ? readExplodeAmount(amount) : 0
      if (placed && placed.offsets === offsets && placed.amount === at) {
        return false
      }
      placed = { offsets, amount: at }
      for (const [id, { group, frame }] of groups) {
        const offset = offsets?.get(id)
        group.position.set((offset?.x ?? 0) * at, (offset?.y ?? 0) * at, (offset?.z ?? 0) * at)
        if (frame) {
          group.quaternion.setFromRotationMatrix(frame)
          group.position.add(SCRATCH.setFromMatrixPosition(frame))
        } else {
          group.quaternion.identity()
        }
      }
      return true
    },
  }
}

/** The offsets as text, so a map rebuilt with the same contents can keep its identity. */
export const offsetsKey = (offsets: ReadonlyMap<string, Vec3>): string =>
  Array.from(offsets, ([id, { x, y, z }]) => `${id}:${x},${y},${z}`).join('|')
