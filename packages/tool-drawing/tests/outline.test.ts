import { describe, expect, it } from 'vitest'
import { assemblyOutline } from '../src/geometry/index.js'
import { radiusAt } from '../src/model/outline.js'
import type {
  ViewerAssembly,
  ViewerHolder,
  ViewerHolderProfile,
  ViewerTool,
} from '../src/geometry/index.js'

const tool = (over: Partial<ViewerTool> = {}): ViewerTool => ({
  form: 'flat end mill',
  label: 'TDMX0600',
  geometry: { DC: 6, LCF: 13, OAL: 57, SFDM: 6, LBH: 19 },
  provenance: { DC: 'vendor-stated', LCF: 'vendor-stated', SFDM: 'vendor-stated', LBH: 'derived' },
  ...over,
})

const holder: ViewerHolder = {
  gaugeLength: 50,
  colletSeries: 'PG6',
  noseDiameter: 10,
  noseLength: null,
  bodyDiameter: null,
  bodyLength: null,
  projection: null,
  flangeDiameter: null,
  colletProtrusion: null,
  provenance: { noseDiameter: 'vendor-stated' },
}

const assembly = (over: Partial<ViewerAssembly> = {}): ViewerAssembly => ({
  tool: tool(),
  holder,
  stickout: 19,
  ...over,
})

/** The outline of an assembly that is drawable, or a failed expectation. */
const drawn = (over: Partial<ViewerAssembly> = {}) => {
  const outline = assemblyOutline(assembly(over))
  expect(outline).not.toBeNull()
  return outline!
}

describe('an assembly as an outline', () => {
  it('draws tip, flutes, shank and nose from the tip up, and says where each came from', () => {
    const outline = drawn()

    expect(outline.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'shank', 'nose'])
    expect(outline.segments.map((each) => each.provenance)).toEqual([
      'vendor-stated',
      'vendor-stated',
      'chosen',
      'vendor-stated',
    ])
    expect(outline.height).toBe(19 + 50)
    expect(outline.radius).toBe(5)
  })

  it('puts the shank at the stickout and the nose above it', () => {
    const outline = drawn({ stickout: 30 })
    const shank = outline.segments.find((each) => each.part === 'shank')!
    const nose = outline.segments.find((each) => each.part === 'nose')!

    expect(shank.points.map((each) => each.z)).toEqual([13, 30])
    expect(nose.points[0]).toEqual({ r: 5, z: 30 })
  })

  it('draws a neck where a shoulder is stated', () => {
    const necked = tool({
      geometry: { DC: 6, LCF: 13, SFDM: 10, 'shoulder-diameter': 5.6, 'shoulder-length': 32 },
    })
    const outline = drawn({ tool: necked, stickout: 40 })

    expect(outline.segments.map((each) => each.part)).toEqual([
      'tip',
      'flutes',
      'neck',
      'shank',
      'nose',
    ])
    expect(outline.segments[2]?.points).toEqual([
      { r: 2.8, z: 13 },
      { r: 2.8, z: 32 },
    ])
  })

  it('draws no nose without a stickout', () => {
    expect(drawn({ stickout: null }).segments.map((each) => each.part)).toEqual([
      'tip',
      'flutes',
      'shank',
    ])
  })

  it('takes a tool with no provenance at its word', () => {
    const bare: ViewerTool = { form: 'flat end mill', geometry: { DC: 6, LCF: 13, SFDM: 6 } }
    expect(drawn({ tool: bare, stickout: null }).segments[0]?.provenance).toBe('vendor-stated')
  })
})

/**
 * The tip is the one place the form changes the outline, and the one place an
 * unstated number is assumed. One case per form that has a generator: a form
 * this cannot draw from the vendor's own numbers has none, and draws nothing.
 */
