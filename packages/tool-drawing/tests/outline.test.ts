import {
  measuredHolder,
  parametricHolder,
  shaftParts,
  toolSilhouette,
  type CuttingTool,
  type Extension,
  type Holder,
  type RotatingToolAssembly,
  type Tool,
} from '@toolpath/tool-support'
import { describe, expect, it } from 'vitest'
import { TIPS, assemblyOutline } from '../src/geometry/index.js'
import { radiusAt } from '../src/model/outline.js'
import { cylinder, measured, tool } from './fixtures.js'

/** A ⌀10 nose 50 long, up to its gauge line, and nothing else stated. */
const holder: Holder = parametricHolder(
  {
    noseDiameter: 10,
    noseLength: 50,
    bodyDiameter: null,
    bodyLength: null,
    projection: null,
    flangeDiameter: null,
    gaugeLength: 50,
  },
  { colletSeries: 'PG6', provenance: { layers: 'vendor-stated' } },
)

const assembly = (over: Partial<RotatingToolAssembly> = {}): RotatingToolAssembly => ({
  tool: tool(),
  holder,
  collet: null,
  stickout: 19,
  ...over,
})

/** The outline of an assembly that is drawable, or a failed expectation. */
const drawn = (over: Partial<RotatingToolAssembly> = {}) => {
  const outline = assemblyOutline(assembly(over))
  expect(outline).not.toBeNull()
  return outline!
}

