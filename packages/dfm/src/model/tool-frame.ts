import type { PinchMark } from './pinch-mark.js'

/*
 * Where a datasheet's own points lie on the part.
 *
 * A datasheet gives its points — pinch discs, sharp corners — in the feature's
 * tool frame: x and y across the tool, z up it. The API says that z runs up
 * the tool axis, and nothing of how x and y turn about it, nor which way "up"
 * is to the machining direction. So the points themselves pin the frame down:
 * every square way of laying the axes is tried, and the one that puts them
 * where the feature's faces say they belong is taken.
 *
 * Plain numbers throughout, so it runs without a renderer: the faces come in
 * as triangles in flat arrays, as `@toolpath/viewer`'s `featureTriangles`
 * reads them, and the answer goes out as plain vectors.
 */

/** A direction or a point. */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** A feature's faces as triangles: nine numbers each for the corners, three for the outward normal. */
export interface FaceTriangles {
  readonly positions: ArrayLike<number>
  readonly normals: ArrayLike<number>
}

/** A datasheet point across the tool, and the disc about it: zero across for a sharp corner. */
interface FrameDisc {
  readonly x: number
  readonly y: number
  readonly diameter: number
}

type V = readonly [number, number, number]

/** The least and greatest of a list, in a loop: spreading a mesh's points into `Math.min` overflows the stack. */
const extent = (values: Iterable<number>): { low: number; high: number } => {
  let low = Infinity
  let high = -Infinity
  for (const value of values) {
    if (value < low) low = value
    if (value > high) high = value
  }
  return { low, high }
}

const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const scale = (a: V, by: number): V => [a[0] * by, a[1] * by, a[2] * by]
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const unit = (a: V): V => scale(a, 1 / Math.hypot(a[0], a[1], a[2]))

/** The frame: x and y across the tool, z up it. */
interface Frame {
  readonly u: V
  readonly v: V
  readonly w: V
}

/** One triangle in the CAD file's own coordinates, with its outward normal. */
interface Triangle {
  readonly a: V
  readonly b: V
  readonly c: V
  readonly normal: V
}

/** How near, mm, the feature's extent along the tool must come to the datasheet's `zMin`..`zMax`. */
const ON_DEPTH_MM = 0.05
/** How near, mm, the projected mesh must come to a sharp corner for a frame to be the Engine's. */
const ON_CORNER_MM = 0.02
/** Narrower than this, mm, a disc is a point: a sharp corner, found by a vertex under it. */
const POINT_DISC_MM = 0.01
/**
 * How far, mm, a disc's edge may stand off the walls and still touch them:
 * the mesh's chords against the true surface, and the tolerance the clearance
 * was measured to. A share of the disc besides, for the bigger ones.
 */
const ON_WALL_MM = 0.1
const ON_WALL_SHARE = 0.02
/** A triangle no steeper than this to the tool axis is a wall: its normal runs across the tool. */
const WALL_NORMAL_ALONG = 0.7
/** Two frames that place every disc within this, mm, of the other are one answer. */
const SAME_PLACE_MM = 0.05
/** The least height a tool is drawn, mm, for a feature with no depth. */
const MIN_HEIGHT_MM = 0.05

/** The triangles, moved back from where the part is drawn to the CAD file's own coordinates. */
const readTriangles = ({ positions, normals }: FaceTriangles, origin: V): Triangle[] => {
  const triangles: Triangle[] = []
  for (let at = 0; at + 8 < positions.length; at += 9) {
    const corner = (k: number): V => [
      (positions[at + k] ?? 0) - origin[0],
      (positions[at + k + 1] ?? 0) - origin[1],
      (positions[at + k + 2] ?? 0) - origin[2],
    ]
    const n = (at / 9) * 3
    triangles.push({
      a: corner(0),
      b: corner(3),
      c: corner(6),
      normal: [normals[n] ?? 0, normals[n + 1] ?? 0, normals[n + 2] ?? 0],
    })
  }
  return triangles
}

