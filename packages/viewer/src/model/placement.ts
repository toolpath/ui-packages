import { Matrix4, Vector3 } from 'three'
import type { Axis2 } from './types.js'

/**
 * The rigid transform `placement` describes, or `null` when it has no frame: a non-finite
 * value, a zero axis, or a reference direction along the axis.
 */
export const axis2Matrix = ({ location, axis, refDirection }: Axis2): Matrix4 | null => {
  if (![location, axis, refDirection].every(({ x, y, z }) => [x, y, z].every(Number.isFinite))) {
    return null
  }
  const z = new Vector3(axis.x, axis.y, axis.z).normalize()
  const x = new Vector3(refDirection.x, refDirection.y, refDirection.z)
  const reference = x.length()
  x.addScaledVector(z, -x.dot(z))
  // Projection leaves float noise, not zero, when the two are parallel.
  if (!(z.lengthSq() > 0 && x.length() > 1e-9 * reference)) {
    return null
  }
  x.normalize()
  const y = new Vector3().crossVectors(z, x)
  return new Matrix4().makeBasis(x, y, z).setPosition(location.x, location.y, location.z)
}

/** `axis2Matrix` for an item's placement, throwing for one with no frame; `null` for none. */
export const placementMatrix = (placement: Axis2 | undefined): Matrix4 | null => {
  if (!placement) {
    return null
  }
  const matrix = axis2Matrix(placement)
  if (!matrix) {
    throw new RangeError(
      'Placement must be finite, with a non-zero axis not parallel to its reference direction.',
    )
  }
  return matrix
}

/** The placement as text, so one rebuilt with the same values counts as unchanged. */
export const placementKey = (placement: Axis2 | undefined): string =>
  placement
    ? [placement.location, placement.axis, placement.refDirection]
        .map(({ x, y, z }) => `${x},${y},${z}`)
        .join('|')
    : ''
