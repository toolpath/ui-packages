import { type Matrix4, Vector2, Vector3 } from 'three'
import type { Vec3 } from '../model/types.js'
import { type ViewerCamera, type ViewportSize, screenLength } from './camera.js'

/**
 * Measuring, without a canvas: where a pointer snaps to, what two or three
 * points measure, and how that is written down. `measure-tool.tsx` is the
 * React surface over this.
 */

/** Draws over the part and the section cap, under nothing. */
export const MEASURE_RENDER_ORDER = 7

/**
 * One colour per world axis, the hue `<Axes>` draws that axis in — lightened,
 * because a pure primary through 30% on a dark page is mud, and the blue one
 * was not there at all. The section tool's three global planes and a
 * distance's X, Y, Z legs both wear them, so an axis is one colour everywhere.
 */
export const AXIS_COLORS: Record<Axis, number> = { x: 0xff6b6b, y: 0x6fe08a, z: 0x6f9bff }

/**
 * How close, in CSS pixels, the pointer has to be for a snap to take.
 *
 * A vertex or a midpoint is a point, so it gets the wider reach; an edge is a
 * line the pointer can sit on, so it needs less. The pointer snaps to the
 * strongest kind it is within reach of — a corner over the edge it ends, the
 * edge over the face it bounds — which is what makes clicking the corner of a
 * part produce the corner rather than a point a pixel off it.
 */
export const SNAP_PIXELS = {
  vertex: 14,
  midpoint: 12,
  edge: 9,
} as const

/** The snap indicator's radius on screen, by what it is on, in CSS pixels. */
export const SNAP_MARKER_PIXELS = {
  vertex: 6,
  midpoint: 5,
  edge: 4,
  face: 3.5,
} as const

/** A measurement's end marker, in CSS pixels. */
export const MEASURE_MARKER_PIXELS = 3.5

/**
 * Line widths in CSS pixels: a measurement's own line, a delta leg, and the
 * edge the pointer is snapped to.
 */
export const MEASURE_LINE_PIXELS = {
  line: 2,
  leg: 1.5,
  edge: 3,
} as const

/** Dash and gap of a delta leg, in CSS pixels. */
export const DELTA_DASH_PIXELS = 6

/** How much of the shorter arm an angle's arc is drawn at. */
export const ANGLE_ARC_FRACTION = 0.3

/** Segments in an angle's arc. */
export const ANGLE_ARC_SEGMENTS = 24

export type SnapKind = 'vertex' | 'midpoint' | 'edge' | 'face'

/** Where the pointer landed after snapping, and what it landed on. */
export interface Snap {
  readonly kind: SnapKind
  readonly point: Vector3
  /** The outward normal of the surface under the pointer, in world space. */
  readonly normal: Vector3
  /** For an edge or midpoint snap, the edge in world space. */
  readonly edge: readonly [Vector3, Vector3] | null
}

/**
 * The edges a pointer can snap to: segment endpoints, six floats per segment,
 * in the space `matrixWorld` maps to the world.
 *
 * In practice this is the part's own edge overlay — `regionEdgesGeometry` —
 * which draws a line only where two analytic surfaces meet. Those are the edges
 * a machinist would put a caliper on; the diagonal a tessellator drew across a
 * flat face is not, and snapping to it would measure the mesh rather than the
 * part.
 */
export interface SnapEdges {
  readonly positions: ArrayLike<number>
  readonly matrixWorld: Matrix4
}

/** What the ray hit, before snapping. */
export interface SnapHit {
  readonly point: Vector3
  readonly normal: Vector3
}

/**
 * Where a hit on the part snaps to.
 *
 * Nearness is judged on screen, in pixels, because that is where the pointer
 * is: a corner three pixels away is a corner however far the camera is. The
 * search is bounded in world space first — a segment further from the hit than
 * the widest reach could ever cover is skipped without being projected — and
 * held to the surface the hit is on: an edge that is within reach of the point
 * but well off its tangent plane is on the far side of a wall, and snapping to
 * it would put a measurement on something the eye cannot see.
 */
