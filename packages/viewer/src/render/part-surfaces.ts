import { Mesh, type BufferGeometry, type Object3D } from 'three'
import { excludedFromFrame } from './camera.js'

/**
 * The part's own surface, and not the section view's stencil meshes: those are
 * drawn from the same geometry, but sit under a group the viewer marks as its
 * own furniture, and already ignore the pointer by themselves.
 */
const isPartSurface = (
  object: Object3D,
  geometry: BufferGeometry,
  scene: Object3D,
): object is Mesh =>
  object instanceof Mesh && object.geometry === geometry && !excludedFromFrame(object, scene)

/** The meshes `<PartMesh>` draws the part's surface with, found by their geometry. */
export const partSurfaces = (scene: Object3D, geometry: BufferGeometry): Mesh[] => {
  const surfaces: Mesh[] = []
  scene.traverse((object) => {
    if (isPartSurface(object, geometry, scene)) surfaces.push(object)
  })
  return surfaces
}
