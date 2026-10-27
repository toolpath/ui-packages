import { type ViewerCamera, type ViewportSize } from './camera.js'
import { screenPoint } from './measure.js'
import { Vector2, Vector3, type Matrix4, type Ray, type Sphere } from 'three'
import { STICKY_REACH, type SnapReach } from './measure-picks.js'

/**
 * The part's edges as an Alt click snaps to them: its corners and the
 * middles of its straight edges (`edgeCorners`, `cornersNear`), its edges
 * whole (`edgeLines`, `edgesNear`), and how far each reaches on screen
 * (`zoomedReach`). Read once from the edge overlay (`regionEdgesGeometry`),
 * whose lines run only where two surfaces meet.
 *
 * That overlay is polylines: a round edge is many short segments, and every
 * joint between two of them would be a "corner" to the viewer's own snap.
 * Here a corner is only where three or more edges meet, or where one turns
 * sharply; and a straight edge is a run of segments that never bends, well
 * longer than any step of a curve it meets, which is what keeps the curve of
 * a hole's rim from being read as a row of corners and middles.
 */

export interface EdgeCorner {
  kind: 'vertex' | 'midpoint'
  /** In the edge geometry's own space. */
  point: Vector3
  /** For a middle, the straight edge it is the middle of. */
  edge: readonly [Vector3, Vector3] | null
}

/** A turn sharper than this, degrees, is a corner. Tessellated curves turn less at each joint. */
const CORNER_TURN_DEG = 40
/** A turn gentler than this, degrees, is no turn: the segments are one straight edge. */
const STRAIGHT_TURN_DEG = 1

const keyOf = (x: number, y: number, z: number): string =>
  `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`

interface Joint {
  point: Vector3
  /** The joints at the other ends of its segments. */
  next: string[]
}

/** The overlay's segments as joints, each with the joints it runs to. */
const jointsOf = (positions: ArrayLike<number>): Map<string, Joint> => {
  const joints = new Map<string, Joint>()
  const at = (index: number): string => {
    const [x, y, z] = [positions[index] ?? 0, positions[index + 1] ?? 0, positions[index + 2] ?? 0]
    const key = keyOf(x, y, z)
    if (!joints.has(key)) joints.set(key, { point: new Vector3(x, y, z), next: [] })
    return key
  }
  for (let index = 0; index + 5 < positions.length; index += 6) {
    const [a, b] = [at(index), at(index + 3)]
    if (a === b) continue
    joints.get(a)?.next.push(b)
    joints.get(b)?.next.push(a)
  }
  return joints
}

/** How far, degrees, a line through a joint of two segments turns there. */
const turnAt = (joints: Map<string, Joint>, joint: Joint): number => {
  const [a, b] = joint.next.map((key) => joints.get(key)?.point)
  if (!a || !b) return 0
  const into = new Vector3().subVectors(joint.point, a)
  const out = new Vector3().subVectors(b, joint.point)
  return (into.angleTo(out) * 180) / Math.PI
}

const isCornerJoint = (joints: Map<string, Joint>, joint: Joint): boolean =>
  joint.next.length !== 2 || turnAt(joints, joint) > CORNER_TURN_DEG

const isStraightThrough = (joints: Map<string, Joint>, joint: Joint): boolean =>
  joint.next.length === 2 && turnAt(joints, joint) < STRAIGHT_TURN_DEG

/** A straight run of the overlay: from a joint that is not straight-through to the next. */
interface Run {
  from: string
  to: string
  /** The joint just inside `to`, so the segment beyond `to` can be found. */
  beforeTo: string
}

/** From `from`, along the segment to `first`, on through every joint that does not bend: the run it makes. */
const runFrom = (joints: Map<string, Joint>, from: string, first: string): Run => {
  let [previous, current] = [from, first]
  for (let steps = 0; steps < joints.size; steps += 1) {
    const joint = joints.get(current)
    const onward = joint?.next.find((key) => key !== previous)
    if (!joint || !isStraightThrough(joints, joint) || !onward) break
    ;[previous, current] = [current, onward]
  }
  return { from, to: current, beforeTo: previous }
}

/** How much longer than the step of curve it meets a run must be to be an edge of its own, not one more step. */
const EDGE_OVER_STEP = 3

const distance = (joints: Map<string, Joint>, a: string, b: string): number => {
  const [p, q] = [joints.get(a)?.point, joints.get(b)?.point]
  return p && q ? p.distanceTo(q) : 0
}

/** The segment beyond a run's end, `inside` being the run's own joint next to it; 0 for none. */
const stepBeyond = (joints: Map<string, Joint>, end: string, inside: string): number => {
  const beyond = joints.get(end)?.next.find((key) => key !== inside)
  return beyond ? distance(joints, end, beyond) : 0
}

