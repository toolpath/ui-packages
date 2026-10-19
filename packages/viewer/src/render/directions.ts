import { type Box3, Vector3 } from 'three'
import type { Vec3 } from '../model/types.js'

/** Arrow length, as a fraction of the part's bounding radius. */
export const LENGTH = 0.33
/** Clearance between the surface the arrow points at and its tip. */
export const GAP = 0.2

export interface ArrowPlacement {
  /** Where the arrow's tip sits: outside the box, on the direction's ray. */
  readonly tip: Vector3
  readonly length: number
}

/**
 * Where an arrow for `direction` sits relative to the part.
 *
 * The exit distance is the smallest `halfExtent / |component|` over the axes the
 * direction actually moves along — the first face of the box the ray leaves
 * through. That formulation is what makes this work for **arbitrary unit
 * vectors** rather than only for axes: real reports carry tilted directions,
 * one of them a 36° five-axis setup, and an axis-aligned simplification would
 * bury those arrows inside the part.
 */
export function arrowPlacement(direction: Vec3, box: Box3): ArrowPlacement {
  const center = box.getCenter(new Vector3())
  const half = box.getSize(new Vector3()).multiplyScalar(0.5)
  const radius = half.length() || 1

  const axis = new Vector3(direction.x, direction.y, direction.z)
  if (axis.lengthSq() === 0) axis.set(0, 0, 1)
  axis.normalize()

  let exit = Number.POSITIVE_INFINITY
  for (const [component, extent] of [
    [axis.x, half.x],
    [axis.y, half.y],
    [axis.z, half.z],
  ] as const) {
    if (Math.abs(component) > 1e-6) exit = Math.min(exit, extent / Math.abs(component))
  }
  if (!Number.isFinite(exit)) exit = radius

  return { tip: center.addScaledVector(axis, exit + radius * GAP), length: radius * LENGTH }
}
