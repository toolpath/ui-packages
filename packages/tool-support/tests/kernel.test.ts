import { describe, expect, it } from 'vitest'

import { cylinder } from '../src/cones.js'
import { fusionTool } from '../src/export/fusion/index.js'
import { isoGeometry } from '../src/export/catalog.js'
import { mastercamLibrary } from '../src/export/mastercam/index.js'
import {
  assemblyFromRecord,
  assemblyFromSummary,
  clampedShank,
  cuttingDiameter,
  RotatingToolAssemblySchema,
  shankOf,
  statedShank,
  stickoutRange,
  toolFromSummary,
  type KernelToolHead,
  type KernelToolRecord,
  type KernelToolSummary,
} from '../src/index.js'

const summary = (
  fields: Partial<KernelToolSummary> & Pick<KernelToolSummary, 'kind'>,
): KernelToolSummary => ({
  name: 'tool',
  key: 'tool-summary',
  diameter: 10,
  fluteLength: 20,
  stickout: 40,
  fluteCount: 3,
  ...fields,
})

describe('a tool from a kernel summary', () => {
  it('keeps a flat endmill to its lengths and flutes', () => {
    expect(toolFromSummary(summary({ kind: 'FlatEndmill' }))).toEqual({
      type: 'solid',
      kind: 'FlatEndmill',
      name: 'tool',
      diameter: 10,
      fluteLength: 20,
      fluteCount: 3,
      shaft: [{ thickness: 20, bottomDiameter: 10, topDiameter: 10 }],
      provenance: { shank: 'assumed', overallLength: 'assumed' },
    })
  })

  it('carries its one diameter as the shank, from the flutes to the stickout', () => {
    expect(toolFromSummary(summary({ kind: 'FlatEndmill', stickout: 20 }))).not.toHaveProperty(
      'shaft',
    )
  })

  it('states neither the shank nor the end of the shaft it carries', () => {
    // The kernel states its cutting diameter and its stickout, not a shank or an end.
    const tool = toolFromSummary(
      summary({ kind: 'FlatEndmill', diameter: 8, fluteLength: 16, stickout: 30 }),
    )
    expect(tool.shaft).toEqual([cylinder(8, 14)])
    expect(tool.provenance).toEqual({ shank: 'assumed', overallLength: 'assumed' })
    expect(stickoutRange(tool)).toMatchObject({
      setup: 18,
      max: null,
      grip: null,
      gripShort: false,
    })
    expect(clampedShank({ tool })).toBeNull()
    expect(isoGeometry(tool)).toEqual({ DC: 8, LCF: 16, NOF: 3 })
  })

  it('is exported with no shank or overall length, which Fusion and Mastercam then lack', () => {
    const guid = '0c0c0c0c-1111-4222-8333-444444444444'
    const tool = { ...toolFromSummary(summary({ kind: 'FlatEndmill' })), guid }
    const fusion = fusionTool({ tool, assembly: { stickout: 40, holder: null } })
    expect(fusion.tool).toBeNull()
    expect(
      fusion.notes.filter((note) => note.kind === 'skipped').map((note) => note.field),
    ).toEqual(expect.arrayContaining(['geometry.OAL', 'geometry.SFDM']))
    const { notes } = mastercamLibrary({ tools: [{ tool }] })
    expect(notes).toEqual([
      expect.objectContaining({
        kind: 'skipped',
        message: expect.stringContaining('overall length'),
      }),
    ])
  })

  it('carries what each kind names it by', () => {
    const cases: Array<[KernelToolSummary, Record<string, unknown>]> = [
      [summary({ kind: 'RadiusEndmill', cornerRadius: 1.5 }), { cornerRadius: 1.5 }],
      [summary({ kind: 'BallEndmill', cornerRadius: 5 }), { cornerRadius: 5 }],
      [summary({ kind: 'ChamferEndmill', tipAngleDeg: 90 }), { tipAngleDeg: 90 }],
      [summary({ kind: 'Countersink', tipAngleDeg: 82 }), { tipAngleDeg: 82 }],
      [summary({ kind: 'CornerRoundingMill', roundingRadius: 2 }), { roundingRadius: 2 }],
      [summary({ kind: 'DrillBit', tipAngleDeg: 118 }), { tipAngleDeg: 118 }],
      [summary({ kind: 'KeyseatCutter', undercutReach: 3 }), { undercutReach: 3 }],
      [summary({ kind: 'DovetailCutter', undercutReach: 2 }), { undercutReach: 2 }],
      [
        summary({ kind: 'ThreadMill', threadPitch: 1.5, threadProfileDeg: 60, threadTaperDeg: 0 }),
        { thread: { pitch: 1.5, profileDeg: 60, taperDeg: 0 } },
      ],
      [
        summary({ kind: 'CuttingTap', threadPitch: 1.25, threadHandedness: 'Right' }),
        { thread: { pitch: 1.25, handedness: 'right' } },
      ],
      [
        summary({ kind: 'FormingTap', threadPitch: 1, threadHandedness: 'Left' }),
        { thread: { pitch: 1, handedness: 'left' } },
      ],
    ]
    for (const [input, expected] of cases) {
      expect(toolFromSummary(input), input.kind).toMatchObject({
        type: 'solid',
        kind: input.kind,
        ...expected,
      })
    }
  })

  it('states no tip diameter, which a summary does not carry', () => {
    expect(
      toolFromSummary(summary({ kind: 'ChamferEndmill', tipAngleDeg: 90 })),
    ).not.toHaveProperty('tipDiameter')
  })

  it('makes a face mill an insert tool with its pockets', () => {
    expect(toolFromSummary(summary({ kind: 'FaceEndmill', diameter: 63, fluteCount: 5 }))).toEqual({
      type: 'insert',
      kind: 'FaceEndmill',
      name: 'tool',
      body: { diameter: 63, fluteLength: 20, pockets: 5 },
      shaft: [{ thickness: 20, bottomDiameter: 63, topDiameter: 63 }],
      provenance: { shank: 'assumed', overallLength: 'assumed' },
      insert: {},
    })
  })

  it('cuts a face mill at the kernel’s swept diameter, stating no lead angle', () => {
    const input = summary({ kind: 'FaceEndmill', diameter: 63 })
    const tool = toolFromSummary(input)
    expect(cuttingDiameter(tool)).toBe(input.diameter)
    expect(tool).toHaveProperty('insert')
    expect(tool).not.toHaveProperty('insert.leadAngleDeg')
  })

  it('keeps a spot drill a kind of its own, where the kernel flags a drill bit', () => {
    expect(toolFromSummary(summary({ kind: 'DrillBit', isSpotDrill: true })).kind).toBe('SpotDrill')
    expect(toolFromSummary(summary({ kind: 'DrillBit', isSpotDrill: false })).kind).toBe('DrillBit')
    expect(toolFromSummary(summary({ kind: 'DrillBit' })).kind).toBe('DrillBit')
  })

  it('leaves out an unstated flute count and a zero pitch', () => {
    const tool = toolFromSummary(summary({ kind: 'ThreadMill', fluteCount: 0, threadPitch: 0 }))
    expect(tool).not.toHaveProperty('fluteCount')
    expect(tool).not.toHaveProperty('thread')
  })

  it('puts it in an assembly at its stickout, holder and collet unknown', () => {
    expect(assemblyFromSummary(summary({ kind: 'FlatEndmill' }))).toEqual({
      tool: toolFromSummary(summary({ kind: 'FlatEndmill' })),
      holder: null,
      collet: null,
      stickout: 40,
    })
  })
})

