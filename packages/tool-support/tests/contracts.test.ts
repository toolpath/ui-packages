/**
 * The contracts, checked the two ways a type can be wrong at a package
 * boundary: what the record's schemas accept and refuse, and the two ways a
 * holder's shape is made — so a published holder and a measured one are read
 * as the one cone stack everything downstream sweeps, draws and exports.
 */

import { describe, expect, it } from 'vitest'

import {
  ColletSchema,
  HolderSchema,
  PROVENANCE,
  RotatingToolAssemblySchema,
  ToolSchema,
  measuredHolder,
  parametricHolder,
  trimToGauge,
  type Collet,
  type FeatureDemand,
  type HolderDimensions,
  type MeasuredProfile,
  type ProfileDatum,
  type ProfilePoint,
  type Provenance,
  type ReachCurve,
  type RotatingToolAssembly,
  type Tool,
} from '../src/index.js'
import { shaft, solid } from './tools.js'

const tool: Tool = solid({
  name: 'TDMX0600',
  shaft: shaft({ shank: 6, overallLength: 57 }),
  provenance: { diameter: 'vendor-stated', shaft: 'derived' },
})

/** A collet chuck as its vendor publishes it. */
const published: HolderDimensions = {
  noseDiameter: 27,
  noseLength: 12,
  bodyDiameter: 42,
  bodyLength: 20,
  projection: 60,
  flangeDiameter: 46,
  gaugeLength: 80,
}

/** `[z, r]`, z from the gage line toward the nose. */
const profile: MeasuredProfile = {
  points: [
    [-30, 8],
    [0, 23],
    [48, 21],
    [60, 13.5],
  ],
  datum: 'gage-line',
}

const collet: Collet = { series: 'ER16', clampMin: 5.5, clampMax: 6, clampLength: 27.5 }

describe('a published holder', () => {
  it('is cylinders nose first, the last diameter carried up to the flange', () => {
    // Nose 12, body 20, the body's ⌀42 carried to the flange face at 60, then
    // the flange to the gauge line at 80.
    expect(parametricHolder(published).layers).toEqual([
      { thickness: 12, bottomDiameter: 27, topDiameter: 27 },
      { thickness: 20, bottomDiameter: 42, topDiameter: 42 },
      { thickness: 28, bottomDiameter: 42, topDiameter: 42 },
      { thickness: 20, bottomDiameter: 46, topDiameter: 46 },
    ])
    expect(parametricHolder(published).gaugeLength).toBe(80)
  })

  it('draws no flange whose height nobody stated', () => {
    const holder = parametricHolder({ ...published, gaugeLength: null })
    expect(holder.layers.map((layer) => layer.bottomDiameter)).toEqual([27, 42, 42])
    expect(holder.gaugeLength).toBeNull()
  })

  it('carries the nose where the body is not stated in full', () => {
    const holder = parametricHolder({ ...published, bodyLength: null })
    expect(holder.layers[1]).toEqual({ thickness: 48, bottomDiameter: 27, topDiameter: 27 })
  })

  it('carries no layer of no height', () => {
    const unstated = parametricHolder({ ...published, noseLength: null, gaugeLength: null })
    expect(unstated.layers.every((layer) => layer.thickness > 0)).toBe(true)
    expect(unstated.layers[0]).toEqual({ thickness: 20, bottomDiameter: 42, topDiameter: 42 })
  })

  it('stands a nose of no stated length up to the flange face, else the gauge line', () => {
    // An older dataset states the nose diameter but not its length. Dropping
    // the nose left a stack with no shape, which cleared every feature.
    const older = { ...published, noseLength: null, bodyDiameter: null, bodyLength: null }
    expect(parametricHolder(older).layers).toEqual([
      { thickness: 60, bottomDiameter: 27, topDiameter: 27 },
      { thickness: 20, bottomDiameter: 46, topDiameter: 46 },
    ])
    expect(parametricHolder({ ...older, projection: null, flangeDiameter: null }).layers).toEqual([
      { thickness: 80, bottomDiameter: 27, topDiameter: 27 },
    ])
  })

  it('has no shape where the vendor states no nose', () => {
    expect(parametricHolder({ ...published, noseDiameter: null }).layers).toEqual([])
  })

  it('keeps the series and the protrusion beside the shape, whichever form it came from', () => {
    // The two facts a stack needs: which collet goes in, and how far the seated
    // one stands proud of the nose. A drawing that read them off only one form
    // would draw a pressed-in collet flush.
    const facts = { colletSeries: 'ER16', colletProtrusion: 2.5, clamping: 'collet' } as const
    for (const holder of [parametricHolder(published, facts), measuredHolder(profile, facts)]) {
      expect(holder.colletSeries).toBe('ER16')
      expect(holder.colletProtrusion).toBe(2.5)
      expect(HolderSchema.safeParse(holder).success).toBe(true)
    }
  })
})

