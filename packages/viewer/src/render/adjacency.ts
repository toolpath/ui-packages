import type { BufferGeometry } from 'three'
import type { PartModel } from '../model/types.js'

/**
 * Which faces touch which, from the mesh itself.
 *
 * Two regions are adjacent when they **share an edge** — two triangles, one in
 * each, with two vertices in common. That is what "next to each other" means on
 * a solid, and it is the only place the answer exists: a region carries a shape
 * kind, an area and a triangle range, and nothing about its neighbours.
 *
 * Consumers need it to answer questions the Engine's own readings cannot. "Are
 * these twelve faces one continuous piece" is one: a shop drawing an operation
 * over a top face and the eleven fillets around it is drawing something real,
 * and no single reported reading covers that set — so co-membership in a
 * reading, which is the obvious stand-in, calls them two pieces and refuses.
 *
 * ## How it is built
 *
 * Vertices are keyed by **position**, not by index. A non-indexed mesh repeats
 * a shared corner once per triangle, so two triangles that meet along an edge
 * have four distinct indices for two distinct points, and an index-based key
 * finds no edges at all.
 *
 * Positions are quantised before keying. Two faces meeting at a seam are
 * separate surfaces tessellated separately, and their corners agree to within
 * floating-point noise rather than exactly.
 */

/** How finely positions are matched, in model units. A micron either way. */
const GRID = 1e-4

const keyFor = (x: number, y: number, z: number): string =>
  `${Math.round(x / GRID)},${Math.round(y / GRID)},${Math.round(z / GRID)}`

/**
 * Every face's neighbours, keyed by region index.
 *
 * One pass over the triangles: each contributes three edges, each edge names
 * the region that owns it, and any edge named by two regions joins them.
 */
export function regionAdjacency(
  model: PartModel,
  geometry: BufferGeometry,
): Map<number, Set<number>> {
  const position = geometry.getAttribute('position')
  const adjacency = new Map<number, Set<number>>()
  if (!position) return adjacency

  /** Which region owns each triangle, so an edge can name one. */
  const owner = new Int32Array(Math.floor(position.count / 3)).fill(-1)
  for (const region of model.regions) {
    for (let at = region.triangles.start; at < region.triangles.end; at++) {
      if (at >= 0 && at < owner.length) owner[at] = region.idx
    }
  }

  /** The first region seen on each edge; the second one closes the pair. */
  const edges = new Map<string, number>()

  const join = (a: number, b: number) => {
    if (a === b) return
    const mine = adjacency.get(a) ?? new Set<number>()
    mine.add(b)
    adjacency.set(a, mine)
    const theirs = adjacency.get(b) ?? new Set<number>()
    theirs.add(a)
    adjacency.set(b, theirs)
  }

  for (let triangle = 0; triangle < owner.length; triangle++) {
    const region = owner[triangle]!
    if (region === -1) continue

    const corners = [0, 1, 2].map((corner) => {
      const at = triangle * 3 + corner
      return keyFor(position.getX(at), position.getY(at), position.getZ(at))
    })

    for (let corner = 0; corner < 3; corner++) {
      const from = corners[corner]!
      const to = corners[(corner + 1) % 3]!
      // Undirected: the two triangles meeting here walk the edge in opposite
      // directions, so the key has to read the same either way round.
      const edge = from < to ? `${from}|${to}` : `${to}|${from}`

      const seen = edges.get(edge)
      if (seen === undefined) edges.set(edge, region)
      else join(seen, region)
    }
  }

  return adjacency
}