const record = (
  head: KernelToolHead,
  fields: Partial<Omit<KernelToolRecord, 'head'>> = {},
): KernelToolRecord => ({
  name: 'tool',
  head,
  shaft: [cylinder(10, 20)],
  holder: null,
  fluteCount: 3,
  ...fields,
})

/** What every solid tool mapped from a {@link record} at its defaults states. */
const solidOf = (kind: string, diameter: number, fluteLength: number) => ({
  type: 'solid',
  kind,
  name: 'tool',
  diameter,
  fluteLength,
  fluteCount: 3,
  shaft: [cylinder(10, 20)],
  provenance: { shank: 'assumed', overallLength: 'assumed' },
})

describe('an assembly from a kernel tool record', () => {
  // One case per head kind, each mapped as tp-rs #2695's table maps it.
  const cases: Array<[string, KernelToolHead, Record<string, unknown>]> = [
    [
      'a flat endmill to its diameter',
      { kind: 'FlatEndmill', fluteLength: 18, diameter: 6 },
      solidOf('FlatEndmill', 6, 18),
    ],
    [
      'a ball endmill to its diameter, and the corner radius its head leaves implied',
      { kind: 'BallEndmill', fluteLength: 12, diameter: 8 },
      { ...solidOf('BallEndmill', 8, 12), cornerRadius: 4 },
    ],
    [
      'a radius endmill to its bottom diameter and two corner radii',
      { kind: 'RadiusEndmill', fluteLength: 15, bottomDiameter: 7, cornerRadius: 1.5 },
      { ...solidOf('RadiusEndmill', 10, 15), cornerRadius: 1.5 },
    ],
    [
      'a chamfer mill to its tip diameter and half angle',
      {
        kind: 'ChamferEndmill',
        fluteLength: 6,
        diameter: 12,
        bottomDiameter: 0.5,
        chamferDeg: 45,
      },
      { ...solidOf('ChamferEndmill', 12, 6), tipDiameter: 0.5, tipAngleDeg: 90 },
    ],
    [
      'a countersink to its tip diameter and included angle',
      { kind: 'Countersink', fluteLength: 5, diameter: 16, bottomDiameter: 2, fullConeDeg: 82 },
      { ...solidOf('Countersink', 16, 5), tipDiameter: 2, tipAngleDeg: 82 },
    ],
    [
      'a drill to its point angle',
      { kind: 'DrillBit', fluteLength: 40, diameter: 6.8, fullConeDeg: 118, isSpotDrill: false },
      { ...solidOf('DrillBit', 6.8, 40), tipAngleDeg: 118 },
    ],
    [
      'a spot drill to a kind of its own',
      { kind: 'DrillBit', fluteLength: 8, diameter: 10, fullConeDeg: 90, isSpotDrill: true },
      { ...solidOf('SpotDrill', 10, 8), tipAngleDeg: 90 },
    ],
    [
      'a corner rounding mill to its bottom diameter and two rounds',
      { kind: 'CornerRoundingMill', fluteLength: 4, bottomDiameter: 6, roundingRadius: 2 },
      { ...solidOf('CornerRoundingMill', 10, 4), roundingRadius: 2 },
    ],
    [
      'a keyseat cutter to its diameter, corner radius and undercut reach',
      { kind: 'KeyseatCutter', fluteLength: 3, diameter: 19, cornerRadius: 0 },
      // Its disc overhangs the 10 mm neck by (19 − 10) / 2.
      { ...solidOf('KeyseatCutter', 19, 3), cornerRadius: 0, undercutReach: 4.5 },
    ],
    [
      'a dovetail cutter to its widest diameter and the lean of its two',
      {
        kind: 'DovetailCutter',
        fluteLength: 4,
        bottomDiameter: 20,
        topDiameter: 12,
        cornerRadius: 0.2,
      },
      // atan((20 − 12) / (2 · 4)) = atan(1) = 45°.
      {
        ...solidOf('DovetailCutter', 20, 4),
        cornerRadius: 0.2,
        undercutReach: 5,
        taperAngleDeg: 45,
      },
    ],
    [
      'a cutting tap to its thread, its hand lower-cased',
      {
        kind: 'CuttingTap',
        fluteLength: 14,
        diameter: 8,
        threadPitch: 1.25,
        partialThreads: 2.5,
        handedness: 'Right',
        threadProfileDeg: 60,
        threadTaperDeg: 0,
      },
      {
        ...solidOf('CuttingTap', 8, 14),
        thread: {
          pitch: 1.25,
          partialThreads: 2.5,
          handedness: 'right',
          profileDeg: 60,
          taperDeg: 0,
        },
      },
    ],
    [
      'a forming tap to its thread',
      {
        kind: 'FormingTap',
        fluteLength: 10,
        diameter: 6,
        threadPitch: 1,
        partialThreads: 1,
        handedness: 'Left',
        threadProfileDeg: 60,
        threadTaperDeg: 1.79,
      },
      {
        ...solidOf('FormingTap', 6, 10),
        thread: { pitch: 1, partialThreads: 1, handedness: 'left', profileDeg: 60, taperDeg: 1.79 },
      },
    ],
    [
      'a single-point thread mill to its pitch range and tip',
      {
        kind: 'ThreadMill',
        fluteLength: 2,
        diameter: 9.5,
        threadPitchMinimum: 0.5,
        threadPitchMaximum: 2,
        threadTip: { kind: 'Flat', width: 0.1 },
        threadProfileDeg: 60,
        threadTaperDeg: 0,
        numberOfTeeth: 1,
      },
      {
        ...solidOf('ThreadMill', 9.5, 2),
        thread: {
          pitch: 2,
          pitchMin: 0.5,
          teeth: 1,
          tip: { form: 'flat', width: 0.1 },
          profileDeg: 60,
          taperDeg: 0,
        },
      },
    ],
    [
      'a face mill to an insert tool at its swept diameter, stating no lead angle',
      { kind: 'FaceEndmill', fluteLength: 5, diameter: 63, canSideMill: true },
      {
        type: 'insert',
        kind: 'FaceEndmill',
        name: 'tool',
        body: { diameter: 63, fluteLength: 5, pockets: 3 },
        shaft: [cylinder(10, 20)],
        provenance: { shank: 'assumed', overallLength: 'assumed' },
        insert: { canSideMill: true },
      },
    ],
  ]

  it.each(cases)('maps %s', (_, head, tool) => {
    const assembly = assemblyFromRecord(record(head))
    expect(assembly).toEqual({
      tool,
      holder: null,
      collet: null,
      stickout: head.fluteLength + 20,
    })
    expect(RotatingToolAssemblySchema.parse(assembly)).toEqual(assembly)
  })

  it('covers every head kind the kernel states', () => {
    expect(new Set(cases.map(([, head]) => head.kind)).size).toBe(13)
  })

  it('works out the computed fields exactly where they are exact', () => {
    const dovetail = assemblyFromRecord(
      record({
        kind: 'DovetailCutter',
        fluteLength: 5,
        bottomDiameter: 16,
        topDiameter: 10,
        cornerRadius: 0,
      }),
    ).tool
    // atan((16 − 10) / (2 · 5)) = atan(0.6).
    expect(dovetail).toMatchObject({ diameter: 16 })
    expect((dovetail as { taperAngleDeg: number }).taperAngleDeg).toBeCloseTo(30.963756532, 9)
  })

  it('states a chamfer mill’s half angle as its exporters read it', () => {
    const tool = assemblyFromRecord(
      record({
        kind: 'ChamferEndmill',
        fluteLength: 6,
        diameter: 12,
        bottomDiameter: 0,
        chamferDeg: 30,
      }),
    ).tool
    expect(isoGeometry(tool)).toMatchObject({ TA: 30 })
  })

  it('takes the larger of a dovetail’s diameters, leaning out as well as in', () => {
    const tool = assemblyFromRecord(
      record({
        kind: 'DovetailCutter',
        fluteLength: 4,
        bottomDiameter: 12,
        topDiameter: 20,
        cornerRadius: 0,
      }),
    ).tool
    expect(tool).toMatchObject({ diameter: 20, taperAngleDeg: -45 })
  })

  it('leaves out the lean of a dovetail stating no flutes', () => {
    for (const topDiameter of [12, 8]) {
      const assembly = assemblyFromRecord(
        record({
          kind: 'DovetailCutter',
          fluteLength: 0,
          bottomDiameter: 12,
          topDiameter,
          cornerRadius: 0,
        }),
      )
      expect(assembly.tool).toMatchObject({ diameter: 12 })
      expect(assembly.tool).not.toHaveProperty('taperAngleDeg')
      expect(RotatingToolAssemblySchema.safeParse(assembly).success).toBe(true)
    }
  })

  it('reads a keyseat’s and a dovetail’s undercut reach as the summary of the same tool states it', () => {
    // A step of no height, then an 8 mm neck under a 12 mm shank: the disc overhangs the neck.
    const shaft = [cylinder(14, 0), cylinder(8, 10), cylinder(12, 20)]
    const heads: Array<[KernelToolHead, number]> = [
      [{ kind: 'KeyseatCutter', fluteLength: 3, diameter: 19, cornerRadius: 0 }, 19],
      [
        {
          kind: 'DovetailCutter',
          fluteLength: 4,
          bottomDiameter: 20,
          topDiameter: 12,
          cornerRadius: 0,
        },
        20,
      ],
    ]
    for (const [head, diameter] of heads) {
      // What the kernel's summary states of the same tool: (diameter − 8) / 2.
      const reach = (diameter - 8) / 2
      const fromSummary = toolFromSummary(
        summary({ kind: head.kind, diameter, undercutReach: reach }),
      )
      expect(fromSummary).toHaveProperty('undercutReach', reach)
      expect(assemblyFromRecord(record(head, { shaft })).tool, head.kind).toHaveProperty(
        'undercutReach',
        reach,
      )
    }
  })

  it('states a reach of zero where nothing stands narrower above the disc, as every reader does', () => {
    for (const shaft of [[], [cylinder(19, 0)], [cylinder(24, 20)]]) {
      const tool = assemblyFromRecord(
        record({ kind: 'KeyseatCutter', fluteLength: 3, diameter: 19, cornerRadius: 0 }, { shaft }),
      ).tool
      expect(tool).toHaveProperty('undercutReach', 0)
    }
    // A kind that does not undercut states none.
    expect(
      assemblyFromRecord(record({ kind: 'FlatEndmill', fluteLength: 18, diameter: 6 })).tool,
    ).not.toHaveProperty('undercutReach')
  })

  it('states a mill of several teeth by its one pitch, and each tip by its form', () => {
    const mill = (threadTip: Extract<KernelToolHead, { kind: 'ThreadMill' }>['threadTip']) =>
      assemblyFromRecord(
        record({
          kind: 'ThreadMill',
          fluteLength: 6,
          diameter: 10,
          threadPitchMinimum: 1.5,
          threadPitchMaximum: 1.5,
          threadTip,
          threadProfileDeg: 60,
          threadTaperDeg: 0,
          numberOfTeeth: 4,
        }),
      ).tool
    const point = mill({ kind: 'Point' })
    expect(point).toMatchObject({ thread: { pitch: 1.5, teeth: 4, tip: { form: 'point' } } })
    expect(point).not.toHaveProperty('thread.pitchMin')
    expect(mill({ kind: 'Round', radius: 0.08 })).toMatchObject({
      thread: { tip: { form: 'round', radius: 0.08 } },
    })
  })

  it('leaves out a flute count of zero', () => {
    const flat = assemblyFromRecord(
      record({ kind: 'FlatEndmill', fluteLength: 18, diameter: 6 }, { fluteCount: 0 }),
    )
    expect(flat.tool).not.toHaveProperty('fluteCount')
    const face = assemblyFromRecord(
      record(
        { kind: 'FaceEndmill', fluteLength: 5, diameter: 50, canSideMill: false },
        { fluteCount: 0 },
      ),
    )
    expect(face.tool).not.toHaveProperty('body.pockets')
  })

  it('states no shaft, and so no provenance, where the flutes reach the holder', () => {
    const assembly = assemblyFromRecord(
      record({ kind: 'FlatEndmill', fluteLength: 18, diameter: 6 }, { shaft: [] }),
    )
    expect(assembly.tool).not.toHaveProperty('shaft')
    expect(assembly.tool).not.toHaveProperty('provenance')
    expect(assembly.stickout).toBe(18)
    expect(RotatingToolAssemblySchema.safeParse(assembly).success).toBe(true)
  })

  it('reaches its stickout through every layer of its shaft', () => {
    const shaft = [
      { thickness: 4, bottomDiameter: 5.8, topDiameter: 5.8 },
      { thickness: 1, bottomDiameter: 5.8, topDiameter: 6 },
      { thickness: 25, bottomDiameter: 6, topDiameter: 6 },
    ]
    const assembly = assemblyFromRecord(
      record({ kind: 'FlatEndmill', fluteLength: 18, diameter: 6 }, { shaft }),
    )
    expect(assembly.stickout).toBe(48)
    expect(assembly.tool.shaft).toEqual(shaft)
  })

  it('keeps a holder not known null, and a stated one as its outline alone', () => {
    const flat: KernelToolHead = { kind: 'FlatEndmill', fluteLength: 18, diameter: 6 }
    expect(assemblyFromRecord(record(flat)).holder).toBeNull()
    const layers = [{ thickness: 20, bottomDiameter: 22, topDiameter: 28 }]
    const assembly = assemblyFromRecord(record(flat, { holder: { layers } }))
    expect(assembly.holder).toEqual({ layers, gaugeLength: null })
    expect(RotatingToolAssemblySchema.parse(assembly)).toEqual(assembly)
  })

  it('keeps a holder of no layers, which holds nothing, rather than read it as not known', () => {
    const assembly = assemblyFromRecord(
      record({ kind: 'FlatEndmill', fluteLength: 18, diameter: 6 }, { holder: { layers: [] } }),
    )
    expect(assembly.holder).toEqual({ layers: [], gaugeLength: null })
    expect(RotatingToolAssemblySchema.safeParse(assembly).success).toBe(true)
  })

  it('reads a shank wider than the cut off a synthesized shaft, never as a stated one', () => {
    const tool = assemblyFromRecord(
      record({ kind: 'FlatEndmill', fluteLength: 9, diameter: 3 }, { shaft: [cylinder(6, 30)] }),
    ).tool
    expect(shankOf(tool)).toBe(6)
    expect(statedShank(tool)).toBeNull()
  })
})
