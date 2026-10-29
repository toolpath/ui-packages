import type { Object3D } from 'three'

/**
 * Each object some mask holds out of raycasts: its own layers, and how many masks hold it.
 * Shared, so masks nest: an object returns to its own layers only when the last one shows it.
 */
const hidden = new WeakMap<Object3D, { mask: number; holds: number }>()

/**
 * Takes objects out of every raycast while they are hidden, and puts them back as they were.
 *
 * Three's raycaster tests an object's layers, never its or its parents' visibility, so a hidden
 * part would still answer picks, snaps and pointer events. Each object leaves all layers while
 * hidden; `hide` catches objects added since it last ran. Masks may hold the same objects, as
 * a hidden `<PartMesh>` inside a hidden `<VisibilityGroup>` does, in any order.
 */
export const createRayMask = () => {
  const held = new Set<Object3D>()
  return {
    hide: (root: Object3D) => {
      root.traverse((object) => {
        if (held.has(object)) {
          return
        }
        held.add(object)
        const entry = hidden.get(object)
        if (entry) {
          entry.holds += 1
        } else {
          hidden.set(object, { mask: object.layers.mask, holds: 1 })
          object.layers.mask = 0
        }
      })
    },
    show: () => {
      for (const object of held) {
        const entry = hidden.get(object)
        if (!entry) {
          continue
        }
        entry.holds -= 1
        if (entry.holds === 0) {
          hidden.delete(object)
          object.layers.mask = entry.mask
        }
      }
      held.clear()
    },
  }
}
