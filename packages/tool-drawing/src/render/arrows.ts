import type { OutlinePoint } from '../model/outline.js'

/**
 * Arrowheads, built in the drawing's own space.
 *
 * A direction here is a heading in millimetres — outward across the axis, or
 * along it toward or away from the tip — rather than one of `up | down | left
 * | right`, which is the same thing as assuming the tool stands upright. The
 * scale is uniform on both axes, so a barb built this way keeps its shape
 * whichever way the frame lays the tool.
 */

/** A direction in the drawing's own space. */
export interface Heading {
  readonly dr: number
  readonly dz: number
}

export const TOWARD_TIP: Heading = { dr: 0, dz: -1 }
export const AWAY_FROM_TIP: Heading = { dr: 0, dz: 1 }
/**
 * Across the axis, by flank rather than by "in" and "out".
 *
 * An arrow on the `-r` flank pointing at the tool points toward `+r`, and one
 * on the `+r` flank pointing at the tool points toward `-r` — so "inward" names
 * two opposite headings depending on which side it is asked about, which is
 * exactly the sort of thing that reads fine and draws backwards.
 */
export const TOWARD_PLUS: Heading = { dr: 1, dz: 0 }
export const TOWARD_MINUS: Heading = { dr: -1, dz: 0 }

export interface Mapping {
  readonly toX: (r: number, z: number) => number
  readonly toY: (r: number, z: number) => number
}

const at = (point: OutlinePoint, frame: Mapping): string =>
  `${frame.toX(point.r, point.z).toFixed(2)},${frame.toY(point.r, point.z).toFixed(2)}`

/** An arrowhead as a polygon: tip at (r, z), pointing `towards`. */
export const arrowhead = (
  r: number,
  z: number,
  towards: Heading,
  size: number,
  frame: Mapping,
): string => {
  // Slim: a drawing's arrowhead is a barb, not a triangle.
  const wing = size * 0.3
  const baseR = r - towards.dr * size
  const baseZ = z - towards.dz * size
  const acrossR = -towards.dz * wing
  const acrossZ = towards.dr * wing
  return [
    at({ r, z }, frame),
    at({ r: baseR + acrossR, z: baseZ + acrossZ }, frame),
    at({ r: baseR - acrossR, z: baseZ - acrossZ }, frame),
  ].join(' ')
}
