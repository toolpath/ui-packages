/**
 * A cone stack as a radial outline, and back.
 *
 * The outline is `[z, r]` in millimetres — `z` along the axis away from the
 * nose, `r` the radius — a {@link ProfilePoint} polyline, as a measured
 * holder's silhouette is, so a drawing can take either.
 */

import type { Cone } from './model.js'
import type { ProfilePoint } from './profile.js'

/** A straight layer: one diameter top and bottom. */
export const cylinder = (diameter: number, thickness: number): Cone => ({
  thickness,
  bottomDiameter: diameter,
  topDiameter: diameter,
})

/** Degrees to radians, rounded as Rust's `to_radians` rounds. */
export const radians = (degrees: number): number => degrees * (Math.PI / 180)

/** How far the full diameter of a cone with this included angle stands above its tip. */
export const coneHeight = (diameter: number, tipDiameter: number, fullDeg: number): number =>
  (diameter - tipDiameter) / 2 / Math.tan(radians(fullDeg) / 2)

/** A cone-tipped head: its full diameter, its tip, its included angle and its flutes, mm. */
export interface ConedHead {
  readonly diameter: number
  readonly tipDiameter: number
  readonly tipAngleDeg: number
  readonly fluteLength: number
}

/**
 * The rest of a cutting cone above flutes that stop short of its full
 * diameter, up to `reach` from the tip: the layer the kernel stacks first
 * above a chamfer mill's or a countersink's flutes. Undefined where the flutes
 * reach the cone's top, or `reach`.
 */
export const coneRemainder = (head: ConedHead, reach: number): Cone | undefined => {
  const { diameter, tipDiameter, tipAngleDeg, fluteLength } = head
  const height = coneHeight(diameter, tipDiameter, tipAngleDeg)
  const at = (z: number): number => tipDiameter * (1 - z / height) + diameter * (z / height)
  const top = Math.min(height, reach)
  const rise = top - fluteLength
  return height > 0 && rise > 0 && Number.isFinite(rise)
    ? { thickness: rise, bottomDiameter: at(fluteLength), topDiameter: at(top) }
    : undefined
}

/**
 * The outline of a stack, nose layer first, starting at `z = start`.
 *
 * Where one layer's top diameter differs from the next one's bottom the solid
 * steps, and the outline holds two vertices at that `z`. Consecutive layers
 * that meet at one diameter share a vertex.
 */
export const conesToProfile = (layers: ReadonlyArray<Cone>, start = 0): Array<ProfilePoint> => {
  const points: Array<ProfilePoint> = []
  let z = start
  for (const layer of layers) {
    const last = points.at(-1)
    const bottom = layer.bottomDiameter / 2
    if (last === undefined || last[1] !== bottom) {
      points.push([z, bottom])
    }
    z += layer.thickness
    points.push([z, layer.topDiameter / 2])
  }
  return points
}

/**
 * The stack an outline describes, nose layer first.
 *
 * The inverse of {@link conesToProfile} for layers of positive thickness: two
 * vertices at one `z` are a step rather than a layer, so a zero-thickness layer
 * does not come back. The outline's own start is not part of a stack.
 *
 * An outline holds positions, not thicknesses, so a thickness comes back as
 * the difference of two running sums: equal to the one that went in up to
 * floating rounding at the outline's size (a few units in the last place of
 * the largest `|z|`). A layer thinner than that rounding does not come back.
 *
 * @throws RangeError when a `z` is not a number, or decreases along the
 *   outline, which no stack describes.
 */
export const profileToCones = (points: ReadonlyArray<ProfilePoint>): Array<Cone> => {
  for (const [index, [z]] of points.entries()) {
    if (Number.isNaN(z)) {
      throw new RangeError(`profile z is not a number at point ${index}`)
    }
  }
  const layers: Array<Cone> = []
  for (let index = 1; index < points.length; index++) {
    const [z0, r0] = points[index - 1] as ProfilePoint
    const [z1, r1] = points[index] as ProfilePoint
    if (z1 < z0) {
      throw new RangeError(`profile z decreases at point ${index}`)
    }
    if (z1 > z0) {
      layers.push({ thickness: z1 - z0, bottomDiameter: 2 * r0, topDiameter: 2 * r1 })
    }
  }
  return layers
}
