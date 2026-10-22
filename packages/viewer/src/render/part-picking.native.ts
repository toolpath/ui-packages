import type { BufferGeometry, Mesh } from 'three'
import { MeshBVH, acceleratedRaycast, type MeshBVHOptions } from 'three-mesh-bvh'

/** Leaves the geometry's index alone. 0.8 builds it, but its types leave `indirect` out. */
const INDIRECT: MeshBVHOptions & { indirect: true } = { indirect: true }

/** Each geometry's tree, and how many parts are using it. */
const trees = new WeakMap<BufferGeometry, { tree: MeshBVH; parts: number }>()

/**
 * React Native's `render/part-picking.ts`: the part's raycasts go through a
 * bounding volume hierarchy, `three-mesh-bvh`'s.
 *
 * Hermes has no JIT, and three's own raycast tests every triangle, so on React
 * Native every raycast against the part goes through the tree, which tests a
 * few dozen. `@react-three/fiber` raycasts every mesh with a handler when a
 * finger goes down and when it comes up — twice a tap, four times a pinch —
 * and a raycast per triangle stalls the frames a gesture needs.
 *
 * The tree is `indirect`, so the geometry's index is left as it is, and a hit's
 * `faceIndex` is still the triangle the region attribute and the model name.
 *
 * The geometry is the caller's, and two parts can share it for a moment (see
 * `createPart`), so the tree is counted: built for the first part on a
 * geometry, shared with the next, and taken off when the last is disposed.
 */
export function acceleratePicking(mesh: Mesh): () => void {
  const geometry = mesh.geometry
  let held = trees.get(geometry)
  if (!held) {
    held = { tree: new MeshBVH(geometry, INDIRECT), parts: 0 }
    trees.set(geometry, held)
  }
  const entry = held
  entry.parts += 1
  geometry.boundsTree = entry.tree
  mesh.raycast = acceleratedRaycast

  let released = false
  return () => {
    if (released) return
    released = true
    entry.parts -= 1
    if (entry.parts > 0) return
    trees.delete(geometry)
    if (geometry.boundsTree === entry.tree) delete geometry.boundsTree
  }
}
