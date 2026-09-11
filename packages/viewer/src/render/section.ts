import { type Box3, Plane, Vector3 } from 'three'
import type { Vec3 } from '../model/types.js'

/**
 * Render order. The stencil pass must precede the cap, and the part must draw
 * after both or it overwrites the cap it is supposed to be capped by. The part
 * draws at 3 and its edges at 4, so the handle sits above the cap it stands on.
 */
export const SECTION_RENDER_ORDER = {
  stencil: 1,
  cap: 2,
  handle: 6,
} as const

/** How far past a picked surface the cut starts, as a fraction of the diagonal. */
const START_DEPTH = 0.005

/** The handle's length on screen, in CSS pixels, whatever the zoom. */
export const HANDLE_PIXELS = 78

const EPSILON = 1e-9
const ARROW_AXIS = new Vector3(0, 1, 0)

export interface SectionBounds {
  /** Plane constant at which the whole part is clipped away. */
  readonly min: number
  /** Plane constant at which nothing is clipped. */
  readonly max: number
}

/** A point the cut's depth is measured from, and what to call it in a panel. */
export interface SectionAnchor {
  readonly point: Vec3
  readonly label: string
}

/**
 * A plane placed at a point rather than swept through the part.
 *
 * `normal` is the plane's own — three keeps the half-space it points into — so
 * it faces *away* from the material the cut removes. Use {@link sectionFromPick}
 * to build one from a picked surface rather than negating by hand.
 */
export interface SectionPlacement {
  readonly normal: Vec3
  readonly point: Vec3
  /** Shown as the cut's reference. Defaults to {@link PICKED_SURFACE_LABEL}. */
  readonly label?: string
}

export const PICKED_SURFACE_LABEL = 'Part surface'

function unit(v: Vec3): Vector3 {
  const vector = new Vector3(v.x, v.y, v.z)
  return vector.lengthSq() === 0 ? vector.set(0, 0, 1) : vector.normalize()
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * The range of plane constants that sweeps a box along `normal`.
 *
 * Derived from the eight corners rather than from a single axis extent, which is
 * what makes an arbitrary normal work: a tilted plane leaves the box through a
 * corner, and an axis-aligned approximation either stops short of cutting the
 * part or sweeps a long way through empty space before reaching it.
 *
 * `Plane` keeps the half-space where `normal · p + constant > 0`, so a *larger*
 * constant clips less. `min` and `max` are named for the constant, not for how
 * much they remove.
 */
export function sectionBounds(box: Box3, normal: Vec3): SectionBounds {
  const axis = unit(normal)

  const corner = new Vector3()
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY

  for (let i = 0; i < 8; i += 1) {
    corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    )
    const distance = corner.dot(axis)
    low = Math.min(low, distance)
    high = Math.max(high, distance)
  }

  // Widen both ends slightly. Without it the extreme corner lies exactly *on*
  // the plane at `t = 0` and `t = 1`, and `Plane` keeps the half-space where the
  // distance is strictly positive — so "uncut" would already have shaved the
  // furthest vertex, and "fully cut" would leave one behind.
  const margin = Math.max((high - low) * 0.005, 1e-6)

  return { min: -(high + margin), max: -(low - margin) }
}

/** The plane constant at `t`, from 0 (uncut) to 1 (fully cut away). */
export function sectionConstant(bounds: SectionBounds, t: number): number {
  return bounds.max + clamp01(t) * (bounds.min - bounds.max)
}

/**
 * Where a plane constant sits in the sweep, inverting {@link sectionConstant}.
 *
 * A part with no extent along the normal has a degenerate range and no
 * meaningful position within it; 0 keeps a slider at rest rather than at NaN.
 */
export function sectionOffset(bounds: SectionBounds, constant: number): number {
  const span = bounds.min - bounds.max
  return span === 0 ? 0 : clamp01((constant - bounds.max) / span)
}

/**
 * How far past `anchor` a plane at `constant` cuts, along its own normal.
 *
 * Positive is into the material the anchor's surface faces away from: pick the
 * top of a part and a depth of 3 removes the top 3 mm. Its own inverse, since
 * `depth = −(n · a) − constant` either way.
 */
export function sectionDepth(normal: Vec3, anchor: Vec3, constant: number): number {
  return -unit(normal).dot(new Vector3(anchor.x, anchor.y, anchor.z)) - constant
}

/** The plane constant that cuts `depth` past `anchor`. */
export function sectionDepthConstant(normal: Vec3, anchor: Vec3, depth: number): number {
  return sectionDepth(normal, anchor, depth)
}

/** The depths at which the cut starts and finishes, for a bounded control. */
export function sectionDepthRange(
  bounds: SectionBounds,
  normal: Vec3,
  anchor: Vec3,
): { readonly min: number; readonly max: number } {
  return {
    min: sectionDepth(normal, anchor, bounds.max),
    max: sectionDepth(normal, anchor, bounds.min),
  }
}

/**
 * Turns a picked surface into a cut that starts at it.
 *
 * The pick reports the surface normal, which faces the viewer; the plane keeps
 * what its own normal points into, so the two are opposite. Getting this
 * backwards leaves the part whole with a plane drawn behind it, which is the
 * failure this helper exists to make unrepeatable.
 */
export function sectionFromPick(
  surface: { readonly point: Vec3; readonly normal: Vec3 },
  label: string = PICKED_SURFACE_LABEL,
): SectionPlacement {
  return {
    normal: { x: -surface.normal.x, y: -surface.normal.y, z: -surface.normal.z },
    point: { x: surface.point.x, y: surface.point.y, z: surface.point.z },
    label,
  }
}

/**
 * The starting depth for a cut keyed off a picked surface.
 *
 * A plane placed exactly on the surface it was picked from cuts nothing and
 * z-fights with that surface, so the click reads as having done nothing. It
 * starts a hair inside instead — engaged, and still "at" the face.
 */
export function pickedStartDepth(box: Box3): number {
  return box.getSize(new Vector3()).length() * START_DEPTH
}

/** The plane a cut sits on, for a placement or a swept offset. */
export function sectionPlane(box: Box3, normal: Vec3, offset: number, into = new Plane()): Plane {
  const axis = unit(normal)
  return into.set(axis, sectionConstant(sectionBounds(box, normal), offset))
}

/**
 * The plane a drag is projected onto: the one containing the handle's axis and
 * facing the camera as squarely as it can.
 *
 * Dragging along a line in a 3D view has to resolve a 2D pointer to a distance,
 * and this is the surface that makes the pointer track the arrow rather than
 * running away from it when the axis is nearly edge-on.
 */
export function dragPlane(axis: Vector3, view: Vector3, point: Vector3, into = new Plane()): Plane {
  const along = axis.lengthSq() === 0 ? ARROW_AXIS.clone() : axis.clone().normalize()
  const side = new Vector3().crossVectors(view, along)

  if (side.lengthSq() < EPSILON) side.copy(perpendicular(along))

  return into.setFromNormalAndCoplanarPoint(side.cross(along).normalize(), point)
}

function perpendicular(axis: Vector3): Vector3 {
  const candidate = Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  return candidate.cross(axis).normalize()
}
