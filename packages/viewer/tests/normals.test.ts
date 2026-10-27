import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { smoothRegionNormals } from '../src/engine/normals.js'
import type { PartModelRegion } from '../src/model/types.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

/**
 * The Engine's mesh carries positions and nothing else, so the normals are
 * invented. Averaging across the whole mesh smooth-shades a cube; averaging
 * nothing leaves a bore looking like a fifty-sided nut. The region table says
 * which triangles are one surface, which is the distinction the mesh cannot
 * express — so these tests are about where the seams end up.
 */

function region(idx: number, start: number, end: number): PartModelRegion {
  return { idx, splitOrigin: idx, shapeKind: 'Plane', area: 1, triangles: { start, end } }
}

/** Two triangles meeting along a shared edge at 90°, as a non-indexed buffer. */
function roof(): BufferGeometry {
  const geometry = new BufferGeometry()
  // Triangle 0 lies in the XY plane; triangle 1 turns up into XZ. They share
  // the edge from (0,0,0) to (1,0,0).
  const positions = [
    0, 0, 0, 1, 0, 0, 0, 1, 0,

    0, 0, 0, 0, 0, 1, 1, 0, 0,
  ]
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

const normalAt = (geometry: BufferGeometry, vertex: number) =>
  new Vector3().fromBufferAttribute(geometry.getAttribute('normal'), vertex)

const distinctNormals = (geometry: BufferGeometry) => {
  const normal = geometry.getAttribute('normal')
  const seen = new Set<string>()
  for (let vertex = 0; vertex < normal.count; vertex += 1) {
    seen.add(
      normalAt(geometry, vertex)
        .toArray()
        .map((value) => value.toFixed(4))
        .join(','),
    )
  }
  return seen
}

describe('smoothRegionNormals', () => {
  it('averages across triangles that share a surface', () => {
    const geometry = roof()

    smoothRegionNormals(geometry, [region(0, 0, 2)])

    // One region, so the shared edge is interior: its vertices take the average
    // of the two facets and the crease disappears, which is what makes a bore
    // read as round.
    const shared = normalAt(geometry, 0)
    expect(shared.z).toBeCloseTo(shared.y, 6)
    expect(shared.equals(normalAt(geometry, 3))).toBe(true)
  })

  it('keeps a hard edge between two surfaces that merely touch', () => {
    const geometry = roof()

    smoothRegionNormals(geometry, [region(0, 0, 1), region(1, 1, 2)])

    // The same two triangles, now one region each. The shared position gets one
    // normal per region, so the edge survives.
    expect(normalAt(geometry, 0).toArray()).toEqual([0, 0, 1])
    expect(normalAt(geometry, 3).toArray()).toEqual([0, 1, 0])
  })

  it('weights a facet by its area, so a sliver does not steer its neighbour', () => {
    const geometry = roof()
    const position = geometry.getAttribute('position')
    // Shrink the second triangle to a sliver, leaving its plane unchanged.
    position.setXYZ(4, 0, 0, 0.01)
    position.setXYZ(5, 1, 0, 0)

    smoothRegionNormals(geometry, [region(0, 0, 2)])

    // The large facet still dominates: the result leans to +Z rather than
    // sitting halfway between the two planes.
    expect(normalAt(geometry, 0).z).toBeGreaterThan(0.9)
  })

  it('leaves a flat region exactly flat', async () => {
    const model = cubeModel()
    const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)

    smoothRegionNormals(geometry, model.regions)

    // Six planar regions on a cube: six normals, one per face. Smoothing must
    // not round off a part that has no curves in it.
    expect(distinctNormals(geometry)).toEqual(
      new Set(
        ['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1'].map((n) =>
          n
            .split(',')
            .map((value) => Number(value).toFixed(4))
            .join(','),
        ),
      ),
    )
  })

  it('lines its normals up with the regions the report describes', async () => {
    const model = cubeModel()
    const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)

    smoothRegionNormals(geometry, model.regions)

    for (const region of model.regions) {
      const first = normalAt(geometry, region.triangles.start * 3)
      for (let triangle = region.triangles.start; triangle < region.triangles.end; triangle += 1) {
        for (let corner = 0; corner < 3; corner += 1) {
          expect(normalAt(geometry, triangle * 3 + corner).equals(first)).toBe(true)
        }
      }
    }
  })

  it('leaves an indexed mesh alone rather than writing normals it cannot key', () => {
    const geometry = roof()
    geometry.setIndex([0, 1, 2, 3, 4, 5])

    smoothRegionNormals(geometry, [region(0, 0, 2)])

    // Shared vertices in an indexed mesh belong to several regions at once, so
    // there is no per-region normal to write. `parsePartGeometry` de-indexes
    // before this runs.
    expect(geometry.hasAttribute('normal')).toBe(false)
  })
})
