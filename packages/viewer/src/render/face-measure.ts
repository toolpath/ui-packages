import type { PartModel } from '../model/types.js'
import { formatDegrees } from './measure.js'
import { Vector3, type BufferGeometry } from 'three'

/**
 * Measuring the part by its faces: a face, a hole, and how two faces stand.
 *
 * The display mesh knows which triangles make each B-rep face, but not what
 * surface the face is: the Engine sends spans, not geometry. So the surface is
 * read back off the triangles. That is reliable for the two that matter here,
 * because a tessellator puts every vertex on the true surface: a plane's
 * triangles all face one way, and a cylinder's all face square to its axis,
 * with every vertex at one distance from it.
 */

/** A point on the part, in the drawn geometry's space. */
export type Point = readonly [number, number, number]

/** A face picked for measuring: the first of its regions, and where the click landed on it. */
export interface MeasuredFace {
  kind: 'face'
  region: number
  point: Point
}

export type FaceSurface =
  | { kind: 'plane'; normal: Vector3; centroid: Vector3 }
  | {
      kind: 'cylinder'
      axis: Vector3
      /** A point on the axis. */
      origin: Vector3
      radius: number
      /** Where the face starts and ends along the axis, from `origin`. */
      from: number
      to: number
      /** How far round the axis the face goes, degrees: 360 for a whole hole, 90 for a corner. */
      sweep: number
    }
  | { kind: 'other' }

/** Within this, degrees, two directions are the same: a plane's facets, or two parallel faces. */
export const PARALLEL_DEG = 0.5
/** How far, as a share of the radius, a vertex may sit off a fitted cylinder. */
const RADIAL_SLACK = 0.005
/** The same, mm, for a hole so small that a share of its radius is nothing. */
const RADIAL_SLACK_MM = 0.002

type Region = PartModel['regions'][number]

/** A model's regions by their `idx`, and each face's regions, lowest first, by its `splitOrigin`. */
interface RegionTable {
  byIdx: Map<number, Region>
  faces: Map<number, number[]>
}

/**
 * Each model's region table, made once on first asking. A click reads a
 * face's regions many times over, for every face of the part on the first
 * one, and a search of the region list each time would cost the square of
 * their count.
 */
const regionTables = new WeakMap<PartModel, RegionTable>()

const regionTable = (model: PartModel): RegionTable => {
  const known = regionTables.get(model)
  if (known) return known
  const byIdx = new Map<number, Region>()
  const faces = new Map<number, number[]>()
  for (const region of model.regions) {
    byIdx.set(region.idx, region)
    const face = faces.get(region.splitOrigin)
    if (face) {
      face.push(region.idx)
    } else {
      faces.set(region.splitOrigin, [region.idx])
    }
  }
  for (const face of faces.values()) face.sort((a, b) => a - b)
  const table = { byIdx, faces }
  regionTables.set(model, table)
  return table
}

/** The face's regions as the table keeps them: not to be changed. */
const regionsOfFace = (model: PartModel, region: number): readonly number[] => {
  const table = regionTable(model)
  const origin = table.byIdx.get(region)?.splitOrigin
  return (origin === undefined ? undefined : table.faces.get(origin)) ?? [region]
}

/**
 * Every region of the face `region` is part of, lowest first. An analysis can
 * split a face in two; the halves share a `splitOrigin`, and a measurement
 * wants the whole.
 */
export const faceRegions = (model: PartModel, region: number): number[] => [
  ...regionsOfFace(model, region),
]

/** The region a face is named by: its first, so either half of a split face is the same face. */
const faceKey = (model: PartModel, region: number): number =>
  regionsOfFace(model, region)[0] ?? region

interface Facet {
  normal: Vector3
  area: number
  centroid: Vector3
}

interface FaceMesh {
  facets: Facet[]
  points: Vector3[]
}