describe('the tip, by what the tool is', () => {
  const tipOf = (over: Partial<ViewerTool>) =>
    drawn({ tool: tool(over), stickout: null }).segments[0]!

  it('ends a flat end mill square', () => {
    expect(tipOf({ form: 'flat end mill' }).points).toEqual([
      { r: 0, z: 0 },
      { r: 3, z: 0 },
    ])
  })

  /**
   * Square, deliberately: the vendors publish no chamfer lead, and the length
   * over which a plug tap tapers would have to be invented to draw it. Both
   * hands, because the hand of the thread is not visible in an elevation.
   */
  it('ends a tap square, on purpose, whichever hand it cuts', () => {
    for (const form of ['tap right hand', 'tap left hand']) {
      expect(tipOf({ form }).points).toEqual([
        { r: 0, z: 0 },
        { r: 3, z: 0 },
      ])
    }
  })

  it('draws a ball end mill as a hemisphere reaching the cutting radius', () => {
    const ball = tipOf({ form: 'ball end mill' })
    expect(ball.points[0]).toEqual({ r: 0, z: 0 })
    expect(ball.points.at(-1)).toEqual({ r: 3, z: 3 })
    expect(ball.provenance).toBe('vendor-stated')
  })

  it('rounds a bull nose end mill by its corner radius', () => {
    const bull = tipOf({
      form: 'bull nose end mill',
      geometry: { DC: 6, LCF: 13, SFDM: 6, RE: 1 },
    })
    expect(bull.points[0]).toEqual({ r: 0, z: 0 })
    expect(bull.points[1]).toEqual({ r: 2, z: 0 })
    expect(bull.points.at(-1)).toEqual({ r: 3, z: 1 })
    expect(bull.provenance).toBe('vendor-stated')
  })

  /**
   * A corner radius wider than the tool, or than half the flute it sits on,
   * describes no tool — the polygon it builds crosses itself. Clamped rather
   * than drawn, and the flat case is what a vendor stating no radius gets.
   */
  it('clamps a bull nose radius to the cutting radius and half the flute', () => {
    const stubby = tipOf({
      form: 'bull nose end mill',
      geometry: { DC: 6, LCF: 1, SFDM: 6, RE: 4 },
    })
    expect(stubby.points.at(-1)).toEqual({ r: 3, z: 0.5 })

    const noRadius = tipOf({ form: 'bull nose end mill', geometry: { DC: 6, LCF: 13, SFDM: 6 } })
    expect(noRadius.points).toEqual([
      { r: 0, z: 0 },
      { r: 3, z: 0 },
    ])
  })

  it('cones a drill at its point angle', () => {
    const stated = tipOf({ form: 'drill', geometry: { DC: 6, LCF: 13, SFDM: 6, SIG: 140 } })
    expect(stated.provenance).toBe('vendor-stated')
    expect(stated.points[1]?.z).toBeCloseTo(3 / Math.tan((140 / 2) * (Math.PI / 180)))
  })

  /** 118° is nobody's number, so the segment says so and a renderer can dash it. */
  it('assumes 118° for a drill with no stated point angle, and marks it assumed', () => {
    const assumed = tipOf({ form: 'drill' })
    expect(assumed.provenance).toBe('assumed')
    expect(assumed.points[1]?.z).toBeCloseTo(3 / Math.tan((118 / 2) * (Math.PI / 180)))
  })

  it('cones a spot drill and a centre drill the same way', () => {
    for (const form of ['spot drill', 'center drill']) {
      const point = tipOf({ form, geometry: { DC: 6, LCF: 13, SFDM: 6, SIG: 90 } })
      expect(point.points[1]?.r).toBe(3)
      expect(point.points[1]?.z).toBeCloseTo(3)
    }
  })

  it('cones a chamfer mill and a counter sink at their stated angle', () => {
    for (const form of ['chamfer mill', 'counter sink']) {
      const stated = tipOf({ form, geometry: { DC: 6, LCF: 13, SFDM: 6, SIG: 60 } })
      expect(stated.provenance).toBe('vendor-stated')
      expect(stated.points[1]?.z).toBeCloseTo(3 / Math.tan((60 / 2) * (Math.PI / 180)))

      const assumed = tipOf({ form, geometry: { DC: 6, LCF: 13, SFDM: 6 } })
      expect(assumed.provenance).toBe('assumed')
      expect(assumed.points[1]?.z).toBeCloseTo(3)
    }
  })

  it('draws nothing for a point angle that describes no cone', () => {
    expect(
      assemblyOutline(
        assembly({ tool: tool({ form: 'drill', geometry: { DC: 6, LCF: 13, SIG: 0 } }) }),
      ),
    ).toBeNull()
  })
})