export function snapAt(
  hit: SnapHit,
  edges: SnapEdges | null,
  camera: ViewerCamera,
  viewport: ViewportSize,
): Snap {
  const face: Snap = {
    kind: 'face',
    point: hit.point.clone(),
    normal: hit.normal.clone(),
    edge: null,
  }
  if (!edges) return face

  const positions = edges.positions
  const segments = Math.floor(positions.length / 6)
  if (segments === 0) return face

  // Everything below is in the edges' own space. A uniform scale keeps the
  // reach honest; a non-uniform one only widens or narrows the prefilter, and
  // the pixel test that decides is done in world space either way.
  const inverse = edges.matrixWorld.clone().invert()
  const p = hit.point.clone().applyMatrix4(inverse)
  const n = hit.normal.clone().transformDirection(inverse)
  const reach = screenLength(camera, hit.point, viewport, SNAP_PIXELS.vertex) * 1.5
  const reachSq = reach * reach

  const pointer = screenPoint(camera, hit.point, viewport)
  const best: Record<Exclude<SnapKind, 'face'>, { distance: number; index: number; t: number }> = {
    vertex: { distance: Number.POSITIVE_INFINITY, index: -1, t: 0 },
    midpoint: { distance: Number.POSITIVE_INFINITY, index: -1, t: 0 },
    edge: { distance: Number.POSITIVE_INFINITY, index: -1, t: 0 },
  }

  const a = new Vector3()
  const b = new Vector3()
  const ab = new Vector3()
  const ap = new Vector3()
  const q = new Vector3()
  const pixel = new Vector2()

  const consider = (kind: Exclude<SnapKind, 'face'>, point: Vector3, index: number, t: number) => {
    const distance = screenPoint(
      camera,
      q.copy(point).applyMatrix4(edges.matrixWorld),
      viewport,
      pixel,
    ).distanceTo(pointer)
    if (distance <= SNAP_PIXELS[kind] && distance < best[kind].distance) {
      best[kind] = { distance, index, t }
    }
  }

  for (let index = 0; index < segments; index += 1) {
    const offset = index * 6
    a.set(positions[offset]!, positions[offset + 1]!, positions[offset + 2]!)
    b.set(positions[offset + 3]!, positions[offset + 4]!, positions[offset + 5]!)

    // On this surface, or near enough: both ends within reach of its plane.
    if (Math.abs(ap.subVectors(a, p).dot(n)) > reach) continue
    if (Math.abs(ap.subVectors(b, p).dot(n)) > reach) continue

    ab.subVectors(b, a)
    ap.subVectors(p, a)
    const lengthSq = ab.lengthSq()
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ap.dot(ab) / lengthSq))
    q.copy(a).addScaledVector(ab, t)
    if (q.distanceToSquared(p) > reachSq) continue

    consider('vertex', a, index, 0)
    consider('vertex', b, index, 1)
    consider('midpoint', q.copy(a).addScaledVector(ab, 0.5), index, 0.5)
    consider('edge', q.copy(a).addScaledVector(ab, t), index, t)
  }

  for (const kind of ['vertex', 'midpoint', 'edge'] as const) {
    const found = best[kind]
    if (found.index < 0) continue
    const offset = found.index * 6
    const start = new Vector3(positions[offset]!, positions[offset + 1]!, positions[offset + 2]!)
    const end = new Vector3(positions[offset + 3]!, positions[offset + 4]!, positions[offset + 5]!)
    const point = start.clone().lerp(end, found.t)
    start.applyMatrix4(edges.matrixWorld)
    end.applyMatrix4(edges.matrixWorld)
    point.applyMatrix4(edges.matrixWorld)
    return {
      kind,
      point,
      normal: hit.normal.clone(),
      edge: kind === 'vertex' ? null : [start, end],
    }
  }

  return face
}

/** Where a world point lands on the canvas, in CSS pixels from the top left. */
export function screenPoint(
  camera: ViewerCamera,
  point: Vector3,
  viewport: ViewportSize,
  into = new Vector2(),
): Vector2 {
  const ndc = point.clone().project(camera)
  return into.set(((ndc.x + 1) / 2) * viewport.width, ((1 - ndc.y) / 2) * viewport.height)
}

export type MeasureMode = 'distance' | 'angle'

/** How many clicks each kind of measurement takes. */
export const POINTS_PER_MEASUREMENT: Record<MeasureMode, number> = {
  distance: 2,
  angle: 3,
}

export interface DistanceMeasurement {
  readonly id: number
  readonly kind: 'distance'
  readonly points: readonly [Vec3, Vec3]
}

/** Three points: the two arms' ends, with the vertex between them. */
export interface AngleMeasurement {
  readonly id: number
  readonly kind: 'angle'
  readonly points: readonly [Vec3, Vec3, Vec3]
}

export type Measurement = DistanceMeasurement | AngleMeasurement

/**
 * A measurement from the points clicked so far, or `null` while there are not
 * enough of them yet.
 */
export function measurementFromPoints(
  kind: MeasureMode,
  points: readonly Vec3[],
  id: number,
): Measurement | null {
  if (points.length < POINTS_PER_MEASUREMENT[kind]) return null
  const [a, b, c] = points
  if (kind === 'distance') return { id, kind, points: [copy(a!), copy(b!)] }
  return { id, kind, points: [copy(a!), copy(b!), copy(c!)] }
}

/** An id no measurement in `held` has. */
export function nextMeasurementId(held: readonly Measurement[]): number {
  return held.reduce((top, entry) => Math.max(top, entry.id), 0) + 1
}