/** The face's triangles, and its vertices, read from the geometry the part is drawn with. */
const readFace = (model: PartModel, geometry: BufferGeometry, region: number): FaceMesh => {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const vertex = (corner: number): Vector3 =>
    new Vector3().fromBufferAttribute(position, index ? index.getX(corner) : corner)
  const facets: Facet[] = []
  const points: Vector3[] = []
  const { byIdx } = regionTable(model)
  for (const idx of regionsOfFace(model, region)) {
    const each = byIdx.get(idx)
    if (!each) continue
    for (let triangle = each.triangles.start; triangle < each.triangles.end; triangle++) {
      const a = vertex(triangle * 3)
      const b = vertex(triangle * 3 + 1)
      const c = vertex(triangle * 3 + 2)
      points.push(a, b, c)
      const cross = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a))
      const length = cross.length()
      if (length === 0) continue
      facets.push({
        normal: cross.divideScalar(length),
        area: length / 2,
        centroid: a.clone().add(b).add(c).divideScalar(3),
      })
    }
  }
  return { facets, points }
}

const cosOf = (degrees: number): number => Math.cos((degrees * Math.PI) / 180)

const asPlane = (facets: readonly Facet[]): FaceSurface | null => {
  const normal = new Vector3()
  const centroid = new Vector3()
  let area = 0
  for (const facet of facets) {
    normal.addScaledVector(facet.normal, facet.area)
    centroid.addScaledVector(facet.centroid, facet.area)
    area += facet.area
  }
  if (area === 0 || normal.lengthSq() === 0) return null
  normal.normalize()
  const flat = facets.every((facet) => facet.normal.dot(normal) > cosOf(PARALLEL_DEG))
  return flat ? { kind: 'plane', normal, centroid: centroid.divideScalar(area) } : null
}

type Row = [number, number, number]
type Matrix3 = [Row, Row, Row]

/** The three indices of a row, as literals, so that indexing a `Row` by one is known to hit. */
const IDX = [0, 1, 2] as const

/**
 * The eigenvector of a symmetric 3×3 matrix with the smallest eigenvalue, by
 * Jacobi rotations. Three by three converges in a handful of sweeps.
 */
const smallestEigenvector = (input: Matrix3): Vector3 => {
  const a = input.map((row) => [...row]) as Matrix3
  const v: Matrix3 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  for (let sweep = 0; sweep < 32; sweep++) {
    const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2
    if (off < 1e-20) break
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      if (Math.abs(a[p][q]) < 1e-30) continue
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
      const c = 1 / Math.sqrt(t * t + 1)
      const s = t * c
      for (const k of IDX) {
        const akp = a[k][p]
        const akq = a[k][q]
        a[k][p] = c * akp - s * akq
        a[k][q] = s * akp + c * akq
      }
      for (const k of IDX) {
        const apk = a[p][k]
        const aqk = a[q][k]
        a[p][k] = c * apk - s * aqk
        a[q][k] = s * apk + c * aqk
      }
      for (const k of IDX) {
        const vkp = v[k][p]
        const vkq = v[k][q]
        v[k][p] = c * vkp - s * vkq
        v[k][q] = s * vkp + c * vkq
      }
    }
  }
  const diagonal = [a[0][0], a[1][1], a[2][2]]
  const least = diagonal.indexOf(Math.min(...diagonal))
  return new Vector3(v[0][least], v[1][least], v[2][least]).normalize()
}

/** Two unit vectors square to `axis` and to each other. */
const basisAround = (axis: Vector3): [Vector3, Vector3] => {
  const helper = Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  const u = new Vector3().crossVectors(axis, helper).normalize()
  return [u, new Vector3().crossVectors(axis, u)]
}

/** Solves a 3×3 system by Cramer's rule; null when it has no single answer. */
const solve3 = (m: Matrix3, b: [number, number, number]): [number, number, number] | null => {
  const det = (k: Matrix3): number =>
    k[0][0] * (k[1][1] * k[2][2] - k[1][2] * k[2][1]) -
    k[0][1] * (k[1][0] * k[2][2] - k[1][2] * k[2][0]) +
    k[0][2] * (k[1][0] * k[2][1] - k[1][1] * k[2][0])
  const d = det(m)
  if (Math.abs(d) < 1e-18) return null
  const column = (i: number): number => {
    const swapped = m.map((row, r) => row.map((value, c) => (c === i ? b[r] : value))) as Matrix3
    return det(swapped) / d
  }
  return [column(0), column(1), column(2)]
}

/**
 * The circle through 2D points, by least squares (Kåsa): `x² + y² + Dx + Ey + F = 0`.
 * Taken about the points' mean, so that a hole far from the origin does not
 * cost the fit its precision. An arc of a few degrees fits as well as a full
 * circle, since every point is on the circle.
 */