/**
 * **A radius on both ends of the disc.** A keyseat cutter carries its corner
 * radius at the top of the flute as well as at the bottom, which is the thing
 * a bull nose generator cannot say. Drawn flat — as it was before it had a
 * generator of its own — a 3.2 mm cutter with 1.6 mm of flute is a featureless
 * sliver, and nothing in the picture says the radius was dropped.
 */
describe('a slot mill', () => {
  const keyseat = tool({
    form: 'slot mill',
    geometry: { DC: 6, LCF: 1.6, SFDM: 6, OAL: 38, RE: 0.5 },
    provenance: { RE: 'vendor-stated' },
  })

  it('rounds the bottom of the disc, the top of it, and runs straight between', () => {
    const outline = drawn({ tool: keyseat, stickout: null })

    expect(outline.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'flutes', 'shank'])
    const [bottom, straight, top] = outline.segments
    expect(bottom?.points[1]).toEqual({ r: 2.5, z: 0 })
    expect(bottom?.points.at(-1)).toEqual({ r: 3, z: 0.5 })
    expect(straight?.points).toEqual([
      { r: 3, z: 0.5 },
      { r: 3, z: 1.1 },
    ])
    expect(top?.points[0]).toEqual({ r: 3, z: 1.1 })
    expect(top?.points.at(-1)).toEqual({ r: 2.5, z: 1.6 })
    expect(top?.provenance).toBe('vendor-stated')
  })

  it('is a plain disc where the vendor states no corner radius', () => {
    const square = drawn({
      tool: tool({ form: 'slot mill', geometry: { DC: 6, LCF: 1.6, SFDM: 6, OAL: 38 } }),
      stickout: null,
    })
    expect(square.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'shank'])
    expect(square.segments[1]?.points).toEqual([
      { r: 3, z: 0 },
      { r: 3, z: 1.6 },
    ])
  })
})

/**
 * A form without a generator draws nothing rather than a plausible cylinder.
 * The four generators this was ported from that invent shape — tapered,
 * dovetail, lollipop, probe — did not come across, so those forms land here.
 */
describe('what cannot be drawn honestly', () => {
  it('returns no outline for a form with no generator', () => {
    for (const form of ['tapered mill', 'dovetail mill', 'lollipop mill', 'reamer', 'other']) {
      expect(assemblyOutline(assembly({ tool: tool({ form }) }))).toBeNull()
    }
  })

  it('returns no outline for a tool that states no diameter or flute length', () => {
    expect(assemblyOutline(assembly({ tool: tool({ geometry: {} }) }))).toBeNull()
    expect(assemblyOutline(assembly({ tool: tool({ geometry: { DC: 6 } }) }))).toBeNull()
    expect(assemblyOutline(assembly({ tool: tool({ geometry: { LCF: 13 } }) }))).toBeNull()
  })
})

