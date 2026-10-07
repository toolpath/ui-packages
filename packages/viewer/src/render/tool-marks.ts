import { Quaternion, Vector2, Vector3 } from 'three'
import type { Vec3 } from '../model/types.js'

/**
 * A cutting tool drawn on the part: an end mill standing at a place, up an
 * axis, to scale. What it stands for — the widest tool a pocket admits, the
 * tool an operation uses — is the caller's; this is only where and how big.
 */
export interface ToolMark {
  /** The centre of the tool's bottom, in the coordinates the part is drawn in. */
  readonly base: Vec3
  /** Up the tool, from its tip to its shank. Need not be unit length. */
  readonly axis: Vec3
  readonly diameter: number
  /** How tall the drawn tool stands from its tip. */
  readonly height: number
  /**
   * The radius on the tool's corner: 0 for a flat end mill, half the diameter
   * for a ball, anything between for a bull nose. Held to that range.
   */
  readonly cornerRadius?: number
  /**
   * Which way the dimension across the tool's top runs: toward what it
   * touches, say. Any direction square to the axis when left out or along it.
   */
  readonly across?: Vec3
  /**
   * The tool's own side, to turn about its axis in place of the end mill
   * `diameter` and `cornerRadius` make: radius out from the axis and height
   * above the tip, from the tip up — `@toolpath/tool-drawing`'s outline of a
   * drill, a chamfer mill, a tool in its holder. `diameter` and `height` still
   * place the rims and the dimension.
   */
  readonly profile?: readonly ToolProfilePoint[]
  /** Written on the dimension: `⌀ 3.200 mm`. */
  readonly label?: string
  /** After the label, quieter: `bull nose R 0.5 · 3 places`. */
  readonly note?: string
}

/** A point on a tool's side: radius out from its axis and height above its tip. */
export interface ToolProfilePoint {
  readonly r: number
  readonly z: number
}

/** How many segments round a tool's corner, from its flat bottom to its side. */
export const TOOL_CORNER_STEPS = 12
/** How many segments go round a rim. */
export const TOOL_ROUND = 64

/**
 * A tool's outline as a lathe turns it about its axis: `x` across from the
 * axis, `y` up from the tip. A flat bottom (none for a ball), the corner
 * rounded off by its radius, then the side straight up to the top.
 */
export function toolProfile(radius: number, corner: number, height: number): Vector2[] {
  const rounded = Math.min(Math.max(corner, 0), radius)
  const flat = radius - rounded
  const points = [new Vector2(0, 0)]
  if (rounded <= 0) {
    points.push(new Vector2(radius, 0))
  } else {
    for (let step = 0; step <= TOOL_CORNER_STEPS; step++) {
      const angle = (step / TOOL_CORNER_STEPS) * (Math.PI / 2)
      points.push(
        new Vector2(flat + Math.sin(angle) * rounded, rounded - Math.cos(angle) * rounded),
      )
    }
  }
  points.push(new Vector2(radius, Math.max(height, rounded)))
  return points
}

/** Everything a tool mark draws, in the part's coordinates. */
export interface ToolMarkShape {
  /** Where the lathe's tip goes, and the turn that takes its `+y` up the tool's axis. */
  readonly base: Vector3
  readonly turn: Quaternion
  readonly profile: Vector2[]
  /** The rims of its flat bottom, inside the corner (none for a ball), and of its top. */
  readonly rims: Vector3[][]
  /** Across its top, through `across`, and the two ticks at its ends. */
  readonly dimension: [Vector3, Vector3]
  readonly ticks: [[Vector3, Vector3], [Vector3, Vector3]]
  /** The middle of the dimension, where the label goes. */
  readonly labelAt: Vector3
}

const UP = new Vector3(0, 1, 0)
const AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]

const toVector = ({ x, y, z }: Vec3): Vector3 => new Vector3(x, y, z)

/** A unit direction square to `w`: `along` made square to it, or the world axis least along it. */
const squareTo = (w: Vector3, along: Vec3 | undefined): Vector3 => {
  const wanted = along ? toVector(along) : null
  const flat = wanted?.clone().addScaledVector(w, -wanted.dot(w))
  if (flat && flat.lengthSq() > 1e-12) return flat.normalize()
  const least = AXES.reduce((best, axis) =>
    Math.abs(axis.dot(w)) < Math.abs(best.dot(w)) ? axis : best,
  )
  return least.clone().addScaledVector(w, -least.dot(w)).normalize()
}

/** A circle about `centre`, in the plane of `u` and `v`, as a closed run of points. */
const circle = (centre: Vector3, u: Vector3, v: Vector3, radius: number): Vector3[] =>
  Array.from({ length: TOOL_ROUND + 1 }, (_, step) => {
    const angle = (step / TOOL_ROUND) * Math.PI * 2
    return centre
      .clone()
      .addScaledVector(u, Math.cos(angle) * radius)
      .addScaledVector(v, Math.sin(angle) * radius)
  })

/** How long a dimension's tick is: a share of the tool, within bounds. */
const tickLength = (diameter: number): number => Math.min(Math.max(diameter * 0.15, 0.3), 3)

/**
 * What a tool mark draws: its turned outline, its rims, and its dimension.
 * Null for a mark that cannot be drawn — no width, or no axis.
 */
export function toolMarkShape(mark: ToolMark): ToolMarkShape | null {
  const axis = toVector(mark.axis)
  if (!(mark.diameter > 0) || axis.lengthSq() === 0) return null
  const w = axis.normalize()
  const u = squareTo(w, mark.across)
  const v = new Vector3().crossVectors(w, u)
  const radius = mark.diameter / 2
  const corner = Math.min(Math.max(mark.cornerRadius ?? 0, 0), radius)
  const height = Math.max(mark.height, corner)
  const base = toVector(mark.base)
  const top = base.clone().addScaledVector(w, height)
  const dimension: [Vector3, Vector3] = [
    top.clone().addScaledVector(u, radius),
    top.clone().addScaledVector(u, -radius),
  ]
  const half = tickLength(mark.diameter) / 2
  const tick = (end: Vector3): [Vector3, Vector3] => [
    end.clone().addScaledVector(w, -half),
    end.clone().addScaledVector(w, half),
  ]
  return {
    base,
    turn: new Quaternion().setFromUnitVectors(UP, w),
    profile: mark.profile
      ? mark.profile.map(({ r, z }) => new Vector2(r, z))
      : toolProfile(radius, corner, height),
    rims: [
      ...(radius - corner > 1e-9 ? [circle(base, u, v, radius - corner)] : []),
      circle(top, u, v, radius),
    ],
    dimension,
    ticks: [tick(dimension[0]), tick(dimension[1])],
    labelAt: top,
  }
}