const fitCircle = (
  points: readonly [number, number][],
): { cx: number; cy: number; r: number } | null => {
  const mx = points.reduce((sum, [x]) => sum + x, 0) / points.length
  const my = points.reduce((sum, [, y]) => sum + y, 0) / points.length
  const m: Matrix3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const b: [number, number, number] = [0, 0, 0]
  for (const [px, py] of points) {
    const x = px - mx
    const y = py - my
    const row: Row = [x, y, 1]
    const rhs = -(x * x + y * y)
    for (const i of IDX) {
      for (const j of IDX) m[i][j] += row[i] * row[j]
      b[i] += row[i] * rhs
    }
  }
  const answer = solve3(m, b)
  if (!answer) return null
  const [d, e, f] = answer
  const rSq = (d * d + e * e) / 4 - f
  return rSq > 0 ? { cx: mx - d / 2, cy: my - e / 2, r: Math.sqrt(rSq) } : null
}

const asCylinder = (facets: readonly Facet[], points: readonly Vector3[]): FaceSurface | null => {
  // The axis is the one direction every facet is square to.
  const m: Matrix3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (const { normal, area } of facets) {
    const n: Row = [normal.x, normal.y, normal.z]
    for (const i of IDX) for (const j of IDX) m[i][j] += area * n[i] * n[j]
  }
  const axis = smallestEigenvector(m)
  const [u, v] = basisAround(axis)
  const circle = fitCircle(points.map((point) => [point.dot(u), point.dot(v)]))
  if (!circle) return null
  const slack = Math.max(circle.r * RADIAL_SLACK, RADIAL_SLACK_MM)
  const origin = u.clone().multiplyScalar(circle.cx).addScaledVector(v, circle.cy)
  let from = Infinity
  let to = -Infinity
  const angles: number[] = []
  for (const point of points) {
    const along = new Vector3().subVectors(point, origin).dot(axis)
    const off = new Vector3().subVectors(point, origin).addScaledVector(axis, -along).length()
    if (Math.abs(off - circle.r) > slack) return null
    from = Math.min(from, along)
    to = Math.max(to, along)
    angles.push(Math.atan2(point.dot(v) - circle.cy, point.dot(u) - circle.cx))
  }
  return { kind: 'cylinder', axis, origin, radius: circle.r, from, to, sweep: sweepOf(angles) }
}

/** How far round a circle a set of angles (radians) goes, degrees: all of it less the widest gap. */
const sweepOf = (angles: number[]): number => {
  const sorted = [...angles].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === undefined || last === undefined) return 0
  let widest = first + 2 * Math.PI - last
  for (let i = 1; i < sorted.length; i++) {
    widest = Math.max(widest, (sorted[i] ?? 0) - (sorted[i - 1] ?? 0))
  }
  return 360 - (widest * 180) / Math.PI
}

/** What surface the face is: a plane, a cylinder (whole or part of one), or something else. */
const faceSurface = (model: PartModel, geometry: BufferGeometry, region: number): FaceSurface =>
  surfaceOf(readFace(model, geometry, region))

/** Reads a face's surface, by the region it is named by. */
export type SurfaceFor = (region: number) => FaceSurface

/**
 * `faceSurface`, remembered per face. Hovering asks for the same face on
 * every move, and a face's surface does not change while the model and its
 * geometry stay the same; make a new one for a new model or geometry.
 */
export const surfaceCache = (model: PartModel, geometry: BufferGeometry): SurfaceFor => {
  const known = new Map<number, FaceSurface>()
  return (region) => {
    const key = faceKey(model, region)
    const cached = known.get(key)
    if (cached) return cached
    const surface = faceSurface(model, geometry, key)
    known.set(key, surface)
    return surface
  }
}

const surfaceOf = ({ facets, points }: FaceMesh): FaceSurface => {
  if (facets.length === 0) return { kind: 'other' }
  return asPlane(facets) ?? asCylinder(facets, points) ?? { kind: 'other' }
}

export type Cylinder = Extract<FaceSurface, { kind: 'cylinder' }>

/**
 * Past this, degrees round, a cylinder is a hole (or a boss) and is sized by
 * its diameter. At or under it — a fillet, an inside corner, a slot's end —
 * it is a radius on a wall, and is sized by that.
 */
