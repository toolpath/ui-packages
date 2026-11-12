import { parametricHolder, type Extension, type Holder, type Tool } from '@toolpath/tool-support'
import { describe, expect, it } from 'vitest'
import { dimensionsFor, laneLayout, laneOffset, laneRoom } from '../src/index.js'
import type { LaneRoom } from '../src/index.js'
import { cylinder, tool as base } from './fixtures.js'

const tool = (over: Partial<Tool>): Tool => base({ name: 'TDMX0500', provenance: {}, ...over })

/** A plain end mill: no relief behind the flutes. */
const plain = tool({
  diameter: 12,
  fluteLength: 30,
  shaft: [cylinder(12, 50)],
  cornerRadius: 0.5,
})

/** A necked one: the relief is under the shank and past the flutes. */
const necked = tool({
  diameter: 6,
  fluteLength: 12,
  shaft: [cylinder(5.4, 28), cylinder(6, 35)],
})

const holder = (gaugeLength: number | null): Holder =>
  parametricHolder(
    {
      noseDiameter: 16,
      noseLength: null,
      bodyDiameter: null,
      bodyLength: null,
      projection: null,
      flangeDiameter: 46,
      gaugeLength,
    },
    { colletSeries: 'PG10' },
  )

/** An assembly of this tool in a holder at this stickout. */
const held = (each: Tool, stickout: number, gauge: number | null = 98.4) => ({
  tool: each,
  holder: holder(gauge),
  collet: null,
  stickout,
})

const codes = (dims: ReadonlyArray<{ code: string }>) => dims.map((each) => each.code)

describe('what a drawing of the tool alone dimensions', () => {
  it('measures the cut, the shank and the two lengths', () => {
    const { widths, lengths } = dimensionsFor(plain)

    expect(codes(widths)).toEqual(['DC', 'SFDM'])
    expect(codes(lengths)).toEqual(['LCF', 'OAL'])
  })

  /** Every length is measured from the tip, which is where the sheet measures from. */
  it('dimensions neither a shank nor an overall length a reader assumed', () => {
    const shank = dimensionsFor({ ...plain, provenance: { shank: 'assumed' } })
    expect(codes(shank.widths)).toEqual(['DC'])
    expect(codes(shank.lengths)).toEqual(['LCF', 'OAL'])
    const end = dimensionsFor({ ...plain, provenance: { overallLength: 'assumed' } })
    expect(codes(end.widths)).toEqual(['DC', 'SFDM'])
    expect(codes(end.lengths)).toEqual(['LCF'])
  })

  it('measures every length from the tip', () => {
    expect(dimensionsFor(plain).lengths.every((each) => each.from === 0)).toBe(true)
  })

  /**
   * Shortest innermost. Lanes assigned in the order they were listed would
   * cross the moment a tool's shoulder ran past its flutes.
   */
  it('nests the lines shortest first, so none crosses another', () => {
    const { lengths } = dimensionsFor(necked)

    expect(lengths.map((each) => [each.code, each.lane])).toEqual([
      ['LCF', 0],
      ['shoulder-length', 1],
      ['OAL', 2],
    ])
  })

  it('dimensions the relief only on a tool that has one', () => {
    expect(codes(dimensionsFor(necked).widths)).toContain('shoulder-diameter')
    expect(codes(dimensionsFor(plain).widths)).not.toContain('shoulder-diameter')
    expect(codes(dimensionsFor(plain).lengths)).not.toContain('shoulder-length')
  })

  /** A vendor's own number or nothing: a corner radius of zero is a square end, not a radius. */
  it('calls out a corner radius only where one is stated', () => {
    expect(dimensionsFor(plain).cornerRadius).toBe(0.5)
    expect(dimensionsFor(tool({ cornerRadius: 0 })).cornerRadius).toBeNull()
  })

  it('states how far an assembly with no holder stands the tool out, beside its length', () => {
    const { lengths } = dimensionsFor({ tool: plain, holder: null, collet: null, stickout: 45 })
    expect(codes(lengths)).toEqual(['LCF', 'stickout', 'OAL'])
  })
})

