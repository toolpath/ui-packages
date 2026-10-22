import {
  type BufferAttribute,
  type BufferGeometry,
  type InterleavedBufferAttribute,
  Vector3,
} from 'three'
import type { PartModel, TriangleRange } from '../model/types.js'

/**
 * Threads drawn into the bores they are cut in.
 *
 * The kernel cuts a modeled internal thread out of the body before it meshes
 * it, so a tapped hole arrives as a plain bore. A displacement map cannot put
 * the thread back: it moves vertices, and wants UVs and a dense mesh, where
 * the Engine's has neither — a small bore is a handful of 30° facets. So the
 * thread is drawn the way a bump map draws: the part's shader tilts each
 * pixel's normal along the bore's axis as a helix of the thread's pitch runs
 * past it, and the light falls as it would on the flanks of a real thread.
 * The silhouette stays round, which inside a bore nobody sees.
 *
 * What the shader needs per region is the bore's axis, a point on it, and the
 * pitch. The pitch comes from the caller; the axis and the point are fitted
 * here from the region's own triangles, so the drawing sits on the mesh
 * exactly and needs nothing from the report it does not already carry.
 */

/** One thread to draw, on the faces of the hole it is cut in. */
export interface ThreadMark {
  /** The regions of the threaded hole, as the report numbers them. */
  readonly regions: readonly number[]
  /** From one crest to the next, in mm. Negative for a left-hand thread. */
  readonly pitch: number
  /**
   * The thread's major diameter, in mm. A cylinder of the hole wider than
   * this — a counterbore — is not threaded, and is left plain.
   */
  readonly majorDiameter: number
}

export interface ThreadOptions {
  readonly threads: readonly ThreadMark[]
}

/** A bore's centreline and size, fitted from its facets. */
export interface FittedBore {
  /** A point on the axis, at the middle of the facets along it. */
  readonly origin: Vector3
  /** Unit length; which of its two ways is arbitrary. */
  readonly axis: Vector3
  /** Through the triangles' centres, so a little under the true radius. */
  readonly radius: number
}

/** Texture rows: `origin.xyz, pitch`, then `axis.xyz, 0`. */
export const THREAD_TEXTURE_ROWS = 2

// A cylinder's facet normals are all square to its axis; a cone's or a plane's
// are not. This is the slack for a facet normal across a coarse mesh.
const MAX_AXIAL_NORMAL = 0.2

// Facets this far apart in direction are enough to cross into an axis.
const MIN_AXIS_CROSS = 0.1

// Facet centres sit inside the true circle (cos 15° for a 30° facet), and a
// tap drill leaves the bore under the major diameter: both pass this slack.
const DIAMETER_SLACK = 1.1

type Positions = BufferAttribute | InterleavedBufferAttribute

interface Facet {
  readonly centre: Vector3
  readonly normal: Vector3
  readonly area: number
}

function facetsOf(position: Positions, ranges: readonly TriangleRange[]): Facet[] {
  const facets: Facet[] = []
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()

  for (const range of ranges) {
    for (let triangle = range.start; triangle < range.end; triangle += 1) {
      const first = triangle * 3
      if (first + 2 >= position.count) break

      a.fromBufferAttribute(position, first)
      b.fromBufferAttribute(position, first + 1)
      c.fromBufferAttribute(position, first + 2)
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a))
      const doubleArea = normal.length()
      if (doubleArea === 0) continue

      facets.push({
        centre: new Vector3().add(a).add(b).add(c).divideScalar(3),
        normal: normal.divideScalar(doubleArea),
        area: doubleArea / 2,
      })
    }
  }

  return facets
}

/** The direction square to every facet normal, or `null` where there is none. */
function axisOf(facets: readonly Facet[]): Vector3 | null {
  const first = facets[0]
  if (!first) return null

  // The facet turned furthest from the first gives the best-conditioned cross.
  let furthest = first
  for (const facet of facets) {
    if (Math.abs(facet.normal.dot(first.normal)) < Math.abs(furthest.normal.dot(first.normal))) {
      furthest = facet
    }
  }

  const axis = new Vector3().crossVectors(first.normal, furthest.normal)
  if (axis.length() < MIN_AXIS_CROSS) return null
  axis.normalize()

  const allSquare = facets.every((facet) => Math.abs(facet.normal.dot(axis)) <= MAX_AXIAL_NORMAL)
  return allSquare ? axis : null
}