/** The tip of a tool drawn alone. */
const tipOf = (over: Partial<Tool>) => assemblyOutline(tool(over))!.segments[0]!

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

  it('draws a neck where one is stated', () => {
    const necked = tool({ shaft: [cylinder(5.6, 19), cylinder(10, 25)] })
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

  it('labels the shaft as the clearance sweep does, a shoulder between necks as shank', () => {
    // Below the top run of shank: a shank-wide layer, a neck, then a wider shoulder.
    const shouldered = tool({
      fluteLength: 12,
      shaft: [cylinder(6, 8), cylinder(5, 8), cylinder(8, 3), cylinder(6, 49)],
    })
    const swept = toolSilhouette(shouldered).map((step) => step.part)
    expect(swept).toEqual(shaftParts(shouldered))
    expect(swept).toEqual(['shank', 'neck', 'shank', 'shank'])
    const parts = assemblyOutline(shouldered)!.segments.map((each) => each.part)
    // The drawing joins neighbouring layers of one part into one segment.
    const runs = swept.filter((part, index) => part !== swept[index - 1])
    expect(parts).toEqual(['tip', 'flutes', ...runs])
  })

  it('draws a layer as wide as the shank as shank, one section with it', () => {
    const relief = tool({ shaft: [cylinder(10, 19), cylinder(10, 25)] })
    const outline = drawn({ tool: relief, stickout: 40 })

    expect(outline.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'shank', 'nose'])
    expect(outline.segments[2]?.points).toEqual([
      { r: 5, z: 13 },
      { r: 5, z: 32 },
      { r: 5, z: 40 },
    ])
  })

  it('draws a tapered layer as the cone it is', () => {
    // A neck flaring from ⌀4 to ⌀5 over 20, under a ⌀6 shank.
    const tapered = tool({
      shaft: [{ thickness: 20, bottomDiameter: 4, topDiameter: 5 }, cylinder(6, 24)],
    })
    const outline = assemblyOutline(tapered)!

    expect(outline.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'neck', 'shank'])
    expect(outline.segments[2]?.points).toEqual([
      { r: 2, z: 13 },
      { r: 2.5, z: 33 },
    ])
    expect(outline.segments[3]?.points).toEqual([
      { r: 3, z: 33 },
      { r: 3, z: 57 },
    ])
    expect(outline.height).toBe(57)
  })

  it('cuts the shaft at the stickout, through a layer where it falls in one', () => {
    const tapered = tool({
      shaft: [{ thickness: 20, bottomDiameter: 4, topDiameter: 5 }, cylinder(6, 24)],
    })
    const outline = drawn({ tool: tapered, stickout: 23 })

    // Ten of the neck's twenty stand below the nose, so it ends halfway out.
    expect(outline.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'neck', 'nose'])
    expect(outline.segments[2]?.points).toEqual([
      { r: 2, z: 13 },
      { r: 2.25, z: 23 },
    ])
    expect(outline.segments[3]?.points[0]).toEqual({ r: 5, z: 23 })
  })

  it('draws a tool on its own, its shank to its overall length and no holder', () => {
    const alone = assemblyOutline(tool())!
    expect(alone.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'shank'])
    expect(alone.height).toBe(57)
    expect(alone.segments.at(-1)?.provenance).toBe('vendor-stated')
  })

  it('draws a modular extension from its head face up to the holder face', () => {
    // A ⌀8 neck 10 long on a ⌀16 shank, its head face 20 above the tip.
    const extension: Extension = {
      systemSize: 'DL06',
      layers: [
        { thickness: 10, bottomDiameter: 8, topDiameter: 8 },
        { thickness: 70, bottomDiameter: 16, topDiameter: 16 },
      ],
    }
    const outline = drawn({ stickout: 60, extension, extensionProtrusion: 40 })

    expect(outline.segments.map((each) => each.part)).toEqual([
      'tip',
      'flutes',
      'shank',
      'extension',
      'nose',
    ])
    expect(outline.segments[2]?.points.map((each) => each.z)).toEqual([13, 20])
    expect(outline.segments[3]).toEqual({
      part: 'extension',
      points: [
        { r: 4, z: 20 },
        { r: 4, z: 30 },
        { r: 8, z: 30 },
        { r: 8, z: 60 },
      ],
      // Nobody said where its layers came from: not the vendor's.
      provenance: 'assumed',
    })
    expect(outline.segments[4]?.points[0]).toEqual({ r: 5, z: 60 })

    const stated = drawn({
      stickout: 60,
      extension: { ...extension, provenance: { layers: 'vendor-stated' } },
      extensionProtrusion: 40,
    })
    expect(stated.segments[3]?.provenance).toBe('vendor-stated')

    // Where it sits is not known, so it is not drawn.
    expect(drawn({ stickout: 60, extension }).segments.map((each) => each.part)).toEqual([
      'tip',
      'flutes',
      'shank',
      'nose',
    ])
    // Nor where it states no place: a head face at or below the tip.
    for (const extensionProtrusion of [0, 60, 75]) {
      expect(
        drawn({ stickout: 60, extension, extensionProtrusion }).segments.map((each) => each.part),
      ).toEqual(['tip', 'flutes', 'shank', 'nose'])
    }
  })

  it('takes a tool with no provenance at its word', () => {
    const { provenance: _none, ...bare } = tool()
    expect(assemblyOutline(bare)!.segments[0]?.provenance).toBe('vendor-stated')
  })
})

/**
 * The tip is the one place the form changes the outline, and the one place an
 * unstated number is assumed. One case per form that has a generator: a form
 * this cannot draw from the vendor's own numbers has none, and draws nothing.
 */
