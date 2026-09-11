import { describe, expect, it } from 'vitest'
import { dimensionsFor, laneLayout, laneOffset, laneRoom } from '../src/index.js'
import type { LaneRoom, ViewerAssembly, ViewerHolder, ViewerTool } from '../src/index.js'

const tool = (geometry: Record<string, number>, form = 'flat end mill'): ViewerTool => ({
  form,
  label: 'TDMX0500',
  geometry,
  provenance: {},
})

/** A plain end mill: no relief behind the flutes. */
const plain = tool({ DC: 12, LCF: 30, OAL: 80, SFDM: 12, RE: 0.5 })

/** A necked one: the relief is under the shank and past the flutes. */
const necked = tool({
  DC: 6,
  LCF: 12,
  OAL: 75,
  SFDM: 6,
  'shoulder-diameter': 5.4,
  'shoulder-length': 40,
})

const holder = (gaugeLength: number | null): ViewerHolder => ({
  gaugeLength,
  colletSeries: 'PG10',
  noseDiameter: 16,
  noseLength: null,
  bodyDiameter: null,
  bodyLength: null,
  projection: null,
  flangeDiameter: 46,
  colletProtrusion: null,
  provenance: {},
})

const alone = (each: ViewerTool): ViewerAssembly => ({
  tool: each,
  holder: null,
  stickout: null,
})

const codes = (dims: ReadonlyArray<{ code: string }>) => dims.map((each) => each.code)

describe('what a drawing of the tool alone dimensions', () => {
  it('measures the cut, the shank and the two lengths', () => {
    const { widths, lengths } = dimensionsFor(alone(plain))

    expect(codes(widths)).toEqual(['DC', 'SFDM'])
    expect(codes(lengths)).toEqual(['LCF', 'OAL'])
  })

  /** Every length is measured from the tip, which is where the sheet measures from. */
  it('measures every length from the tip', () => {
    expect(dimensionsFor(alone(plain)).lengths.every((each) => each.from === 0)).toBe(true)
  })

  /**
   * Shortest innermost. Lanes assigned in the order they were listed would
   * cross the moment a tool's shoulder ran past its flutes.
   */
  it('nests the lines shortest first, so none crosses another', () => {
    const { lengths } = dimensionsFor(alone(necked))

    expect(lengths.map((each) => [each.code, each.lane])).toEqual([
      ['LCF', 0],
      ['shoulder-length', 1],
      ['OAL', 2],
    ])
  })

  it('dimensions the relief only on a tool that has one', () => {
    expect(codes(dimensionsFor(alone(necked)).widths)).toContain('shoulder-diameter')
    expect(codes(dimensionsFor(alone(plain)).widths)).not.toContain('shoulder-diameter')
    expect(codes(dimensionsFor(alone(plain)).lengths)).not.toContain('shoulder-length')
  })

  /** A vendor's own number or nothing: a corner radius of zero is a square end, not a radius. */
  it('calls out a corner radius only where one is stated', () => {
    expect(dimensionsFor(alone(plain)).cornerRadius).toBe(0.5)
    expect(dimensionsFor(alone(tool({ DC: 12, LCF: 30, RE: 0 }))).cornerRadius).toBeNull()
  })

  it('draws nothing for a tool that states no diameter or flute length', () => {
    expect(dimensionsFor(alone(tool({ OAL: 80 })))).toEqual({
      lengths: [],
      widths: [],
      angles: [],
      cornerRadius: null,
    })
  })
})