export const HOLE_SWEEP_DEG = 185

/** A hole: every cylinder face round one axis, at one radius, taken together. */
type Hole = Cylinder & {
  /** Its faces, by the region each is named by, lowest first: the first names the hole. */
  faces: readonly number[]
}

/** The part's holes, read off its faces. */
export interface HoleIndex {
  /** The hole a face is part of, or null for a face that is not the wall of one. */
  holeOf: (region: number) => Hole | null
  /** Every hole the same as `hole`, it among them. */
  sameAs: (hole: Hole) => readonly Hole[]
  /** The face a face is measured as: a hole's first face for any of its faces, so a hole is one face. */
  faceOf: (region: number) => number
}

/** Within this, degrees, two holes' axes are one way. Looser than a plane's: a half cylinder's axis is fitted. */
const AXIS_DEG = 1

/** How far two cylinders' axes, or their ends, may be apart and still be one hole, mm. */
const coaxialSlack = (radius: number): number => Math.max(radius * 0.02, 0.01)

/** Where `cylinder`'s ends fall along `on`'s axis, measured from `on`'s origin. */
const extentOn = (on: Cylinder, cylinder: Cylinder): [number, number] => {
  const at = (level: number): number =>
    cylinder.origin.clone().addScaledVector(cylinder.axis, level).sub(on.origin).dot(on.axis)
  const [a, b] = [at(cylinder.from), at(cylinder.to)]
  return [Math.min(a, b), Math.max(a, b)]
}

/** Whether two cylinders are walls of one hole: one radius, one axis, and ends that meet or overlap. */
const coaxial = (a: Cylinder, b: Cylinder): boolean => {
  const slack = coaxialSlack(Math.max(a.radius, b.radius))
  if (Math.abs(a.radius - b.radius) > slack) return false
  if (lineAngle(a.axis, b.axis) > AXIS_DEG) return false
  const offset = new Vector3().subVectors(b.origin, a.origin)
  if (offset.addScaledVector(a.axis, -offset.dot(a.axis)).length() > slack) return false
  const [from, to] = extentOn(a, b)
  return from <= a.to + slack && to >= a.from - slack
}

/** One hole made of its faces' cylinders, on the first face's axis. */
const holeFrom = (faces: readonly { region: number; cylinder: Cylinder }[]): Hole | null => {
  const [first] = faces
  if (!first) return null
  const base = first.cylinder
  let from = Infinity
  let to = -Infinity
  let sweep = 0
  let radius = 0
  for (const { cylinder } of faces) {
    const [a, b] = extentOn(base, cylinder)
    from = Math.min(from, a)
    to = Math.max(to, b)
    sweep += cylinder.sweep
    radius += cylinder.radius
  }
  return {
    ...base,
    from,
    to,
    radius: radius / faces.length,
    sweep: Math.min(sweep, 360),
    faces: faces.map((face) => face.region),
  }
}

const SAME_DEPTH = 0.05
const DEPTH_FLOOR = 0.01

/**
 * Whether two depths are one depth: within a twentieth, or a hundredth of a
 * mm. The same test as `@toolpath/dfm`'s `sameDepth`, which this package does
 * not depend on, so a hole the DFM rules count with another is measured with it.
 */
const sameDepth = (a: number, b: number): boolean =>
  Math.abs(a - b) <= Math.max(DEPTH_FLOOR, Math.max(Math.abs(a), Math.abs(b)) * SAME_DEPTH)

const sameHole = (a: Hole, b: Hole): boolean => {
  const [da, db] = [a.radius * 2, b.radius * 2]
  return (
    lineAngle(a.axis, b.axis) <= AXIS_DEG &&
    Math.abs(da - db) <= Math.max(0.005, Math.max(da, db) * 0.001) &&
    sameDepth(a.to - a.from, b.to - b.from)
  )
}

/**
 * The part's holes. A hole the CAD split into halves (most do: a cylinder is
 * often two faces of 180°) is one hole here, its faces gathered by sharing a
 * radius and an axis. Read once, on first asking, as it reads every face.
 */
