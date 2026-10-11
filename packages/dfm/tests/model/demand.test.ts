import { fitAgainst } from '@toolpath/tool-support'
import { describe, expect, it } from 'vitest'
import { featureDemand } from '../../src/model/demand.js'
import { featureSheet, type FeatureSheets } from '../../src/model/feature-sheet.js'
import type { DfmFeature } from '../../src/model/geometry.js'
import { readReachCurve } from '../../src/model/reach.js'

/**
 * Synthetic datasheets, shaped as the Engine sends them (API 1.12.1, the
 * `HoleFacts` and pocket facts the SDK types), read through `featureSheet`
 * exactly as an app's worker cuts them down.
 */
const tolerance = { atolIgnore: 0.01, atolDeviate: 0.02, atolMax: 0.05 }
const UP = { x: 0, y: 0, z: 1 }

const feature = (tag: string, featureType: string, over: Partial<DfmFeature> = {}): DfmFeature => ({
  tag,
  featureType,
  machiningDirection: UP,
  regionIdxs: [0],
  number: 0,
  ...over,
})

/** An ⌀8 blind hole, 118° point, 30 deep from a top at z = 0. */
const holeSheet = {
  zMin: -30,
  zMax: 0,
  extendedZMax: 0,
  hasWall: true,
  hasFloor: true,
  toleranceBand: tolerance,
  reachCurve: { horizontalOffset: [1, 5, 50], verticalOffset: [0, 2, 2] },
  facts: {
    kind: 'Hole',
    diameter: 8,
    fullConeDeg: 118,
    isCounterbore: false,
    maxDrillDiameter: 8.02,
    maxEndmillDiameter: 7.2,
    filletRadius: 0,
    filletHeight: 0,
    maxSpotDiameter: 8,
    cd: { ignore: { min: 8, max: 8 }, deviate: { min: 8, max: 8 } },
  },
}

/** A pocket 12 deep, with 3 mm inside corners and a 1 mm floor fillet, its top 5 under the part's. */
const pocketSheet = {
  zMin: -17,
  zMax: -5,
  extendedZMax: -5,
  hasWall: true,
  hasFloor: true,
  toleranceBand: tolerance,
  pinchPoints: [{ center: { x: 10, y: 10 }, diameter: 6.1 }],
  facts: {
    kind: 'Pocket',
    cd: { ignore: { min: 6.1, max: 40 }, deviate: { min: 6.2, max: 40 } },
    filletRadius: 1,
  },
}

/** The part's top face: it stands highest, and that is all it is here for. */
const faceSheet = { zMin: 0, zMax: 0, extendedZMax: 0, facts: { kind: 'Face' } }

describe('featureDemand: what a feature asks of a tool', () => {
  it('states a hole’s drill, end mill and bore limits apart, with its depth and reach', () => {
    const hole = feature('h1', 'blind_hole')
    const sheets: FeatureSheets = { h1: featureSheet(holeSheet) }
    const demand = featureDemand({
      features: [hole],
      feature: hole,
      sheets,
      reachCurve: readReachCurve(holeSheet),
    })
    expect(demand).toEqual({
      featureTag: 'h1',
      maxToolDiameter: 8,
      maxDrillDiameter: 8.02,
      maxEndmillDiameter: 7.2,
      holeDiameter: 8,
      depth: 30,
      reachBelowTop: 30,
      reachCurve: { horizontalOffset: [1, 5, 50], verticalOffset: [0, 2, 2] },
    })
    // A zero fillet is a sharp floor, not a 0 mm limit on the tool's corner.
    expect(demand).not.toHaveProperty('floorRadius')
  })

  it('bounds a drill by the bore and an end mill by what helixes in', () => {
    const hole = feature('h1', 'blind_hole')
    const demand = featureDemand({
      features: [hole],
      feature: hole,
      sheets: { h1: featureSheet(holeSheet) },
    })
    expect(fitAgainst({ form: 'drill', geometry: { DC: 8 } }, demand)).toEqual([])
    expect(fitAgainst({ form: 'flat end mill', geometry: { DC: 8 } }, demand)).toHaveLength(1)
  })

  it('reads a filleted pocket’s corner limit and floor fillet, its reach from the part’s top', () => {
    const top = feature('f1', 'face')
    const pocket = feature('p1', 'pocket')
    const sheets: FeatureSheets = {
      f1: featureSheet(faceSheet),
      p1: featureSheet(pocketSheet),
    }
    const demand = featureDemand({ features: [top, pocket], feature: pocket, sheets })
    expect(demand).toEqual({
      featureTag: 'p1',
      maxToolDiameter: 6.1,
      depth: 12,
      reachBelowTop: 17,
      floorRadius: 1,
    })
  })

  it('measures reach only from features cut the same way up', () => {
    const below = feature('f2', 'face', { machiningDirection: { x: 0, y: 0, z: -1 } })
    const pocket = feature('p1', 'pocket')
    const sheets: FeatureSheets = {
      f2: featureSheet({ ...faceSheet, extendedZMax: 40 }),
      p1: featureSheet(pocketSheet),
    }
    // Only the pocket itself stands this way up: its own top, 12 above its floor.
    expect(
      featureDemand({ features: [below, pocket], feature: pocket, sheets }).reachBelowTop,
    ).toBe(12)
  })

  it('leaves out what the datasheet does not state, rather than sending zeros', () => {
    const wall = feature('w1', 'wall')
    // As the Engine sends a wall with no corner to reach: a cutter band of nulls, no zMin.
    const sheets: FeatureSheets = {
      w1: featureSheet({
        hasWall: true,
        hasFloor: false,
        facts: { kind: 'Wall', cd: { ignore: { max: null, min: null } } },
      }),
    }
    expect(featureDemand({ features: [wall], feature: wall, sheets })).toEqual({ featureTag: 'w1' })
    // No sheet at all: the tag, and nothing claimed.
    expect(featureDemand({ features: [wall], feature: wall, sheets: {} })).toEqual({
      featureTag: 'w1',
    })
  })

  it('drops a zero corner limit rather than ruling out every tool', () => {
    const pocket = feature('p1', 'pocket')
    const sheets: FeatureSheets = {
      p1: featureSheet({
        ...pocketSheet,
        facts: { ...pocketSheet.facts, cd: { ignore: { min: 0, max: 40 } } },
      }),
    }
    expect(featureDemand({ features: [pocket], feature: pocket, sheets })).not.toHaveProperty(
      'maxToolDiameter',
    )
  })

  it('falls back on a contour surface’s tool fit, which has no cutter band', () => {
    const surface = feature('s1', 'contour_surface')
    const sheets: FeatureSheets = {
      s1: featureSheet({
        zMin: -4,
        zMax: 0,
        extendedZMax: 0,
        facts: { kind: 'ContourSurface', toolFit: { toolDiameter: 10, cornerRadius: 2 } },
      }),
    }
    expect(featureDemand({ features: [surface], feature: surface, sheets })).toEqual({
      featureTag: 's1',
      maxToolDiameter: 10,
      depth: 4,
      reachBelowTop: 4,
      floorRadius: 2,
    })
  })
})
