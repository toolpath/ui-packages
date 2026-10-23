import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SphereGeometry,
  Vector3,
  type Intersection,
} from 'three'
import { describe, expect, it } from 'vitest'
import { acceleratePicking } from '../src/render/part-picking.native.js'

/**
 * React Native's picking: the same hits as three's own raycast, through a tree
 * that leaves the geometry as it found it.
 */

const sphere = () => new SphereGeometry(10, 64, 48)

const hits = (mesh: Mesh, origin: Vector3): Intersection[] => {
  const raycaster = new Raycaster(origin, origin.clone().negate().normalize())
  return raycaster.intersectObject(mesh)
}

// Off the sphere's vertices and seams, where triangles tie for a hit.
const ORIGINS = [
  new Vector3(29.3, 1.7, 3.1),
  new Vector3(2.3, 28.9, -4.7),
  new Vector3(7.1, -12.3, 25.3),
  new Vector3(-18.2, 9.4, -21.1),
]

describe('acceleratePicking (React Native)', () => {
  it('finds the faces three finds, by the same face index', () => {
    const geometry = sphere()
    // Both sides, so each ray finds two faces and their order is checked too.
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const plain = new Mesh(geometry, material)
    const expected = ORIGINS.map((origin) => hits(plain, origin))

    const fast = new Mesh(geometry, material)
    acceleratePicking(fast)

    ORIGINS.forEach((origin, i) => {
      const found = hits(fast, origin)
      // In and out of the sphere: two faces, nearest first.
      expect(found).toHaveLength(2)
      expect(found.map((hit) => hit.faceIndex)).toEqual(expected[i]?.map((hit) => hit.faceIndex))
      found.forEach((hit, j) => expect(hit.distance).toBeCloseTo(expected[i]?.[j]?.distance ?? NaN))
    })
  })

  it("leaves the geometry's index as it was", () => {
    const geometry = sphere()
    const before = Array.from(geometry.index?.array ?? [])
    acceleratePicking(new Mesh(geometry, new MeshBasicMaterial()))
    expect(Array.from(geometry.index?.array ?? [])).toEqual(before)
  })

  it('builds one tree per geometry, kept across parts and their release', () => {
    const geometry = sphere()
    const release = acceleratePicking(new Mesh(geometry, new MeshBasicMaterial()))
    const tree = geometry.boundsTree
    release()
    expect(geometry.boundsTree).toBe(tree)

    acceleratePicking(new Mesh(geometry, new MeshBasicMaterial()))
    expect(geometry.boundsTree).toBe(tree)
  })

  it('builds the tree again once the positions change', () => {
    const geometry = sphere()
    acceleratePicking(new Mesh(geometry, new MeshBasicMaterial()))
    const tree = geometry.boundsTree

    geometry.getAttribute('position').needsUpdate = true
    acceleratePicking(new Mesh(geometry, new MeshBasicMaterial()))

    expect(geometry.boundsTree).toBeDefined()
    expect(geometry.boundsTree).not.toBe(tree)
  })
})
