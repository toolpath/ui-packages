import { type Box3, type Intersection, type Object3D, Plane, type Raycaster, Vector3 } from 'three'
import type { Vec3 } from '../model/types.js'
import { excludedFromPart } from './camera.js'
import { AXIS_COLORS } from './measure.js'

/**
 * Render order. The stencil pass must precede the cap, and the part must draw
 * after both or it overwrites the cap it is supposed to be capped by. The part
 * draws at 3 and its edges at 4, so the handle sits above the cap it stands on.
 */
export const SECTION_RENDER_ORDER = {
  stencil: 1,
  cap: 2,
  handle: 6,
  /** The tool's translucent plane and its outline, over everything but the handle. */
  outline: 5,
} as const

/** How far past a picked surface the cut starts, as a fraction of the diagonal. */
const START_DEPTH = 0.005

/** The handle's length on screen, in CSS pixels, whatever the zoom. */
export const HANDLE_PIXELS = 78

/** The viewer-space span of the visible section-plane frame, relative to the part diagonal. */
export const SECTION_GIZMO_FRAME_SCALE = 1.1

/**
 * The hatch on the cap: stripe pitch and line thickness in CSS pixels, and the
 * outline's width. Screen-space, so the cut reads the same at any zoom.
 */
export const CAP_HATCH = {
  pitch: 9,
  line: 1.25,
  outline: 1.5,
} as const

/**
 * The global cutting planes the tool offers: how far outside the part each one
 * stands, and how much larger than the part it is drawn. Both are fractions of
 * the part's largest dimension.
 */
export const AXES_PLANE_OFFSET = 0.55
export const AXES_PLANE_SCALE = 1.2

/** The surface preview under the pointer, as a fraction of the part's diagonal. */
export const PREVIEW_SCALE = 0.125

/** How far the tool's translucent plane extends past the part, as a fraction of the diagonal. */
export const OUTLINE_SCALE = 1.2

const EPSILON = 1e-9
const ARROW_AXIS = new Vector3(0, 1, 0)

export interface SectionOptions {
  enabled: boolean
  /**
   * The half-space that stays. Defaults to +Z, which keeps the top of the part
   * and eats upward from the bottom as `offset` grows.
   */
  normal?: Vec3
  /** Where the sweep sits, 0 (whole part) to 1 (gone). */
  offset?: number
  /** Key the cut off one surface instead, usually from `sectionFromPick`. */
  plane?: SectionPlacement | null
  /** How far past that surface to cut, in model units. */
  depth?: number
}

export interface SectionState {
  readonly enabled: boolean
  readonly normal: Vec3
  readonly offset: number
  readonly constant: number
  readonly plane: SectionPlacement | null
  readonly depth: number | null
  /**
   * Distance swept from the edge of the part into its projected bounds, in
   * model units. A surface-anchored cut also reports `depth`, which is its
   * more useful physical datum.
   */
  readonly cutDistance: number
  /**
   * How far the cut can travel from its anchor, in model units, or `null` for a
   * sweep — which is measured as a fraction of the part rather than a distance.
   *
   * Reported because a control that moves the cut has to be bounded by the same
   * numbers the cut is, and only the viewer knows the part's extent along a
   * given normal.
   */
  readonly depthRange: { readonly min: number; readonly max: number } | null
}

export const DEFAULT_SECTION_NORMAL: Vec3 = { x: 0, y: 0, z: 1 }

/**
 * What is reported when a cut goes away.
 *
 * A state rather than `null`, so a consumer that echoes the callback into its
 * own state never has to special-case the absence: `enabled` says it.
 */
export const DISABLED_SECTION: SectionState = {
  enabled: false,
  normal: DEFAULT_SECTION_NORMAL,
  offset: 0,
  constant: 0,
  plane: null,
  depth: null,
  cutDistance: 0,
  depthRange: null,
}

/**
 * A concise physical measurement for a host application's section control.
 *
 * A cut placed from a surface is measured from that surface. A free sweep is
 * measured from the edge of the part along the cut normal.
 */
export function sectionMeasurement(state: SectionState): string {
  return `${(state.depth ?? state.cutDistance).toFixed(2)} mm`
}

/**
 * A section plane's direction colour. Cardinal normals match the X/Y/Z axis
 * colours used by the directional arrows; tilted normals blend those colours
 * by their absolute axis contributions.
 */
