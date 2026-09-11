import { describe, expect, it } from 'vitest'
import { assemblyOutline } from '../src/geometry/index.js'
import { assumedNames, isConnection, sectionFill, SHEETS } from '../src/render/sheet.js'
import { joins, sectionPoints, silhouettePath } from '../src/render/silhouette.js'
import type { OutlineSegment } from '../src/geometry/index.js'

/** A frame that does nothing, so a path can be read as the millimetres it came from. */
const identity = { toX: (r: number) => r, toY: (_r: number, z: number) => z }

const segment = (over: Partial<OutlineSegment> = {}): OutlineSegment => ({
  part: 'shank',
  points: [
    { r: 3, z: 0 },
    { r: 3, z: 10 },
  ],
  provenance: 'vendor-stated',
  ...over,
})

describe('the silhouette, in one stroke', () => {
  it('runs up the right side and back down the left, and closes', () => {
    const path = silhouettePath([segment()], identity)

    expect(path).toBe('M3.00,0.00 L3.00,10.00 L-3.00,10.00 L-3.00,0.00 Z')
  })

  it('mirrors one section about the axis', () => {
    expect(sectionPoints(segment(), identity)).toBe('3.00,0.00 3.00,10.00 -3.00,10.00 -3.00,0.00')
  })

  it('draws nothing from no sections', () => {
    expect(silhouettePath([], identity)).toBe('')
  })
})

/**
 * Where two sections meet at the same radius the line is a light dashed one:
 * a bull nose's corner runs into the flutes at exactly the flute diameter and
 * there is no edge there. Where the radius steps, the line is an edge.
 */
describe('the joins between sections', () => {
  it('calls a same-radius meeting a chord and a stepped one an edge', () => {
    const necked = assemblyOutline({
      tool: {
        form: 'flat end mill',
        geometry: {
          DC: 6,
          LCF: 13,
          OAL: 57,
          SFDM: 10,
          'shoulder-diameter': 5.6,
          'shoulder-length': 32,
        },
      },
      holder: null,
      stickout: null,
    })!

    const found = joins(necked.segments)
    expect(found.map((each) => [each.part, each.stepped])).toEqual([
      // tip into flutes: both at the full cutting radius, so no edge.
      ['tip', false],
      // flutes down onto the narrower neck, and the neck up to the shank.
      ['flutes', true],
      ['neck', true],
    ])
  })

  it('draws the chord at the narrower of the two radii, where they meet', () => {
    const found = joins([
      segment({
        part: 'flutes',
        points: [
          { r: 3, z: 0 },
          { r: 3, z: 13 },
        ],
      }),
      segment({
        part: 'shank',
        points: [
          { r: 5, z: 13 },
          { r: 5, z: 40 },
        ],
      }),
    ])

    expect(found).toEqual([{ part: 'flutes', radius: 3, z: 13, stepped: true }])
  })

  /**
   * **The slot mill is why a join is measured where the sections meet rather
   * than at each section's widest point.** Its cutting disc emits two `flutes`
   * segments, and the second is a corner arc curving back in from the full
   * radius to `DC/2 - RE`. Asked for its widest point that arc answers `DC/2`,
   * which is not where it meets the shank — so a real step read as no step and
   * the edge at the top of the disc went missing.
   */
  it('finds the edge at the top of a slot mill’s disc', () => {
    const keyseat = assemblyOutline({
      tool: {
        form: 'slot mill',
        geometry: { DC: 6, LCF: 1.6, SFDM: 6, OAL: 38, RE: 0.5 },
      },
      holder: null,
      stickout: null,
    })!

    expect(keyseat.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'flutes', 'shank'])
    const found = joins(keyseat.segments)
    // Tip into the straight side, and the straight side into the crown: both
    // at the full radius, so both are chords. The crown into the shank is a
    // real step, from 2.5 mm back out to 3 mm.
    expect(found.map((each) => each.stepped)).toEqual([false, false, true])
    expect(found.at(-1)).toEqual({ part: 'flutes', radius: 2.5, z: 1.6, stepped: true })
  })
})

describe('the ink a section is painted in', () => {
  it('reads the flange and the cone nobody states as the spindle connection', () => {
    expect(isConnection(segment({ part: 'flange' }))).toBe(true)
    expect(isConnection(segment({ part: 'body', provenance: 'assumed' }))).toBe(true)
    expect(isConnection(segment({ part: 'body', provenance: 'vendor-stated' }))).toBe(false)
  })

  it('gives the cutting end gold, the tool body steel, and the holder its own grey', () => {
    const sheet = SHEETS.dark
    expect(sectionFill(segment({ part: 'tip' }), sheet)).toBe(sheet.flutes)
    expect(sectionFill(segment({ part: 'flutes' }), sheet)).toBe(sheet.flutes)
    expect(sectionFill(segment({ part: 'neck' }), sheet)).toBe(sheet.body)
    expect(sectionFill(segment({ part: 'shank' }), sheet)).toBe(sheet.body)
    expect(sectionFill(segment({ part: 'nose' }), sheet)).toBe(sheet.holder)
    expect(sectionFill(segment({ part: 'flange' }), sheet)).toBe(sheet.connection)
  })
})

describe('what the drawing had to assume', () => {
  it('names each assumed section once, in the words the note uses', () => {
    expect(
      assumedNames([
        segment({ part: 'tip', provenance: 'assumed' }),
        segment({ part: 'shank', provenance: 'vendor-stated' }),
        segment({ part: 'body', provenance: 'assumed' }),
        segment({ part: 'flange', provenance: 'assumed' }),
        segment({ part: 'body', provenance: 'assumed' }),
      ]),
    ).toEqual(['tip angle', 'body cone', 'flange thickness'])
  })

  it('names nothing when everything was stated', () => {
    expect(assumedNames([segment()])).toEqual([])
  })
})
