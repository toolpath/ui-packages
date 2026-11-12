import { describe, expect, it } from 'vitest'

import { cylinder } from '../src/cones.js'
import { fusionTool } from '../src/export/fusion/index.js'
import { isoGeometry } from '../src/export/catalog.js'
import { mastercamLibrary } from '../src/export/mastercam/index.js'
import {
  assemblyFromSummary,
  clampedShank,
  cuttingDiameter,
  stickoutRange,
  toolFromSummary,
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