describe('a holder drawn as the body the vendor states', () => {
  const stated = assembly({
    stickout: 30,
    holder: {
      ...holder,
      colletSeries: 'PG6',
      noseLength: 10.55,
      bodyDiameter: 12.02,
      bodyLength: 9.6,
      projection: 50,
      flangeDiameter: 46,
      colletProtrusion: 2.5,
      provenance: {
        noseDiameter: 'vendor-stated',
        flangeDiameter: 'derived',
        colletProtrusion: 'derived',
      },
    },
  })

  /**
   * **Cylinders, not cones** (Paul, 2026-08-31). The stretch between the body
   * and the flange was drawn as a cone flaring out to the flange's own
   * diameter — a shape the vendor never published, and most of the drawn
   * holder. It is the body's own diameter carried up now: still assumed,
   * because nothing states it, but assumed to be no wider than what *is*
   * stated rather than assumed to flare.
   */
  it('draws collet, nose, body, the body carried to the flange, and the flange', () => {
    const outline = drawn(stated)
    const holderParts = outline.segments.filter(
      (each) => !['tip', 'flutes', 'shank'].includes(each.part),
    )

    expect(holderParts.map((each) => [each.part, each.provenance])).toEqual([
      ['collet', 'derived'],
      ['nose', 'vendor-stated'],
      ['body', 'vendor-stated'],
      ['body', 'assumed'],
      ['flange', 'derived'],
    ])
    // The carry is the body's own radius, top and bottom.
    expect(holderParts[3]?.points).toEqual([
      { r: 6.01, z: 50.15 },
      { r: 6.01, z: 80 },
    ])
    expect(holderParts[0]?.points).toEqual([
      { r: 3, z: 27.5 },
      { r: 3, z: 30 },
    ])
    expect(holderParts.at(-1)?.points[0]).toEqual({ r: 23, z: 80 })
    expect(outline.radius).toBe(23)
  })

  it('takes a holder with no provenance at its word', () => {
    const bare: ViewerHolder = { ...holder, provenance: undefined }
    expect(drawn({ holder: bare }).segments.at(-1)?.provenance).toBe('vendor-stated')
  })
})

/**
 * A measured holder is drawn as measured.
 *
 * The fixture is a BT30-shaped stack cut down to the seven vertices the cases
 * below need: a taper, a flange with a step face in it, a body, and a nose —
 * with the gage line falling **between** two vertices so the crossing has to be
 * interpolated rather than found.
 */
const profilePoints: ReadonlyArray<readonly [number, number]> = [
  [-40, 11],
  [-10, 20],
  [2, 24],
  [2, 16],
  [30, 16],
  [30, 8],
  [50, 8],
]

const profile: ViewerHolderProfile = {
  points: profilePoints,
  datum: 'gage-line',
  colletSeries: 'PG6',
  colletProtrusion: null,
}

