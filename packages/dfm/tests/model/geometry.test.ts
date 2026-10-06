import { describe, expect, it } from 'vitest'
import type { PartFeature } from '@toolpath/api'
import type { FeatureSheets } from '../../src/model/feature-sheet.js'
import {
  dfmFeatures,
  featureLd,
  featureTypeLabel,
  isDrilled,
  partTop,
  type DfmFeature,
} from '../../src/model/geometry.js'

const UP = { x: 0, y: 0, z: 1 }
const SIDE = { x: 1, y: 0, z: 0 }

const feature = (tag: string, over: Partial<DfmFeature> = {}): DfmFeature => ({
  tag,
  featureType: 'pocket',
  machiningDirection: UP,
  regionIdxs: [0],
  number: 0,
  ...over,
})

describe('dfmFeatures: the report cut down and numbered', () => {
  it('numbers a direction at a time, in the order the report first gives them', () => {
    // Typed as the SDK's own `PartFeature`, so `pnpm check-types` fails here if
    // the report's type stops fitting `ReportFeature`.
    const report = [
      { featureTag: 'A', featureType: 'pocket', machiningDirection: UP, regionIdxs: [0] },
      { featureTag: 'B', featureType: 'wall', machiningDirection: SIDE, regionIdxs: [1] },
      { featureTag: 'C', featureType: 'pocket', machiningDirection: UP, regionIdxs: [2] },
    ] as unknown as PartFeature[]
    expect(dfmFeatures(report).map(({ tag, number }) => `${tag}${number}`)).toEqual([
      'A1',
      'B3',
      'C2',
    ])
  })

  it('labels a snake-case type in plain words', () => {
    expect(featureTypeLabel('through_hole')).toBe('Through hole')
    expect(featureTypeLabel('undercut_filleted_tslot')).toBe('Undercut filleted tslot')
  })
})

describe('partTop: the top of the part along one direction', () => {
  it('is the highest extendedZMax of the features cut that way, and null with none', () => {
    const features = [feature('a'), feature('b', { machiningDirection: SIDE }), feature('c')]
    const sheets: FeatureSheets = {
      a: { extendedZMax: 10 },
      b: { extendedZMax: 99 },
      c: { extendedZMax: 12 },
    }
    expect(partTop(features, sheets, UP)).toBe(12)
    expect(partTop(features, sheets, SIDE)).toBe(99)
    expect(partTop(features, sheets, { x: 0, y: 1, z: 0 })).toBeNull()
    expect(partTop(features, {}, UP)).toBeNull()
  })
})

describe('isDrilled: a bore with a point at the bottom', () => {
  it('needs a bore, and a tip that is not flat', () => {
    expect(isDrilled({ diameter: 5, tipAngle: 118 })).toBe(true)
    expect(isDrilled({ diameter: 5 })).toBe(true)
    expect(isDrilled({ diameter: 5, tipAngle: 180 })).toBe(false)
    expect(isDrilled({ diameter: 5, tipAngle: 179.6 })).toBe(false)
    expect(isDrilled({ diameter: 0 })).toBe(false)
    expect(isDrilled(undefined)).toBe(false)
  })
})

describe('featureLd: how far the tool reaches over how wide it can be', () => {
  const deep = feature('deep')
  const features = [feature('top', { regionIdxs: [9] }), deep]
  // The part's top is 0; the deep feature sits 10 below it and is 20 deep itself.
  const base = { zMax: -10, zMin: -30, extendedZMax: -10 }

  it('takes a hole over its bore, drilled or not, and reports both ratios', () => {
    const sheets: FeatureSheets = {
      top: { extendedZMax: 0 },
      deep: { ...base, diameter: 5, tipAngle: 118 },
    }
    const ld = featureLd(features, deep, sheets)
    expect(ld).toMatchObject({ basis: 'bore', across: 5, drilling: true, atLeast: false })
    expect(ld?.ratio).toBeCloseTo(30 / 5)
    expect(ld?.featureRatio).toBeCloseTo(20 / 5)
    const flat: FeatureSheets = { ...sheets, deep: { ...base, diameter: 5, tipAngle: 180 } }
    expect(featureLd(features, deep, flat)?.drilling).toBe(false)
  })

  it('takes a milled feature over its pinch diameter, else twice its corner radius', () => {
    const pinched: FeatureSheets = {
      top: { extendedZMax: 0 },
      deep: { ...base, pinchDiameter: 6, cornerRadius: 3 },
    }
    expect(featureLd(features, deep, pinched)).toMatchObject({
      basis: 'pinch',
      across: 6,
      ratio: 5,
    })
    const radius: FeatureSheets = { top: { extendedZMax: 0 }, deep: { ...base, cornerRadius: 2 } }
    expect(featureLd(features, deep, radius)).toMatchObject({
      basis: 'radius',
      across: 4,
      ratio: 7.5,
    })
  })

  it('has no answer for a sharp corner with no pinch disc, or without a top or bottom', () => {
    const sharp: FeatureSheets = {
      top: { extendedZMax: 0 },
      deep: { ...base, cornerRadius: 0, sharpCorners: [] },
    }
    expect(featureLd(features, deep, sharp)).toBeNull()
    // With nothing standing higher in its direction, the feature's own top is the part's top.
    expect(featureLd(features, deep, { deep: { ...base, diameter: 5 } })).toMatchObject({
      ratio: 4,
    })
    expect(
      featureLd(features, deep, { top: { extendedZMax: 0 }, deep: { diameter: 5 } }),
    ).toBeNull()
  })

  it('is only a bound when the clearance was measured at one tolerance', () => {
    const sheets: FeatureSheets = {
      top: { extendedZMax: 0 },
      deep: { ...base, pinchDiameter: 6, cornerRadius: 3, cornerRadiusUnresolved: true },
    }
    expect(featureLd(features, deep, sheets)?.atLeast).toBe(true)
    const bore: FeatureSheets = {
      ...sheets,
      deep: { ...base, diameter: 5, cornerRadiusUnresolved: true },
    }
    expect(featureLd(features, deep, bore)?.atLeast).toBe(false)
  })

  it('leaves out the feature’s own ratio when it has no top of its own', () => {
    const sheets: FeatureSheets = { top: { extendedZMax: 0 }, deep: { zMin: -30, diameter: 5 } }
    const ld = featureLd(features, deep, sheets)
    expect(ld?.ratio).toBe(6)
    expect(ld?.featureRatio).toBeUndefined()
  })
})
