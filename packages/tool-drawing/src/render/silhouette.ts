import type { OutlinePoint, OutlineSegment } from '../model/outline.js'

/**
 * The silhouette's geometry: the arithmetic behind the lines, kept out of the
 * component so it can be checked without mounting anything.
 *
 * Everything here works in **model space** — radius out from the axis and
 * height above the tip — and takes the frame's two mappings when it has to
 * emit SVG. Nothing in this file knows which way the tool axis runs, which is
 * what lets one renderer serve both orientations.
 *
 * ## One part may emit several segments
 *
 * `OutlinePart` names what a section *is*, not how many segments draw it, and
 * two known shapes need more than one: a slot mill's cutting disc emits two
 * `flutes` — a straight side and a corner arc — and a holder whose flange
 * stands above its stated body emits two `body`, the stated one and the last
 * stated diameter carried up to the flange. There will be others.
 *
 * So nothing here groups by part, keys off part identity, or assumes a part
 * appears once. Part is a label; the segment is the unit. Where two segments of
 * the same part have to be told apart, `provenance` is what does it — the
 * carried body is `assumed` and the stated one is not.
 */

/** The frame's two coordinate mappings: the only things that know the axis sense. */
export interface Mapping {
  readonly toX: (r: number, z: number) => number
  readonly toY: (r: number, z: number) => number
}

const at = (point: OutlinePoint, frame: Mapping): string =>
  `${frame.toX(point.r, point.z).toFixed(2)},${frame.toY(point.r, point.z).toFixed(2)}`

/**
 * The whole tool as one closed path: up the right side and back down the left.
 *
 * **One stroke around the whole silhouette**, rather than a stroke per
 * section, so a join between two sections of the same radius is not drawn as
 * an edge. The fills are per section — a section is shaded on its own — but
 * the outline is the tool's, not the section's.
 */
export const silhouettePath = (segments: ReadonlyArray<OutlineSegment>, frame: Mapping): string => {
  const up = segments.flatMap((segment) => segment.points)
  if (up.length === 0) {
    return ''
  }
  const down = [...segments].reverse().flatMap((segment) => [...segment.points].reverse())
  const right = up.map((point) => at(point, frame)).join(' L')
  const left = down.map((point) => at({ r: -point.r, z: point.z }, frame)).join(' L')
  return `M${right} L${left} Z`
}

/** One section mirrored about the axis: a body of revolution in elevation. */
export const sectionPoints = (segment: OutlineSegment, frame: Mapping): string => {
  const right = segment.points.map((point) => at(point, frame))
  const left = [...segment.points].reverse().map((point) => at({ r: -point.r, z: point.z }, frame))
  return [...right, ...left].join(' ')
}

/** Where two sections meet, and whether the meeting is an edge. */
export interface Join {
  /** The lower section's part, so the line can be found in the DOM. */
  readonly part: string
  /** Half the width of the line to draw, in millimetres. */
  readonly radius: number
  /** How far above the tip the two sections meet. */
  readonly z: number
  /** True where the radius really steps, so the join is an edge and not a chord. */
  readonly stepped: boolean
}

/** Below this a difference in radius is float noise rather than a step. */
const STEP = 0.01

/**
 * Every place two sections meet, and what kind of line belongs there.
 *
 * **Where two sections meet at the same radius, the line is a light dashed
 * one** (Paul, 2026-09-01: "don't show a solid line across the radius — use a
 * dashed lighter line. For bull and ball nose end mills, and at the tip for
 * drills"). A bull nose's corner radius runs into the flutes at exactly the
 * flute diameter, and a drill's point into its body: there is no edge there,
 * and a solid chord across the tool read as one. Where the radius does step —
 * a neck under a shank — the line stays what it is: an edge.
 *
 * **Measured at the point the two sections actually meet**, which is the last
 * point of the lower and the first point of the upper — not each section's
 * widest point. The two are the same for a cylinder, and the original drew the
 * widest because every section it had ended as wide as it started. A slot
 * mill's cutting disc does not: it emits two `flutes` segments, and the second
 * is a corner arc that curves back in from the full radius to `DC/2 - RE`. Ask
 * that segment how wide it is and the answer is the arc's widest point, which
 * is not where it meets the shank — so a real step read as no step, and the
 * edge at the top of the disc went missing on the one form this package was
 * partly built to draw.
 */
export const joins = (segments: ReadonlyArray<OutlineSegment>): Array<Join> => {
  const found: Array<Join> = []
  for (let index = 0; index + 1 < segments.length; index += 1) {
    const lower = segments[index]!
    const upper = segments[index + 1]!
    const below = lower.points[lower.points.length - 1]
    const above = upper.points[0]
    if (below === undefined || above === undefined) {
      continue
    }
    found.push({
      part: lower.part,
      radius: Math.min(below.r, above.r),
      z: below.z,
      stepped: Math.abs(below.r - above.r) > STEP,
    })
  }
  return found
}