/**
 * Whether a run is a straight edge. Between two corners it is. Where an end
 * bends gently into a curve — a slot's side meeting its round end, a face's
 * edge meeting a fillet — it is one only if it is well longer than the
 * curve's step there; a run no longer than that is a step of the curve.
 */
const isStraightEdge = (joints: Map<string, Joint>, run: Run, firstStep: string): boolean => {
  const length = distance(joints, run.from, run.to)
  const ends: [string, string][] = [
    [run.from, firstStep],
    [run.to, run.beforeTo],
  ]
  return ends.every(([end, inside]) => {
    const joint = joints.get(end)
    if (!joint || isCornerJoint(joints, joint)) return true
    return length > EDGE_OVER_STEP * stepBeyond(joints, end, inside)
  })
}

/**
 * The part's corners, the middle of each straight edge, and the ends of a
 * straight edge where it runs into a curve: where a fillet starts is a
 * point a machinist measures to as surely as a corner.
 */
export const edgeCorners = (positions: ArrayLike<number>): EdgeCorner[] => {
  const joints = jointsOf(positions)
  const corners: EdgeCorner[] = []
  const vertices = new Set<string>()
  const edges = new Set<string>()
  const vertex = (key: string): void => {
    const point = joints.get(key)?.point
    if (!point || vertices.has(key)) return
    vertices.add(key)
    corners.push({ kind: 'vertex', point, edge: null })
  }
  for (const [key, joint] of joints) {
    if (isStraightThrough(joints, joint)) continue
    if (isCornerJoint(joints, joint)) vertex(key)
    for (const first of joint.next) {
      const run = runFrom(joints, key, first)
      const edgeKey = [run.from, run.to].sort().join('|')
      const end = joints.get(run.to)
      if (!end || run.to === key || edges.has(edgeKey) || !isStraightEdge(joints, run, first)) {
        continue
      }
      edges.add(edgeKey)
      vertex(run.from)
      vertex(run.to)
      corners.push({
        kind: 'midpoint',
        point: joint.point.clone().add(end.point).multiplyScalar(0.5),
        edge: [joint.point, end.point],
      })
    }
  }
  return corners
}

/** A corner near the pointer, in world space. */
export interface CornerHit {
  kind: EdgeCorner['kind']
  point: Vector3
  edge: readonly [Vector3, Vector3] | null
  /** How far from the pointer it is on screen, CSS pixels. */
  pixels: number
}

/** The view, and where on it the pointer is, CSS pixels from the top left. */
export interface ScreenAt {
  camera: ViewerCamera
  viewport: ViewportSize
  pointer: { x: number; y: number }
}

/**
 * The corners and straight edges' middles within reach of the pointer
 * (`reach` pixels on screen, by kind), nearest for its reach first. A corner
 * reaches further than a middle, so it comes first where both are as near;
 * on a short edge its middle still wins near the middle.
 *
 * Says nothing of whether each can be seen: the caller asks that of the
 * first few, as only it has the part to look past.
 */
export const cornersNear = (
  corners: readonly EdgeCorner[],
  matrixWorld: Matrix4,
  { camera, viewport, pointer }: ScreenAt,
  reach: SnapReach,
): CornerHit[] => {
  const point = new Vector3()
  const onScreen = new Vector2()
  const near: { corner: EdgeCorner; pixels: number; score: number }[] = []
  for (const corner of corners) {
    point.copy(corner.point).applyMatrix4(matrixWorld)
    screenPoint(camera, point, viewport, onScreen)
    const pixels = Math.hypot(onScreen.x - pointer.x, onScreen.y - pointer.y)
    const score = pixels / reach[corner.kind]
    if (score <= 1) near.push({ corner, pixels, score })
  }
  const toWorld = (local: Vector3): Vector3 => local.clone().applyMatrix4(matrixWorld)
  return near
    .sort((a, b) => a.score - b.score)
    .map(({ corner, pixels }) => ({
      kind: corner.kind,
      point: toWorld(corner.point),
      edge: corner.edge ? [toWorld(corner.edge[0]), toWorld(corner.edge[1])] : null,
      pixels,
    }))
}

/** How wide on screen, CSS pixels, a part is when the reach is as written. */
const USUAL_PART_PIXELS = 400
/** How far the reach shrinks and grows with the part on screen. */
const ZOOM_SCALE = { min: 0.5, max: 2 } as const

/**
 * The reach for the part as it is on screen: as written with the part
 * `USUAL_PART_PIXELS` across, larger as it is zoomed in, smaller as it is
 * zoomed out, between half and twice. Zoomed in, the corners are far apart
 * and a wide reach costs nothing; zoomed out, they crowd, and a narrow one
 * keeps them apart.
 */
