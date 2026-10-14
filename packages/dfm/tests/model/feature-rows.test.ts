import { describe, expect, it } from 'vitest'

import { featureRows, type FeatureRowsOptions } from '../../src/model/feature-rows.js'
import { featureSheet } from '../../src/model/feature-sheet.js'
import type { DfmFeature } from '../../src/model/geometry.js'

const UP = { x: 0, y: 0, z: 1 }
const SIDE = { x: 1, y: 0, z: 0 }
const ODD = { x: 0, y: 1, z: 0 }

let n = 0
const feature = (
  tag: string,
  featureType: string,
  regionIdxs: number[],
  machiningDirection = UP,
): DfmFeature => ({ tag, featureType, regionIdxs, machiningDirection, number: ++n })

// Stand-ins for the viewer's `directionIndexOf` and `featureTypeRank`.
const CANDIDATES = [UP, SIDE]
const directionOf = (d: { x: number; y: number; z: number }) =>
  CANDIDATES.findIndex((c) => c.x === d.x && c.y === d.y && c.z === d.z)
const RANK: Record<string, number> = {
  blind_hole: 0,
  through_hole: 0,
  pocket: 1,
  wall: 4,
  face: 4,
  profile: 5,
}
const typeRank = (type: string) => RANK[type] ?? 3

const base: FeatureRowsOptions = { directionOf, typeRank }
const AREAS: Record<number, number> = { 1: 100, 2: 400, 3: 50, 4: 10, 5: 900, 6: 30 }
const areaOf = (idx: number) => AREAS[idx] ?? 0

describe('feature rows', () => {
  const part = [
    feature('Pocket-1', 'pocket', [2, 1]),
    feature('Face-1', 'face', [1, 2]),
    feature('Face-2', 'face', [5]),
    feature('Hole-1', 'blind_hole', [3]),
    feature('Profile-1', 'profile', [1, 2, 3, 5]),
    feature('Wall-1', 'wall', [4], SIDE),
    feature('Face-3', 'face', [1, 2], SIDE),
    feature('Mystery-1', 'mystery', [6], ODD),
  ]

  it('makes one row of the readings of one set of faces, under the most specific', () => {
    const rows = featureRows(part, { ...base, direction: 0, areaOf })
    const pocket = rows.find((row) => row.tag === 'Pocket-1')
    expect(pocket?.tags).toEqual(['Pocket-1', 'Face-1'])
    expect(pocket?.label).toBe('Pocket')
    expect(pocket?.area).toBe(500)
    expect(rows.filter((row) => row.tags.includes('Face-1'))).toHaveLength(1)
  })

  it('keeps the same faces in another direction as a row of their own', () => {
    const rows = featureRows(part, base)
    expect(rows.find((row) => row.tags.includes('Face-3'))?.tag).toBe('Face-3')
  })

  it('leaves out a profile', () => {
    expect(featureRows(part, base).flatMap((row) => row.tags)).not.toContain('Profile-1')
  })

  it('sorts by type rank, then area, largest first', () => {
    const rows = featureRows(part, { ...base, direction: 0, areaOf })
    expect(rows.map((row) => row.tag)).toEqual(['Hole-1', 'Pocket-1', 'Face-2'])
  })

  it('lists every direction a direction at a time, off the candidates last', () => {
    const rows = featureRows(part, { ...base, areaOf })
    expect(rows.map((row) => [row.direction, row.tag])).toEqual([
      [0, 'Hole-1'],
      [0, 'Pocket-1'],
      [0, 'Face-2'],
      [1, 'Face-3'],
      [1, 'Wall-1'],
      [-1, 'Mystery-1'],
    ])
  })

  it('breaks a tie by tag, so the order is steady', () => {
    const rows = featureRows([feature('B', 'face', [1]), feature('A', 'face', [2])], base)
    expect(rows.map((row) => row.tag)).toEqual(['A', 'B'])
  })

  it('is empty for no features, and for a direction with none', () => {
    expect(featureRows([], base)).toEqual([])
    expect(featureRows(part, { ...base, direction: 7 })).toEqual([])
  })
})

describe('a row’s measurement', () => {
  const sheet = (raw: Record<string, unknown>) => featureSheet(raw)
  const one = (f: DfmFeature, options: Partial<FeatureRowsOptions>) =>
    featureRows([f], { ...base, ...options })[0]?.measure

  it('gives a hole its bore and depth, from the datasheet', () => {
    const sheets = {
      'hole-1': sheet({ zMin: -15, zMax: 0, facts: { kind: 'Hole', diameter: 10 } }),
      'hole-2': sheet({ zMin: -20, zMax: 0, facts: { kind: 'Hole', diameter: 6.35 } }),
    }
    expect(one(feature('Hole-1', 'blind_hole', [1]), { sheets })).toBe('⌀10 mm × 15 deep')
    expect(one(feature('Hole-2', 'through_hole', [1]), { sheets })).toBe('⌀6.35 mm × 20 through')
    expect(one(feature('Hole-2', 'through_hole', [1]), { sheets, units: 'inch' })).toBe(
      '⌀0.25 in × 0.787 through',
    )
  })

  it('gives a pocket its plan size from the mesh and its depth from the datasheet', () => {
    const sheets = { 'pocket-1': sheet({ zMin: -15, zMax: 0, facts: { kind: 'Pocket' } }) }
    const extentOf = () => ({ across: [40.0000002, 39.9999998] as const, along: 15 })
    expect(one(feature('Pocket-1', 'pocket', [1]), { sheets, extentOf })).toBe(
      '40 × 40 mm, 15 deep',
    )
    // No datasheet depth: the mesh's.
    expect(one(feature('Pocket-1', 'pocket', [1]), { extentOf })).toBe('40 × 40 mm, 15 deep')
    // No plan size: depth alone.
    expect(one(feature('Pocket-1', 'pocket', [1]), { sheets })).toBe('15 mm deep')
  })

  it('gives a face its plan size, and a wall its length and height', () => {
    const flat = () => ({ across: [30, 20] as const, along: 0 })
    expect(one(feature('Face-1', 'face', [1]), { extentOf: flat })).toBe('30 × 20 mm')
    const tall = () => ({ across: [50, 0] as const, along: 12 })
    expect(one(feature('Wall-1', 'wall', [1]), { extentOf: tall })).toBe('50 mm × 12 high')
    expect(
      one(feature('Wall-1', 'wall', [1]), {
        extentOf: () => ({ across: [0, 0] as const, along: 12 }),
      }),
    ).toBe('12 mm high')
  })

  it('is null when nothing was measured', () => {
    expect(one(feature('Face-1', 'face', [1]), {})).toBeNull()
    expect(one(feature('Wall-1', 'wall', [1]), { extentOf: () => null })).toBeNull()
  })
})
