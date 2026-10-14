import type { BufferGeometry } from 'three'
import type { FeatureTag, PartModel, Vec3 } from './types.js'

/** A feature's size across a direction, largest first, and along it. In the mesh's units. */
export interface FeatureExtent {
  readonly across: readonly [number, number]
  readonly along: number
}

/**
 * How big a feature is, seen down a machining direction: its plan size and its
 * depth, measured off its triangles.
 *
 * A datasheet states a pocket's depth and a hole's bore, but not how long and
 * wide a pocket is — the size a list of features reads as `40 × 40 mm`. This
 * is the bounding box of the feature's faces in a frame square to `direction`:
 * `across` its two spans in the plane, largest first, `along` its span down
 * the direction. The frame's in-plane axes are arbitrary, so a feature turned
 * in plan reads larger across than its own sides; on the axis-aligned features
 * a prismatic part is mostly made of, it is their size.
 *
 * `direction` need not be unit length. `null` for a tag the part does not
 * have, a feature with no triangles, a geometry with no positions, or a
 * direction with no length.
 */
export function featureExtent(
  model: Pick<PartModel, 'regionIndex'>,
  geometry: BufferGeometry,
  tag: FeatureTag,
  direction: Vec3,
): FeatureExtent | null {
  const position = geometry.getAttribute('position')
  const length = Math.hypot(direction.x, direction.y, direction.z)
  if (!position || !(length > 0) || !Number.isFinite(length)) return null

  const along = { x: direction.x / length, y: direction.y / length, z: direction.z / length }
  const [u, v] = acrossBasis(along)
  const axes = [u, v, along]
  const index = geometry.getIndex()
  const triangleCount = Math.floor((index ? index.count : position.count) / 3)
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  let seen = false

  for (const region of new Set(model.regionIndex.regionsForFeature(tag))) {
    const range = model.regionIndex.rangeForRegion(region)
    if (!range) continue
    for (let corner = range.start * 3; corner < Math.min(range.end, triangleCount) * 3; corner++) {
      const vertex = index ? index.getX(corner) : corner
      const x = position.getX(vertex)
      const y = position.getY(vertex)
      const z = position.getZ(vertex)
      seen = true
      axes.forEach((axis, i) => {
        const p = x * axis.x + y * axis.y + z * axis.z
        if (p < (lo[i] as number)) lo[i] = p
        if (p > (hi[i] as number)) hi[i] = p
      })
    }
  }
  if (!seen) return null

  const span = (i: number) => (hi[i] as number) - (lo[i] as number)
  const a = span(0)
  const b = span(1)
  return { across: a >= b ? [a, b] : [b, a], along: span(2) }
}

/** Two unit vectors square to unit `d` and to each other. */
function acrossBasis(d: Vec3): [Vec3, Vec3] {
  // The world axis least along d, so the cross product is well conditioned.
  const ax = Math.abs(d.x)
  const ay = Math.abs(d.y)
  const az = Math.abs(d.z)
  const ref: Vec3 =
    ax <= ay && ax <= az
      ? { x: 1, y: 0, z: 0 }
      : ay <= az
        ? { x: 0, y: 1, z: 0 }
        : { x: 0, y: 0, z: 1 }
  const u0 = cross(d, ref)
  const length = Math.hypot(u0.x, u0.y, u0.z)
  const u = { x: u0.x / length, y: u0.y / length, z: u0.z / length }
  return [u, cross(d, u)]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