export const zoomedReach = (
  base: SnapReach,
  part: Sphere,
  camera: ViewerCamera,
  viewport: ViewportSize,
): SnapReach => {
  const across = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  const centre = screenPoint(camera, part.center, viewport)
  const rim = screenPoint(
    camera,
    part.center.clone().addScaledVector(across, part.radius),
    viewport,
  )
  const pixels = 2 * centre.distanceTo(rim)
  const scale = Math.min(Math.max(pixels / USUAL_PART_PIXELS, ZOOM_SCALE.min), ZOOM_SCALE.max)
  return { vertex: base.vertex * scale, midpoint: base.midpoint * scale, edge: base.edge * scale }
}

/** One segment of the overlay, and the edge line it is part of. */
interface EdgeSegment {
  a: Vector3
  b: Vector3
  line: number
}

/**
 * The overlay as whole edges: each line runs from corner to corner
 * (`isCornerJoint`), or round as a loop, as a hole's rim does. In the edge
 * geometry's own space.
 */
export interface EdgeLines {
  lines: Vector3[][]
  segments: EdgeSegment[]
}

const segmentKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * The overlay's segments joined into whole edges. An Alt point along an
 * edge snaps to the edge as a whole, and it is the whole edge that is drawn
 * bold: one short segment of a curve at a time would flick from one to the
 * next as the pointer ran along it.
 */
export const edgeLines = (positions: ArrayLike<number>): EdgeLines => {
  const joints = jointsOf(positions)
  const claimed = new Set<string>()
  const lines: Vector3[][] = []
  const segments: EdgeSegment[] = []
  const claim = (a: string, b: string, line: number): boolean => {
    const key = segmentKey(a, b)
    const [p, q] = [joints.get(a)?.point, joints.get(b)?.point]
    if (claimed.has(key) || !p || !q) return false
    claimed.add(key)
    segments.push({ a: p, b: q, line })
    return true
  }
  // From `to`, away from `from`, through every joint that is no corner: the joints passed.
  const extend = (from: string, to: string, line: number): string[] => {
    const passed: string[] = []
    let [previous, current] = [from, to]
    for (;;) {
      const joint = joints.get(current)
      if (!joint || isCornerJoint(joints, joint)) return passed
      const onward = joint.next.find((key) => key !== previous)
      if (!onward || !claim(current, onward, line)) return passed
      passed.push(onward)
      ;[previous, current] = [current, onward]
    }
  }
  for (const [key, joint] of joints) {
    for (const next of joint.next) {
      const line = lines.length
      if (!claim(key, next, line)) continue
      const ahead = extend(key, next, line)
      const behind = extend(next, key, line)
      const keys = [...behind.reverse(), key, next, ...ahead]
      lines.push(keys.flatMap((each) => joints.get(each)?.point ?? []))
    }
  }
  return { lines, segments }
}

/** The nearest point on an edge line to the pointer, in world space. */
export interface EdgeHit {
  point: Vector3
  line: number
}

/**
 * The nearest point on each edge line within `reach` CSS pixels of the
 * pointer, nearest first, one to a line. `ray` is the pointer's, in world
 * space. The line the pointer last had (`held`) reaches `STICKY_REACH` as
 * far again, so a hand that wobbles at the edge of the reach does not flick
 * it on and off. Says nothing of whether each can be seen, as `cornersNear`.
 */
export const edgesNear = (
  { segments }: EdgeLines,
  matrixWorld: Matrix4,
  ray: Ray,
  { camera, viewport, pointer }: ScreenAt,
  reach: number,
  held: number | null,
): EdgeHit[] => {
  const [a, b, onSegment] = [new Vector3(), new Vector3(), new Vector3()]
  const onScreen = new Vector2()
  const best = new Map<number, { point: Vector3; score: number }>()
  for (const segment of segments) {
    a.copy(segment.a).applyMatrix4(matrixWorld)
    b.copy(segment.b).applyMatrix4(matrixWorld)
    ray.distanceSqToSegment(a, b, undefined, onSegment)
    screenPoint(camera, onSegment, viewport, onScreen)
    const pixels = Math.hypot(onScreen.x - pointer.x, onScreen.y - pointer.y)
    const score = pixels / (segment.line === held ? reach * STICKY_REACH : reach)
    const known = best.get(segment.line)
    if (score <= 1 && (!known || score < known.score)) {
      best.set(segment.line, { point: onSegment.clone(), score })
    }
  }
  return [...best]
    .sort(([, x], [, y]) => x.score - y.score)
    .map(([line, { point }]) => ({ point, line }))
}
