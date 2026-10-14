import { BufferGeometry, Float32BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'
import { featureExtent } from '../src/model/extent.js'
import { buildRegionIndex } from '../src/model/region-index.js'

/**
 * A 40 × 30 floor at z = -15 (two triangles, region 0) and one wall triangle
 * from it up to z = 0 (region 1). `pocket` owns both; `floor` the first.
 */
const model = () => ({
  regionIndex: buildRegionIndex({
    regions: [
      { idx: 0, triangles: { start: 0, end: 2 } },
      { idx: 1, triangles: { start: 2, end: 3 } },
    ],
    features: [
      { tag: 'pocket', regionIdxs: [0, 1] },
      { tag: 'floor', regionIdxs: [0] },
    ],
    triangleCount: 3,
  }),
})

const corners = [
  [0, 0, -15],
  [40, 0, -15],
  [40, 30, -15],
  [0, 0, -15],
  [40, 30, -15],
  [0, 30, -15],
  [0, 0, -15],
  [40, 0, -15],
  [0, 0, 0],
]

const flat = (): BufferGeometry => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(corners.flat(), 3))
  return geometry
}

const UP = { x: 0, y: 0, z: 1 }

const close = (
  extent: ReturnType<typeof featureExtent>,
  across: [number, number],
  along: number,
) => {
  expect(extent).not.toBeNull()
  expect(extent!.across[0]).toBeCloseTo(across[0], 5)
  expect(extent!.across[1]).toBeCloseTo(across[1], 5)
  expect(extent!.along).toBeCloseTo(along, 5)
}

describe('featureExtent', () => {
  it('measures plan size across a direction, largest first, and depth along it', () => {
    close(featureExtent(model(), flat(), 'pocket', UP), [40, 30], 15)
    close(featureExtent(model(), flat(), 'floor', UP), [40, 30], 0)
  })

  it('measures down any direction, of any length', () => {
    // Down -Y: the plan is x by z.
    close(featureExtent(model(), flat(), 'pocket', { x: 0, y: -2, z: 0 }), [40, 15], 30)
  })

  it('reads an indexed mesh through its index', () => {
    const geometry = new BufferGeometry()
    const unique = [
      [0, 0, -15],
      [40, 0, -15],
      [40, 30, -15],
      [0, 30, -15],
      [0, 0, 0],
    ]
    geometry.setAttribute('position', new Float32BufferAttribute(unique.flat(), 3))
    geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 1, 4])
    close(featureExtent(model(), geometry, 'pocket', UP), [40, 30], 15)
  })

  it('is null for a tag with no triangles, no positions or no direction', () => {
    expect(featureExtent(model(), flat(), 'nope', UP)).toBeNull()
    expect(featureExtent(model(), new BufferGeometry(), 'pocket', UP)).toBeNull()
    expect(featureExtent(model(), flat(), 'pocket', { x: 0, y: 0, z: 0 })).toBeNull()
  })

  it('stops at the end of the mesh, as a range past it reads nothing more', () => {
    const short = new BufferGeometry()
    short.setAttribute('position', new Float32BufferAttribute(corners.slice(0, 6).flat(), 3))
    close(featureExtent(model(), short, 'pocket', UP), [40, 30], 0)
  })
})
