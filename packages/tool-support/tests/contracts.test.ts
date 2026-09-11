/**
 * The contracts, checked the two ways a type can be wrong at a package
 * boundary: the guard that discriminates the holder union, and the structural
 * assignability that is the whole reason none of this is a class.
 *
 * A class would lose that assignability. Today a catalog's own record simply
 * _is_ a {@link Tool} — an adapter is kept explicit by choice rather than by
 * necessity — and `instanceof` breaks across duplicate installs, which this
 * tree has already been bitten by once.
 */

import { describe, expect, it } from 'vitest'

import {
  PROFILES_VERSION,
  PROVENANCE,
  isHolderProfile,
  type Assembly,
  type Collet,
  type FeatureDemand,
  type Holder,
  type HolderProfile,
  type ProfileDatum,
  type ProfilePoint,
  type Provenance,
  type ProvenanceMap,
  type ReachCurve,
  type Tool,
} from '../src/index.js'

const tool: Tool = {
  form: 'flat end mill',
  label: 'TDMX0600',
  geometry: { DC: 6, LCF: 13, OAL: 57, SFDM: 6, LBH: 19 },
  provenance: { DC: 'vendor-stated', LBH: 'derived' },
}

const tap: Tool = {
  form: 'tap right hand',
  label: 'BU37Z700.5003',
  threadMethod: 'forming',
  geometry: { DC: 2.845, TP: 0.635, LCF: 6, OAL: 56, SFDM: 3.581 },
}

const holder: Holder = {
  noseDiameter: 27,
  noseLength: 12,
  bodyDiameter: 42,
  bodyLength: 20,
  projection: 60,
  flangeDiameter: 46,
  gaugeLength: 60,
  colletSeries: 'ER16',
  colletProtrusion: 2.5,
}

const profile: HolderProfile = {
  points: [
    [-30, 8],
    [0, 23],
    [48, 21],
    [60, 13.5],
  ],
  datum: 'gage-line',
  colletSeries: 'ER16',
  colletProtrusion: 2.5,
}

const collet: Collet = {
  series: 'ER16',
  clampMin: 5.5,
  clampMax: 6,
  clampLength: 27.5,
}

describe('the holder union', () => {
  it('tells a measured silhouette from a published holder', () => {
    // On the presence of `points` rather than a `kind` tag: a tag would have to
    // be added to the parametric side as well, and every existing adapter would
    // stop compiling to gain nothing this does not already give.
    expect(isHolderProfile(profile)).toBe(true)
    expect(isHolderProfile(holder)).toBe(false)
  })

  it('narrows to the silhouette, so a caller reads points without a cast', () => {
    const either: Holder | HolderProfile = profile
    expect(isHolderProfile(either) ? either.points.length : null).toBe(4)
  })

  it('narrows the other way to the vendor’s own numbers', () => {
    const either: Holder | HolderProfile = holder
    expect(isHolderProfile(either) ? null : either.flangeDiameter).toBe(46)
  })

  it('keeps the series and the protrusion on both forms', () => {
    // The two facts a stack needs whichever form it has: which collet goes in,
    // and how far the seated one stands proud of the nose. A drawing that read
    // them off only the parametric side would draw a pressed-in collet flush.
    for (const either of [holder, profile]) {
      expect(either.colletSeries).toBe('ER16')
      expect(either.colletProtrusion).toBe(2.5)
    }
  })
})

describe('an assembly', () => {
  it('takes either holder form, or none', () => {
    const stacks: readonly Assembly[] = [
      { tool, holder, collet, stickout: 19 },
      { tool, holder: profile, collet, stickout: 19 },
      // Null is "nobody has decided", not zero: the tool stands alone and
      // nothing is checked against a part.
      { tool, holder: null, collet: null, stickout: null },
    ]

    expect(stacks.map((stack) => stack.holder === null)).toEqual([false, false, true])
    expect(stacks.map((stack) => isHolderProfile(stack.holder ?? holder))).toEqual([
      false,
      true,
      false,
    ])
  })
})