describe('a measured holder', () => {
  it("is stacked from the nose whole, its gauge length the nose's z", () => {
    // Nose last in the profile, first in the stack; the taper above the spindle
    // face is kept, as layers past the gauge length, for a drawing to shade.
    const holder = measuredHolder(profile)
    expect(holder.gaugeLength).toBe(60)
    expect(holder.layers).toEqual([
      { thickness: 12, bottomDiameter: 27, topDiameter: 42 },
      { thickness: 48, bottomDiameter: 42, topDiameter: 46 },
      { thickness: 30, bottomDiameter: 46, topDiameter: 16 },
    ])
  })

  it('is cut at its spindle face by what reads it as mounted', () => {
    expect(trimToGauge(measuredHolder(profile)).layers).toEqual([
      { thickness: 12, bottomDiameter: 27, topDiameter: 42 },
      { thickness: 48, bottomDiameter: 42, topDiameter: 46 },
    ])
    // A face between two vertices cuts the layer that crosses it at the diameter
    // it has there: two thirds along from r = 20 to r = 24.
    const crossing: MeasuredProfile = {
      points: [
        [-40, 11],
        [-10, 20],
        [2, 24],
        [2, 16],
        [30, 16],
        [30, 8],
        [50, 8],
      ],
      datum: 'gage-line',
    }
    const cut = trimToGauge(measuredHolder(crossing)).layers.at(-1)!
    expect(cut.thickness).toBeCloseTo(2, 9)
    expect(cut.topDiameter / 2).toBeCloseTo(23.333333333333332, 9)
    // No gauge length, or a stack that ends at or below it: as it is.
    const nosed = measuredHolder({ ...profile, datum: 'nose' })
    expect(trimToGauge(nosed)).toBe(nosed)
    expect(trimToGauge(parametricHolder(published)).layers).toEqual(
      parametricHolder(published).layers,
    )
  })

  it('is kept whole, and states no gauge length, from a nose datum', () => {
    const holder = measuredHolder({ ...profile, datum: 'nose' })
    expect(holder.gaugeLength).toBeNull()
    expect(holder.layers.reduce((total, layer) => total + layer.thickness, 0)).toBe(90)
  })

  it('has no shape from a profile of fewer than two vertices', () => {
    expect(measuredHolder({ points: [[0, 8]], datum: 'nose' }).layers).toEqual([])
  })
})

describe('an assembly', () => {
  it('takes a holder, or none, and always a stickout', () => {
    const stacks: readonly RotatingToolAssembly[] = [
      { tool, holder: parametricHolder(published), collet, stickout: 19 },
      { tool, holder: null, collet: null, stickout: 19 },
    ]
    for (const stack of stacks) {
      expect(RotatingToolAssemblySchema.safeParse(stack).success).toBe(true)
    }
    // A stickout nobody decided is not a stack: a tool on its own is a tool.
    expect(
      RotatingToolAssemblySchema.safeParse({ tool, holder: null, collet: null, stickout: null })
        .success,
    ).toBe(false)
  })
})

describe('the tool record', () => {
  it('carries provenance a shop can trace, and nothing implied', () => {
    // A key with no entry is nobody having said, not a claim of vendor-stated.
    expect(tool.provenance?.['shaft']).toBe('derived')
    expect(tool.provenance?.['fluteLength']).toBeUndefined()

    const every: readonly Provenance[] = PROVENANCE
    expect(every).toEqual(['vendor-stated', 'derived', 'assumed'])
    expect(ToolSchema.safeParse({ ...tool, provenance: { diameter: 'guessed' } }).success).toBe(
      false,
    )
  })

  it('says how a tap makes its thread by its kind', () => {
    const tap = solid({ kind: 'FormingTap', thread: { pitch: 0.635, handedness: 'right' } })
    expect(ToolSchema.safeParse(tap).success).toBe(true)
    expect(tap.kind).toBe('FormingTap')
  })
})

describe('the measured profile', () => {
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
    const { clampLength: _grip, ...powRgrip } = { ...collet, series: 'PG10' }
    expect(ColletSchema.safeParse(powRgrip).success).toBe(true)
    expect(collet.clampLength).toBe(27.5)
  })
})