/**
 * Fits a cylinder to the triangles of `ranges`: the axis is the direction
 * square to every facet normal, and the centre is the point closest, in the
 * least-squares sense, to every facet's normal line — each of which passes
 * through the axis. `null` for anything that is not one cylinder.
 */
export function fitBore(position: Positions, ranges: readonly TriangleRange[]): FittedBore | null {
  const facets = facetsOf(position, ranges)
  const axis = axisOf(facets)
  if (!axis) return null

  const u = new Vector3()
    .crossVectors(axis, Math.abs(axis.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0))
    .normalize()
  const v = new Vector3().crossVectors(axis, u)

  // Normal equations of Σ area · |(I − m mᵀ)(centre − q)|² in the plane square
  // to the axis, where q is a facet centre and m its normal, both in (u, v).
  let xx = 0
  let xy = 0
  let yy = 0
  let rx = 0
  let ry = 0
  let along = 0
  let total = 0
  for (const { centre, normal, area } of facets) {
    const mx = normal.dot(u)
    const my = normal.dot(v)
    const length = Math.hypot(mx, my)
    const nx = mx / length
    const ny = my / length
    const qx = centre.dot(u)
    const qy = centre.dot(v)
    const pxx = 1 - nx * nx
    const pxy = -nx * ny
    const pyy = 1 - ny * ny

    xx += area * pxx
    xy += area * pxy
    yy += area * pyy
    rx += area * (pxx * qx + pxy * qy)
    ry += area * (pxy * qx + pyy * qy)
    along += area * centre.dot(axis)
    total += area
  }

  const determinant = xx * yy - xy * xy
  if (Math.abs(determinant) < 1e-9 * total * total) return null

  const cx = (yy * rx - xy * ry) / determinant
  const cy = (xx * ry - xy * rx) / determinant

  let radius = 0
  for (const { centre, area } of facets) {
    radius += area * Math.hypot(centre.dot(u) - cx, centre.dot(v) - cy)
  }

  return {
    origin: new Vector3()
      .addScaledVector(u, cx)
      .addScaledVector(v, cy)
      .addScaledVector(axis, along / total),
    axis,
    radius: radius / total,
  }
}

/**
 * The regions of a mark the thread is drawn on: its cylinders no wider than
 * the thread, each fitted on its own to tell a cylinder from a cone or a floor.
 */
function threadedRanges(
  position: Positions,
  model: PartModel,
  mark: ThreadMark,
): { regions: number[]; ranges: TriangleRange[] } {
  const regions: number[] = []
  const ranges: TriangleRange[] = []

  for (const region of mark.regions) {
    const range = model.regionIndex.rangeForRegion(region)
    if (!range) continue

    const bore = fitBore(position, [range])
    if (!bore || bore.radius * 2 > mark.majorDiameter * DIAMETER_SLACK) continue

    regions.push(region)
    ranges.push(range)
  }

  return { regions, ranges }
}

/**
 * Fills the thread texture: for each threaded region's column, its bore's
 * origin and the pitch in row 0, and its axis in row 1. Every other column is
 * zero, which the shader reads as no thread. The regions of one mark share one
 * fit, so a bore split into two half cylinders draws one unbroken helix.
 */
export function writeThreadTexels(
  data: Float32Array,
  width: number,
  geometry: BufferGeometry,
  model: PartModel,
  texels: ReadonlyMap<number, number>,
  options: ThreadOptions | null,
): void {
  data.fill(0)
  if (!options) return

  const position = geometry.getAttribute('position')
  for (const mark of options.threads) {
    if (!Number.isFinite(mark.pitch) || mark.pitch === 0) continue

    const { regions, ranges } = threadedRanges(position, model, mark)
    const bore = fitBore(position, ranges)
    if (!bore) continue

    for (const region of regions) {
      const column = texels.get(region)
      if (column === undefined) continue

      const first = column * 4
      const second = (width + column) * 4
      data[first] = bore.origin.x
      data[first + 1] = bore.origin.y
      data[first + 2] = bore.origin.z
      data[first + 3] = mark.pitch
      data[second] = bore.axis.x
      data[second + 1] = bore.axis.y
      data[second + 2] = bore.axis.z
    }
  }
}

/** Equal for equal threads, so a caller may pass a fresh object every render. */
export function threadKey(options: ThreadOptions | null): string {
  if (!options) return ''
  return options.threads
    .map((mark) => `${mark.regions.join(',')}:${mark.pitch}:${mark.majorDiameter}`)
    .join('|')
}