export function distanceBetween(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

/** `b − a`, per axis. */
export function deltaBetween(a: Vec3, b: Vec3): Vec3 {
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

/**
 * The angle at `vertex` between the arms to `a` and `b`, in degrees, from 0 to
 * 180. An arm with no length has no direction, and the angle is 0.
 */
export function angleAt(vertex: Vec3, a: Vec3, b: Vec3): number {
  const u = new Vector3(a.x - vertex.x, a.y - vertex.y, a.z - vertex.z)
  const w = new Vector3(b.x - vertex.x, b.y - vertex.y, b.z - vertex.z)
  if (u.lengthSq() === 0 || w.lengthSq() === 0) return 0
  return (u.angleTo(w) * 180) / Math.PI
}

export type Axis = 'x' | 'y' | 'z'

/** One leg of a distance's X, Y, Z breakdown. */
export interface DeltaLeg {
  readonly axis: Axis
  readonly from: Vec3
  readonly to: Vec3
  readonly length: number
}

/** Where a point lands when it is held to one axis from `from`. */
export interface AxisLock {
  readonly axis: Axis
  readonly point: Vec3
}

/**
 * `to`, held to the one axis it has moved furthest along from `from`.
 *
 * The ortho lock a CAD user reaches for with Shift: the next point is dropped
 * onto the X, Y or Z line through the last one, so a distance meant to be "how
 * long is this" is not "how long is this, and a little sideways". Which axis is
 * whichever the pointer is furthest along, and a pointer that has not moved
 * stays put on X.
 */
export function lockToAxis(from: Vec3, to: Vec3): AxisLock {
  const delta = deltaBetween(from, to)
  let axis: Axis = 'x'
  for (const candidate of ['y', 'z'] as const) {
    if (Math.abs(delta[candidate]) > Math.abs(delta[axis])) axis = candidate
  }
  return { axis, point: { ...from, [axis]: to[axis] } }
}

/**
 * A distance broken into its X, Y and Z parts, as a path from `a` to `b` that
 * runs along one axis at a time.
 *
 * Only the legs with length are returned, and none at all when the distance
 * already runs along an axis: a single leg would lie on top of the line it
 * explains and say nothing the line does not.
 */
export function deltaLegs(a: Vec3, b: Vec3): readonly DeltaLeg[] {
  const delta = deltaBetween(a, b)
  const threshold = Math.max(1e-9, distanceBetween(a, b) * 1e-6)
  const legs: DeltaLeg[] = []
  let cursor = copy(a)
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(delta[axis]) <= threshold) continue
    const to = { ...cursor, [axis]: b[axis] }
    legs.push({ axis, from: cursor, to, length: Math.abs(delta[axis]) })
    cursor = to
  }
  return legs.length > 1 ? legs : []
}

/**
 * Points along the arc an angle is drawn with, from the arm to `a` round to
 * the arm to `b`, at `radius` from the vertex.
 *
 * Interpolated on the sphere rather than along the chord, so the arc is an
 * arc. Two arms that point the same way, or opposite ways, have no plane to
 * draw in, and get their two ends and nothing between.
 */
export function angleArc(
  vertex: Vec3,
  a: Vec3,
  b: Vec3,
  radius: number,
  segments = ANGLE_ARC_SEGMENTS,
): Vector3[] {
  const v = new Vector3(vertex.x, vertex.y, vertex.z)
  const u = new Vector3(a.x, a.y, a.z).sub(v)
  const w = new Vector3(b.x, b.y, b.z).sub(v)
  if (u.lengthSq() === 0 || w.lengthSq() === 0) return []
  u.normalize()
  w.normalize()

  const theta = u.angleTo(w)
  const sine = Math.sin(theta)
  if (sine < 1e-6) {
    return [v.clone().addScaledVector(u, radius), v.clone().addScaledVector(w, radius)]
  }

  const points: Vector3[] = []
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const direction = u
      .clone()
      .multiplyScalar(Math.sin((1 - t) * theta) / sine)
      .addScaledVector(w, Math.sin(t * theta) / sine)
    points.push(v.clone().addScaledVector(direction, radius))
  }
  return points
}

/** The radius an angle's arc is drawn at: a fraction of the shorter arm. */
export function angleArcRadius(vertex: Vec3, a: Vec3, b: Vec3): number {
  return Math.min(distanceBetween(vertex, a), distanceBetween(vertex, b)) * ANGLE_ARC_FRACTION
}

/** A length in millimetres, as the tool writes it when told nothing else. */
export function formatMillimetres(mm: number, digits = 2): string {
  return `${mm.toFixed(digits)} mm`
}

export function formatDegrees(degrees: number, digits = 1): string {
  return `${degrees.toFixed(digits)}°`
}

/** What a measurement's label says. `format` writes a length; angles write themselves. */
export function measurementLabel(
  measurement: Measurement,
  format: (mm: number) => string = formatMillimetres,
): string {
  if (measurement.kind === 'distance') {
    const [a, b] = measurement.points
    return format(distanceBetween(a, b))
  }
  const [a, vertex, b] = measurement.points
  return formatDegrees(angleAt(vertex, a, b))
}

/** Where a measurement's label sits: the middle of a distance, the vertex of an angle. */
export function measurementLabelAnchor(measurement: Measurement): Vec3 {
  if (measurement.kind === 'distance') return midpoint(measurement.points[0], measurement.points[1])
  const [a, vertex, b] = measurement.points
  const arc = angleArc(vertex, a, b, angleArcRadius(vertex, a, b) * 1.6, 2)
  const middle = arc[1] ?? arc[0]
  return middle ? { x: middle.x, y: middle.y, z: middle.z } : copy(vertex)
}

function copy(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z }
}
