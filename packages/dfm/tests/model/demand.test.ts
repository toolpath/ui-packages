import type { FeatureDatasheet } from '@toolpath/api'
import { fitAgainst } from '@toolpath/tool-support'
import { describe, expect, it } from 'vitest'
import { featureDemand } from '../../src/model/demand.js'
import { featureSheet, type FeatureSheets } from '../../src/model/feature-sheet.js'
import type { DfmFeature } from '../../src/model/geometry.js'
import { readReachCurve } from '../../src/model/reach.js'

/**
 * Synthetic datasheets, typed as the SDK's `FeatureDatasheet` so a field the
 * API renames or drops fails here, read through `featureSheet` exactly as an
 * app's worker cuts them down.
 */
const tolerance = { atolIgnore: 0.01, atolDeviate: 0.02, atolMax: 0.05 }
const UP = { x: 0, y: 0, z: 1 }

/** What every datasheet carries and no test here reads. */
const unread = {
  axialStockToLeave: 0,
  radialStockToLeave: 0,
  toleranceBand: tolerance,
  projectedFloorArea: 0,
  projectedWallArea: 0,
  reachCurve: { horizontalOffset: [], verticalOffset: [] },
}

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
  ...unread,
  featureType: 'BlindHole',
  zMin: -30,
  zMax: 0,
  extendedZMin: -30,
  extendedZMax: 0,
  hasWall: true,
  hasFloor: true,
  reachCurve: { horizontalOffset: [1, 5, 50], verticalOffset: [0, 2, 2] },
  facts: {
    kind: 'Hole',
    diameter: 8,
    fullConeDeg: 118,
    isCounterbore: false,
    holeProcess: 'Automatic',
    maxDrillDiameter: 8.02,
    maxEndmillDiameter: 7.2,
    filletRadius: 0,
    filletHeight: 0,
    maxSpotDiameter: 8,
    cd: {
      ignore: { min: 8, max: 8 },
      deviate: { min: 8, max: 8 },
      effectiveAdaptive: { min: 8, max: 8 },
    },
  },
} satisfies FeatureDatasheet

/** A pocket 12 deep, with 3 mm inside corners and a 1 mm floor fillet, its top 5 under the part's. */
const pocketSheet = {
  ...unread,
  featureType: 'Pocket',
  zMin: -17,
  zMax: -5,
  extendedZMin: -17,
  extendedZMax: -5,
  hasWall: true,
  hasFloor: true,
  pinchPoints: [{ center: { x: 10, y: 10 }, diameter: 6.1 }],
  facts: {
    kind: 'Pocket',
    cd: {
      ignore: { min: 6.1, max: 40 },
      deviate: { min: 6.2, max: 40 },
      effectiveAdaptive: { min: 6.2, max: 40 },
    },
    filletRadius: 1,
    filletHeight: 1,
    maxBottomDiameter: null,
  },
} satisfies FeatureDatasheet

/** The part's top face: it stands highest, and that is all it is here for. */
const faceSheet = {
  ...unread,
  featureType: 'Face',
  zMin: 0,
  zMax: 0,
  extendedZMin: 0,
  extendedZMax: 0,
  hasWall: false,
  hasFloor: true,
  facts: {
    kind: 'Face',
    isTopFace: true,
    isFacing: true,
    needsSidemill: false,
    maxBottomDiameter: null,
    cd: { ignore: {}, deviate: {}, effectiveAdaptive: {} },
  },
} satisfies FeatureDatasheet

