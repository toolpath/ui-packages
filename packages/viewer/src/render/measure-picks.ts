import { AXIS_COLORS, type SnapKind, deltaLegs } from './measure.js'
import { Vector3 } from 'three'
import {
  HOLE_SWEEP_DEG,
  PARALLEL_DEG,
  dimension,
  groupReadout,
  lineAngle,
  onAxis,
  toVector,
  type Cylinder,
  type FaceReadout,
  type FaceSurface,
  type HoleIndex,
  type MeasuredFace,
  type Point,
  type SurfaceFor,
} from './face-measure.js'

/**
 * The measure tool has no modes: what a click measures is read off what it
 * lands on, and off Alt (Option). A plain click on a face takes the whole
 * face, and on a hole the whole hole; it never makes a point. With Alt held,
 * a click places a point, snapped to a corner, the middle of a straight
 * edge, or an edge where one is near, and on the face where none is.
 *
 * Points are Alt's alone because a plain click that turned into a point near
 * a corner or an edge flicked between the face and the point as the pointer
 * moved: one key held says which is wanted, and nothing near it can change it.
 *
 * Two picks are then read together where they make a dimension:
 *
 * | First | Second | Reads                                     |
 * | ----- | ------ | ----------------------------------------- |
 * | point | point  | the distance, with its X, Y and Z legs    |
 * | point | plane  | the distance square to the plane          |
 * | plane | plane  | the gap if parallel, else the angle       |
 * | hole  | plane  | the hole's centre line to the plane       |
 *
 * in either order. A hole pairs only with a plane its axis runs along, since
 * only there does its centre line stand a distance off it. Anything else
 * starts a new measurement, and a hole alone reads its own size.
 */

/** A point picked for measuring, with Alt: a corner, an edge's middle, along an edge, or on a face. */
export interface MeasuredPoint {
  kind: 'point'
  point: Point
}

export type MeasurePick = MeasuredFace | MeasuredPoint

/** One measurement: one pick alone, or two read together. */
export type MeasureGroup = readonly MeasurePick[]

/** Whether two picks are read together. Bound to the part's surfaces by the caller. */
export type Pairs = (a: MeasurePick, b: MeasurePick) => boolean

export const isFace = (pick: MeasurePick): pick is MeasuredFace => pick.kind === 'face'

/** The face under the pointer, and the surface it is. */
export interface OnFace {
  face: MeasuredFace
  surface: FaceSurface
}

/** Where an Alt point snaps: the point, what it snapped to, and the edge for an edge or its middle. */
export interface Snapped {
  kind: SnapKind
  point: Point
  /** The edge it snapped to, or is the middle of, as points along it; null for a corner or the face. */
  edge: readonly Point[] | null
}

/**
 * What a click under the pointer would pick. `on` is the face the pointer is
 * on, null just off the part's outline and on a section's cut face, which is
 * no face of the part. `snap` is where an Alt point goes,
 * null without Alt: a corner of the part within reach, on the part or just
 * off its outline, else an edge or the face under the pointer.
 */
export interface Under {
  on: OnFace | null
  snap: Snapped | null
}

/** Snaps that are points in themselves, which hold the pointer a little past their reach. */
export const isPointSnap = (kind: SnapKind): kind is 'vertex' | 'midpoint' =>
  kind === 'vertex' || kind === 'midpoint'

/** What a click picks: with Alt, the point it snapped to; without, the face, or a hole's whole hole. */
export const pickFrom = ({ on, snap }: Under): MeasurePick | null =>
  snap ? { kind: 'point', point: snap.point } : (on?.face ?? null)

/** How near, CSS pixels on screen, the pointer has to come to a corner, a straight edge's middle, or an edge. */
export type SnapReach = Record<'vertex' | 'midpoint' | 'edge', number>

/**
 * The reach of each with the part at its usual size on screen (`zoomedReach`
 * scales it). Over three times the viewer's own snap for a corner and a
 * middle (14 and 12), and near twice for an edge (9): with Alt held a point
 * is plainly wanted, and a corner is the point most often wanted, so it must
 * be easy to catch.
 */
export const SNAP_REACH: SnapReach = { vertex: 48, midpoint: 36, edge: 16 }