export const holeIndex = (model: PartModel, surfaceFor: SurfaceFor): HoleIndex => {
  let built: { byFace: Map<number, Hole>; holes: Hole[] } | null = null
  const build = (): { byFace: Map<number, Hole>; holes: Hole[] } => {
    if (built) return built
    const keys = [...new Set(model.regions.map((region) => faceKey(model, region.idx)))].sort(
      (a, b) => a - b,
    )
    const cylinders = keys.flatMap((region) => {
      const surface = surfaceFor(region)
      return surface.kind === 'cylinder' ? [{ region, cylinder: surface }] : []
    })
    const root = cylinders.map((_, at) => at)
    const find = (at: number): number => {
      let top = at
      while (root[top] !== top) top = root[top] ?? top
      root[at] = top
      return top
    }
    // Only cylinders of about one radius can be one hole: taken smallest first, each is tried
    // against the larger ones until they are too large, rather than against every other.
    const byRadius = cylinders
      .map((_, at) => at)
      .sort((a, b) => (cylinders[a]?.cylinder.radius ?? 0) - (cylinders[b]?.cylinder.radius ?? 0))
    for (let i = 0; i < byRadius.length; i += 1) {
      const a = byRadius[i] ?? 0
      const one = cylinders[a]?.cylinder
      for (let j = i + 1; one && j < byRadius.length; j += 1) {
        const b = byRadius[j] ?? 0
        const other = cylinders[b]?.cylinder
        if (!other) continue
        if (other.radius - one.radius > coaxialSlack(other.radius)) break
        if (coaxial(one, other)) {
          const [low, high] = [find(a), find(b)].sort((x, y) => x - y)
          if (low !== undefined && high !== undefined) root[high] = low
        }
      }
    }
    const sets = new Map<number, { region: number; cylinder: Cylinder }[]>()
    cylinders.forEach((face, at) => {
      const top = find(at)
      const set = sets.get(top)
      if (set) {
        set.push(face)
      } else {
        sets.set(top, [face])
      }
    })
    const byFace = new Map<number, Hole>()
    const holes: Hole[] = []
    for (const set of sets.values()) {
      const hole = holeFrom(set)
      if (!hole || hole.sweep <= HOLE_SWEEP_DEG) continue
      holes.push(hole)
      for (const face of hole.faces) byFace.set(face, hole)
    }
    built = { byFace, holes }
    return built
  }
  const holeOf = (region: number): Hole | null => build().byFace.get(faceKey(model, region)) ?? null
  const same = new Map<Hole, readonly Hole[]>()
  return {
    holeOf,
    sameAs: (hole) => {
      const known = same.get(hole)
      if (known) return known
      const found = build().holes.filter((other) => other === hole || sameHole(hole, other))
      same.set(hole, found)
      return found
    },
    faceOf: (region) => holeOf(region)?.faces[0] ?? faceKey(model, region),
  }
}

interface ReadoutLine {
  points: Vector3[]
  /** An extension line, out to where a dimension is taken, rather than the dimension itself. */
  dashed: boolean
  /** A colour of its own, over the measurement's: a distance's X, Y and Z legs wear their axis's. */
  color?: number
}

interface ReadoutLabel {
  at: Vector3
  text: string
  /** For a distance's X, Y or Z leg: drawn as the leg's label, in its axis's colour (`viewer.css`). */
  axis?: 'x' | 'y' | 'z'
}

/** What a face measurement draws: lines over the part, and labels on them. */
export interface FaceReadout {
  lines: ReadoutLine[]
  labels: ReadoutLabel[]
}

const EMPTY: FaceReadout = { lines: [], labels: [] }

const merge = (...readouts: FaceReadout[]): FaceReadout => ({
  lines: readouts.flatMap((readout) => readout.lines),
  labels: readouts.flatMap((readout) => readout.labels),
})

export const toVector = (point: Point): Vector3 => new Vector3(point[0], point[1], point[2])

/** The point on a cylinder's axis level with `point`. */
export const onAxis = (
  cylinder: Extract<FaceSurface, { kind: 'cylinder' }>,
  point: Vector3,
): Vector3 =>
  cylinder.origin
    .clone()
    .addScaledVector(
      cylinder.axis,
      new Vector3().subVectors(point, cylinder.origin).dot(cylinder.axis),
    )

/** The angle between two lines, 0–90°: which way either one points does not matter. */
export const lineAngle = (a: Vector3, b: Vector3): number =>
  (Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180) / Math.PI

