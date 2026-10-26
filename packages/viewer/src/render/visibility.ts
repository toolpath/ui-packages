import type { Object3D } from 'three'

/**
 * Takes objects out of every raycast while they are hidden, and puts them back as they were.
 *
 * Three's raycaster tests an object's layers, never its or its parents' visibility, so a hidden
 * part would still answer picks, snaps and pointer events. Each object leaves all layers while
 * hidden; `hide` catches objects added since it last ran.
 */
export const createRayMask = () => {
  const held = new Map<Object3D, number>()
  return {
    hide: (root: Object3D) => {
      root.traverse((object) => {
        if (!held.has(object)) {
          held.set(object, object.layers.mask)
          object.layers.mask = 0
        }
      })
    },
    show: () => {
      for (const [object, mask] of held) {
        object.layers.mask = mask
      }
      held.clear()
    },
  }
}