/** How much further than its reach a corner or an edge holds the pointer once it has it. */
export const STICKY_REACH = 1.5

/**
 * The snap, held on a corner the pointer had until it moves well clear.
 *
 * A corner takes the pointer within its reach and lets it go only past half
 * as far again, so a hand that wobbles at the edge of the reach does not
 * flick the ring on and off. `fromHeld` is how far the pointer is from the
 * held corner on screen, in CSS pixels.
 */
export const stickySnap = (
  held: Snapped | null,
  snap: Snapped | null,
  fromHeld: number,
  reach: SnapReach,
): Snapped | null => {
  if ((snap && isPointSnap(snap.kind)) || !held || !isPointSnap(held.kind)) return snap
  return fromHeld <= reach[held.kind] * STICKY_REACH ? held : snap
}

const POINT_CAPTIONS: Record<SnapKind, string> = {
  vertex: 'Corner',
  midpoint: 'Midpoint',
  edge: 'Edge',
  face: 'Point',
}

/** What the pointer's caption says a click there picks: "Corner", "Face", "Hole ⌀ 6.350". */
export const hoverCaption = (
  { on, snap }: Under,
  holes: HoleIndex,
  format: (mm: number) => string,
): string => {
  if (snap) return POINT_CAPTIONS[snap.kind]
  if (!on) return ''
  const { surface } = on
  if (surface.kind === 'plane') return 'Face'
  if (surface.kind === 'other') return "Can't measure"
  const round = holes.holeOf(on.face.region) ?? surface
  return round.sweep > HOLE_SWEEP_DEG
    ? `Hole ⌀ ${format(round.radius * 2)}`
    : `R ${format(round.radius)}`
}

type Role = 'point' | 'plane' | 'hole' | 'other'

const roleOf = (pick: MeasurePick, surfaceFor: SurfaceFor): Role => {
  if (!isFace(pick)) return 'point'
  const { kind } = surfaceFor(pick.region)
  return kind === 'cylinder' ? 'hole' : kind
}

/** Whether a cylinder's axis runs along a plane: square to its normal. */
const runsAlong = (cylinder: FaceSurface, plane: FaceSurface): boolean =>
  cylinder.kind === 'cylinder' &&
  plane.kind === 'plane' &&
  lineAngle(cylinder.axis, plane.normal) >= 90 - PARALLEL_DEG

/** The pairs of the table above, in either order. */
export const pairsOn =
  (surfaceFor: SurfaceFor): Pairs =>
  (a, b) => {
    const roles = [roleOf(a, surfaceFor), roleOf(b, surfaceFor)].sort().join('+')
    if (roles === 'point+point' || roles === 'plane+point' || roles === 'plane+plane') return true
    if (roles !== 'hole+plane' || !isFace(a) || !isFace(b)) return false
    const [hole, plane] = roleOf(a, surfaceFor) === 'hole' ? [a, b] : [b, a]
    return runsAlong(surfaceFor(hole.region), surfaceFor(plane.region))
  }

const sameFace = (a: MeasurePick, b: MeasurePick): boolean =>
  isFace(a) && isFace(b) && a.region === b.region

/**
 * One click, against every measurement on screen.
 *
 * A face already held is dropped from its measurement. Otherwise the pick
 * joins the latest measurement where the two pair, and starts a new one
 * where they do not. `keep` (Shift) says whether the measurements already
 * on screen stay; without it the click moves on, and only the one the pick
 * is in is left.
 */
export const clickPick = (
  groups: readonly MeasureGroup[],
  pick: MeasurePick,
  keep: boolean,
  pairs: Pairs,
): readonly MeasureGroup[] => {
  if (groups.some((group) => group.some((each) => sameFace(each, pick)))) {
    return groups
      .map((group) => group.filter((each) => !sameFace(each, pick)))
      .filter((group) => group.length > 0)
  }
  const last = groups[groups.length - 1]
  const [only] = last ?? []
  const paired = last?.length === 1 && only !== undefined && pairs(only, pick)
  const before = keep ? groups.slice(0, paired ? -1 : undefined) : []
  return [...before, paired ? [only, pick] : [pick]]
}

