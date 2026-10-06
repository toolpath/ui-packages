import { describe, expect, it } from 'vitest'
import type { FeatureSheets } from '../../src/model/feature-sheet.js'
import type { DfmFeature } from '../../src/model/geometry.js'
import { featureRows, holeSize, sameDepth } from '../../src/model/hole-groups.js'

const UP = { x: 0, y: 0, z: 1 }
const SIDE = { x: 1, y: 0, z: 0 }

const hole = (tag: string, direction = UP): DfmFeature => ({
  tag,
  featureType: 'through_hole',
  machiningDirection: direction,
  regionIdxs: [0],
  number: 0,
})

const sheet = (diameter: number, depth: number) => ({
  kind: 'Hole',
  diameter,
  zMin: -depth,
  zMax: 0,
})

describe('one hole or the same hole', () => {
  it('needs a Hole with a bore and both z bounds to have a size', () => {
    expect(holeSize({ a: sheet(5, 20) }, 'A')).toEqual({ diameter: 5, depth: 20 })
    expect(holeSize({ a: { kind: 'Pocket', diameter: 5, zMin: -20, zMax: 0 } }, 'a')).toBeNull()
    expect(holeSize({ a: { kind: 'Hole', diameter: 5 } }, 'a')).toBeNull()
  })

  it('counts depths within a twentieth, or a hundredth of a millimetre, as one depth', () => {
    expect(sameDepth(20, 20.9)).toBe(true)
    expect(sameDepth(20, 21.1)).toBe(false)
    expect(sameDepth(0.1, 0.109)).toBe(true)
  })
})

describe('featureRows: identical holes as one row', () => {
  const features = [hole('a'), hole('b'), hole('c', SIDE), hole('d'), hole('e')]
  const sheets: FeatureSheets = {
    a: sheet(5, 20),
    b: sheet(5.0004, 20.5),
    c: sheet(5, 20),
    d: sheet(6, 20),
    e: sheet(5, 21.4),
  }

  it('groups the same bore, depth and direction, in the place of the first', () => {
    const rows = featureRows(['a', 'b', 'c', 'd', 'e'], features, sheets)
    expect(rows).toEqual([
      { kind: 'holes', key: 'a', tags: ['a', 'b', 'e'], diameter: 5 },
      { kind: 'feature', tag: 'c' },
      { kind: 'feature', tag: 'd' },
    ])
  })

  it('chains depths that creep a twentieth at a time, whatever the order', () => {
    // e (21.4) is within a twentieth of b (20.5) but not of a (20); the chain joins all three.
    const rows = featureRows(['e', 'a', 'b'], features, sheets)
    expect(rows).toEqual([{ kind: 'holes', key: 'e', tags: ['e', 'a', 'b'], diameter: 5 }])
  })

  it('leaves a lone hole, and anything the Engine did not measure, as a row of its own', () => {
    expect(featureRows(['a'], features, sheets)).toEqual([{ kind: 'feature', tag: 'a' }])
    expect(featureRows(['a', 'x'], features, sheets)).toEqual([
      { kind: 'feature', tag: 'a' },
      { kind: 'feature', tag: 'x' },
    ])
  })
})