describe('what the holder adds, and what it takes away', () => {
  const assembly = (stickout: number, gauge: number | null = 98.4) => held(plain, stickout, gauge)

  /**
   * Most of the shank is inside the holder, so a line to the end of it
   * measures to a face nobody can see.
   */
  it('drops the overall length and states the stickout instead', () => {
    const { lengths } = dimensionsFor(assembly(45))

    expect(codes(lengths)).not.toContain('OAL')
    expect(codes(lengths)).toContain('stickout')
  })

  /**
   * Neither drawing reaches the spindle face — both stop past the flange — so
   * a gauge-length line would point at a face that is not there.
   */
  it('never dimensions the gauge length, stated or not', () => {
    expect(codes(dimensionsFor(assembly(45)).lengths)).toEqual(['LCF', 'stickout'])
    expect(codes(dimensionsFor(assembly(45, null)).lengths)).toEqual(['LCF', 'stickout'])
  })

  /**
   * And whatever the two codes are: a tool stood out to its flutes states the
   * same span as its flute length, which drew a third identical ladder.
   */
  it('collapses any two lengths that are the same span, the tool’s code first', () => {
    const { lengths } = dimensionsFor(held(plain, 30))

    expect(codes(lengths)).toEqual(['LCF'])
    expect(lengths[0]?.aliases).toEqual(['stickout'])
  })

  /** Two numbers stay two lines. */
  it('keeps them apart where they are different numbers', () => {
    const { lengths } = dimensionsFor(held(plain, 45))

    expect(codes(lengths)).toEqual(['LCF', 'stickout'])
    expect(lengths.every((each) => each.aliases === undefined)).toBe(true)
  })

  it('measures the shank above the nose, not inside the holder', () => {
    const { widths } = dimensionsFor(assembly(45))
    const shank = widths.find((each) => each.code === 'SFDM')

    expect(shank?.at).toBeGreaterThan(30)
    expect(shank?.at).toBeLessThanOrEqual(45)
  })

  /**
   * The seated collet stands proud of the nose and is drawn as solid at its
   * series diameter, so a width struck under it measures across a face the
   * collet is in front of.
   */
  it('keeps the shank width clear of the seated collet', () => {
    const seated: Holder = { ...holder(98.4), colletProtrusion: 10 }
    const { widths } = dimensionsFor({ tool: plain, holder: seated, collet: null, stickout: 45 })
    const shank = widths.find((each) => each.code === 'SFDM')

    expect(shank?.at).toBeLessThanOrEqual(35)
  })

  it('dimensions a modular extension’s protrusion beside the stickout, only where it is stated', () => {
    const extension: Extension = {
      systemSize: 'DL12',
      layers: [{ thickness: 90, bottomDiameter: 16, topDiameter: 16 }],
    }
    const modular = { ...assembly(80), extension, extensionProtrusion: 40 }
    const { lengths, widths } = dimensionsFor(modular)

    expect(lengths.map(({ code, from, to }) => ({ code, from, to }))).toEqual([
      { code: 'LCF', from: 0, to: 30 },
      { code: 'extension-protrusion', from: 40, to: 80 },
      { code: 'stickout', from: 0, to: 80 },
    ])
    // The head's shank, between its flutes and the extension's head face.
    expect(widths.find((each) => each.code === 'SFDM')?.at).toBe(35)

    const { extensionProtrusion: _unstated, ...unplaced } = modular
    expect(codes(dimensionsFor(unplaced).lengths)).toEqual(['LCF', 'stickout'])
  })

  it('dimensions no extension the outline does not draw', () => {
    const bare = dimensionsFor(assembly(80))
    const unshaped: Extension = { systemSize: 'DL12', layers: [] }
    const shaped: Extension = {
      ...unshaped,
      layers: [{ thickness: 90, bottomDiameter: 16, topDiameter: 16 }],
    }
    // One that states no shape, and protrusions that place no head face.
    for (const [extension, extensionProtrusion] of [
      [unshaped, 40],
      [shaped, 0],
      [shaped, 80],
      [shaped, 95],
    ] as const) {
      const { lengths, widths } = dimensionsFor({ ...assembly(80), extension, extensionProtrusion })

      expect(codes(lengths)).not.toContain('extension-protrusion')
      expect(widths.find((each) => each.code === 'SFDM')).toEqual(
        bare.widths.find((each) => each.code === 'SFDM'),
      )
    }
  })
})