/** A dimension line between two points, with its label at the middle. */
export const dimension = (from: Vector3, to: Vector3, text: string): FaceReadout => ({
  lines: [{ points: [from, to], dashed: false }],
  labels: [{ at: from.clone().add(to).multiplyScalar(0.5), text }],
})

/** The way out from the axis to the click, or any way square to the axis for a click on it. */
const radialTo = (cylinder: Cylinder, picked: Vector3): Vector3 => {
  const outward = new Vector3().subVectors(picked, onAxis(cylinder, picked))
  return outward.lengthSq() < 1e-12 ? basisAround(cylinder.axis)[0] : outward.normalize()
}

/**
 * A cylinder's own size, drawn at the end nearer the click: a hole's
 * diameter straight across it, or a wall radius from its centre out to the
 * wall where it was clicked. Either is followed by its depth, the length of
 * its wall along the axis (↧, as a drawing writes it), and a hole by how
 * many of it the part has, where it has more than one.
 */
const cylinderReadout = (
  cylinder: Cylinder,
  picked: Vector3,
  format: (mm: number) => string,
  count = 1,
): FaceReadout => {
  const depth = `↧ ${format(cylinder.to - cylinder.from)}`
  const level = new Vector3().subVectors(picked, cylinder.origin).dot(cylinder.axis)
  const end =
    Math.abs(level - cylinder.from) < Math.abs(level - cylinder.to) ? cylinder.from : cylinder.to
  const centre = cylinder.origin.clone().addScaledVector(cylinder.axis, end)
  const outward = radialTo(cylinder, picked).multiplyScalar(cylinder.radius)
  if (cylinder.sweep > HOLE_SWEEP_DEG) {
    return dimension(
      centre.clone().add(outward),
      centre.clone().sub(outward),
      `${count > 1 ? `${count}× ` : ''}⌀ ${format(cylinder.radius * 2)}  ${depth}`,
    )
  }
  return dimension(centre, centre.clone().add(outward), `R ${format(cylinder.radius)}  ${depth}`)
}

/**
 * What one face says by itself. Only a cylinder has a size of its own; anything
 * that is neither surface says so. A face of a hole is read as the whole hole.
 */
const singleReadout = (
  { surface, point, region }: Measured & { region: number },
  format: (mm: number) => string,
  holes: HoleIndex | undefined,
): FaceReadout => {
  if (surface.kind === 'cylinder') {
    const hole = holes?.holeOf(region)
    return hole
      ? cylinderReadout(hole, point, format, holes?.sameAs(hole).length)
      : cylinderReadout(surface, point, format)
  }
  if (surface.kind === 'other')
    return { lines: [], labels: [{ at: point, text: 'Not a plane or cylinder' }] }
  return EMPTY
}

type Plane = Extract<FaceSurface, { kind: 'plane' }>
type Measured = { surface: FaceSurface; point: Vector3 }
type MeasuredPlane = Measured & { surface: Plane }

const isPlane = (measured: Measured): measured is MeasuredPlane => measured.surface.kind === 'plane'

/** How many points an angle's arc is drawn with. */
const ARC_SEGMENTS = 32
/** How far round from the arms, as a share of the shorter arm, the arc is drawn. */
const ARC_FRACTION = 0.4
/**
 * Beyond this many times the gap between the two clicks, the planes meet too
 * far off to draw the angle there: the arms would run off the screen.
 */
const FAR_VERTEX = 3

/** Points round the arc from `from` to `to`, both unit directions, about `vertex`. */
const arc = (vertex: Vector3, from: Vector3, to: Vector3, radius: number): Vector3[] => {
  const axis = new Vector3().crossVectors(from, to)
  const sweep = from.angleTo(to)
  if (axis.lengthSq() < 1e-12) return [vertex.clone().addScaledVector(from, radius)]
  axis.normalize()
  return Array.from({ length: ARC_SEGMENTS + 1 }, (_, step) =>
    vertex
      .clone()
      .addScaledVector(from.clone().applyAxisAngle(axis, (sweep * step) / ARC_SEGMENTS), radius),
  )
}

/**
 * The angle between two planes, drawn where they meet: dashed arms out along
 * each face from the line the two planes share to where each was clicked,
 * and an arc between the arms, labelled. The label is the arc's angle, so
 * what is read is what is drawn.
 *
 * Planes that meet far off would put the vertex off the screen, so there the
 * angle is carried to between the clicks instead: two arms the way each face
 * runs, from the midpoint.
 */
