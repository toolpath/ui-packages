import { type Plane, type Ray, Vector3 } from 'three'

/**
 * A cut part, re-sampled for measuring.
 *
 * A clipping plane hides half of a part without changing a triangle, so the
 * mesh and its edges still describe the whole thing — and a tool that snaps
 * to them would offer corners nobody can see, and nothing at all on the cut.
 * This is what the measure tool works against instead: the part's edges
 * trimmed to the half that is left, the outline where the plane passes
 * through solid material, and a test for whether a point on the plane is on
 * the capped face. It is rebuilt whenever the plane moves; see
 * `measure-tool.tsx`.
 *
 * Everything here is in one space — the mesh's own — and the plane is
 * expected in it too. Six floats per segment throughout, the layout
 * `regionEdgesGeometry` uses.
 */
export interface SectionSample {
  /** The edges of the part on the kept side, plus the cut's outline. */
  readonly edges: Float32Array
  /** The cut's outline alone: where the plane crosses solid material. */
  readonly contour: Float32Array
}

/** Distances this close to the plane count as on it. */
const ON_PLANE = 1e-7

/** Endpoints this close are one point, when the outline is stitched. */
const STITCH = 1e-5

/** Directions this nearly parallel are one straight run. */
const COLLINEAR = 1e-6

/**
 * Trims segments to the half-space a plane keeps.
 *
 * A segment wholly on the removed side goes; one that crosses is cut at the
 * plane and its kept part stays. `Plane` keeps the side its normal points
 * into — where the signed distance is positive — as the part's own clipping
 * does.
 */