/**
 * **A drill is its point** (Paul, 2026-09-01: "shouldn't a 2d rep of a drill be
 * showing me a tip angle?"). On a ⌀1 drill the cone is three tenths of a
 * millimetre tall, so the drawing runs the point's own two flanks out past the
 * tool and arcs between them rather than lettering a number nobody can place.
 */
describe('the tip angle', () => {
  it('calls out a drill’s stated tip angle, on the flank it is between', () => {
    const drill = dimensionsFor(
      tool({
        kind: 'DrillBit',
        diameter: 10,
        fluteLength: 40,
        shaft: [cylinder(10, 60)],
        tipAngleDeg: 140,
      }),
    )

    const halfwayUpTheFlank: unknown = expect.closeTo(0.911, 2)
    expect(drill.angles).toEqual([
      { code: 'SIG', degrees: 140, at: { r: 2.5, z: halfwayUpTheFlank } },
    ])
  })

  it('says nothing about a tool with no point, or a drill that states no angle', () => {
    expect(dimensionsFor(tool({ diameter: 10, fluteLength: 40, tipAngleDeg: 140 })).angles).toEqual(
      [],
    )
    expect(dimensionsFor(tool({ kind: 'DrillBit', diameter: 10, fluteLength: 40 })).angles).toEqual(
      [],
    )
  })
})

/**
 * **The drawing letters nothing** (Paul, 2026-09-02), so a lane is a place for
 * a line and nothing else. What used to be a band sized by the widest figure
 * in it is a plain ladder, and the only question left is which flank a length
 * runs up and how far out.
 */
describe('the lanes the lines run in', () => {
  const model = dimensionsFor(necked)

  it('keeps every lane on one flank unless both are offered', () => {
    const one = laneLayout(model, 'one')

    expect(one.lanes.every((each) => each.side === 'minus')).toBe(true)
    expect(one.count).toEqual({ minus: 3, plus: 0 })
    expect(one.lanes.map((each) => each.lane)).toEqual([0, 1, 2])
  })

  /**
   * Alternating, so neither margin runs away with the drawing while the other
   * stands empty — and each flank numbers its own lanes from the tool out.
   */
  it('alternates the flanks where both are offered, and renumbers each one', () => {
    const both = laneLayout(model, 'both')

    expect(both.lanes).toEqual([
      { code: 'LCF', side: 'minus', lane: 0 },
      { code: 'shoulder-length', side: 'plus', lane: 0 },
      { code: 'OAL', side: 'minus', lane: 1 },
    ])
    expect(both.count).toEqual({ minus: 2, plus: 1 })
  })

  it('lays no lane for a model with no lengths', () => {
    const nothing = laneLayout({ lengths: [], widths: [], angles: [], cornerRadius: null })

    expect(nothing.lanes).toEqual([])
    expect(nothing.count).toEqual({ minus: 0, plus: 0 })
  })
})

describe('the room a flank’s lines take', () => {
  const room: LaneRoom = { arrow: 10, gap: 2, step: 4 }

  it('starts past the arrows and steps out one lane at a time', () => {
    expect(laneOffset(0, room)).toBe(12)
    expect(laneOffset(2, room)).toBe(20)
  })

  it('reaches to the outermost line', () => {
    expect(laneRoom(3, room)).toBe(20)
  })

  /**
   * A width is dimensioned from outside on **both** flanks, so a flank with no
   * length running up it still has the arrows standing off it.
   */
  it('still leaves room for the arrows on a flank with no lines', () => {
    expect(laneRoom(0, room)).toBe(10)
  })
})