/** The hole with only its drill, end mill or bore limit stated, the others zero and no band. */
const holeStating = (
  over: Partial<
    Pick<typeof holeSheet.facts, 'maxDrillDiameter' | 'maxEndmillDiameter' | 'diameter'>
  >,
) =>
  ({
    ...holeSheet,
    facts: {
      ...holeSheet.facts,
      diameter: 0,
      maxDrillDiameter: 0,
      maxEndmillDiameter: 0,
      cd: { ignore: {}, deviate: {}, effectiveAdaptive: {} },
      ...over,
    },
  }) satisfies FeatureDatasheet

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
    // A zero fillet is a sharp floor, not a 0 mm limit on the tool's corner: no floorRadius.
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
  })

  it('bounds a drill by the bore and an end mill by what helixes in', () => {
    const hole = feature('h1', 'blind_hole')
    const demand = featureDemand({
      features: [hole],
      feature: hole,
      sheets: { h1: featureSheet(holeSheet) },
    })
    expect(fitAgainst({ form: 'drill', geometry: { DC: 8 } }, demand)).toEqual([])
    expect(fitAgainst({ form: 'flat end mill', geometry: { DC: 8 } }, demand)).toEqual([
      { featureTag: 'h1', reason: '⌀8 mm is wider than the 7.2 mm this feature admits' },
    ])
    expect(fitAgainst({ form: 'drill', geometry: { DC: 8.1 } }, demand)).toEqual([
      { featureTag: 'h1', reason: '⌀8.1 mm is wider than the 8.02 mm this feature admits' },
    ])
  })

  it('states only the hole limit the datasheet gives', () => {
    const hole = feature('h1', 'blind_hole')
    const demandOf = (sheet: unknown) =>
      featureDemand({ features: [hole], feature: hole, sheets: { h1: featureSheet(sheet) } })
    const rest = { featureTag: 'h1', depth: 30, reachBelowTop: 30 }
    expect(demandOf(holeStating({ maxDrillDiameter: 8.02 }))).toEqual({
      ...rest,
      maxDrillDiameter: 8.02,
    })
    expect(demandOf(holeStating({ maxEndmillDiameter: 7.2 }))).toEqual({
      ...rest,
      maxEndmillDiameter: 7.2,
    })
    expect(demandOf(holeStating({ diameter: 8 }))).toEqual({ ...rest, holeDiameter: 8 })
  })

  it('finds the sheet under an upper-case tag', () => {
    const hole = feature('H1', 'blind_hole')
    const demand = featureDemand({
      features: [hole],
      feature: hole,
      sheets: { h1: featureSheet(holeSheet) },
    })
    expect(demand).toEqual({
      featureTag: 'H1',
      maxToolDiameter: 8,
      maxDrillDiameter: 8.02,
      maxEndmillDiameter: 7.2,
      holeDiameter: 8,
      depth: 30,
      reachBelowTop: 30,
    })
  })

  it('keeps a reach curve given with no sheet, and states none for a null one', () => {
    const hole = feature('h1', 'blind_hole')
    const reachCurve = readReachCurve(holeSheet)
    expect(featureDemand({ features: [hole], feature: hole, sheets: {}, reachCurve })).toEqual({
      featureTag: 'h1',
      reachCurve: { horizontalOffset: [1, 5, 50], verticalOffset: [0, 2, 2] },
    })
    const withNull = featureDemand({
      features: [hole],
      feature: hole,
      sheets: { h1: featureSheet(holeSheet) },
      reachCurve: null,
    })
    expect(Object.keys(withNull)).not.toContain('reachCurve')
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

  it('states no floor radius for a sharp floor', () => {
    const pocket = feature('p1', 'pocket')
    const sheets: FeatureSheets = {
      p1: featureSheet({
        ...pocketSheet,
        facts: { ...pocketSheet.facts, filletRadius: 0 },
      } satisfies FeatureDatasheet),
    }
    expect(featureDemand({ features: [pocket], feature: pocket, sheets })).toEqual({
      featureTag: 'p1',
      maxToolDiameter: 6.1,
      depth: 12,
      reachBelowTop: 12,
    })
  })

  it('states no depth for a feature with no height', () => {
    const top = feature('f1', 'face')
    const pocket = feature('p1', 'pocket')
    const sheets: FeatureSheets = {
      f1: featureSheet(faceSheet),
      p1: featureSheet({ ...pocketSheet, zMax: -17 } satisfies FeatureDatasheet),
    }
    expect(featureDemand({ features: [top, pocket], feature: pocket, sheets })).toEqual({
      featureTag: 'p1',
      maxToolDiameter: 6.1,
      reachBelowTop: 17,
      floorRadius: 1,
    })
  })

  it('states no reach for a feature at the part’s top', () => {
    const top = feature('f1', 'face')
    const sheets: FeatureSheets = {
      f1: featureSheet({
        ...faceSheet,
        facts: { ...faceSheet.facts, cd: { ...faceSheet.facts.cd, ignore: { min: 50 } } },
      } satisfies FeatureDatasheet),
    }
    expect(featureDemand({ features: [top], feature: top, sheets })).toEqual({
      featureTag: 'f1',
      maxToolDiameter: 50,
    })
  })

  it('measures reach only from features cut the same way up', () => {
    const below = feature('f2', 'face', { machiningDirection: { x: 0, y: 0, z: -1 } })
    const pocket = feature('p1', 'pocket')
    const sheets: FeatureSheets = {
      f2: featureSheet({ ...faceSheet, extendedZMax: 40 } satisfies FeatureDatasheet),
      p1: featureSheet(pocketSheet),
    }
    // Only the pocket itself stands this way up: its own top, 12 above its floor.
    expect(
      featureDemand({ features: [below, pocket], feature: pocket, sheets }).reachBelowTop,
    ).toBe(12)
  })

  it('leaves out what the datasheet does not state, rather than sending zeros', () => {
    const wall = feature('w1', 'wall')
    // As the Engine sends a wall with no corner to reach: a cutter band of nulls,
    // no zMin. Not `satisfies FeatureDatasheet`: the SDK types an absent bound as
    // a missing key, and the nulls are the point of the test.
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
        facts: {
          ...pocketSheet.facts,
          cd: { ...pocketSheet.facts.cd, ignore: { min: 0, max: 40 } },
        },
      } satisfies FeatureDatasheet),
    }
    expect(featureDemand({ features: [pocket], feature: pocket, sheets })).toEqual({
      featureTag: 'p1',
      depth: 12,
      reachBelowTop: 12,
      floorRadius: 1,
    })
  })

  it('reads no limit off a contour surface’s tool fit, as the catalog’s demandOf does not', () => {
    const surface = feature('s1', 'contour_surface')
    const sheets: FeatureSheets = {
      s1: featureSheet({
        ...unread,
        featureType: 'ContourSurface',
        zMin: -4,
        zMax: 0,
        extendedZMin: -4,
        extendedZMax: 0,
        hasWall: true,
        hasFloor: true,
        facts: {
          kind: 'Three',
          filletRadius: 0,
          maxStepdown: 0.5,
          surfaceFinishCuspHeight: 0.005,
          hasSharpCorner: false,
          useOnlyBallToolsForFinish: false,
          isUShapedFillet: false,
          cd: { ignore: {}, deviate: {}, effectiveAdaptive: {} },
          toolFit: { toolDiameter: 10, cornerRadius: 2 },
        },
      } satisfies FeatureDatasheet),
    }
    expect(featureDemand({ features: [surface], feature: surface, sheets })).toEqual({
      featureTag: 's1',
      depth: 4,
      reachBelowTop: 4,
    })
  })
})
