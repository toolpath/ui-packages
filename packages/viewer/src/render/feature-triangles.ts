import type { BufferGeometry } from 'three'
import type { FeatureTag, PartModel } from '../model/types.js'

/**
 * A feature's faces as plain triangles: what something placed on the part
 * fits itself against, without needing three.js to read them.
 */
export interface FeatureTriangles {
  /** Nine numbers a triangle — its three corners, x, y, z each — in the geometry's coordinates. */
  readonly positions: Float32Array
  /** Three a triangle: its unit normal, pointing out of the part. */
  readonly normals: Float32Array
}

const EMPTY: FeatureTriangles = { positions: new Float32Array(), normals: new Float32Array() }

/**
 * Every triangle of a feature's faces, read out of the mesh through the
 * region index.
 *
 * Each normal is the mesh's own where it has them — the average of the three
 * corners' — because they say which side is outside whatever order a
 * triangle's corners are wound in. A mesh without normals gives each triangle
 * its winding's. A triangle with no area has no normal and is left out.
 *
 * Indexed and non-indexed meshes both read: triangle `t` is corners `3t` to
 * `3t + 2` of the index where there is one, of the positions where there is
 * not. Empty for a tag the part does not have, or a geometry with no positions.
 */
export function featureTriangles(
  model: Pick<PartModel, 'regionIndex'>,
  geometry: BufferGeometry,
  tag: FeatureTag,
): FeatureTriangles {
  const position = geometry.getAttribute('position')
  if (!position) return EMPTY
  const normal = geometry.getAttribute('normal')
  const index = geometry.getIndex()
  const vertex = (corner: number): number => (index ? index.getX(corner) : corner)
  const triangleCount = Math.floor((index ? index.count : position.count) / 3)

  const positions: number[] = []
  const normals: number[] = []
  for (const region of new Set(model.regionIndex.regionsForFeature(tag))) {
    const range = model.regionIndex.rangeForRegion(region)
    if (!range) continue
    for (let triangle = range.start; triangle < Math.min(range.end, triangleCount); triangle++) {
      const corners = [vertex(triangle * 3), vertex(triangle * 3 + 1), vertex(triangle * 3 + 2)]
      const at = corners.map((corner) => [
        position.getX(corner),
        position.getY(corner),
        position.getZ(corner),
      ]) as [Triple, Triple, Triple]
      const out = normal
        ? corners.reduce<Triple>(
            (sum, corner) => [
              sum[0] + normal.getX(corner),
              sum[1] + normal.getY(corner),
              sum[2] + normal.getZ(corner),
            ],
            [0, 0, 0],
          )
        : winding(at)
      const length = Math.hypot(out[0], out[1], out[2])
      if (length === 0) continue
      positions.push(...at[0], ...at[1], ...at[2])
      normals.push(out[0] / length, out[1] / length, out[2] / length)
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals) }
}

type Triple = [number, number, number]

/** The normal a triangle's corner order gives it: `(b − a) × (c − a)`, unnormalised. */
const winding = ([a, b, c]: [Triple, Triple, Triple]): Triple => {
  const u: Triple = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: Triple = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
}