const pointsOf = (triangles: readonly Triangle[]): V[] =>
  triangles.flatMap(({ a, b, c }) => [a, b, c])

interface Flat {
  readonly x: number
  readonly y: number
}

/** A wall's edge, flattened across the tool, and which way is open air from it. */
interface Segment {
  readonly p: Flat
  readonly q: Flat
  readonly air: Flat
}

const flatten = (point: V, { u, v }: Frame): Flat => ({ x: dot(point, u), y: dot(point, v) })

/** The edges of the walls of a feature, flattened across the tool. */
const wallSegments = (triangles: readonly Triangle[], frame: Frame): Segment[] =>
  triangles
    .filter(({ normal }) => Math.abs(dot(normal, frame.w)) < WALL_NORMAL_ALONG)
    .flatMap(({ a, b, c, normal }): Segment[] => {
      const [fa, fb, fc] = [flatten(a, frame), flatten(b, frame), flatten(c, frame)]
      const air = flatten(normal, frame)
      return [
        { p: fa, q: fb, air },
        { p: fb, q: fc, air },
        { p: fc, q: fa, air },
      ]
    })

/** The point of a segment nearest a point. */
const nearestOn = ({ p, q }: Segment, at: Flat): Flat => {
  const dx = q.x - p.x
  const dy = q.y - p.y
  const length = dx * dx + dy * dy
  const t =
    length === 0 ? 0 : Math.min(1, Math.max(0, ((at.x - p.x) * dx + (at.y - p.y) * dy) / length))
  return { x: p.x + t * dx, y: p.y + t * dy }
}

interface Nearest {
  readonly point: Flat
  readonly distance: number
  /** Whether the point looked from stands on the open side of the wall: in the cut, not the stock. */
  readonly open: boolean
}

/** The point of the walls nearest a point, how far it is, and whether the point is in the open. */
const nearestWall = (segments: readonly Segment[], at: Flat): Nearest | null =>
  segments.reduce<Nearest | null>((best, segment) => {
    const point = nearestOn(segment, at)
    const distance = Math.hypot(point.x - at.x, point.y - at.y)
    if (best && distance >= best.distance) return best
    const open = (at.x - point.x) * segment.air.x + (at.y - point.y) * segment.air.y >= 0
    return { point, distance, open }
  }, null)

/**
 * Whether a frame puts the datasheet's discs where the mesh has them. A point —
 * a sharp corner — needs a vertex under it. A disc must stand in the cut, on
 * the open side of the wall nearest it, clear of every wall and, for one of
 * them at least, touch one: a disc may also be held by the edge of the stock,
 * which is no face of the feature's own.
 */
const fitsDiscs = (
  triangles: readonly Triangle[],
  frame: Frame,
  discs: readonly FrameDisc[],
): boolean => {
  const points = discs.filter((disc) => disc.diameter < POINT_DISC_MM)
  const wide = discs.filter((disc) => disc.diameter >= POINT_DISC_MM)
  if (points.length > 0) {
    const flat = pointsOf(triangles).map((point) => flatten(point, frame))
    const onCorners = points.every((disc) =>
      flat.some((point) => Math.hypot(point.x - disc.x, point.y - disc.y) <= ON_CORNER_MM),
    )
    if (!onCorners) return false
  }
  if (wide.length === 0) return points.length > 0
  const segments = wallSegments(triangles, frame)
  if (segments.length === 0) return false
  let touches = false
  for (const disc of wide) {
    const nearest = nearestWall(segments, disc)
    // A disc stands in the cut: one in the stock is the wrong frame, however near a wall it lands.
    if (!nearest || !nearest.open) return false
    const slack = ON_WALL_MM + ON_WALL_SHARE * disc.diameter
    const radius = disc.diameter / 2
    if (nearest.distance < radius - slack) return false
    if (nearest.distance <= radius + slack) touches = true
  }
  return touches
}

/** Where a frame puts a datasheet point, in the CAD file's coordinates, at `z` up the tool. */
const placeInFrame = ({ u, v, w }: Frame, x: number, y: number, z: number): V =>
  add(add(scale(u, x), scale(v, y)), scale(w, z))

