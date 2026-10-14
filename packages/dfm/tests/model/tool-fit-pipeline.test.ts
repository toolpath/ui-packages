import type { FeatureDatasheet } from '@toolpath/api'
import { fitTools } from '@toolpath/tool-support'
import { fromFusionLibrary } from '@toolpath/tool-support/import/fusion'
import { describe, expect, it } from 'vitest'
import { featureDemand } from '../../src/model/demand.js'
import { formsFor } from '../../src/model/feature-forms.js'
import { featureSheet, type FeatureSheets } from '../../src/model/feature-sheet.js'
import type { DfmFeature } from '../../src/model/geometry.js'
import { readReachCurve } from '../../src/model/reach.js'

/**
 * The README's "Tools that fit a feature", run end to end: a Fusion library
 * read by the tool package, a part's datasheets read here, and the two met in
 * `fitTools`. Written the way a consumer would write it, so the snippet and
 * this file stay one.
 */

/** A Fusion library document, `{ version, data }` as `ToolLibrary.toJson()` gives it. */
const library = {
  version: 22,
  data: [
    {
      guid: 'drill-quarter',
      type: 'drill',
      unit: 'inches',
      description: '1/4 jobber drill',
      geometry: { DC: 0.25, LCF: 1.5, OAL: 4, SIG: 118 },
    },
    {
      guid: 'flat-6',
      type: 'flat end mill',
      unit: 'millimeters',
      description: '6 mm flat end mill',
      geometry: { DC: 6, LCF: 32, OAL: 75, RE: 0, NOF: 3 },
    },
    {
      guid: 'ball-12',
      type: 'ball end mill',
      unit: 'millimeters',
      description: '12 mm ball end mill',
      geometry: { DC: 12, LCF: 30, OAL: 100, NOF: 2 },
    },
    {
      // Narrow enough for the pocket, but no chamfer mill has the shape to cut one.
      guid: 'chamfer-6',
      type: 'chamfer mill',
      unit: 'millimeters',
      description: '6 mm chamfer mill',
      geometry: { DC: 6, OAL: 50, TA: 45 },
    },
    { guid: 'holder-er32', type: 'holder', unit: 'millimeters', description: 'ER32 collet chuck' },
  ],
}

const tolerance = { atolIgnore: 0.01, atolDeviate: 0.02, atolMax: 0.05 }
const UP = { x: 0, y: 0, z: 1 }

const unread = {
  axialStockToLeave: 0,
  radialStockToLeave: 0,
  toleranceBand: tolerance,
  projectedFloorArea: 0,
  projectedWallArea: 0,
}

/** An ⌀8 blind hole, 118° point, 30 deep from the top at z = 0. */
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

/** A pocket 12 deep, its tightest corner admitting ⌀6.1, with a 1 mm floor fillet. */
const pocketSheet = {
  ...unread,
  featureType: 'Pocket',
  zMin: -17,
  zMax: -5,
  extendedZMin: -17,
  extendedZMax: -5,
  hasWall: true,
  hasFloor: true,
  reachCurve: { horizontalOffset: [], verticalOffset: [] },
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

/**
 * A 40 × 40 pocket 12 deep with square inside corners, as the Engine reports
 * one: its corner limit is only the tolerance's reading of no radius (ten
 * times the tolerance, ten times the tool).
 */
const sharpPocketSheet = {
  ...pocketSheet,
  pinchPoints: [{ center: { x: 0, y: 0 }, diameter: 0.0483 }],
  facts: {
    ...pocketSheet.facts,
    filletRadius: 0,
    filletHeight: 0,
    cd: {
      ignore: { min: 0.0483, max: 40 },
      deviate: { min: 0.0966, max: 40 },
      effectiveAdaptive: { min: 0.92, max: 40 },
      terminalCornerRadius: 0,
    },
  },
} satisfies FeatureDatasheet

const datasheets: Readonly<Record<string, FeatureDatasheet>> = {
  h1: holeSheet,
  p1: pocketSheet,
  s1: sharpPocketSheet,
}
const features: DfmFeature[] = [
  { tag: 'h1', featureType: 'blind_hole', machiningDirection: UP, regionIdxs: [0], number: 1 },
  { tag: 'p1', featureType: 'pocket', machiningDirection: UP, regionIdxs: [1], number: 2 },
  { tag: 's1', featureType: 'pocket', machiningDirection: UP, regionIdxs: [2], number: 3 },
]
const sheets: FeatureSheets = Object.fromEntries(
  Object.entries(datasheets).map(([tag, datasheet]) => [tag, featureSheet(datasheet)]),
)

const { tools: entries } = fromFusionLibrary(library)
const tools = entries.map((entry) => ({ ...entry.tool, guid: entry.guid }))

/** The README's snippet, for one feature: every candidate's fit. */
const fitsFor = (feature: DfmFeature) => {
  const reachCurve = readReachCurve(datasheets[feature.tag])
  const demand = featureDemand({ features, feature, sheets, reachCurve })
  const sheet = sheets[feature.tag.toLowerCase()]
  const forms = formsFor(feature.featureType, sheet) // null: any form
  const candidates = forms
    ? tools.filter((tool) => forms.some((form) => form === tool.form))
    : tools
  return fitTools(candidates, [demand])
}

/** The tools that fit it. */
const fitting = (feature: DfmFeature) =>
  fitsFor(feature)
    .filter((fit) => fit.fits)
    .map((fit) => fit.tool.guid)

describe('tools that fit a feature, from a Fusion library', () => {
  it('reads every tool in the library, inches into millimetres, and not the holder', () => {
    expect(tools.map((tool) => [tool.guid, tool.form, tool.geometry.DC])).toEqual([
      ['drill-quarter', 'drill', 6.35],
      ['flat-6', 'flat end mill', 6],
      ['ball-12', 'ball end mill', 12],
      ['chamfer-6', 'chamfer mill', 6],
    ])
  })

  it('drills or mills the blind hole with what is narrow and long enough', () => {
    const [hole] = features
    // The ball is wider than the hole; a chamfer mill is no hole's shape.
    expect(hole && fitting(hole)).toEqual(['drill-quarter', 'flat-6'])
  })

  it('mills the filleted pocket with the end mill alone', () => {
    const [, pocket] = features
    // The drill is wider than its corner, the ball too, and the chamfer mill,
    // narrow enough, is not a form that cuts a pocket.
    expect(pocket && fitting(pocket)).toEqual(['flat-6'])
  })

  it('fits nothing to a sharp-cornered pocket, and says it is the corners', () => {
    const sharp = features[2]
    if (!sharp) throw new Error('no sharp pocket')
    // The README's closest-tools reading: every end mill misses only the corners.
    const closest = fitsFor(sharp).flatMap((fit) =>
      !fit.fits && fit.failures.every((failure) => failure.kind === 'sharp-corner')
        ? [[fit.tool.guid, fit.failures[0]?.leavesCornerRadius]]
        : [],
    )
    expect(fitting(sharp)).toEqual([])
    expect(closest).toEqual([['flat-6', 3]])
  })
})
