import { describe, expect, it } from 'vitest'

import { readFusionEntry, readFusionLibrary } from '../src/import/fusion/index.js'
import {
  MM_PER_INCH,
  hasNeck,
  holderTakesTool,
  neckOf,
  overallLengthOf,
  shankOf,
  stickoutRange,
  type RotatingToolAssembly,
} from '../src/index.js'

const IN = 25.4

type Entry = Record<string, unknown>

/** A minimal Fusion entry: a 6 mm two-flute flat endmill, 12 mm of flute, 30 mm out of the holder. */
const entry = (fields: Entry = {}, geometry: Entry = {}): Entry => ({
  type: 'flat end mill',
  unit: 'millimeters',
  description: '6mm flat',
  ...fields,
  geometry: { DC: 6, LCF: 12, LB: 30, NOF: 2, ...geometry },
})

const read = (fields: Entry = {}, geometry: Entry = {}): RotatingToolAssembly => {
  const assembly = readFusionEntry(entry(fields, geometry))
  expect(assembly).not.toBeNull()
  return assembly as RotatingToolAssembly
}

describe('a Fusion entry', () => {
  it('reads a flat endmill', () => {
    expect(read({ vendor: 'Acme', 'product-id': 'A-6' }, { OAL: 60, SFDM: 6 })).toEqual({
      tool: {
        type: 'solid',
        kind: 'FlatEndmill',
        name: '6mm flat',
        vendor: 'Acme',
        productId: 'A-6',
        description: '6mm flat',
        unitSystem: 'millimeters',
        diameter: 6,
        fluteLength: 12,
        fluteCount: 2,
        shaft: [{ thickness: 48, bottomDiameter: 6, topDiameter: 6 }],
      },
      holder: null,
      collet: null,
      stickout: 30,
    })
  })

  it('converts inches to millimetres, lengths and pitch alike', () => {
    const assembly = read(
      { type: 'tap right hand', unit: 'inches', description: '1/4-20 tap' },
      { DC: 0.25, LCF: 0.5, LB: 1.25, TP: 0.05, NOF: 4 },
    )
    expect(assembly.stickout).toBeCloseTo(1.25 * IN)
    expect(assembly.tool).toMatchObject({
      kind: 'CuttingTap',
      diameter: 0.25 * IN,
      fluteLength: 0.5 * IN,
      fluteCount: 4,
      thread: { pitch: 0.05 * IN, handedness: 'right' },
    })
  })

  it('reads who listed it, and how: guid, link, unit, hand, coolant and material', () => {
    const tool = read(
      {
        guid: '9da403e4-b6e7-4019-8f8b-d13955d7aae7',
        'product-link': 'https://example.com/a-6',
        unit: 'mm',
        BMC: 'carbide',
      },
      { HAND: false, CSP: true },
    ).tool
    expect(tool).toMatchObject({
      guid: '9da403e4-b6e7-4019-8f8b-d13955d7aae7',
      productLink: 'https://example.com/a-6',
      unitSystem: 'millimeters',
      hand: 'left',
      coolantThrough: true,
      substrate: 'carbide',
    })
    // `unspecified` is Fusion saying nothing, and a geometry flag that is not a
    // boolean is not read as one.
    const unstated = read({ BMC: 'unspecified' }, { HAND: 1, CSP: 'yes' }).tool
    expect(unstated).not.toHaveProperty('substrate')
    expect(unstated).not.toHaveProperty('hand')
    expect(unstated).not.toHaveProperty('coolantThrough')
  })

  it('reads a face mill’s arbor as the shank its stickout is clamped on', () => {
    // 3 × the ⌀22 arbor is wanted in the holder, which a 40 mm body cannot give.
    const face = read({ type: 'face mill' }, { DC: 50, LCF: 5, TA: 45, SFDM: 22, OAL: 40, LB: 30 })
    const range = stickoutRange(face.tool)
    expect(range.wantedGrip).toBe(66)
    expect(range.gripShort).toBe(true)
  })

  it('takes its name from the product id when it has no description', () => {
    expect(read({ description: '', 'product-id': 'P-1' }).tool.name).toBe('P-1')
    expect(read({ description: undefined }).tool.name).toBe('')
  })

  it('carries the T number and its holder, nose first, in the holder unit', () => {
    const assembly = read(
      {
        unit: 'inches',
        'post-process': { number: 7 },
        holder: {
          type: 'holder',
          unit: 'millimeters',
          description: 'ER16 chuck',
          vendor: 'Holdco',
          gaugeLength: 70,
          segments: [
            { height: 20, 'lower-diameter': 25, 'upper-diameter': 30 },
            { height: 0, 'lower-diameter': 30, 'upper-diameter': 40 },
            { height: 10, 'lower-diameter': 40, 'upper-diameter': 40 },
          ],
        },
      },
      { DC: 0.25, LCF: 0.5, LB: 1, SFDM: 0.25, OAL: 2 },
    )
    expect(assembly.number).toBe(7)
    expect(assembly.holder).toEqual({
      name: 'ER16 chuck',
      vendor: 'Holdco',
      description: 'ER16 chuck',
      unitSystem: 'millimeters',
      layers: [
        { thickness: 20, bottomDiameter: 25, topDiameter: 30 },
        { thickness: 10, bottomDiameter: 40, topDiameter: 40 },
      ],
      gaugeLength: 70,
      clamping: 'bore',
      boreDiameter: 0.25 * IN,
      provenance: { clamping: 'derived', boreDiameter: 'derived' },
    })
  })

  it("reads a holder in the tool's unit when it states none, and no gauge length as null", () => {
    const { holder } = read(
      {
        unit: 'inches',
        holder: { segments: [{ height: 1, 'lower-diameter': 1, 'upper-diameter': 1.5 }] },
      },
      { DC: 0.25, LCF: 0.5, LB: 1, SFDM: 0.25, OAL: 2 },
    )
    expect(holder).toEqual({
      unitSystem: 'inches',
      layers: [{ thickness: IN, bottomDiameter: IN, topDiameter: 1.5 * IN }],
      gaugeLength: null,
      clamping: 'bore',
      boreDiameter: 0.25 * IN,
      provenance: { clamping: 'derived', boreDiameter: 'derived' },
    })
  })

  describe('its holder takes the shank it was published with', () => {
    const holder = { segments: [{ height: 20, 'lower-diameter': 20, 'upper-diameter': 30 }] }

    it('as a bore of that shank, and refuses another', () => {
      const assembly = read({ holder }, { SFDM: 6, OAL: 50 })
      expect(assembly.holder).toMatchObject({ clamping: 'bore', boreDiameter: 6 })
      expect(holderTakesTool(assembly.holder!, null, assembly.tool)).toBe(true)
      const other = read({}, { DC: 8, SFDM: 8, OAL: 50 }).tool
      expect(holderTakesTool(assembly.holder!, null, other)).toBe(false)
    })

    it('marks the clamping and the bore derived', () => {
      expect(read({ holder }, { SFDM: 6, OAL: 50 }).holder?.provenance).toEqual({
        clamping: 'derived',
        boreDiameter: 'derived',
      })
      // An inch library's shank, in millimetres as the tool states it.
      const inch = read(
        { holder, unit: 'inches' },
        { DC: 0.25, LCF: 0.5, LB: 1, SFDM: 0.25, OAL: 2 },
      )
      expect(inch.holder?.boreDiameter).toBe(0.25 * IN)
    })

    it('states neither where the entry states no SFDM, as the shank is then assumed', () => {
      const assembly = read({ holder }, { OAL: 50 })
      expect(assembly.tool.provenance).toEqual({ shank: 'assumed' })
      expect(assembly.holder).not.toHaveProperty('clamping')
      expect(assembly.holder).not.toHaveProperty('boreDiameter')
      expect(holderTakesTool({ clamping: 'bore', boreDiameter: 6 }, null, assembly.tool)).toBe(
        false,
      )
    })

    it('takes the stated shank where the entry states no OAL, as only its end is assumed', () => {
      const assembly = read({ holder }, { SFDM: 6 })
      expect(assembly.tool.provenance).toEqual({ overallLength: 'assumed' })
      expect(assembly.holder).toMatchObject({ clamping: 'bore', boreDiameter: 6 })
      expect(holderTakesTool(assembly.holder!, null, assembly.tool)).toBe(true)
    })

    it('states neither where the tool states nothing above its flutes', () => {
      const unstated = read({ holder }, { LB: undefined }).holder
      expect(unstated).not.toHaveProperty('clamping')
      expect(unstated).not.toHaveProperty('boreDiameter')
      expect(unstated).not.toHaveProperty('provenance')
    })
  })

  it('assumes the shaft only where the entry leaves its shank or its end unstated', () => {
    expect(read({}, { SFDM: 6, OAL: 50 }).tool).not.toHaveProperty('provenance')
    expect(read({}, { OAL: 50 }).tool.provenance).toEqual({ shank: 'assumed' })
    expect(read({}, { SFDM: 6 }).tool.provenance).toEqual({ overallLength: 'assumed' })
    expect(read({}, { SFDM: 0, OAL: 0 }).tool.provenance).toEqual({
      shank: 'assumed',
      overallLength: 'assumed',
    })
    // With nothing above its flutes there is no shaft to assume.
    expect(read({}, { LB: undefined }).tool).not.toHaveProperty('provenance')
  })

  it('leaves out a holder with no segments, a malformed one, and a T number that is not one', () => {
    expect(read({ holder: { segments: [] } }).holder).toBeNull()
    expect(read({ holder: { segments: [{ height: 'x' }] } }).holder).toBeNull()
    expect(read({ holder: { unit: 'furlongs', segments: [] } }).holder).toBeNull()
    expect(read({ 'post-process': { number: 1.5 } })).not.toHaveProperty('number')
    expect(read({ 'post-process': { number: 0 } })).not.toHaveProperty('number')
    expect(read({ 'post-process': { number: 1e300 } })).not.toHaveProperty('number')
    expect(read({ 'post-process': { number: 2 ** 53 } })).not.toHaveProperty('number')
    expect(read({ 'post-process': { number: '7' } })).not.toHaveProperty('number')
  })

  it("reads a holder whose unit is null in the tool's unit", () => {
    const { holder } = read(
      {
        unit: 'inches',
        holder: { unit: null, segments: [{ height: 1, 'lower-diameter': 1, 'upper-diameter': 1 }] },
      },
      { DC: 0.25, LCF: 0.5, LB: 1 },
    )
    expect(holder?.layers).toEqual([{ thickness: IN, bottomDiameter: IN, topDiameter: IN }])
  })

  it('reads a numeric string only where the kernel does: LCF and shoulder-length', () => {
    expect(read({}, { LCF: '12', 'shoulder-length': '20' }).tool).toMatchObject({
      fluteLength: 12,
    })
    expect(read({}, { LCF: '1e1' }).tool).toMatchObject({ fluteLength: 10 })
    for (const geometry of [{ LCF: '0x6' }, { LCF: ' 12' }, { DC: '6' }, { DC: '1e1' }]) {
      expect(readFusionEntry(entry({}, geometry)), JSON.stringify(geometry)).toBeNull()
    }
  })

  it('checks a length is finite once it is in millimetres', () => {
    expect(readFusionEntry(entry({ unit: 'inches' }, { DC: 1e308 }))).toBeNull()
    // An LB past every float once scaled is no LB at all.
    expect(read({ unit: 'inches' }, { DC: 0.25, LCF: 0.5, LB: 1e308 }).stickout).toBe(0.5 * IN)
  })

  it('reads a zero SFDM or shoulder-diameter as unset, as the kernel does', () => {
    const tool = read({}, { SFDM: 0, 'shoulder-length': 20, 'shoulder-diameter': 0 })
    expect(shankOf(tool.tool)).toBe(6)
    expect(tool.tool.shaft).toEqual([
      { thickness: 8, bottomDiameter: 6, topDiameter: 6 },
      { thickness: 10, bottomDiameter: 6, topDiameter: 6 },
    ])
  })

  it('stands out by its flutes and the stack above them, as the kernel measures it', () => {
    const stickout = (assembly: RotatingToolAssembly): number =>
      overallLengthOf(assembly.tool) ??
      (assembly.tool.type === 'solid' ? assembly.tool.fluteLength : 0)
    const cases = [
      read(),
      read({}, { LB: undefined }),
      read({}, { LB: undefined, 'shoulder-length': 20 }),
      read(
        { shaft: { segments: [{ height: 10, 'lower-diameter': 5, 'upper-diameter': 5 }] } },
        { LB: 15 },
      ),
    ]
    expect(cases.map((assembly) => assembly.stickout)).toEqual([30, 12, 20, 22])
    for (const assembly of cases) {
      expect(assembly.stickout).toBe(stickout(assembly))
    }
  })

  it('carries the shank on to OAL, past the stickout', () => {
    const whole = read({}, { OAL: 60, LB: 30, 'shoulder-length': 20, 'shoulder-diameter': 5.6 })
    expect(whole.stickout).toBe(30)
    expect(overallLengthOf(whole.tool)).toBe(60)
    expect(whole.tool.shaft).toEqual([
      { thickness: 8, bottomDiameter: 5.6, topDiameter: 5.6 },
      { thickness: 40, bottomDiameter: 6, topDiameter: 6 },
    ])
    // With no LB the kernel stands it out by what it stacks, not by OAL.
    expect(read({}, { OAL: 60, LB: undefined }).stickout).toBe(12)
  })

  it('has a neck where the stated section stands narrower than the shank', () => {
    const necked = read({}, { 'shoulder-length': 20, 'shoulder-diameter': 5.6, SFDM: 6 })
    expect(neckOf(necked.tool)).toEqual({ diameter: 5.6, length: 8 })
    expect(necked.tool.shaft).toEqual([
      { thickness: 8, bottomDiameter: 5.6, topDiameter: 5.6 },
      { thickness: 10, bottomDiameter: 6, topDiameter: 6 },
    ])
    // Measured against the shank, not the cut: a relief wider than the flutes
    // and narrower than the shank is a neck, and one narrower than the flutes
    // but as wide as the shank is not.
    expect(
      neckOf(read({}, { 'shoulder-length': 20, 'shoulder-diameter': 8, SFDM: 10 }).tool),
    ).toEqual({ diameter: 8, length: 8 })
    expect(hasNeck(read({}, { 'shoulder-length': 20, 'shoulder-diameter': 5, SFDM: 5 }).tool)).toBe(
      false,
    )
    // A shoulder wider than the shank is stated as it is, and is no neck to a collet.
    const shouldered = read(
      {},
      { DC: 20, LCF: 20, 'shoulder-length': 50, 'shoulder-diameter': 19, SFDM: 16, LB: 60 },
    )
    expect(shouldered.tool.shaft?.[0]).toEqual({
      thickness: 30,
      bottomDiameter: 19,
      topDiameter: 19,
    })
    expect(hasNeck(shouldered.tool)).toBe(false)
    // With no shank stated, the cut stands in for it; within a conversion's last bit is no neck.
    expect(hasNeck(read({}, { 'shoulder-length': 20, 'shoulder-diameter': 6 }).tool)).toBe(false)
    expect(
      hasNeck(read({}, { 'shoulder-length': 20, 'shoulder-diameter': 5.9999999, SFDM: 6 }).tool),
    ).toBe(false)
    // An inch shoulder a hundred-thousandth under its shank is the shank, snapped to it.
    const inch = read(
      { unit: 'inches' },
      {
        DC: 0.375,
        LCF: 1,
        LB: 2,
        SFDM: 0.375,
        OAL: 3,
        'shoulder-length': 1.5,
        'shoulder-diameter': 0.37499,
      },
    )
    expect(hasNeck(inch.tool)).toBe(false)
    expect(inch.tool.shaft?.map((layer) => layer.bottomDiameter)).toEqual([0.375 * IN, 0.375 * IN])
    // The stack is the geometry: shaft segments narrower than the shank are a
    // neck whether or not a shoulder is stated.
    const tapering = read(
      { shaft: { segments: [{ height: 20, 'lower-diameter': 4, 'upper-diameter': 5.5 }] } },
      { LB: 60 },
    )
    expect(neckOf(tapering.tool)).toEqual({ diameter: 4, length: 20 })
  })

  it('reads a shoulder past the flutes with no stated diameter as shank', () => {
    const reach = read({}, { 'shoulder-length': 20, SFDM: 6 }).tool
    expect(reach.shaft).toEqual([
      { thickness: 8, bottomDiameter: 6, topDiameter: 6 },
      { thickness: 10, bottomDiameter: 6, topDiameter: 6 },
    ])
    expect(hasNeck(reach)).toBe(false)
  })

  it('stacks explicit shaft segments between the shoulder and the shank', () => {
    const { tool } = read(
      { shaft: { segments: [{ height: 5, 'lower-diameter': 5, 'upper-diameter': 6 }] } },
      { SFDM: 6 },
    )
    expect(tool.shaft).toEqual([
      { thickness: 5, bottomDiameter: 5, topDiameter: 6 },
      { thickness: 13, bottomDiameter: 6, topDiameter: 6 },
    ])
  })

  it('reads a shaft of any number of segments without throwing', () => {
    const segments = Array.from({ length: 200_000 }, () => ({
      height: 0.0001,
      'lower-diameter': 5,
      'upper-diameter': 5,
    }))
    const assembly = readFusionEntry(entry({ shaft: { segments } }))
    expect(assembly?.tool.shaft?.length).toBe(200_000)
    expect(readFusionLibrary({ data: [entry({ shaft: { segments } })] })).toHaveLength(1)
  })

  describe('reads each type the kernel imports', () => {
    it('ball end mill: the corner is half the diameter, and RE is not read', () => {
      expect(read({ type: 'ball end mill' }, { RE: 0 }).tool).toMatchObject({
        kind: 'BallEndmill',
        cornerRadius: 3,
      })
    })

    it('bull nose end mill: a radius endmill, or a flat one at RE 0', () => {
      expect(read({ type: 'bull nose end mill' }, { RE: 0.5 }).tool).toMatchObject({
        kind: 'RadiusEndmill',
        diameter: 6,
        cornerRadius: 0.5,
      })
      const flat = read({ type: 'bull nose end mill' }, { RE: 0 }).tool
      expect(flat.kind).toBe('FlatEndmill')
      expect(flat).not.toHaveProperty('cornerRadius')
    })

    it('chamfer mill: DC its diameter, TA the cone half angle, the uncut cone above the flutes', () => {
      const assembly = read({ type: 'chamfer mill' }, { DC: 10, LCF: 2, TA: 45, 'tip-diameter': 1 })
      expect(assembly.tool).toMatchObject({
        kind: 'ChamferEndmill',
        diameter: 10,
        tipAngleDeg: 90,
        tipDiameter: 1,
        fluteLength: 2,
      })
      // The cone rises 4.5 mm to DC; the flutes stop 2 mm up it, at 5 mm across.
      expect(assembly.tool.shaft).toEqual([
        { thickness: expect.closeTo(2.5), bottomDiameter: expect.closeTo(5), topDiameter: 10 },
        { thickness: expect.closeTo(25.5), bottomDiameter: 10, topDiameter: 10 },
      ])
      expect(assembly.stickout).toBeCloseTo(30)
      // Flutes past the top of the cone leave the diameter DC.
      expect(
        read({ type: 'chamfer mill' }, { DC: 10, LCF: 8, TA: 45, 'tip-diameter': 1 }).tool,
      ).toMatchObject({ diameter: 10, fluteLength: 8 })
      expect(
        readFusionEntry(entry({ type: 'chamfer mill' }, { LCF: undefined, TA: 45 })),
      ).toBeNull()
      expect(readFusionEntry(entry({ type: 'chamfer mill' }, { TA: 90 }))).toBeNull()
    })

    it('chamfer mill: a zero tip gives way to the flat its description states and LCF fits', () => {
      const geometry = { DC: 10, LCF: 4.5, TA: 45, 'tip-diameter': 0 }
      const tool = (description: string): unknown =>
        readFusionEntry(entry({ type: 'chamfer mill', description }, geometry))?.tool ?? null
      expect(tool('90 deg chamfer X 1.0 FLAT')).toMatchObject({
        tipDiameter: 1,
        fluteLength: expect.closeTo(4.5),
      })
      // A flat the geometry does not size, or one named without a size, is no tool.
      expect(tool('90 deg chamfer X 2.0 FLAT')).toBeNull()
      expect(tool('X 45 DEG PER SIDE FLAT')).toBeNull()
      // With nothing stated the zero stands.
      expect(tool('90 deg chamfer')).toMatchObject({ tipDiameter: 0, fluteLength: 4.5 })
    })

    it('counter sink: DC its diameter, SIG the included angle', () => {
      expect(read({ type: 'counter sink' }, { DC: 12, LCF: 6, SIG: 90 }).tool).toMatchObject({
        kind: 'Countersink',
        diameter: 12,
        tipAngleDeg: 90,
        tipDiameter: 0,
        fluteLength: 6,
      })
    })

    it('drill and spot drill: drill bits with their point angle, a spot drill a kind of its own', () => {
      expect(read({ type: 'drill' }, { SIG: 118 }).tool).toMatchObject({
        kind: 'DrillBit',
        tipAngleDeg: 118,
      })
      const spot = read({ type: 'spot drill' }, { SIG: 90, 'tip-diameter': 0 })
      expect(spot.tool).toMatchObject({ kind: 'SpotDrill', tipAngleDeg: 90, tipDiameter: 0 })
      expect(spot.tool.shaft).toEqual(read({ type: 'drill' }, { SIG: 90 }).tool.shaft)
      expect(readFusionEntry(entry({ type: 'drill' }))).toBeNull()
      expect(readFusionEntry(entry({ type: 'spot drill' }, { SIG: 0 }))).toBeNull()
    })

    it('radius mill: a corner rounding mill whose diameter includes the round', () => {
      expect(
        read({ type: 'radius mill' }, { DC: 4, RE: 2, LCF: undefined, 'tip-length': 1 }).tool,
      ).toMatchObject({
        kind: 'CornerRoundingMill',
        diameter: 8,
        roundingRadius: 2,
        fluteLength: 3,
      })
      expect(readFusionEntry(entry({ type: 'radius mill' }))).toBeNull()
    })

    it('taps: the hand from the type, which the kernel reads for left-hand taps as well', () => {
      expect(read({ type: 'tap right hand' }, { TP: 1 }).tool).toMatchObject({
        kind: 'CuttingTap',
        thread: { pitch: 1, handedness: 'right', profileDeg: 60, taperDeg: 0 },
      })
      expect(read({ type: 'tap left hand' }, { TP: 1 }).tool).toMatchObject({
        kind: 'CuttingTap',
        thread: { pitch: 1, handedness: 'left' },
      })
      expect(readFusionEntry(entry({ type: 'tap right hand' }))).toBeNull()
      expect(readFusionEntry(entry({ type: 'tap left hand' }))).toBeNull()
    })

    it('taps: forming where the description says so in whole words', () => {
      const kind = (description: string): unknown =>
        read({ type: 'tap right hand', description }, { TP: 1 }).tool.kind
      for (const forming of [
        'M6 Roll Tap',
        'M6 FORM tap',
        'M6 forming',
        'BalaxFormTAP M6',
        'M6 RollTap',
      ]) {
        expect(kind(forming), forming).toBe('FormingTap')
      }
      for (const cutting of ['High Performance tap M6', 'Platform tap', 'M6 form', 'M6 tap']) {
        expect(kind(cutting), cutting).toBe('CuttingTap')
      }
      expect(
        read({ type: 'tap left hand', description: 'M6 LH form tap' }, { TP: 1 }).tool,
      ).toMatchObject({
        kind: 'FormingTap',
        thread: { handedness: 'left' },
      })
    })

    it('taps: the form and taper the description names, a stated profile first', () => {
      const thread = (description: string, geometry: Entry = {}): unknown =>
        read({ type: 'tap right hand', description }, { TP: 1, ...geometry }).tool
      expect(thread('1/4 BSW tap')).toMatchObject({ thread: { profileDeg: 55, taperDeg: 0 } })
      expect(thread('1/8-27NPT tap')).toMatchObject({
        thread: {
          profileDeg: 60,
          taperDeg: expect.closeTo((Math.atan(1 / 32) * 180) / Math.PI, 12),
        },
      })
      expect(thread('1/8 BSPT tap')).toMatchObject({
        thread: { profileDeg: 55, taperDeg: expect.closeTo(1.79) },
      })
      expect(thread('1/4 BSW tap', { 'thread-profile-angle': 50 })).toMatchObject({
        thread: { profileDeg: 50 },
      })
      expect(
        readFusionEntry(entry({ type: 'tap right hand' }, { TP: 1, 'thread-profile-angle': 0 })),
      ).toBeNull()
    })

    it('taps: the lead a partialThreadCount states, and a hand that agrees with the thread', () => {
      expect(read({ type: 'tap right hand' }, { TP: 1, partialThreadCount: 5 }).tool).toMatchObject(
        {
          thread: { partialThreads: 5 },
        },
      )
      expect(read({ type: 'tap right hand' }, { TP: 1 }).tool).not.toHaveProperty(
        'thread.partialThreads',
      )
      // The type names the thread's hand, which the kernel reads; a HAND that
      // disagrees gives way to it.
      expect(read({ type: 'tap left hand' }, { TP: 1, HAND: true }).tool).toMatchObject({
        hand: 'left',
        thread: { handedness: 'left' },
      })
      expect(read({ type: 'tap left hand' }, { TP: 1 }).tool).not.toHaveProperty('hand')
    })

    it('thread mill: its teeth, the bottom of a single point’s range and its tip, where stated', () => {
      expect(read({ type: 'thread mill' }, { NT: 4, TP: 1.5 }).tool).toMatchObject({
        thread: { pitch: 1.5, teeth: 4 },
      })
      expect(read({ type: 'thread mill' }, { NT: 4, TP: 1.5, TPN: 1 }).tool).not.toHaveProperty(
        'thread.pitchMin',
      )
      expect(
        read(
          { type: 'thread mill' },
          { TPN: 1, TPX: 2, 'thread-tip-type': 'flat', 'thread-tip-width': 0.1 },
        ).tool,
      ).toMatchObject({ thread: { pitch: 2, pitchMin: 1, tip: { form: 'flat', width: 0.1 } } })
      expect(
        read(
          { type: 'thread mill' },
          { TP: 1, 'thread-tip-type': 'round', 'thread-tip-radius': 0.05 },
        ).tool,
      ).toMatchObject({ thread: { tip: { form: 'round', radius: 0.05 } } })
      // A flat or round of no stated size is no tip the record can carry.
      expect(
        read({ type: 'thread mill' }, { TP: 1, 'thread-tip-type': 'flat' }).tool,
      ).not.toHaveProperty('thread.tip')
      expect(read({ type: 'thread mill' }, { TP: 1 }).tool).not.toHaveProperty('thread.teeth')
    })

    it('thread mill: TP for a multi-tooth mill, the top of the range for a single point', () => {
      expect(read({ type: 'thread mill' }, { TP: 1.5 }).tool).toMatchObject({
        kind: 'ThreadMill',
        thread: { pitch: 1.5, profileDeg: 60, taperDeg: 0 },
      })
      expect(read({ type: 'thread mill' }, { TPN: 0.5, TPX: 2 }).tool).toMatchObject({
        thread: { pitch: 2 },
      })
      expect(read({ type: 'thread mill' }, { NT: 3, TP: 1, TPN: 0.5, TPX: 2 }).tool).toMatchObject({
        thread: { pitch: 1 },
      })
      expect(
        read({ type: 'thread mill', description: '1/8-27 NPT mill' }, { TP: 0.94 }).tool,
      ).toMatchObject({ thread: { taperDeg: expect.closeTo(1.79) } })
      for (const geometry of [
        {},
        { TPN: 0.5 },
        { NT: 3, TPX: 2 },
        { NT: 1.5, TP: 1 },
        { NT: 0, TP: 1 },
      ]) {
        expect(
          readFusionEntry(entry({ type: 'thread mill' }, geometry)),
          JSON.stringify(geometry),
        ).toBeNull()
      }
    })

    it('slot mill and dovetail mill: undercutting discs, reaching over what is above them', () => {
      const keyseat = read(
        { type: 'slot mill' },
        { DC: 12, LCF: 3, 'shoulder-length': 10, 'shoulder-diameter': 6 },
      )
      expect(keyseat.tool).toMatchObject({ kind: 'KeyseatCutter', undercutReach: 3 })
      expect(
        read({ type: 'dovetail mill' }, { DC: 12, LCF: 3, SFDM: 8, TA: 0 }).tool,
      ).toMatchObject({
        kind: 'DovetailCutter',
        undercutReach: 2,
      })
      expect(readFusionEntry(entry({ type: 'dovetail mill' }, { DC: 12, LCF: 3 }))).toBeNull()
    })

    it('slot mill: measures its undercut below the stickout, as the kernel stacks it', () => {
      // The stack runs on to OAL, but nothing of it stands below LB, where the flutes end.
      const slot = read({ type: 'slot mill' }, { DC: 20, LCF: 3, LB: 3, SFDM: 8, OAL: 60 })
      expect(slot.tool.shaft).toEqual([{ thickness: 57, bottomDiameter: 8, topDiameter: 8 }])
      expect(slot.tool).toMatchObject({ kind: 'KeyseatCutter', undercutReach: 0 })
    })

    it('face mill: an insert tool, DC its diameter, LCF its flute length, TA the complement of its lead', () => {
      const assembly = read(
        { type: 'face mill', unit: 'inches' },
        { DC: 2, LCF: 0.25, LB: 1.5, NOF: 4, OAL: 2, RE: 0.03, TA: 45, SFDM: 1.75 },
      )
      expect(assembly.tool).toEqual({
        type: 'insert',
        kind: 'FaceEndmill',
        name: '6mm flat',
        description: '6mm flat',
        unitSystem: 'inches',
        body: {
          diameter: 2 * IN,
          fluteLength: 0.25 * IN,
          pockets: 4,
        },
        shaft: [
          {
            thickness: expect.closeTo(1.75 * IN),
            bottomDiameter: 1.75 * IN,
            topDiameter: 1.75 * IN,
          },
        ],
        insert: { cornerRadius: 0.03 * IN, leadAngleDeg: 45 },
      })
    })
  })

  it('is null where it is not a tool this package models', () => {
    for (const type of [
      'holder',
      'probe',
      'turning general',
      'reamer',
      'center drill',
      'toString',
      42,
    ]) {
      expect(readFusionEntry(entry({ type })), String(type)).toBeNull()
    }
  })

  it('is null where the geometry its kind needs is missing or not a size', () => {
    for (const geometry of [
      { DC: undefined },
      { DC: 0 },
      { DC: -6 },
      { DC: 'wide' },
      { LCF: undefined },
      { LCF: 'Infinity' },
    ]) {
      expect(readFusionEntry(entry({}, geometry)), JSON.stringify(geometry)).toBeNull()
    }
    expect(readFusionEntry(entry({ shaft: { segments: [{ height: -1 }] } }))).toBeNull()
    expect(readFusionEntry(entry({ shaft: { segments: 'none' } }))).toBeNull()
  })

  it('is null for anything that is not an entry, never throwing', () => {
    const throwing = {
      type: 'flat end mill',
      unit: 'mm',
      get geometry(): never {
        throw new Error('no geometry')
      },
    }
    const inherited = Object.assign(
      Object.create({ geometry: { DC: 6, LCF: 1, LB: 3 } }) as object,
      {
        type: 'flat end mill',
        unit: 'mm',
      },
    )
    const odd: Array<unknown> = [
      null,
      undefined,
      0,
      'flat end mill',
      [],
      {},
      { type: 'flat end mill' },
      { type: 'flat end mill', unit: 'millimeters' },
      { type: 'flat end mill', unit: 'millimeters', geometry: [] },
      { type: 'flat end mill', unit: 'cubits', geometry: { DC: 6, LCF: 12 } },
      { type: 'flat end mill', unit: 'constructor', geometry: { DC: 6, LCF: 12 } },
      throwing,
      inherited,
    ]
    for (const value of odd) {
      expect(readFusionEntry(value)).toBeNull()
    }
  })
})

describe('a Fusion library', () => {
  it('reads one result per entry, index-aligned, a hole as null', () => {
    const data: Array<unknown> = [entry(), { type: 'holder', unit: 'millimeters' }]
    data.length = 3 // a hole at index 2
    data.push(entry({ type: 'ball end mill' }), 'junk')
    const results = readFusionLibrary({ data })
    expect(results.map((result) => result?.tool.kind ?? null)).toEqual([
      'FlatEndmill',
      null,
      null,
      'BallEndmill',
      null,
    ])
  })

  it('reads as no entries without a data array', () => {
    expect(readFusionLibrary(null)).toEqual([])
    expect(readFusionLibrary({ data: {} })).toEqual([])
    expect(readFusionLibrary([entry()])).toEqual([])
  })
})

describe('millimetres per inch', () => {
  it('is exact, and is what an inch library scales by', () => {
    expect(MM_PER_INCH).toBe(25.4)
    const inch = readFusionEntry({
      type: 'flat end mill',
      unit: 'inches',
      geometry: { DC: 1, LCF: 1, LB: 2 },
    })
    expect(inch?.stickout).toBe(2 * MM_PER_INCH)
  })
})