/** Delete: the last pick goes, and with it its measurement if it was alone. */
export const dropLastPick = (groups: readonly MeasureGroup[]): readonly MeasureGroup[] => {
  const last = groups[groups.length - 1]
  if (!last) return groups
  const rest = groups.slice(0, -1)
  return last.length > 1 ? [...rest, last.slice(0, -1)] : rest
}

/** What a measurement draws: its faces' readout, and a dot on each point picked. */
export interface MeasureReadout extends FaceReadout {
  markers: Vector3[]
}

/** A distance, with its X, Y and Z legs dashed in their axes' colours where it runs along none. */
const distanceReadout = (
  from: Vector3,
  to: Vector3,
  format: (mm: number) => string,
): FaceReadout => {
  const line = dimension(from, to, format(from.distanceTo(to)))
  const legs = deltaLegs(from, to).map((leg) => ({
    line: {
      points: [
        toVector([leg.from.x, leg.from.y, leg.from.z]),
        toVector([leg.to.x, leg.to.y, leg.to.z]),
      ],
      dashed: true,
      color: AXIS_COLORS[leg.axis],
    },
    label: {
      at: toVector([
        (leg.from.x + leg.to.x) / 2,
        (leg.from.y + leg.to.y) / 2,
        (leg.from.z + leg.to.z) / 2,
      ]),
      text: `${leg.axis.toUpperCase()} ${format(leg.length)}`,
      axis: leg.axis,
    },
  }))
  return {
    lines: [...line.lines, ...legs.map((leg) => leg.line)],
    labels: [...line.labels, ...legs.map((leg) => leg.label)],
  }
}

type Plane = Extract<FaceSurface, { kind: 'plane' }>

/** From `point` square to `plane`, labelled with `prefix` and the distance. */
const toPlane = (
  point: Vector3,
  plane: Plane,
  prefix: string,
  format: (mm: number) => string,
): FaceReadout => {
  const off = new Vector3().subVectors(point, plane.centroid).dot(plane.normal)
  const foot = point.clone().addScaledVector(plane.normal, -off)
  return dimension(point, foot, `${prefix} ${format(Math.abs(off))}`)
}

const NOTHING: FaceReadout = { lines: [], labels: [] }

/**
 * What a pair says beyond its faces' own readouts: a distance between
 * points, from a point to a plane, or from a hole's centre line to a plane.
 * Two planes are read by `groupReadout`.
 */
const pairReadout = (
  a: MeasurePick,
  b: MeasurePick,
  surfaceFor: SurfaceFor,
  holes: HoleIndex,
  format: (mm: number) => string,
): FaceReadout => {
  if (!isFace(a) && !isFace(b)) return distanceReadout(toVector(a.point), toVector(b.point), format)
  const [face, other] = isFace(a) ? [a, b] : [b, a]
  if (!isFace(face)) return NOTHING
  const surface = surfaceFor(face.region)
  if (!isFace(other)) {
    return surface.kind === 'plane' ? toPlane(toVector(other.point), surface, '⟂', format) : NOTHING
  }
  const otherSurface = surfaceFor(other.region)
  const [round, flat, roundPick] =
    surface.kind === 'cylinder' ? [surface, otherSurface, face] : [otherSurface, surface, other]
  if (round.kind !== 'cylinder' || flat.kind !== 'plane') return NOTHING
  const hole: Cylinder = holes.holeOf(roundPick.region) ?? round
  return toPlane(onAxis(hole, toVector(roundPick.point)), flat, 'Center ⟂', format)
}

/** Everything one measurement draws. */
export const measureReadout = (
  group: MeasureGroup,
  surfaceFor: SurfaceFor,
  holes: HoleIndex,
  format: (mm: number) => string,
): MeasureReadout => {
  const own = groupReadout(group.filter(isFace), surfaceFor, format, holes)
  const [first, second] = group
  const pair = first && second ? pairReadout(first, second, surfaceFor, holes, format) : NOTHING
  return {
    lines: [...own.lines, ...pair.lines],
    labels: [...own.labels, ...pair.labels],
    markers: group.flatMap((pick) => (isFace(pick) ? [] : [toVector(pick.point)])),
  }
}
