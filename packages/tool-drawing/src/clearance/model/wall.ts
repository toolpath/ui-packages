import type { OutlinePoint } from '../../model/outline.js'

/**
 * The material beside the tool, as lines.
 *
 * All of it in the drawing's own space — radius from the axis, height above
 * the tip — so the overlay maps through `toX`/`toY` like everything else and
 * reads the same either way the tool is laid.
 */

/**
 * The wall's corners: **both ends of every run**, so a step draws as a step.
 *
 * A rise smaller than `noise` is float noise and makes no corner. Everything
 * else is kept, including the far end of the run the rise interrupts — and
 * that far end is the correction of 2026-08-30. Keeping only the point where
 * a new height begins left consecutive corners that spanned a whole run *and*
 * the rise after it, so the line drew a diagonal ramp across both: a square
 * step read as a chamfer, and the material over the run looked taller than
 * the sweep says it is. Paul's section view is the reference — a wall is
 * vertical, a ledge is horizontal, and only a fillet is round.
 *
 * A sampled fillet still keeps every corner, which is what lets `wallPath`
 * draw it as the arc it is (Paul, 2026-08-30: thinning to chords had turned a
 * fillet into a chamfer).
 */
export const wallCorners = (
  profile: ReadonlyArray<OutlinePoint>,
  noise: number,
): Array<OutlinePoint> => {
  const corners: Array<OutlinePoint> = []
  // How far the run at the current height has reached: a corner in waiting,
  // needed only when the height changes or the profile ends.
  let run: OutlinePoint | null = null
  for (const point of profile) {
    const last = corners[corners.length - 1]
    if (!last) {
      corners.push({ r: point.r, z: point.z })
      continue
    }
    // A corner is a change of height; a change under the noise is no corner.
    if (Math.abs(point.z - last.z) < noise) {
      run = point
      continue
    }
    if (run && run.r !== last.r) {
      corners.push({ r: run.r, z: last.z })
    }
    corners.push({ r: point.r, z: point.z })
    run = null
  }
  const kept = corners[corners.length - 1]
  if (run && kept && run.r !== kept.r) {
    corners.push({ r: run.r, z: kept.z })
  }
  return corners
}

/**
 * Where the wall stops changing: the radius of the outermost rise. Beyond it
 * the material is flat and drawing more of it says nothing.
 */
export const lastRise = (corners: ReadonlyArray<OutlinePoint>): number => {
  for (let index = corners.length - 1; index > 0; index -= 1) {
    if (corners[index]!.z !== corners[index - 1]!.z) {
      return corners[index]!.r
    }
  }
  return corners[0]?.r ?? 0
}

/** The staircase as a polygon, clipped at the drawing's outer edge and its top. */
export const clipped = (
  profile: ReadonlyArray<OutlinePoint>,
  edge: number,
  ceiling: number,
): Array<OutlinePoint> => {
  const points: Array<OutlinePoint> = []
  for (const point of profile) {
    if (point.r >= edge) {
      points.push({ r: edge, z: Math.min(point.z, ceiling) })
      break
    }
    points.push({ r: point.r, z: Math.min(point.z, ceiling) })
  }
  const last = points[points.length - 1]
  if (last && last.r < edge) {
    points.push({ r: edge, z: last.z })
  }
  return points
}

/** The frame's two coordinate mappings: the only things that know the axis sense. */
export interface Mapping {
  readonly toX: (r: number, z: number) => number
  readonly toY: (r: number, z: number) => number
}

const at = (point: OutlinePoint, frame: Mapping): string =>
  `${frame.toX(point.r, point.z).toFixed(2)},${frame.toY(point.r, point.z).toFixed(2)}`

/**
 * The wall as an SVG path that looks like the geometry it came from.
 *
 * The reach curve samples a curved surface — a fillet, a draft — as a run of
 * closely spaced rises; a vertical wall or a step is one big rise. A corner
 * whose neighbours on both sides are within `smooth.run` across and
 * `smooth.rise` up belongs to a curve and is passed through with a
 * Catmull-Rom spline; any other corner stays a sharp line join. So a fillet
 * reads as the arc it is and a wall as the wall it is (Paul, 2026-08-30:
 * "more closely resemble the actual geometry", after chords made a fillet
 * read as a chamfer).
 */
export const wallPath = (
  points: ReadonlyArray<OutlinePoint>,
  smooth: { readonly run: number; readonly rise: number },
  frame: Mapping,
): string => {
  if (points.length === 0) {
    return ''
  }
  const close = (a: OutlinePoint, b: OutlinePoint) =>
    Math.abs(a.r - b.r) < smooth.run && Math.abs(a.z - b.z) < smooth.rise
  const isSmooth = (index: number): boolean => {
    const previous = points[index - 1]
    const here = points[index]!
    const next = points[index + 1]
    return (
      previous !== undefined && next !== undefined && close(previous, here) && close(here, next)
    )
  }
  let d = `M${at(points[0]!, frame)}`
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!
    const to = points[index]!
    // A spline segment only between two corners that both sit inside a curve.
    if (isSmooth(index - 1) && isSmooth(index)) {
      const before = points[index - 2] ?? from
      const after = points[index + 1] ?? to
      const c1 = { r: from.r + (to.r - before.r) / 6, z: from.z + (to.z - before.z) / 6 }
      const c2 = { r: to.r - (after.r - from.r) / 6, z: to.z - (after.z - from.z) / 6 }
      d += ` C${at(c1, frame)} ${at(c2, frame)} ${at(to, frame)}`
    } else {
      d += ` L${at(to, frame)}`
    }
  }
  return d
}

/**
 * A break, as the ragged edge of an interrupted view: the saw-tooth along an
 * edge that says the material carries on past where the drawing stops. It is
 * what lets the part be cut short at all.
 *
 * Runs at a constant radius, from one height to another, wandering across the
 * axis by `amplitude` — so it is the same saw-tooth whichever way the tool is
 * laid.
 */
export const zigzag = (
  atR: number,
  fromZ: number,
  toZ: number,
  amplitude: number,
  steps = 8,
): Array<OutlinePoint> =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const end = index === 0 || index === steps
    return {
      r: atR + (end ? 0 : index % 2 === 1 ? amplitude : -amplitude),
      z: fromZ + ((toZ - fromZ) * index) / steps,
    }
  })

/** A run of points as an SVG points list, through the frame. */
export const polyline = (points: ReadonlyArray<OutlinePoint>, frame: Mapping): string =>
  points.map((point) => at(point, frame)).join(' ')
