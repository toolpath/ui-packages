import { type BufferGeometry, MathUtils, Triangle, Vector3 } from 'three'

/** The angle stock outlines are drawn at, as `EdgesGeometry(geometry, 15)`. */
const STOCK_EDGE_ANGLE = 15

/**
 * Up to this many triangles the outline is built at once, as it always was:
 * a figure or a small blank costs a few milliseconds. Above it the build runs
 * in slices between frames, because stock cut by a fine tool can hold hundreds
 * of thousands of triangles and the one-shot build froze the page for half a
 * second each time a new in-process stock was shown.
 */
export const SYNC_EDGE_TRIANGLES = 20_000

/** How long one slice of a sliced build may run before giving the page back. */
const SLICE_MS = 4
/** How many triangles, or remaining edges, between clock checks. */
const CHECK_EVERY = 256

const _v0 = new Vector3()
const _v1 = new Vector3()
const _normal = new Vector3()
const _triangle = new Triangle()

interface Unmatched {
  index0: number
  index1: number
  normal: Vector3
}

/**
 * Three's `EdgesGeometry` walk, step for step, as a generator that yields every
 * {@link CHECK_EVERY} triangles: the same quantised vertex keys, the same
 * pairing of an edge with its reverse, the same threshold and the same output
 * order, so the lines drawn are exactly the ones `EdgesGeometry` draws. The map
 * of unmatched edges is a `Map` rather than an object; both iterate in insertion
 * order for these keys, which never look like array indices.
 */
function* edgeWork(
  geometry: BufferGeometry,
  thresholdAngle: number,
): Generator<void, Float32Array, void> {
  const precision = Math.pow(10, 4)
  const thresholdDot = Math.cos(MathUtils.DEG2RAD * thresholdAngle)
  const indexAttr = geometry.getIndex()
  const positionAttr = geometry.getAttribute('position')
  const indexCount = indexAttr ? indexAttr.count : positionAttr.count
  const indexArr = [0, 0, 0]
  const corners = [_triangle.a, _triangle.b, _triangle.c] as const
  const hashes = ['', '', '']
  const edgeData = new Map<string, Unmatched | null>()
  const vertices: Array<number> = []
  const key = (v: Vector3) =>
    `${Math.round(v.x * precision)},${Math.round(v.y * precision)},${Math.round(v.z * precision)}`

  for (let i = 0, step = 0; i < indexCount; i += 3, step += 1) {
    if (step % CHECK_EVERY === 0 && step > 0) yield
    if (indexAttr) {
      indexArr[0] = indexAttr.getX(i)
      indexArr[1] = indexAttr.getX(i + 1)
      indexArr[2] = indexAttr.getX(i + 2)
    } else {
      indexArr[0] = i
      indexArr[1] = i + 1
      indexArr[2] = i + 2
    }
    _triangle.a.fromBufferAttribute(positionAttr, indexArr[0]!)
    _triangle.b.fromBufferAttribute(positionAttr, indexArr[1]!)
    _triangle.c.fromBufferAttribute(positionAttr, indexArr[2]!)
    _triangle.getNormal(_normal)
    hashes[0] = key(_triangle.a)
    hashes[1] = key(_triangle.b)
    hashes[2] = key(_triangle.c)
    // Degenerate triangles have no normal to compare.
    if (hashes[0] === hashes[1] || hashes[1] === hashes[2] || hashes[2] === hashes[0]) continue

    for (let j = 0; j < 3; j += 1) {
      const jNext = (j + 1) % 3
      const v0 = corners[j]!
      const v1 = corners[jNext]!
      const hash = `${hashes[j]}_${hashes[jNext]}`
      const reverse = edgeData.get(`${hashes[jNext]}_${hashes[j]}`)
      if (reverse) {
        // The sibling edge: drawn if the faces meet sharply enough, then done.
        if (_normal.dot(reverse.normal) <= thresholdDot) {
          vertices.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z)
        }
        edgeData.set(`${hashes[jNext]}_${hashes[j]}`, null)
      } else if (!edgeData.has(hash)) {
        edgeData.set(hash, {
          index0: indexArr[j]!,
          index1: indexArr[jNext]!,
          normal: _normal.clone(),
        })
      }
    }
  }

  // Edges with no sibling are open boundaries, and always drawn.
  let step = 0
  for (const edge of edgeData.values()) {
    step += 1
    if (step % CHECK_EVERY === 0) yield
    if (!edge) continue
    _v0.fromBufferAttribute(positionAttr, edge.index0)
    _v1.fromBufferAttribute(positionAttr, edge.index1)
    vertices.push(_v0.x, _v0.y, _v0.z, _v1.x, _v1.y, _v1.z)
  }
  return new Float32Array(vertices)
}

/** The outline's segment positions, built at once: what `EdgesGeometry` would hold. */
export function stockEdgePositions(
  geometry: BufferGeometry,
  thresholdAngle = STOCK_EDGE_ANGLE,
): Float32Array {
  const work = edgeWork(geometry, thresholdAngle)
  for (;;) {
    const next = work.next()
    if (next.done) return next.value
  }
}

/** The geometry's triangle count, indexed or not. */
export function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex()
  return Math.floor((index ? index.count : (geometry.getAttribute('position')?.count ?? 0)) / 3)
}

/**
 * The next turn of the event loop without the 4 ms clamp nested timeouts get:
 * a message to oneself, where the platform has channels.
 */
const nextTurn = (run: () => void): (() => void) => {
  if (typeof MessageChannel === 'undefined') {
    const timer = setTimeout(run, 0)
    return () => clearTimeout(timer)
  }
  const channel = new MessageChannel()
  let live = true
  channel.port1.onmessage = () => {
    channel.port1.close()
    if (live) run()
  }
  channel.port2.postMessage(null)
  return () => {
    live = false
    channel.port1.close()
  }
}

/**
 * Builds the outline in slices of {@link SLICE_MS}, handing the page back
 * between them, and calls `onDone` with the positions — the same ones
 * {@link stockEdgePositions} returns. The first slice runs on the next turn, not
 * now, so whatever showed the stock gets its frame first. Returns a cancel,
 * after which `onDone` is never called.
 */
export function buildStockEdges(
  geometry: BufferGeometry,
  onDone: (positions: Float32Array) => void,
  thresholdAngle = STOCK_EDGE_ANGLE,
): () => void {
  const work = edgeWork(geometry, thresholdAngle)
  let cancelTurn: () => void = () => {}
  let cancelled = false
  const slice = () => {
    const until = performance.now() + SLICE_MS
    for (;;) {
      const next = work.next()
      if (next.done) {
        onDone(next.value)
        return
      }
      if (performance.now() >= until) break
    }
    if (!cancelled) cancelTurn = nextTurn(slice)
  }
  cancelTurn = nextTurn(slice)
  return () => {
    cancelled = true
    cancelTurn()
  }
}