describe('what the holder adds, and what it takes away', () => {
  const assembly = (stickout: number | null, gauge: number | null = 98.4): ViewerAssembly => ({
    tool: plain,
    holder: holder(gauge),
    stickout,
  })

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
   * The stickout and the below-holder length are the same span from the tip
   * whenever the shop clamps to its own rule, and the drawing drew both: two
   * lines of exactly the same length, in two lanes, on opposite flanks.
   */
  it('draws one line where the stickout and the below-holder length are one number', () => {
    const clamped = tool({ DC: 12, LCF: 30, OAL: 80, SFDM: 12, LBH: 45 })
    const { lengths } = dimensionsFor({ tool: clamped, holder: holder(98.4), stickout: 45 })

    expect(codes(lengths)).toEqual(['LCF', 'LBH'])
    expect(lengths.find((each) => each.code === 'LBH')?.aliases).toEqual(['stickout'])
  })

  /**
   * And whatever the two codes are: a tool stood out to its flutes states the
   * same span as its flute length, which drew a third identical ladder.
   */
  it('collapses any two lengths that are the same span, the tool’s code first', () => {
    const { lengths } = dimensionsFor({ tool: plain, holder: holder(98.4), stickout: 30 })

    expect(codes(lengths)).toEqual(['LCF'])
    expect(lengths[0]?.aliases).toEqual(['stickout'])
  })

  /** Two numbers stay two lines: the tool stands out further than it reaches. */
  it('keeps them apart where they are different numbers', () => {
    const proud = tool({ DC: 12, LCF: 30, OAL: 80, SFDM: 12, LBH: 40 })
    const { lengths } = dimensionsFor({ tool: proud, holder: holder(98.4), stickout: 45 })

    expect(codes(lengths)).toEqual(['LCF', 'LBH', 'stickout'])
    expect(lengths.every((each) => each.aliases === undefined)).toBe(true)
  })

  /**
   * The stickout is the shop's number and `LBH` is the tool's. Where the tool
   * is stood out less than the clamping rule assumed, the top of `LBH` is
   * inside the holder — and the line ran visibly past the nose into the holder
   * body, which reads as a drawing that got the assembly wrong.
   */
  it('declines to dimension a below-holder length that ends inside the holder', () => {
    const proud = tool({ DC: 12, LCF: 30, OAL: 80, SFDM: 12, LBH: 50 })

    expect(
      codes(dimensionsFor({ tool: proud, holder: holder(98.4), stickout: 32 }).lengths),
    ).toEqual(['LCF', 'stickout'])
    // Below the nose it is a face on the drawing, and it is dimensioned.
    expect(
      codes(dimensionsFor({ tool: proud, holder: holder(98.4), stickout: 60 }).lengths),
    ).toEqual(['LCF', 'LBH', 'stickout'])
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
    const seated: ViewerHolder = { ...holder(98.4), colletProtrusion: 10 }
    const { widths } = dimensionsFor({ tool: plain, holder: seated, stickout: 45 })
    const shank = widths.find((each) => each.code === 'SFDM')

    expect(shank?.at).toBeLessThanOrEqual(35)
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
    const drill = dimensionsFor(alone(tool({ DC: 10, LCF: 40, OAL: 100, SIG: 140 }, 'drill')))

    expect(drill.angles).toEqual([
      { code: 'SIG', degrees: 140, at: { r: 2.5, z: expect.closeTo(0.911, 2) } },
    ])
  })

  it('says nothing about a tool with no point, or a drill that states no angle', () => {
    expect(dimensionsFor(alone(tool({ DC: 10, LCF: 40, SIG: 140 }))).angles).toEqual([])
    expect(dimensionsFor(alone(tool({ DC: 10, LCF: 40 }, 'drill'))).angles).toEqual([])
  })
})

/**
 * **The drawing letters nothing** (Paul, 2026-09-02), so a lane is a place for
 * a line and nothing else. What used to be a band sized by the widest figure
 * in it is a plain ladder, and the only question left is which flank a length
 * runs up and how far out.
 */
describe('the lanes the lines run in', () => {
  const model = dimensionsFor(alone(necked))

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

  it('lays no lane for a tool it dimensions nothing on', () => {
    const nothing = laneLayout(dimensionsFor(alone(tool({ OAL: 80 }))))

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
