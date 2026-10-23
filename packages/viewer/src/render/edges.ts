import { type BufferGeometry, BufferGeometry as Buffer, Float32BufferAttribute } from 'three'
import type { PartModel } from '../model/types.js'
import { visualSurfaces } from '../model/surfaces.js'

/**
 * The lines between regions, and nothing else.
 *
 * `EdgesGeometry` draws an edge wherever two facets meet at more than some
 * angle, which is a guess standing in for "is this a real edge". On a machined
 * part the guess is wrong in both directions: a small bore tessellated into
 * twelve facets has 30° between them and gets drawn as a nut, while a shallow
 * chamfer meeting a wall at 12° gets no line at all.
 *
 * The report already knows. A region is one analytic surface, so an edge inside
 * one is tessellation and an edge between two is a real boundary — the same
 * fact that makes region-aware shading possible, used for the other half of
 * what makes a part read as a part.
 *
 * With one qualification. The Engine splits a surface where that makes a better
 * machining plan, and those splits are boundaries between regions without being
 * edges of the part: a floor cut in two to be reached from two directions is
 * still one face to look at. So the walk is over *visual surfaces* — regions
 * grouped by the kernel's exact `splitOrigin` lineage — and a split leaves no
 * line. Nothing about picking or features goes through that grouping.
 *
 * The mesh must be non-indexed, which `parsePartGeometry` guarantees.
 */
export function regionEdgesGeometry(
  geometry: BufferGeometry,
  // Keep regionIndex accepted for existing object-literal callers; only regions
  // participate in outlining, so compact surface copies need no feature index.
  model: Pick<PartModel, 'regions'> & Partial<Pick<PartModel, 'regionIndex'>>,
): BufferGeometry {
  const position = geometry.getAttribute('position')
  const edges = new Buffer()
  // Always a well-formed geometry, empty or not: a LineSegments with no
  // position attribute at all throws when three tries to draw it.
  edges.setAttribute('position', new Float32BufferAttribute([], 3))
  if (!position || geometry.index) return edges

  const triangleCount = Math.floor(position.count / 3)

  // Triangle → the surface it is part of, so the walk below is a lookup rather
  // than a search through the region table for every facet.
  const surfaces = visualSurfaces(model.regions)
  const regionOf = new Int32Array(triangleCount).fill(-1)
  for (const region of model.regions) {
    const end = Math.min(region.triangles.end, triangleCount)
    for (let triangle = region.triangles.start; triangle < end; triangle += 1) {
      regionOf[triangle] = surfaces.get(region.idx) ?? region.idx
    }
  }

  /** An undirected edge, keyed on its two endpoints in a fixed order. */
  const seen = new Map<string, { region: number; a: number; b: number; shared: boolean }>()
  const key = (a: number, b: number): string => {
    const ax = position.getX(a)
    const ay = position.getY(a)
    const az = position.getZ(a)
    const bx = position.getX(b)
    const by = position.getY(b)
    const bz = position.getZ(b)
    // Endpoints sorted so the two triangles that share an edge agree on it.
    const first = ax < bx || (ax === bx && (ay < by || (ay === by && az <= bz)))
    return first ? `${ax},${ay},${az}|${bx},${by},${bz}` : `${bx},${by},${bz}|${ax},${ay},${az}`
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const region = regionOf[triangle] ?? -1
    const corners = [triangle * 3, triangle * 3 + 1, triangle * 3 + 2]

    for (let i = 0; i < 3; i += 1) {
      const a = corners[i]!
      const b = corners[(i + 1) % 3]!
      const id = key(a, b)
      const found = seen.get(id)

      if (!found) {
        seen.set(id, { region, a, b, shared: false })
        continue
      }
      // Met from both sides. Inside one surface it is tessellation or a split;
      // between two it is a boundary, and it stays.
      found.shared = found.region === region
    }
  }

  const points: number[] = []
  for (const edge of seen.values()) {
    if (edge.shared) continue
    points.push(
      position.getX(edge.a),
      position.getY(edge.a),
      position.getZ(edge.a),
      position.getX(edge.b),
      position.getY(edge.b),
      position.getZ(edge.b),
    )
  }

  edges.setAttribute('position', new Float32BufferAttribute(points, 3))
  return edges
}
