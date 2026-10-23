import type { BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Mesh } from 'three'
import { MeshBVH, acceleratedRaycast, type MeshBVHOptions } from 'three-mesh-bvh'

/** Leaves the geometry's index alone. 0.8 builds it, but its types leave `indirect` out. */
const INDIRECT: MeshBVHOptions & { indirect: true } = { indirect: true }

/**
 * Each geometry's tree, and the versions of the attributes it was built from.
 * Held for as long as the geometry is: a cache that keeps a geometry for the
 * next mount keeps its tree too, rather than building it again on Hermes.
 */
const trees = new WeakMap<BufferGeometry, { tree: MeshBVH; position: number; index: number }>()

const positionVersion = (geometry: BufferGeometry): number => {
  const position = geometry.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute
  if (!position) return -1
  return 'isInterleavedBufferAttribute' in position ? position.data.version : position.version
}
const indexVersion = (geometry: BufferGeometry): number => geometry.index?.version ?? -1

const nothing = (): void => {}

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
 * The tree is built once per geometry and kept with it, so a part disposed and
 * mounted again on the same geometry reuses it; it is built again only if the
 * geometry's positions or index changed since. There is nothing to undo.
 */
export function acceleratePicking(mesh: Mesh): () => void {
  const geometry = mesh.geometry
  const position = positionVersion(geometry)
  const index = indexVersion(geometry)
  let held = trees.get(geometry)
  if (!held || held.position !== position || held.index !== index) {
    held = { tree: new MeshBVH(geometry, INDIRECT), position, index }
    trees.set(geometry, held)
  }
  geometry.boundsTree = held.tree
  mesh.raycast = acceleratedRaycast
  return nothing
}
