import type { Object3D } from 'three'
import { readExplodeAmount, type ExplodeAmount } from '../model/explode-amount.js'
import type { Vec3 } from '../model/types.js'

/** Where a collection's items are drawn: each item's group, moved by its offset times an amount. */
export interface CollectionPlacement {
  /** Moves `group` for `id` from the next `place`; the returned function lets it go. */
  add(id: string, group: Object3D): () => void
  /**
   * Puts every group at its offset times the amount, or back in place for `null` offsets.
   * Returns whether anything was written, so a frame with nothing new writes nothing.
   */
  place(offsets: ReadonlyMap<string, Vec3> | null, amount: number | ExplodeAmount): boolean
}

export const createCollectionPlacement = (): CollectionPlacement => {
  const groups = new Map<string, Object3D>()
  let placed: { offsets: ReadonlyMap<string, Vec3> | null; amount: number } | null = null
  return {
    add(id, group) {
      groups.set(id, group)
      placed = null
      return () => {
        if (groups.get(id) === group) {
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
      for (const [id, group] of groups) {
        const offset = offsets?.get(id)
        group.position.set((offset?.x ?? 0) * at, (offset?.y ?? 0) * at, (offset?.z ?? 0) * at)
      }
      return true
    },
  }
}

/** The offsets as text, so a map rebuilt with the same contents can keep its identity. */
export const offsetsKey = (offsets: ReadonlyMap<string, Vec3>): string =>
  Array.from(offsets, ([id, { x, y, z }]) => `${id}:${x},${y},${z}`).join('|')