export function clipSegments(positions: ArrayLike<number>, plane: Plane): Float32Array {
  const out: number[] = []
  const a = new Vector3()
  const b = new Vector3()
  const count = Math.floor(positions.length / 6)
  for (let i = 0; i < count; i += 1) {
    a.set(positions[i * 6]!, positions[i * 6 + 1]!, positions[i * 6 + 2]!)
    b.set(positions[i * 6 + 3]!, positions[i * 6 + 4]!, positions[i * 6 + 5]!)
    const da = plane.distanceToPoint(a)
    const db = plane.distanceToPoint(b)
    if (da < -ON_PLANE && db < -ON_PLANE) continue
    if (da < -ON_PLANE) a.lerp(b, da / (da - db))
    else if (db < -ON_PLANE) b.lerp(a, db / (db - da))
    out.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  return Float32Array.from(out)
}

/**
 * Where a plane passes through a mesh: one segment per triangle it crosses,
 * then straight runs inside one region stitched into one segment each.
 *
 * The stitching is what makes the outline snappable. A flat face is two
 * triangles or two hundred, and the plane crosses each of them separately,
 * so before stitching every triangle boundary on the face was a corner the
 * pointer would snap to. After it, a corner is where the outline turns —
 * where the plane leaves one surface for the next — and on a curved surface
 * the facets stay, as they do in the part's own edges.
 *
 * `regionOf` says which surface each triangle belongs to, indexed by
 * triangle; without it every triangle is one surface, which stitches a
 * straight run across a fold only if the fold is perfectly flat, which it is
 * not.
 */
export function sectionContour(
  positions: ArrayLike<number>,
  regionOf: ArrayLike<number> | null,
  plane: Plane,
): Float32Array {
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const p = new Vector3()
  const q = new Vector3()

  /** Per region, the raw crossing segments. */
  const byRegion = new Map<number, number[]>()
  const triangleCount = Math.floor(positions.length / 9)

  for (let t = 0; t < triangleCount; t += 1) {
    a.set(positions[t * 9]!, positions[t * 9 + 1]!, positions[t * 9 + 2]!)
    b.set(positions[t * 9 + 3]!, positions[t * 9 + 4]!, positions[t * 9 + 5]!)
    c.set(positions[t * 9 + 6]!, positions[t * 9 + 7]!, positions[t * 9 + 8]!)
    const crossings = triangleCrossings(a, b, c, plane, p, q)
    if (!crossings) continue
    const region = regionOf ? (regionOf[t] ?? 0) : 0
    const list = byRegion.get(region)
    const entry = [p.x, p.y, p.z, q.x, q.y, q.z]
    if (list) list.push(...entry)
    else byRegion.set(region, entry)
  }

  const out: number[] = []
  for (const segments of byRegion.values()) stitch(segments, out)
  return Float32Array.from(out)
}

/**
 * The two points where a plane crosses a triangle's edges, or `null` when
 * it does not cross. A vertex on the plane counts as on the kept side, so a
 * triangle touching the plane at a corner is not a crossing, and one lying in
 * it produces nothing — the cap covers it.
 */
function triangleCrossings(
  a: Vector3,
  b: Vector3,
  c: Vector3,
  plane: Plane,
  p: Vector3,
  q: Vector3,
): boolean {
  const da = plane.distanceToPoint(a)
  const db = plane.distanceToPoint(b)
  const dc = plane.distanceToPoint(c)
  const sa = da < -ON_PLANE
  const sb = db < -ON_PLANE
  const sc = dc < -ON_PLANE
  if (sa === sb && sb === sc) return false

  const found: Vector3[] = []
  const edge = (u: Vector3, v: Vector3, du: number, dv: number, su: boolean, sv: boolean) => {
    if (su === sv) return
    found.push(u.clone().lerp(v, du / (du - dv)))
  }
  edge(a, b, da, db, sa, sb)
  edge(b, c, db, dc, sb, sc)
  edge(c, a, dc, da, sc, sa)
  if (found.length < 2) return false
  p.copy(found[0]!)
  q.copy(found[1]!)
  return p.distanceToSquared(q) > ON_PLANE * ON_PLANE
}

/**
 * Joins segments that meet end to end in a straight line, appending the
 * result to `out`. Six floats per segment in and out.
 */
function stitch(segments: number[], out: number[]): void {
  const count = segments.length / 6
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x / STITCH)},${Math.round(y / STITCH)},${Math.round(z / STITCH)}`
  /** Endpoint → the segments that end there, as `index * 2 + end`. */
  const ends = new Map<string, number[]>()
  for (let i = 0; i < count; i += 1) {
    for (const end of [0, 1]) {
      const o = i * 6 + end * 3
      const k = key(segments[o]!, segments[o + 1]!, segments[o + 2]!)
      const list = ends.get(k)
      if (list) list.push(i * 2 + end)
      else ends.set(k, [i * 2 + end])
    }
  }

  const point = (i: number, end: number, into: Vector3) => {
    const o = i * 6 + end * 3
    return into.set(segments[o]!, segments[o + 1]!, segments[o + 2]!)
  }
  const direction = (i: number, into: Vector3) => {
    const s = new Vector3()
    const e = new Vector3()
    point(i, 0, s)
    point(i, 1, e)
    return into.subVectors(e, s).normalize()
  }

  const consumed = new Uint8Array(count)
  const d = new Vector3()
  const n = new Vector3()

  /** The one other segment continuing straight on from `i`'s `end`, or -1. */
  const next = (i: number, end: number): { index: number; end: number } | null => {
    const at = point(i, end, new Vector3())
    const list = ends.get(key(at.x, at.y, at.z)) ?? []
    if (list.length !== 2) return null
    const other = list.find((entry) => entry >> 1 !== i)
    if (other === undefined) return null
    const j = other >> 1
    if (consumed[j]) return null
    direction(i, d)
    direction(j, n)
    if (Math.abs(Math.abs(d.dot(n)) - 1) > COLLINEAR) return null
    return { index: j, end: other & 1 }
  }

  for (let i = 0; i < count; i += 1) {
    if (consumed[i]) continue
    consumed[i] = 1
    // Walk each way to the end of the straight run.
    const walk = (end: number) => {
      let at = { index: i, end }
      let steps = 0
      for (;;) {
        const step = next(at.index, at.end)
        if (!step || steps > count) break
        consumed[step.index] = 1
        at = { index: step.index, end: 1 - step.end }
        steps += 1
      }
      return at
    }
    const back = walk(0)
    const forward = walk(1)
    const s = point(back.index, back.end, new Vector3())
    const e = point(forward.index, forward.end, new Vector3())
    out.push(s.x, s.y, s.z, e.x, e.y, e.z)
  }
}

/**
 * Whether a point on the plane lies inside the cut's outline — on the capped
 * face rather than in the air beside it.
 *
 * Even-odd against every outline segment, in the plane's own two axes, so a
 * part cut through a bore is inside the outer loop and outside the hole's.
 */
export function pointInContour(point: Vector3, plane: Plane, contour: ArrayLike<number>): boolean {
  const [u, v] = planeAxes(plane)
  const px = point.dot(u)
  const py = point.dot(v)
  const a = new Vector3()
  const b = new Vector3()
  let inside = false
  const count = Math.floor(contour.length / 6)
  for (let i = 0; i < count; i += 1) {
    a.set(contour[i * 6]!, contour[i * 6 + 1]!, contour[i * 6 + 2]!)
    b.set(contour[i * 6 + 3]!, contour[i * 6 + 4]!, contour[i * 6 + 5]!)
    const ax = a.dot(u)
    const ay = a.dot(v)
    const bx = b.dot(u)
    const by = b.dot(v)
    if (ay > py === by > py) continue
    const x = ax + ((py - ay) / (by - ay)) * (bx - ax)
    if (px < x) inside = !inside
  }
  return inside
}

/**
 * Where a ray meets the capped face, or `null` when it misses the cap — a
 * ray through the open half that lands beside the part, or one that reaches
 * the plane from behind.
 */
export function capHit(ray: Ray, plane: Plane, contour: ArrayLike<number>): Vector3 | null {
  const point = ray.intersectPlane(plane, new Vector3())
  if (!point) return null
  return pointInContour(point, plane, contour) ? point : null
}

/** Two unit axes in a plane, for reading its points as 2D. */
function planeAxes(plane: Plane): [Vector3, Vector3] {
  const n = plane.normal
  const seed = Math.abs(n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  const u = new Vector3().crossVectors(n, seed).normalize()
  const v = new Vector3().crossVectors(n, u).normalize()
  return [u, v]
}

/** The edges and outline of a part cut by `plane`, everything in the mesh's own space. */
export function sampleSection(
  meshPositions: ArrayLike<number>,
  regionOf: ArrayLike<number> | null,
  edgePositions: ArrayLike<number> | null,
  plane: Plane,
): SectionSample {
  const contour = sectionContour(meshPositions, regionOf, plane)
  const kept = edgePositions ? clipSegments(edgePositions, plane) : new Float32Array()
  const edges = new Float32Array(kept.length + contour.length)
  edges.set(kept, 0)
  edges.set(contour, kept.length)
  return { edges, contour }
}
