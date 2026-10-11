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

/** How far, in degrees, `nearestDirectionIndex` looks by default. */
const NEAREST_TOLERANCE_DEG = 1

/**
 * The index of the candidate direction closest to an axis measured somewhere
 * else, or `-1`.
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
 * **The axis has to point the way the candidates do.** A candidate is a
 * direction the part can be machined *from*; the opposite axis is a different
 * setup, so it never matches, and an axis with its sign flipped reports `-1`.
 *
 * Neither vector has to be unit length. A zero-length or non-finite axis
 * matches nothing, as does a tolerance that is negative or not finite.
 */
export function nearestDirectionIndex(
  model: Pick<PartModel, 'candidateDirections'>,
  axis: Vec3,
  toleranceDeg: number = NEAREST_TOLERANCE_DEG,
): number {
  if (!Number.isFinite(toleranceDeg) || toleranceDeg < 0) return -1
  if (!isUsable(axis)) return -1

  const tolerance = (toleranceDeg * Math.PI) / 180
  let best = -1
  let bestAngle = Infinity

  model.candidateDirections.forEach((candidate, index) => {
    if (!isUsable(candidate)) return

    const angle = angleBetween(axis, candidate)
    if (angle <= tolerance && angle < bestAngle) {
      best = index
      bestAngle = angle
    }
  })

  return best
}

/** Finite, and not zero length: a vector that has a direction. */
function isUsable(v: Vec3): boolean {
  return (
    Number.isFinite(v.x) &&
    Number.isFinite(v.y) &&
    Number.isFinite(v.z) &&
    Math.hypot(v.x, v.y, v.z) > 0
  )
}

/**
 * The angle between two vectors, in radians. `atan2(|a × b|, a · b)` rather
 * than `acos` of the normalised dot product, which rounds to just under 1 for
 * a vector against itself and loses the small angles this is for.
 */
function angleBetween(a: Vec3, b: Vec3): number {
  const cross = Math.hypot(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
  return Math.atan2(cross, a.x * b.x + a.y * b.y + a.z * b.z)
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
