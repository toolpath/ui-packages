import { Float32BufferAttribute, type BufferGeometry } from 'three'
import type { PartModelRegion } from '../model/types.js'
import { visualSurfaces } from '../model/surfaces.js'

/**
 * Shades each region smoothly and every boundary between them hard.
 *
 * The Engine's mesh carries positions and nothing else, so the normals have to
 * be invented. Averaging them across the whole mesh smooth-shades a cube —
 * every corner reads as a ball bearing. Not averaging at all gives every
 * triangle its own normal, which is honest but leaves a bore looking like a
 * fifty-sided nut, because that is exactly what its triangles are.
 *
 * The report says which post-split regions came from one original B-rep face.
 * Averaging within that exact visual surface and never across one gives a bore
 * that shades like a bore and an edge that stays an edge.
 *
 * Two vertices are the same point if their coordinates match exactly. That is
 * safe rather than optimistic — `toNonIndexed` copies each shared vertex from
 * one source value, so the duplicates it makes are bit-identical, which is the
 * only case this needs to find.
 *
 * The geometry must be non-indexed, which `parsePartGeometry` guarantees.
 */
export function smoothRegionNormals(
  geometry: BufferGeometry,
  regions: readonly PartModelRegion[],
): void {
  const position = geometry.getAttribute('position')
  if (!position || geometry.index) return

  const vertexCount = position.count
  const triangleCount = Math.floor(vertexCount / 3)

  // Triangle → the surface it is part of, so the accumulation below is a lookup
  // rather than a search through the region table for every one of a part's
  // 90 000 facets.
  //
  // Surfaces rather than regions, because the Engine splits a surface where
  // that makes a better machining plan and shading each half separately creases
  // it. Features still see the post-split region IDs.
  const surfaces = visualSurfaces(regions)
  const regionOf = new Int32Array(triangleCount).fill(-1)
  for (const region of regions) {
    const end = Math.min(region.triangles.end, triangleCount)
    for (let triangle = region.triangles.start; triangle < end; triangle += 1) {
      regionOf[triangle] = surfaces.get(region.idx) ?? region.idx
    }
  }

  const sums = new Map<string, [number, number, number]>()
  const keys: string[] = new Array<string>(vertexCount)

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const a = triangle * 3
    const ax = position.getX(a)
    const ay = position.getY(a)
    const az = position.getZ(a)
    const bx = position.getX(a + 1)
    const by = position.getY(a + 1)
    const bz = position.getZ(a + 1)
    const cx = position.getX(a + 2)
    const cy = position.getY(a + 2)
    const cz = position.getZ(a + 2)

    // The cross product of two edges: its direction is the facet's normal and
    // its length is twice the triangle's area, so a sliver contributes to its
    // neighbours in proportion to how much surface it actually is.
    const ux = bx - ax
    const uy = by - ay
    const uz = bz - az
    const vx = cx - ax
    const vy = cy - ay
    const vz = cz - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx

    const region = regionOf[triangle] ?? -1
    const corners: ReadonlyArray<readonly [number, number, number, number]> = [
      [a, ax, ay, az],
      [a + 1, bx, by, bz],
      [a + 2, cx, cy, cz],
    ]

    for (const [vertex, x, y, z] of corners) {
      // Keyed by region as well as position, so a vertex on the seam between
      // two surfaces accumulates into two separate buckets and keeps its edge.
      const key = `${region}|${x}|${y}|${z}`
      keys[vertex] = key

      const sum = sums.get(key)
      if (sum) {
        sum[0] += nx
        sum[1] += ny
        sum[2] += nz
      } else {
        sums.set(key, [nx, ny, nz])
      }
    }
  }

  const normals = new Float32Array(vertexCount * 3)
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const sum = sums.get(keys[vertex] ?? '')
    if (!sum) continue

    const [x, y, z] = sum
    const length = Math.hypot(x, y, z)
    if (length <= 1e-12) continue

    normals[vertex * 3] = x / length
    normals[vertex * 3 + 1] = y / length
    normals[vertex * 3 + 2] = z / length
  }

  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
}