export function sectionDirectionColor(normal: Vec3): number {
  const x = Math.abs(normal.x)
  const y = Math.abs(normal.y)
  const z = Math.abs(normal.z)
  const total = x + y + z || 1
  const channel = (shift: number) =>
    Math.round(
      (((AXIS_COLORS.x >> shift) & 0xff) * x +
        ((AXIS_COLORS.y >> shift) & 0xff) * y +
        ((AXIS_COLORS.z >> shift) & 0xff) * z) /
        total,
    )

  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/**
 * The options that would resolve to `state` again.
 *
 * A cut keyed off a surface keeps its anchor and is moved by depth; a sweep is
 * moved by offset. The state carries both descriptions, and which one to keep
 * is what makes a dragged cut stay anchored to the face it was picked from.
 */
export function sectionOptionsFromState(state: SectionState): SectionOptions {
  if (state.plane) {
    return { enabled: state.enabled, plane: state.plane, depth: state.depth ?? 0 }
  }
  return { enabled: state.enabled, normal: state.normal, offset: state.offset }
}

/** One of the three global cutting planes the tool offers. */
export interface AxesPlane {
  /** Which world axis the plane is perpendicular to. */
  readonly axis: 'x' | 'y' | 'z'
  /** Which side of the part the camera is on along that axis, +1 or -1. */
  readonly sign: 1 | -1
  /** Where to draw it: outside the part, on the side away from the camera. */
  readonly position: Vec3
  /** Its edge length. */
  readonly size: number
  /** The sweep a click on it starts: cutting in from the camera's side, halfway through. */
  readonly options: SectionOptions
}

/**
 * Where the three global planes stand for a camera at `eye`.
 *
 * They sit past the part on the side *away* from the camera, like the walls of
 * a room the part is standing in, so the part is never hidden behind them —
 * and each one cuts in from the camera's own side, which is the half of the
 * part somebody looking at it can see into. A camera dead on an axis has no
 * side along the other two; they fall to +1, so the planes still stand
 * somewhere rather than at the part's centre.
 */
export function axesPlanes(box: Box3, eye: Vec3): readonly AxesPlane[] {
  const centre = box.getCenter(new Vector3())
  const extent = box.getSize(new Vector3())
  const largest = Math.max(extent.x, extent.y, extent.z)
  const size = largest * AXES_PLANE_SCALE
  const offset = largest * AXES_PLANE_OFFSET

  const side = (delta: number): 1 | -1 => (delta < 0 ? -1 : 1)
  const sx = side(eye.x - centre.x)
  const sy = side(eye.y - centre.y)
  const sz = side(eye.z - centre.z)

  return [
    {
      axis: 'x',
      sign: sx,
      position: { x: centre.x - sx * offset, y: centre.y, z: centre.z },
      size,
      options: { enabled: true, normal: { x: -sx, y: 0, z: 0 }, offset: 0.5 },
    },
    {
      axis: 'y',
      sign: sy,
      position: { x: centre.x, y: centre.y - sy * offset, z: centre.z },
      size,
      options: { enabled: true, normal: { x: 0, y: -sy, z: 0 }, offset: 0.5 },
    },
    {
      axis: 'z',
      sign: sz,
      position: { x: centre.x, y: centre.y, z: centre.z - sz * offset },
      size,
      options: { enabled: true, normal: { x: 0, y: 0, z: -sz }, offset: 0.5 },
    },
  ]
}

/** A point on the part under the pointer, with the surface's outward normal in world space. */
export interface SurfaceHit {
  readonly point: Vector3
  readonly normal: Vector3
}

/**
 * The nearest hit on the part along `raycaster`'s ray, or `null`.
 *
 * "The part" is whatever in the scene is a visible mesh outside an overlay —
 * every overlay here marks its outermost group with `EXCLUDE_FROM_FRAME`, the
 * same flag that keeps it out of the camera's framing. Stock has its own flag:
 * it belongs in Fit, but not in section or measurement picks. Non-clickable
 * overlays also turn their own raycast off.
 *
 * A surface a section cut has clipped away is skipped too. three's raycaster
 * knows nothing about clipping planes, so without this a ray through the open
 * half of a cut part lands on a face nobody can see — and a tool that previews
 * or measures there is working on something that is not on screen.
 */
export function hitUnderRay(raycaster: Raycaster, root: Object3D): Intersection | null {
  for (const hit of raycaster.intersectObjects(root.children, true)) {
    if (!('isMesh' in hit.object) || !hit.face) continue
    // three's raycaster does not skip hidden objects; R3F's event layer does
    // that itself, and this ray is not R3F's.
    if (!hit.object.visible || excludedFromPart(hit.object, root)) continue
    if (clippedAway(hit)) continue
    return hit
  }
  return null
}

/** Whether a material's own clipping planes remove `hit` from view. */
function clippedAway(hit: Intersection): boolean {
  const material = (hit.object as { material?: unknown }).material
  const materials = Array.isArray(material) ? material : [material]
  for (const entry of materials) {
    const planes = (entry as { clippingPlanes?: Plane[] | null } | undefined)?.clippingPlanes
    if (!planes) continue
    for (const plane of planes) if (plane.distanceToPoint(hit.point) < 0) return true
  }
  return false
}

/**
 * The nearest surface of the part along `raycaster`'s ray, or `null`, with the
 * surface's outward normal in world space. Used by the tool to preview a cut
 * on a hovered face without the part having to tell it where the pointer is.
 */
export function surfaceUnderRay(raycaster: Raycaster, root: Object3D): SurfaceHit | null {
  const hit = hitUnderRay(raycaster, root)
  if (!hit?.face) return null
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
  return { point: hit.point, normal }
}

/**
 * Where the cut's plane meets the line through the part's centre along its
 * normal — where the cap, the handle and the tool's outline all sit.
 */
export function sectionAnchor(box: Box3, plane: Plane, into = new Vector3()): Vector3 {
  const centre = box.getCenter(into)
  return centre.addScaledVector(plane.normal, -(plane.constant + plane.normal.dot(centre)))
}

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
function projectedBounds(box: Box3, normal: Vec3): { low: number; high: number } {
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

  return { low, high }
}

export function sectionBounds(box: Box3, normal: Vec3): SectionBounds {
  const { low, high } = projectedBounds(box, normal)

  // Widen both ends slightly. Without it the extreme corner lies exactly *on*
  // the plane at `t = 0` and `t = 1`, and `Plane` keeps the half-space where the
  // distance is strictly positive — so "uncut" would already have shaved the
  // furthest vertex, and "fully cut" would leave one behind.
  const margin = Math.max((high - low) * 0.005, 1e-6)

  return { min: -(high + margin), max: -(low - margin) }
}

/**
 * The distance actually cut through the part, excluding the off-part margin
 * that makes the clipping plane reliably start and finish outside the mesh.
 */
export function sectionCutDistance(box: Box3, normal: Vec3, constant: number): number {
  const { low, high } = projectedBounds(box, normal)
  return Math.max(0, Math.min(high - low, -constant - low))
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