describe('a holder drawn as its own model measures it', () => {
  it('places the nose vertex at the stickout and walks the stack back from it', () => {
    const outline = drawn({ holder: profile })
    const measured = outline.segments.filter((each) => ['body', 'flange'].includes(each.part))

    // Outline z runs up from the tip and profile z runs toward the nose, so
    // the two frames are opposite: 19 + (50 - z).
    expect(measured.flatMap((each) => each.points.map((point) => point.z))).toEqual([
      19, 39, 39, 67, 67, 69, 69, 79, 109,
    ])
    expect(outline.height).toBe(109)
    expect(outline.radius).toBe(24)
  })

  it('keeps the step faces the measurement found', () => {
    const body = drawn({ holder: profile }).segments.find((each) => each.part === 'body')!

    // Two vertices at one z on each face, so the solid steps rather than
    // sloping across the neighbouring vertices.
    expect(body.points).toEqual([
      { r: 8, z: 19 },
      { r: 8, z: 39 },
      { r: 16, z: 39 },
      { r: 16, z: 67 },
      { r: 24, z: 67 },
      { r: 24 - 4 / 6, z: 69 },
    ])
  })

  it('splits at the gage line, interpolating the crossing and sharing it', () => {
    const outline = drawn({ holder: profile })
    const body = outline.segments.find((each) => each.part === 'body')!
    const flange = outline.segments.find((each) => each.part === 'flange')!

    // The spindle face is z = 0 on the profile, so it lands at stickout + 50.
    expect(body.points.at(-1)).toEqual({ r: 24 - 4 / 6, z: 69 })
    expect(flange.points[0]).toEqual(body.points.at(-1))
    expect(flange.points.at(-1)).toEqual({ r: 11, z: 109 })
  })

  it('shares a vertex that already sits on the gage line rather than adding one', () => {
    const onTheLine: ViewerHolderProfile = {
      ...profile,
      points: [
        [-20, 10],
        [0, 15],
        [0, 12],
        [40, 12],
        [40, 6],
        [60, 6],
      ],
    }
    const outline = drawn({ holder: onTheLine })
    const body = outline.segments.find((each) => each.part === 'body')!
    const flange = outline.segments.find((each) => each.part === 'flange')!

    expect(body.points.map((each) => each.z)).toEqual([19, 39, 39, 79, 79])
    expect(flange.points).toEqual([
      { r: 15, z: 79 },
      { r: 10, z: 99 },
    ])
  })

  it('does not split a profile with no gage line to split on', () => {
    const nose: ViewerHolderProfile = {
      ...profile,
      datum: 'nose',
      points: [
        [-30, 10],
        [-5, 14],
        [0, 14],
      ],
    }
    const parts = drawn({ holder: nose }).segments.map((each) => each.part)

    expect(parts).toEqual(['tip', 'flutes', 'shank', 'body'])
  })

  it('draws no holder from a profile too short to be one', () => {
    const stub: ViewerHolderProfile = { ...profile, points: [[0, 12]] }
    const outline = drawn({ holder: stub })

    expect(outline.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'shank'])
    expect(outline.height).toBe(19)
  })

  it('draws the seated collet on a measured holder too', () => {
    const seated: ViewerHolderProfile = { ...profile, colletProtrusion: 2.5 }
    const collet = drawn({ holder: seated }).segments.find((each) => each.part === 'collet')!

    expect(collet.points).toEqual([
      { r: 3, z: 16.5 },
      { r: 3, z: 19 },
    ])
  })

  it('calls the measurement vendor-stated unless the caller says otherwise', () => {
    expect(
      drawn({ holder: profile })
        .segments.filter((each) => ['body', 'flange'].includes(each.part))
        .map((each) => each.provenance),
    ).toEqual(['vendor-stated', 'vendor-stated'])

    const derived: ViewerHolderProfile = { ...profile, provenance: { points: 'derived' } }
    expect(drawn({ holder: derived }).segments.at(-1)?.provenance).toBe('derived')
  })
})

/**
 * **Where an extension line starts.** A dimension line runs outside the whole
 * view; the line that carries the eye to it starts at the solid being
 * measured, and on an assembly that solid is nowhere near `Outline.radius`.
 */
describe('the widest the drawing reaches at one height', () => {
  it('reads the solid at that height rather than the widest thing drawn', () => {
    const outline = drawn()

    // The shank, not the ⌀10 nose twelve millimetres outside it.
    expect(radiusAt(outline, 15)).toBe(3)
    expect(radiusAt(outline, 25)).toBe(5)
    expect(outline.radius).toBe(5)
  })

  it('follows a sloped face between two vertices', () => {
    // A drill's cone: half a millimetre up a ⌀6 point at 90° is a ⌀1 face.
    const cone = drawn({
      tool: tool({ form: 'drill', geometry: { DC: 6, LCF: 13, OAL: 57, SFDM: 6, SIG: 90 } }),
    })

    expect(radiusAt(cone, 0)).toBe(0)
    expect(radiusAt(cone, 0.5)).toBeCloseTo(0.5, 6)
    expect(radiusAt(cone, 3)).toBe(3)
  })

  it('takes the wider face where the solid steps', () => {
    // The flutes meet the nose at the stickout: the step is the nose's own.
    expect(radiusAt(drawn(), 19)).toBe(5)
  })

  it('is zero past either end of the stack, where nothing is drawn', () => {
    expect(radiusAt(drawn(), -1)).toBe(0)
    expect(radiusAt(drawn(), 1000)).toBe(0)
  })
})
