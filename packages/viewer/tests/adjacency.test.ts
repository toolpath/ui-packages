import { describe, expect, it } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import { regionAdjacency } from '../src/render/adjacency.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

/**
 * The cube: six faces, each touching the four around it and never the one
 * opposite. Enough to catch every way this goes wrong — an empty map, a map
 * where everything touches everything, and one that misses the seams.
 */
describe('which faces touch which', () => {
  const load = async () => {
    const model = cubeModel()
    const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
    return { model, adjacency: regionAdjacency(model, geometry) }
  }

  it('joins every face to the four around it', async () => {
    const { model, adjacency } = await load()

    expect(model.regions).toHaveLength(6)
    for (const region of model.regions) {
      expect(adjacency.get(region.idx)?.size).toBe(4)
    }
  })

  it('never joins a face to the one opposite it', async () => {
    // They share no edge, and a proxy that said otherwise would let a feature
    // be drawn through the middle of the part.
    const { adjacency } = await load()
    const first = 0

    const neighbours = adjacency.get(first)!
    expect(neighbours.size).toBe(4)
    // Of the other five, exactly one is not a neighbour: the opposite face.
    expect([1, 2, 3, 4, 5].filter((idx) => !neighbours.has(idx))).toHaveLength(1)
  })

  it('never joins a face to itself', async () => {
    const { adjacency } = await load()

    for (const [idx, neighbours] of adjacency) expect(neighbours.has(idx)).toBe(false)
  })

  it('is symmetric, because touching is', async () => {
    const { adjacency } = await load()

    for (const [idx, neighbours] of adjacency) {
      for (const other of neighbours) expect(adjacency.get(other)?.has(idx)).toBe(true)
    }
  })
})