describe('a catalog record is a Tool by structure', () => {
  it('assigns a narrower geometry with no adapter', () => {
    // A record states `Record<string, number>` — every value present. `Tool`
    // admits `undefined` so the narrower shape satisfies it, which is what
    // keeps the adapter a choice rather than a requirement.
    const record: {
      readonly guid: string
      readonly form: string
      readonly geometry: Readonly<Record<string, number>>
      readonly provenance: ProvenanceMap
    } = {
      guid: '2f0c…',
      form: 'drill',
      geometry: { DC: 6.8, OAL: 91, SIG: 140 },
      provenance: { DC: 'vendor-stated' },
    }

    const asTool: Tool = record
    expect(asTool.geometry.DC).toBe(6.8)
    expect(asTool.geometry.WOC).toBeUndefined()
  })

  it('carries how a tap makes its thread, where anybody has said', () => {
    // Optional, and absent is nobody having said rather than a claim of
    // cutting — the rule `Clamping` keeps on a holder. An end mill carries none
    // because the question does not apply to it, and the type does not force a
    // caller to write that down.
    expect(tap.threadMethod).toBe('forming')
    expect(tool.threadMethod).toBeUndefined()
  })

  it('carries provenance a shop can trace, and nothing implied', () => {
    // A key with no entry is nobody having said, not a claim of vendor-stated.
    const stated: ProvenanceMap = tool.provenance ?? {}
    expect(stated.LBH).toBe('derived')
    expect(stated.OAL).toBeUndefined()

    const every: readonly Provenance[] = PROVENANCE
    expect(every).toEqual(['vendor-stated', 'derived', 'assumed'])
  })
})

describe('the measured profile', () => {
  it('states one version for the whole tree', () => {
    // Two of these stood before, one imported under an alias specifically so it
    // could be compared against the other.
    expect(PROFILES_VERSION).toBe(1)
  })

  it('is a polyline and not a function of z', () => {
    // Two vertices share a z where the solid steps. A shape that assumed one r
    // per z would round every step into a taper.
    const stepped: readonly ProfilePoint[] = [
      [0, 23],
      [0, 21],
      [48, 21],
    ]
    expect(stepped.filter(([z]) => z === 0)).toHaveLength(2)
  })

  it('says what z = 0 means rather than assuming a taper', () => {
    // A holder with no cone has no gauge plane to solve, so there is no gauge
    // length to read off it — and a consumer must say so instead of printing
    // one.
    const data: readonly ProfileDatum[] = ['gage-line', 'nose']
    expect(data).toContain('nose')

    const straightShank: HolderProfile = { ...profile, datum: 'nose' }
    expect(straightShank.datum).toBe('nose')
  })
})

describe('a feature demand', () => {
  it('states only what was measured', () => {
    // Every field optional, because a demand nobody stated must not silently
    // become a demand of zero. What is not stated is not checked, and not
    // claimed.
    const demand: FeatureDemand = { featureTag: 'pocket-3' }
    expect(demand.maxToolDiameter).toBeUndefined()
    expect(demand.floorRadius).toBeUndefined()
  })

  it('takes a reach curve by structure, with no schema behind it', () => {
    // The seam that keeps the API's part schema out of this package: a curve
    // off a report satisfies this shape as it stands.
    const curve: ReachCurve = { horizontalOffset: [2, 8], verticalOffset: [10, 4] }
    const demand: FeatureDemand = { featureTag: 'pocket-3', depth: 12, reachCurve: curve }
    expect(demand.reachCurve?.horizontalOffset).toEqual([2, 8])
  })
})

describe('a collet', () => {
  it('admits no grip length rather than inventing one', () => {
    // REGO-FIX's powRgrip line publishes none, and the absence is load bearing:
    // without it there is no honest maximum stickout, so the answer has to be
    // "nobody has said".
    const powRgrip: Collet = { ...collet, series: 'PG10', clampLength: null }
    expect(powRgrip.clampLength).toBeNull()
    expect(collet.clampLength).toBe(27.5)
  })
})
