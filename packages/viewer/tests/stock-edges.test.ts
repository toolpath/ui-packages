import {
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  LineSegments,
  PlaneGeometry,
  SphereGeometry,
  TorusKnotGeometry,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createStock } from '../src/render/stock.js'
import {
  SYNC_EDGE_TRIANGLES,
  buildStockEdges,
  stockEdgePositions,
  triangleCount,
} from '../src/render/stock-edges.js'

const threeEdges = (geometry: BufferGeometry, angle = 15) =>
  Array.from(new EdgesGeometry(geometry, angle).getAttribute('position').array)

/** A sphere with every vertex nudged, so the walk meets many near-threshold angles. */
const jittered = () => {
  const geometry = new SphereGeometry(10, 48, 32).toNonIndexed()
  const position = geometry.getAttribute('position')
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.2
  for (let i = 0; i < position.count; i += 1) {
    position.setXYZ(i, position.getX(i) + random(), position.getY(i) + random(), position.getZ(i))
  }
  return geometry
}

/** Enough triangles to take the sliced path. */
const large = () => new TorusKnotGeometry(10, 3, 400, 40)

const settle = (cancelled = false) =>
  new Promise<void>((resolve) => setTimeout(resolve, cancelled ? 50 : 0))

const waitFor = async (done: () => boolean) => {
  for (let turn = 0; turn < 2000 && !done(); turn += 1) await settle()
}

describe('stockEdgePositions', () => {
  it.each([
    ['an indexed box', () => new BoxGeometry(30, 40, 50)],
    ['an indexed sphere', () => new SphereGeometry(10, 24, 16)],
    ['a non-indexed sphere', () => new SphereGeometry(10, 24, 16).toNonIndexed()],
    ['a jittered mesh', jittered],
    ['an open plane', () => new PlaneGeometry(10, 10, 8, 8)],
    ['a torus knot', large],
    // The torus knot's two full comparisons take about 0.4 s alone, and past Vitest's 5 s default
    // on a CI runner that runs every workspace's tests at once.
  ])('draws exactly the lines EdgesGeometry draws on %s', { timeout: 30_000 }, (_name, make) => {
    const geometry = make()
    expect(Array.from(stockEdgePositions(geometry))).toEqual(threeEdges(geometry))
    expect(Array.from(stockEdgePositions(geometry, 1))).toEqual(threeEdges(geometry, 1))
  })

  it('skips degenerate triangles as EdgesGeometry does', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )
    expect(Array.from(stockEdgePositions(geometry))).toEqual(threeEdges(geometry))
  })
})

describe('buildStockEdges', () => {
  it('builds the same outline in slices, after the current turn', async () => {
    const geometry = large()
    expect(triangleCount(geometry)).toBeGreaterThan(SYNC_EDGE_TRIANGLES)
    let positions: Float32Array | null = null
    buildStockEdges(geometry, (built) => {
      positions = built
    })
    expect(positions).toBeNull()
    await waitFor(() => positions !== null)
    expect(Array.from(positions!)).toEqual(threeEdges(geometry))
  })

  it('never answers once cancelled', async () => {
    const onDone = vi.fn()
    const cancel = buildStockEdges(large(), onDone)
    await settle()
    cancel()
    await settle(true)
    await settle(true)
    expect(onDone).not.toHaveBeenCalled()
  })
})

describe('createStock outlines', () => {
  it('adds a large mesh’s outline once built, and says so', async () => {
    const onEdges = vi.fn()
    const geometry = large()
    const stock = createStock(geometry, true, onEdges)
    stock.showEdges(true)
    const outline = () => stock.object.children.find((child) => child instanceof LineSegments)
    expect(outline()).toBeUndefined()
    await waitFor(() => onEdges.mock.calls.length > 0)
    expect(onEdges).toHaveBeenCalledOnce()
    const edges = outline() as LineSegments
    expect(edges.renderOrder).toBe(1)
    expect(edges.visible).toBe(true)
    expect(Array.from(edges.geometry.getAttribute('position').array)).toEqual(threeEdges(geometry))
  })

  it('keeps an outline hidden when it lands after being hidden', async () => {
    const onEdges = vi.fn()
    const stock = createStock(large(), false, onEdges)
    stock.showEdges(true)
    stock.showEdges(false)
    await waitFor(() => onEdges.mock.calls.length > 0)
    const edges = stock.object.children.find((child) => child instanceof LineSegments)!
    expect(edges.visible).toBe(false)
  })

  it('stops building when disposed', async () => {
    const onEdges = vi.fn()
    const stock = createStock(large(), false, onEdges)
    stock.showEdges(true)
    stock.dispose()
    await settle(true)
    await settle(true)
    expect(onEdges).not.toHaveBeenCalled()
    expect(stock.object.children.some((child) => child instanceof LineSegments)).toBe(false)
  })
})
