import { describe, expect, it } from 'vitest'
import {
  featureAcross,
  featureProfile,
  isThroughType,
  peakStart,
  trimmedCurve,
  TAIL_MM,
} from '../../src/model/reach.js'

describe('trimmedCurve: the drawing stops half an inch past full height', () => {
  it('cuts off a long level tail, holding the height to the cut', () => {
    const curve = { offsets: [1, 5, 10, 50, 100], heights: [2, 10, 25, 25, 25] }
    expect(peakStart(curve)).toBe(5)
    expect(trimmedCurve(curve)).toEqual({
      curve: { offsets: [1, 5, 10, 5 + TAIL_MM], heights: [2, 10, 25, 25] },
      cut: true,
    })
  })

  it('does not follow a hair of a rise far out', () => {
    const curve = { offsets: [1, 5, 10, 100, 130], heights: [2, 10, 25.4, 25.41, 25.41] }
    expect(peakStart(curve)).toBe(5)
    expect(trimmedCurve(curve).curve.offsets[3]).toBe(5 + TAIL_MM)
  })

  it('leaves a curve whole that keeps rising nearly to its end', () => {
    const curve = { offsets: [1, 5, 10], heights: [2, 10, 25] }
    expect(trimmedCurve(curve)).toEqual({ curve, cut: false })
  })
})

describe('featureAcross: the feature drawn to its own width', () => {
  it('takes a hole by its diameter, over any clearance', () => {
    expect(featureAcross({ diameter: 10.8, pinchDiameter: 4 })).toEqual({
      width: 10.8,
      kind: 'diameter',
    })
  })

  it('takes a milled feature by its tightest clearance', () => {
    expect(featureAcross({ kind: 'Pocket', pinchDiameter: 6.35 })).toEqual({
      width: 6.35,
      kind: 'clearance',
    })
  })

  it('has nothing to go on for a sharp corner or a surface', () => {
    expect(featureAcross({ kind: 'Pocket', cornerRadius: 0 })).toBeNull()
    expect(featureAcross(undefined)).toBeNull()
  })
})

describe('featureProfile: what the section draws of the feature', () => {
  it('reads its depth from its own bottom to its top', () => {
    expect(featureProfile({ zMin: 2, zMax: 14.5, diameter: 6 }, 'blind_hole')).toEqual({
      across: { width: 6, kind: 'diameter' },
      depth: 12.5,
      through: false,
    })
  })

  it('knows a through feature by its type', () => {
    expect(featureProfile({ zMin: 0, zMax: 10 }, 'threaded_through_hole').through).toBe(true)
    expect(isThroughType('through_pocket')).toBe(true)
    expect(isThroughType('Through_Hole')).toBe(true)
    expect(isThroughType('blind_hole')).toBe(false)
    expect(isThroughType('breakthrough_slot')).toBe(false)
  })

  it('has no depth without both ends', () => {
    expect(featureProfile({ zMax: 10 }, 'pocket').depth).toBeNull()
    expect(featureProfile(undefined, 'pocket')).toEqual({
      across: null,
      depth: null,
      through: false,
    })
  })
})
