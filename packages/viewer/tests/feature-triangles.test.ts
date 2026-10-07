import { BufferGeometry, Float32BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'
import { buildRegionIndex } from '../src/model/region-index.js'
import { featureTriangles } from '../src/render/feature-triangles.js'

/** Two regions of one triangle each; the feature `pocket` owns the second. */
const model = () => ({
  regionIndex: buildRegionIndex({
    regions: [
      { idx: 0, triangles: { start: 0, end: 1 } },
      { idx: 1, triangles: { start: 1, end: 2 } },
    ],
    features: [
      { tag: 'pocket', regionIdxs: [1] },
      { tag: 'both', regionIdxs: [0, 1, 1] },
    ],
    triangleCount: 2,
  }),
})

/** Triangle 0 in z = 0, triangle 1 in the y = 0 plane, as the corners repeat in a non-indexed mesh. */
const flat = (): BufferGeometry => {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0], 3),
  )
  return geometry
}

describe('featureTriangles', () => {
  it("reads only the feature's own faces", () => {
    const { positions, normals } = featureTriangles(model(), flat(), 'pocket')
    expect([...positions]).toEqual([0, 0, 0, 0, 0, 1, 1, 0, 0])
    expect(normals).toHaveLength(3)
  })

  it('reads a region owned twice once', () => {
    expect(featureTriangles(model(), flat(), 'both').positions).toHaveLength(18)
  })

  it("takes a triangle's normal from its winding when the mesh has none", () => {
    const { normals } = featureTriangles(model(), flat(), 'pocket')
    // (0,0,0), (0,0,1), (1,0,0): (0,0,1) × (1,0,0) is +y.
    expect([...normals]).toEqual([0, 1, 0])
  })

  it("takes the mesh's own normals where it has them, whatever the winding", () => {
    const geometry = flat()
    geometry.setAttribute(
      'normal',
      new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0], 3),
    )
    expect([...featureTriangles(model(), geometry, 'pocket').normals]).toEqual([0, -1, 0])
  })

  it('reads an indexed mesh through its index', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], 3),
    )
    geometry.setIndex([0, 1, 2, 0, 3, 1])
    expect([...featureTriangles(model(), geometry, 'pocket').positions]).toEqual([
      0, 0, 0, 0, 0, 1, 1, 0, 0,
    ])
  })

  it('leaves out a triangle with no area, and reads nothing for an unknown tag', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0], 3),
    )
    expect(featureTriangles(model(), geometry, 'pocket').positions).toHaveLength(0)
    expect(featureTriangles(model(), flat(), 'nothing').positions).toHaveLength(0)
  })
})
