import type { PartModel, PartModelFeature, Vec3 } from './types.js'

/** Component tolerance for matching a direction. The data is exact; floats. */
const EPSILON = 1e-6

export interface DirectionGroup {
  /**
   * Position in `candidateDirections`, or `-1` for the group holding features
   * whose direction is not among them — which no observed report produces, but
   * which must not silently drop features if one ever does.
   */
  readonly index: number
  readonly direction: Vec3
  readonly features: readonly PartModelFeature[]
}

export function sameDirection(a: Vec3, b: Vec3): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON && Math.abs(a.z - b.z) < EPSILON
  )
}

/** The index of a direction in `candidateDirections`, or `-1`. */
export function directionIndexOf(
  model: Pick<PartModel, 'candidateDirections'>,
  direction: Vec3,
): number {
  return model.candidateDirections.findIndex((candidate) => sameDirection(candidate, direction))
}

/** How far, in degrees, `nearestDirection` looks by default. */
const NEAREST_TOLERANCE_DEG = 1

/**
 * The candidate direction closest to an axis measured somewhere else, or `-1`.
 *
 * `directionIndexOf` is for a direction read back out of the same report, which
 * is exact. An axis from outside the report — a CAM setup's tool axis, read off
 * a work coordinate system and carried through an occurrence transform — is
 * not: it arrives a rounded matrix away from the candidate it means, and an
 * exact match turns that into "no setup". This takes the smallest angle
 * instead, and only within `toleranceDeg`, so an axis that is genuinely not a
 * candidate still reports `-1` rather than snapping to whichever direction
 * happens to be nearest.
 *
 * Neither vector has to be unit length. A zero-length axis matches nothing.
 */
export function nearestDirection(
  model: Pick<PartModel, 'candidateDirections'>,
  axis: Vec3,
  toleranceDeg: number = NEAREST_TOLERANCE_DEG,
): number {
  const axisLength = Math.hypot(axis.x, axis.y, axis.z)
  if (axisLength === 0) return -1

  const minCosine = Math.cos((toleranceDeg * Math.PI) / 180)
  let best = -1
  let bestCosine = -Infinity

  model.candidateDirections.forEach((candidate, index) => {
    const length = Math.hypot(candidate.x, candidate.y, candidate.z)
    if (length === 0) return

    const cosine =
      (axis.x * candidate.x + axis.y * candidate.y + axis.z * candidate.z) / (axisLength * length)
    if (cosine >= minCosine && cosine > bestCosine) {
      best = index
      bestCosine = cosine
    }
  })

  return best
}

/**
 * Features by machining direction, in `candidateDirections` order.
 *
 * Every feature's `machiningDirection` is one of `candidateDirections` — zero
 * exceptions across 1122 features on three parts — so the unmatched group is
 * defensive rather than expected. Groups are returned even when empty, since a
 * direction with no features is still a direction the part can be set up in.
 */
export function groupByDirection(model: PartModel): readonly DirectionGroup[] {
  const groups = model.candidateDirections.map((direction, index) => ({
    index,
    direction,
    features: [] as PartModelFeature[],
  }))
  const unmatched: PartModelFeature[] = []

  for (const feature of model.features) {
    const index = directionIndexOf(model, feature.machiningDirection)
    const group = index === -1 ? undefined : groups[index]

    if (group) group.features.push(feature)
    else unmatched.push(feature)
  }

  if (unmatched.length === 0) return groups
  return [...groups, { index: -1, direction: { x: 0, y: 0, z: 0 }, features: unmatched }]
}

/**
 * A direction as a label: `+Z` when it is an axis, three decimals otherwise.
 *
 * Not every direction is axis-aligned — real parts report tilted ones, a 36°
 * five-axis setup among them — so the general form is the fallback rather than
 * an error case.
 */
export function directionLabel(direction: Vec3): string {
  const axes = [
    ['X', direction.x],
    ['Y', direction.y],
    ['Z', direction.z],
  ] as const

  const nonZero = axes.filter(([, value]) => Math.abs(value) > EPSILON)
  const [axis] = nonZero

  if (nonZero.length === 1 && axis && Math.abs(Math.abs(axis[1]) - 1) < EPSILON) {
    return `${axis[1] > 0 ? '+' : '−'}${axis[0]}`
  }

  return axes.map(([, value]) => trim(value)).join(', ')
}

/** Three decimals, without the trailing zeros that make a vector unreadable. */
function trim(value: number): string {
  return Number.parseFloat(value.toFixed(3)).toString()
}