describe('the tip, by what the tool is', () => {
  it('ends a flat end mill square', () => {
    expect(tipOf({ kind: 'FlatEndmill' }).points).toEqual([
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
    for (const kind of ['CuttingTap', 'FormingTap'] as const) {
      expect(tipOf({ kind }).points).toEqual([
        { r: 0, z: 0 },
        { r: 3, z: 0 },
      ])
    }
  })

  it('draws a ball end mill as a hemisphere reaching the cutting radius', () => {
    const ball = tipOf({ kind: 'BallEndmill' })
    expect(ball.points[0]).toEqual({ r: 0, z: 0 })
    expect(ball.points.at(-1)).toEqual({ r: 3, z: 3 })
    expect(ball.provenance).toBe('vendor-stated')
  })

  it('rounds a bull nose end mill by its corner radius', () => {
    const bull = tipOf({ kind: 'RadiusEndmill', cornerRadius: 1 })
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
    const stubby = tipOf({ kind: 'RadiusEndmill', fluteLength: 1, cornerRadius: 4 })
    expect(stubby.points.at(-1)).toEqual({ r: 3, z: 0.5 })

    const noRadius = tipOf({ kind: 'RadiusEndmill' })
    expect(noRadius.points).toEqual([
      { r: 0, z: 0 },
      { r: 3, z: 0 },
    ])
  })

  it('cones a drill at its point angle', () => {
    const stated = tipOf({ kind: 'DrillBit', tipAngleDeg: 140 })
    expect(stated.provenance).toBe('vendor-stated')
    expect(stated.points[1]?.z).toBeCloseTo(3 / Math.tan((140 / 2) * (Math.PI / 180)))
  })

  /** 118° is nobody's number, so the segment says so and a renderer can dash it. */
  it('assumes 118° for a drill with no stated point angle, and marks it assumed', () => {
    const assumed = tipOf({ kind: 'DrillBit' })
    expect(assumed.provenance).toBe('assumed')
    expect(assumed.points[1]?.z).toBeCloseTo(3 / Math.tan((118 / 2) * (Math.PI / 180)))
  })

  it('cones a spot drill and a centre drill the same way', () => {
    for (const kind of ['SpotDrill', 'CenterDrill'] as const) {
      const point = tipOf({ kind, tipAngleDeg: 90 })
      expect(point.points[1]?.r).toBe(3)
      expect(point.points[1]?.z).toBeCloseTo(3)
    }
  })

  it('cones a chamfer mill and a counter sink at their stated angle', () => {
    for (const kind of ['ChamferEndmill', 'Countersink'] as const) {
      const stated = tipOf({ kind, tipAngleDeg: 60 })
      expect(stated.provenance).toBe('vendor-stated')
      expect(stated.points[1]?.z).toBeCloseTo(3 / Math.tan((60 / 2) * (Math.PI / 180)))

      const assumed = tipOf({ kind })
      expect(assumed.provenance).toBe('assumed')
      expect(assumed.points[1]?.z).toBeCloseTo(3)
    }
  })

  it('draws nothing for a point angle that describes no cone', () => {
    expect(
      assemblyOutline(assembly({ tool: tool({ kind: 'DrillBit', tipAngleDeg: 0 }) })),
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
    kind: 'KeyseatCutter',
    fluteLength: 1.6,
    shaft: [cylinder(6, 36.4)],
    cornerRadius: 0.5,
    provenance: { cornerRadius: 'vendor-stated' },
  })

  it('rounds the bottom of the disc, the top of it, and runs straight between', () => {
    const outline = assemblyOutline(keyseat)!

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
    const square = assemblyOutline(
      tool({ kind: 'KeyseatCutter', fluteLength: 1.6, shaft: [cylinder(6, 36.4)] }),
    )!
    expect(square.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'shank'])
    expect(square.segments[1]?.points).toEqual([
      { r: 3, z: 0 },
      { r: 3, z: 1.6 },
    ])
  })
})

/**
 * A kind no generator was written for borrows the nearest one, and says so:
 * its tip is `assumed`, whatever its numbers' own provenance, so a renderer
 * can dash it and a simulation can refuse to cut with it.
 */
describe('a kind with no shape of its own', () => {
  const borrowed = Object.entries(TIPS)
    .filter(([, each]) => each.borrowed === true)
    .map(([kind]) => kind)

  it('is drawn on the nearest generator, its tip marked assumed', () => {
    expect(borrowed).toEqual([
      'CornerRoundingMill',
      'ThreadMill',
      'DovetailCutter',
      'TaperedEndmill',
      'LollipopMill',
      'CircleSegmentBarrel',
      'CircleSegmentLens',
      'CircleSegmentOval',
      'CircleSegmentTaper',
      'BoringBar',
      'Counterbore',
      'Reamer',
    ])
    for (const kind of borrowed) {
      const outline = assemblyOutline(tool({ kind: kind as Tool['kind'] }))
      expect(outline?.segments[0]?.provenance, kind).toBe('assumed')
    }
    // A lollipop on a ball: the nearest shape, from its own diameter.
    expect(tipOf({ kind: 'LollipopMill' }).points.at(-1)).toEqual({ r: 3, z: 3 })
  })

  it('draws an insert tool from its body', () => {
    const face: CuttingTool = {
      type: 'insert',
      kind: 'FaceEndmill',
      name: 'face',
      body: { diameter: 50, fluteLength: 5 },
      shaft: [cylinder(22, 35)],
      insert: {},
    }
    const outline = assemblyOutline(face)!
    expect(outline.radius).toBe(25)
    expect(outline.segments.at(-1)?.points).toEqual([
      { r: 11, z: 5 },
      { r: 11, z: 40 },
    ])
  })
})

describe('a holder drawn as the body the vendor states', () => {
  /** A PG 6 chuck: nose, body, the body carried to the flange face at 50, the flange to the gauge line. */
  const chuck = parametricHolder(
    {
      noseDiameter: 10,
      noseLength: 10.55,
      bodyDiameter: 12.02,
      bodyLength: 9.6,
      projection: 50,
      flangeDiameter: 46,
      gaugeLength: 70,
    },
    {
      colletSeries: 'PG6',
      colletProtrusion: 2.5,
      provenance: { layers: 'vendor-stated', colletProtrusion: 'derived' },
    },
  )

  /**
   * **Cylinders, not cones** (Paul, 2026-08-31). The stretch between the body
   * and the flange is the body's own diameter carried up, assumed to be no
   * wider than what *is* stated rather than assumed to flare.
   */
  it('draws collet, nose, and the body carried up to the flange and the gauge line', () => {
    const outline = drawn({ stickout: 30, holder: chuck })
    const holderParts = outline.segments.filter(
      (each) => !['tip', 'flutes', 'shank'].includes(each.part),
    )

    expect(holderParts.map((each) => [each.part, each.provenance])).toEqual([
      ['collet', 'derived'],
      ['nose', 'vendor-stated'],
      ['body', 'vendor-stated'],
    ])
    expect(holderParts[0]?.points).toEqual([
      { r: 3, z: 27.5 },
      { r: 3, z: 30 },
    ])
    expect(holderParts[1]?.points).toEqual([
      { r: 5, z: 30 },
      { r: 5, z: 40.55 },
    ])
    // The step out to the body is the body's face; the carry is the body's own
    // radius, up to the flange face at 30 + 50, and the flange to the gauge line.
    expect(holderParts[2]?.points.map(({ r, z }) => [r, Number(z.toFixed(9))])).toEqual([
      [5, 40.55],
      [6.01, 40.55],
      [6.01, 50.15],
      [6.01, 80],
      [23, 80],
      [23, 100],
    ])
    expect(outline.radius).toBe(23)
    expect(outline.height).toBe(100)
  })

  it('takes a holder with no provenance at its word', () => {
    const { provenance: _provenance, ...bare } = holder
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

const profile: Holder = measured(profilePoints, { colletSeries: 'PG6' })

describe('a holder drawn as its own model measures it', () => {
  /**
   * The holder below the spindle face: its nose and body, which share the
   * point where they meet, as one polyline.
   */
  const belowFace = (outline: ReturnType<typeof drawn>) => {
    const part = (name: string) => outline.segments.find((each) => each.part === name)!.points
    return [...part('nose'), ...part('body').slice(1)]
  }

  it('places the nose vertex at the stickout and walks the stack back from it', () => {
    const outline = drawn({ holder: profile })
    const flange = outline.segments.find((each) => each.part === 'flange')!

    // Outline z runs up from the tip and profile z runs toward the nose, so
    // the two frames are opposite: 19 + (50 - z).
    expect([...belowFace(outline), ...flange.points].map((point) => point.z)).toEqual([
      19, 39, 39, 67, 67, 69, 69, 79, 109,
    ])
    expect(outline.height).toBe(109)
    expect(outline.radius).toBe(24)
  })

  it('keeps the step faces the measurement found', () => {
    const below = belowFace(drawn({ holder: profile }))

    // Two vertices at one z on each face, so the solid steps rather than
    // sloping across the neighbouring vertices.
    expect(below.slice(0, 5)).toEqual([
      { r: 8, z: 19 },
      { r: 8, z: 39 },
      { r: 16, z: 39 },
      { r: 16, z: 67 },
      { r: 24, z: 67 },
    ])
    expect(below.at(-1)?.z).toBe(69)
    expect(below.at(-1)?.r).toBeCloseTo(24 - 4 / 6, 9)
  })

  it('splits at the gage line, interpolating the crossing and sharing it', () => {
    const outline = drawn({ holder: profile })
    const body = outline.segments.find((each) => each.part === 'body')!
    const flange = outline.segments.find((each) => each.part === 'flange')!

    // The spindle face is the gauge length above the nose: 19 + 50.
    expect(body.points.at(-1)?.z).toBe(69)
    expect(body.points.at(-1)?.r).toBeCloseTo(24 - 4 / 6, 9)
    expect(flange.points[0]).toEqual(body.points.at(-1))
    expect(flange.points.at(-1)).toEqual({ r: 11, z: 109 })
  })

  it('shares a vertex that already sits on the gage line rather than adding one', () => {
    const onTheLine = measured([
      [-20, 10],
      [0, 15],
      [0, 12],
      [40, 12],
      [40, 6],
      [60, 6],
    ])
    const outline = drawn({ holder: onTheLine })
    const body = outline.segments.find((each) => each.part === 'body')!
    const flange = outline.segments.find((each) => each.part === 'flange')!

    expect(belowFace(outline).map((each) => each.z)).toEqual([19, 39, 39, 79, 79])
    expect(body.points.at(-1)).toEqual(flange.points[0])
    expect(flange.points).toEqual([
      { r: 15, z: 79 },
      { r: 10, z: 99 },
    ])
  })

  it('does not split a profile with no gage line to split on', () => {
    const nose = measuredHolder({
      datum: 'nose',
      points: [
        [-30, 10],
        [-5, 14],
        [0, 14],
      ],
    })
    const parts = drawn({ holder: nose }).segments.map((each) => each.part)

    expect(parts).toEqual(['tip', 'flutes', 'shank', 'nose', 'body'])
  })

  it('draws no holder from a stack with no layers', () => {
    const outline = drawn({ holder: { layers: [], gaugeLength: null } })

    expect(outline.segments.map((each) => each.part)).toEqual(['tip', 'flutes', 'shank'])
    expect(outline.height).toBe(19)
  })

  it('draws the seated collet on a measured holder too', () => {
    const seated: Holder = { ...profile, colletProtrusion: 2.5 }
    const collet = drawn({ holder: seated }).segments.find((each) => each.part === 'collet')!

    expect(collet.points).toEqual([
      { r: 3, z: 16.5 },
      { r: 3, z: 19 },
    ])
  })

  it('calls the measurement vendor-stated unless the caller says otherwise', () => {
    expect(
      drawn({ holder: profile })
        .segments.filter((each) => ['nose', 'body', 'flange'].includes(each.part))
        .map((each) => each.provenance),
    ).toEqual(['vendor-stated', 'vendor-stated', 'vendor-stated'])

    const derived: Holder = { ...profile, provenance: { layers: 'derived' } }
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
      tool: tool({ kind: 'DrillBit', tipAngleDeg: 90 }),
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