const AXES: readonly V[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

/**
 * The frames that put the feature's faces between `zMin` and `zMax`, up the
 * direction or against it, with x turned by quarters about it and y either
 * side of x: sixteen at most. Not `strict`, every such frame, wherever the
 * faces fall.
 */
const candidateFrames = (
  points: readonly V[],
  zMin: number,
  zMax: number,
  direction: V,
  strict = true,
): Frame[] => {
  const along = unit(direction)
  const frames: Frame[] = []
  for (const sign of [1, -1]) {
    const w = scale(along, sign)
    const { low, high } = extent(points.map((point) => dot(point, w)))
    if (strict && (Math.abs(low - zMin) > ON_DEPTH_MM || Math.abs(high - zMax) > ON_DEPTH_MM)) {
      continue
    }
    // The world axis least along the tool, made square to it: a first x, then turned by quarters.
    const across = AXES.reduce((best, axis) =>
      Math.abs(dot(axis, w)) < Math.abs(dot(best, w)) ? axis : best,
    )
    const u0 = unit(add(across, scale(w, -dot(across, w))))
    const v0 = cross(w, u0)
    for (let quarter = 0; quarter < 4; quarter++) {
      const angle = (quarter * Math.PI) / 2
      const u = add(scale(u0, Math.cos(angle)), scale(v0, Math.sin(angle)))
      for (const hand of [1, -1]) frames.push({ u, v: scale(cross(w, u), hand), w })
    }
  }
  return frames
}

const distance = (a: V, b: V): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * The datasheet's tool frame: the one way of laying the axes that puts the
 * faces between `zMin` and `zMax` and the discs where the mesh has them. Two
 * ways that put every disc in the same place are one answer; two that
 * disagree, or none, and there is no frame.
 */
const exactFrame = (
  triangles: readonly Triangle[],
  discs: readonly FrameDisc[],
  zMin: number,
  zMax: number,
  direction: V,
): Frame | null => {
  const fits = candidateFrames(pointsOf(triangles), zMin, zMax, direction).filter((frame) =>
    fitsDiscs(triangles, frame, discs),
  )
  const [first] = fits
  if (!first) return null
  const placed = (frame: Frame): V[] =>
    discs.map((disc) => placeInFrame(frame, disc.x, disc.y, zMin))
  const firstPlaces = placed(first)
  const agree = fits.every((frame) =>
    placed(frame).every((at, index) => distance(at, firstPlaces[index] ?? at) <= SAME_PLACE_MM),
  )
  return agree ? first : null
}

/**
 * How far a frame is from putting the discs where the mesh has them: nothing
 * for one `fitsDiscs` takes, more the further off, and a great deal for a disc
 * standing in the stock.
 */
const discMiss = (
  triangles: readonly Triangle[],
  frame: Frame,
  discs: readonly FrameDisc[],
): number => {
  let miss = 0
  const points = discs.filter((disc) => disc.diameter < POINT_DISC_MM)
  if (points.length > 0) {
    const flat = pointsOf(triangles).map((point) => flatten(point, frame))
    for (const disc of points) {
      miss += extent(flat.map((point) => Math.hypot(point.x - disc.x, point.y - disc.y))).low
    }
  }
  const wide = discs.filter((disc) => disc.diameter >= POINT_DISC_MM)
  if (wide.length === 0) return miss
  const segments = wallSegments(triangles, frame)
  let touch = Infinity
  for (const disc of wide) {
    const radius = disc.diameter / 2
    const nearest = nearestWall(segments, disc)
    if (!nearest) return Infinity
    if (!nearest.open) miss += disc.diameter * 4
    miss += Math.max(0, radius - nearest.distance)
    touch = Math.min(touch, Math.abs(nearest.distance - radius))
  }
  return miss + touch
}

/** A frame for the discs, and what to add to a datasheet height to place it on the mesh. */
interface FoundFrame {
  readonly frame: Frame
  readonly lift: number
}

/**
 * The datasheet's tool frame where it can be found exactly; otherwise the
 * frame that comes nearest, so the discs are drawn somewhere sensible rather
 * than nowhere. With no frame putting the faces between `zMin` and `zMax`, the
 * nearest is lifted to stand the feature's floor at `zMin`.
 */
const bestFrame = (
  triangles: readonly Triangle[],
  discs: readonly FrameDisc[],
  zMin: number,
  zMax: number,
  direction: V,
): FoundFrame | null => {
  if (triangles.length === 0 || discs.length === 0) return null
  const exact = exactFrame(triangles, discs, zMin, zMax, direction)
  if (exact) return { frame: exact, lift: 0 }
  const points = pointsOf(triangles)
  const fitting = candidateFrames(points, zMin, zMax, direction)
  const frames =
    fitting.length > 0 ? fitting : candidateFrames(points, zMin, zMax, direction, false)
  const best = frames.reduce<{ frame: Frame; miss: number } | null>((was, frame) => {
    const miss = discMiss(triangles, frame, discs)
    return !was || miss < was.miss ? { frame, miss } : was
  }, null)
  if (!best) return null
  const { low } = extent(points.map((point) => dot(point, best.frame.w)))
  return { frame: best.frame, lift: fitting.length > 0 ? 0 : low - zMin }
}

/** The widest tool a feature admits, placed on the part: what to draw, in the drawn coordinates. */
export interface PlacedTool {
  /** The centre of the tool's bottom, on the feature's floor. */
  readonly base: Vec3
  /** Up the tool. */
  readonly axis: Vec3
  readonly diameter: number
  readonly height: number
  /** The radius on its corner: a filleted floor's, no more than the tool's own radius. */
  readonly cornerRadius: number
  /** Across the tool, toward where it touches the wall. */
  readonly across: Vec3
}

const asVec = ([x, y, z]: V): Vec3 => ({ x, y, z })

/**
 * The widest tool a feature admits, standing on its tightest pinch disc, ready
 * to draw: the datasheet's frame found against the feature's faces, the disc
 * placed in it, and the tool turned toward the wall that pinches it.
 *
 * `origin` is where the CAD file's own zero sits in the coordinates the part
 * is drawn in — moved by whatever centred it — since a datasheet is in the
 * file's coordinates and the triangles and the answer are in the drawn ones.
 * Null for a feature with no faces or no discs.
 */
export const placePinchTool = (
  mark: PinchMark,
  triangles: FaceTriangles,
  direction: Vec3,
  origin: Vec3 = { x: 0, y: 0, z: 0 },
): PlacedTool | null => {
  const shift: V = [origin.x, origin.y, origin.z]
  const faces = readTriangles(triangles, shift)
  const found = bestFrame(faces, mark.discs, mark.zMin, mark.zMax, [
    direction.x,
    direction.y,
    direction.z,
  ])
  const disc = mark.discs.reduce<FrameDisc | null>(
    (tightest, each) => (!tightest || each.diameter < tightest.diameter ? each : tightest),
    null,
  )
  if (!found || !disc) return null
  const { frame, lift } = found
  const radius = disc.diameter / 2
  const base = add(placeInFrame(frame, disc.x, disc.y, mark.zMin + lift), shift)
  // Across the disc the way it is pinched: from its centre, to where it touches the wall.
  const contact = nearestWall(wallSegments(faces, frame), disc)?.point
  const toward = contact ? { x: contact.x - disc.x, y: contact.y - disc.y } : { x: 1, y: 0 }
  const length = Math.hypot(toward.x, toward.y)
  const across = add(
    scale(frame.u, length > 1e-9 ? toward.x / length : 1),
    scale(frame.v, length > 1e-9 ? toward.y / length : 0),
  )
  return {
    base: asVec(base),
    axis: asVec(frame.w),
    diameter: disc.diameter,
    height: Math.max(mark.zMax - mark.zMin, MIN_HEIGHT_MM),
    cornerRadius: Math.min(Math.max(mark.corner ?? 0, 0), radius),
    across: asVec(across),
  }
}