const angleReadout = (a: MeasuredPlane, b: MeasuredPlane): FaceReadout => {
  const n1 = a.surface.normal
  const n2 = b.surface.normal
  const along = new Vector3().crossVectors(n1, n2).normalize()
  const cos = n1.dot(n2)
  const d1 = n1.dot(a.surface.centroid)
  const d2 = n2.dot(b.surface.centroid)
  // A point on both planes, and from it the one on their common line nearest the clicks.
  const onBoth = n1
    .clone()
    .multiplyScalar(d1 - d2 * cos)
    .addScaledVector(n2, d2 - d1 * cos)
    .divideScalar(1 - cos * cos)
  const middle = a.point.clone().add(b.point).multiplyScalar(0.5)
  const vertex = onBoth.addScaledVector(along, new Vector3().subVectors(middle, onBoth).dot(along))
  // Each arm runs square to the common line, in its own face's plane, towards its click.
  const arm = (to: Vector3, normal: Vector3): Vector3 => {
    const reach = new Vector3().subVectors(to, vertex)
    reach.addScaledVector(along, -reach.dot(along))
    // A click on the common line itself gives no way to go; the face's own way across does.
    return reach.lengthSq() > 1e-12 ? reach : new Vector3().crossVectors(along, normal)
  }
  const armA = arm(a.point, n1)
  const armB = arm(b.point, n2)
  const dirA = armA.clone().normalize()
  const dirB = armB.clone().normalize()
  const degrees = (dirA.angleTo(dirB) * 180) / Math.PI
  const text = `Angle ${formatDegrees(degrees, 3)}`
  const span = a.point.distanceTo(b.point)

  if (Math.max(armA.length(), armB.length()) <= FAR_VERTEX * Math.max(span, 1e-6)) {
    const radius = ARC_FRACTION * Math.max(Math.min(armA.length(), armB.length()), span * 0.25)
    const points = arc(vertex, dirA, dirB, radius)
    return {
      lines: [
        { points: [vertex, vertex.clone().add(armA)], dashed: true },
        { points: [vertex, vertex.clone().add(armB)], dashed: true },
        { points, dashed: false },
      ],
      labels: [{ at: points[Math.floor(points.length / 2)] ?? vertex, text }],
    }
  }

  const radius = span * 0.25
  const points = arc(middle, dirA, dirB, radius)
  return {
    lines: [
      { points: [middle, middle.clone().addScaledVector(dirA, radius * 1.4)], dashed: true },
      { points: [middle, middle.clone().addScaledVector(dirB, radius * 1.4)], dashed: true },
      { points, dashed: false },
    ],
    labels: [{ at: points[Math.floor(points.length / 2)] ?? middle, text }],
  }
}

/**
 * How two planes stand to one another: parallel faces by the gap between
 * their planes, square across from the first click; any others by their
 * angle, drawn.
 *
 * Only planes are paired: a cylinder held beside another face is read on its
 * own, as if held alone.
 */
const pairReadout = (a: Measured, b: Measured, format: (mm: number) => string): FaceReadout => {
  if (!isPlane(a) || !isPlane(b)) return EMPTY
  if (lineAngle(a.surface.normal, b.surface.normal) > PARALLEL_DEG) return angleReadout(a, b)
  const normal = b.surface.normal
  const gap = new Vector3().subVectors(a.point, b.surface.centroid).dot(normal)
  const foot = a.point.clone().addScaledVector(normal, -gap)
  return dimension(a.point.clone(), foot, `${format(Math.abs(gap))} · parallel`)
}

/** What faces say: a cylinder's own size, or how two planes stand. */
export const groupReadout = (
  group: readonly MeasuredFace[],
  surfaceFor: SurfaceFor,
  format: (mm: number) => string,
  holes?: HoleIndex,
): FaceReadout => {
  const measured = group.map((face) => ({
    region: face.region,
    surface: surfaceFor(face.region),
    point: toVector(face.point),
  }))
  const own = measured.map((each) => singleReadout(each, format, holes))
  const [first, second] = measured
  const pair = first && second ? pairReadout(first, second, format) : EMPTY
  return merge(...own, pair)
}
