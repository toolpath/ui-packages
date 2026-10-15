import { LatheGeometry, Vector2, Vector3 } from 'three'

/**
 * The arrows the viewer draws — a direction's, and the section handle's — as
 * turned solids rather than a cone stood on a cylinder.
 *
 * Both are one outline turned about `+y`: `x` out from the axis, `y` along it.
 * One outline is one mesh, so an arrow is picked, shaded and made translucent
 * as one thing, and there is no seam where a head was stood on a shaft.
 *
 * The shape is the plain one CAD tools draw: a straight cone with a flat back,
 * on a slim shaft. An outline that never turns back toward its tip — no barbs,
 * no hollow behind the head — still reads as an arrow from behind, as a disc
 * with the shaft at its centre, where a hollowed head reads as a drawing pin.
 */

/** The axis every arrow is turned about, before it is aimed. */
export const ARROW_AXIS = new Vector3(0, 1, 0)

/** How many segments go round an arrow. */
const ARROW_ROUND = 32

/** A direction arrow's head and shaft, as fractions of the arrow's own length. */
export const HEAD_LENGTH = 0.415
export const HEAD_RADIUS = 0.153
export const SHAFT_RADIUS = 0.0515

/** The section handle: a head at each end, and a bead in the middle to take hold of. */
export const HANDLE_TIP = 0.76
const HANDLE_HEAD_LENGTH = 0.3
const HANDLE_HEAD_RADIUS = 0.14
const HANDLE_SHAFT_RADIUS = 0.035
export const HANDLE_BEAD_RADIUS = 0.1

/**
 * The corners are rounded off by a hair, and not for looks: `LatheGeometry`
 * averages the normals either side of every point, so a sharp corner shades
 * as a smear across the whole of both faces. A small radius gives that average
 * a surface to be right about.
 */
const RIM_ROUND = 0.006
const NECK_ROUND = 0.008
const BEAD_ROUND = 0.02
const ROUND_STEPS = 4
const CAP_STEPS = 6
const BEAD_STEPS = 12

/** A point on an outline, and how far to round it off; sharp when left out. */
interface Corner {
  readonly at: Vector2
  readonly round?: number
}

interface HeadShape {
  readonly length: number
  readonly radius: number
  readonly shaft: number
}

/**
 * One head, from its tip on the axis to where it meets the shaft: a straight
 * flank out to the rim, then a flat back in to the shaft.
 */
const head = ({ length, radius, shaft }: HeadShape): Corner[] => [
  { at: new Vector2(0, 0) },
  { at: new Vector2(radius, length), round: RIM_ROUND },
  { at: new Vector2(shaft, length), round: NECK_ROUND },
]

/**
 * An outline with each rounded corner replaced by an arc tangent to both of
 * its edges. An arc never takes more than half of either edge, so two rounded
 * corners on one short edge cannot overlap; a corner that would need more is
 * rounded less.
 */
const rounded = (corners: readonly Corner[]): Vector2[] =>
  corners.flatMap(({ at, round = 0 }, index) => {
    const before = corners[index - 1]?.at
    const after = corners[index + 1]?.at
    if (!(round > 0) || !before || !after) return [at]

    const back = before.clone().sub(at)
    const ahead = after.clone().sub(at)
    const reach = Math.min(back.length(), ahead.length()) / 2
    back.normalize()
    ahead.normalize()
    const angle = Math.acos(Math.min(Math.max(back.dot(ahead), -1), 1))
    // A straight run has no corner to round.
    if (angle > Math.PI - 1e-6 || angle < 1e-6) return [at]

    const half = angle / 2
    const offset = Math.min(round / Math.tan(half), reach)
    const radius = offset * Math.tan(half)
    const centre = at
      .clone()
      .addScaledVector(back.clone().add(ahead).normalize(), radius / Math.sin(half))
    const from = at.clone().addScaledVector(back, offset).sub(centre)
    const to = at.clone().addScaledVector(ahead, offset).sub(centre)
    const start = Math.atan2(from.y, from.x)
    let sweep = Math.atan2(to.y, to.x) - start
    if (sweep > Math.PI) sweep -= Math.PI * 2
    if (sweep < -Math.PI) sweep += Math.PI * 2

    return Array.from({ length: ROUND_STEPS + 1 }, (_, step) => {
      const turn = start + (sweep * step) / ROUND_STEPS
      return new Vector2(centre.x + Math.cos(turn) * radius, centre.y + Math.sin(turn) * radius)
    })
  })

/**
 * A direction arrow's outline, one long: its tip at the origin and its tail at
 * `y = 1`, so it is placed at its tip, aimed with {@link ARROW_AXIS} and sized
 * by scaling.
 */
export function arrowProfile(): Vector2[] {
  const body = rounded([
    ...head({ length: HEAD_LENGTH, radius: HEAD_RADIUS, shaft: SHAFT_RADIUS }),
    { at: new Vector2(SHAFT_RADIUS, 1 - SHAFT_RADIUS) },
  ])
  // The tail is rounded off where the shaft ends, rather than cut square.
  const tail = Array.from({ length: CAP_STEPS }, (_, step) => {
    const turn = ((step + 1) / CAP_STEPS) * (Math.PI / 2)
    return new Vector2(
      step + 1 === CAP_STEPS ? 0 : Math.cos(turn) * SHAFT_RADIUS,
      1 - SHAFT_RADIUS + Math.sin(turn) * SHAFT_RADIUS,
    )
  })
  return [...body, ...tail]
}

/**
 * The section handle's outline: a head at each end, tips at ±{@link HANDLE_TIP},
 * and a bead at the middle where the shaft passes through it.
 */
export function handleProfile(): Vector2[] {
  const lower = head({
    length: HANDLE_HEAD_LENGTH,
    radius: HANDLE_HEAD_RADIUS,
    shaft: HANDLE_SHAFT_RADIUS,
  }).map(({ at, round }) => ({ at: new Vector2(at.x, at.y - HANDLE_TIP), round }))
  const upper = lower
    .slice()
    .reverse()
    .map(({ at, round }) => ({ at: new Vector2(at.x, -at.y), round }))

  // The bead runs round from where the shaft goes in to where it comes out.
  const meet = Math.acos(HANDLE_SHAFT_RADIUS / HANDLE_BEAD_RADIUS)
  const bead = Array.from({ length: BEAD_STEPS + 1 }, (_, step) => {
    const turn = -meet + (2 * meet * step) / BEAD_STEPS
    const at = new Vector2(Math.cos(turn), Math.sin(turn)).multiplyScalar(HANDLE_BEAD_RADIUS)
    return { at, round: step === 0 || step === BEAD_STEPS ? BEAD_ROUND : 0 }
  })

  return rounded([...lower, ...bead, ...upper])
}

const turned = (profile: Vector2[]): LatheGeometry => {
  const geometry = new LatheGeometry(profile, ARROW_ROUND)
  // three leaves the last point's normal as long as the edge before it.
  geometry.normalizeNormals()
  return geometry
}

/** A direction arrow, one long, tip at the origin. */
export const arrowGeometry = (): LatheGeometry => turned(arrowProfile())

/** The section handle, centred on the origin. */
export const handleGeometry = (): LatheGeometry => turned(handleProfile())
