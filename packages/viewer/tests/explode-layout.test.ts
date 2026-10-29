import { Box3, Vector3, type BufferGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { parsePartGeometry } from '../src/engine/geometry.js'
import type { PartModel } from '../src/model/types.js'
import { EXPLODE_LIMITS, explodeFits, explodeLayout } from '../src/render/explode-layout.js'
import { cubeModel, loadMeshFixture } from './fixtures.js'

/** Where regions sit in the source mesh. */
const regionBounds = (model: PartModel, geometry: BufferGeometry, regions: Array<number>) => {
  const box = new Box3()
  const position = geometry.getAttribute('position')
  for (const region of regions) {
    const range = model.regionIndex.rangeForRegion(region)!
    for (let vertex = range.start * 3; vertex < range.end * 3; vertex += 1) {
      box.expandByPoint(new Vector3().fromBufferAttribute(position, vertex))
    }
  }
  return box
}

const source = async () => {
  const model = cubeModel()
  const geometry = await parsePartGeometry(loadMeshFixture('local-0.3.0-cube'), model.mesh)
  return { model, geometry }
}

describe('explodeLayout', () => {
  it('moves each piece clear of the part along its approach, in order and with its identity', async () => {
    const { model, geometry } = await source()
    const [top, bottom] = [...model.regions].map((region) => region.idx)
    const groups = explodeLayout(model, geometry, [
      {
        id: 'up',
        regionIdxs: [top!],
        direction: { x: 0, y: 0, z: 2 },
        color: 1,
        featureTags: ['a'],
      },
      { id: 'side', regionIdxs: [bottom!], direction: { x: 1, y: 0, z: 0 }, color: 2 },
    ])
    expect(groups.map((group) => group.id)).toEqual(['up', 'side'])
    const whole = regionBounds(
      model,
      geometry,
      model.regions.map((region) => region.idx),
    )
    const up = groups[0]!
    // Directions need not be unit length; the travel is along the unit approach.
    expect(up.offset.x).toBe(0)
    expect(up.offset.y).toBe(0)
    expect(regionBounds(model, geometry, [top!]).min.z + up.offset.z).toBeGreaterThan(whole.max.z)
    expect(up.direction).toEqual({ x: 0, y: 0, z: 2 })
    expect(up.featureTags).toEqual(['a'])
    expect(groups[1]!.featureTags).toBeUndefined()
    geometry.dispose()
  })

  it('stacks pieces that share surfaces and an approach, and leaves one with no approach in place', async () => {
    const { model, geometry } = await source()
    const region = model.regions[0]!.idx
    const up = { x: 0, y: 0, z: 1 }
    const [first, second, still] = explodeLayout(model, geometry, [
      { id: 'first', regionIdxs: [region], direction: up, color: 1 },
      { id: 'second', regionIdxs: [region], direction: up, color: 1 },
      { id: 'still', regionIdxs: [region], direction: null, color: 1 },
    ])
    const height = regionBounds(model, geometry, [region])
    expect(second!.offset.z + height.min.z).toBeGreaterThan(first!.offset.z + height.max.z)
    expect(still!.offset).toEqual({ x: 0, y: 0, z: 0 })
    expect(still!.direction).toBeNull()
    geometry.dispose()
  })

  it('drops regions the model lacks, and pieces left with none', async () => {
    const { model, geometry } = await source()
    const region = model.regions[0]!.idx
    const groups = explodeLayout(model, geometry, [
      { id: 'kept', regionIdxs: [region, 9999, region], direction: { x: 1, y: 0, z: 0 }, color: 1 },
      { id: 'empty', regionIdxs: [9999], direction: { x: 1, y: 0, z: 0 }, color: 1 },
    ])
    expect(groups.map((group) => [group.id, group.regionIdxs])).toEqual([['kept', [region]]])
    geometry.dispose()
  })
})

describe('explodeFits', () => {
  it('refuses layouts past the piece or copied-triangle limits', () => {
    const model = cubeModel()
    const region = model.regions[0]!.idx
    const group = (id: string, regionIdxs = [region]) => ({
      id,
      regionIdxs,
      offset: { x: 0, y: 0, z: 0 },
      color: 0,
    })
    const many = Array.from({ length: EXPLODE_LIMITS.groups + 1 }, (_, i) => group(`g${i}`))
    expect(explodeFits(model, many.slice(1))).toBe(true)
    expect(explodeFits(model, many)).toBe(false)
    const dense = {
      ...model,
      regionIndex: {
        ...model.regionIndex,
        rangeForRegion: () => ({ start: 0, end: EXPLODE_LIMITS.triangles + 1 }),
      },
    }
    expect(explodeFits(dense, [group('a')])).toBe(false)
    // A region repeated within one piece is copied once.
    expect(explodeFits(model, [group('a', [region, region])])).toBe(true)
  })
})
