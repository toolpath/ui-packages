/**
 * A Fusion entry read into the record, written back out, and read again.
 *
 * For every type the reader accepts, the record carries what Fusion requires
 * of that type, so the entry comes back as a tool rather than being skipped,
 * and every required value it stated comes back as it went in, a spot drill as
 * a spot drill. A thread mill's teeth, range and tip and a tap's lead come back
 * as stated rather than as the conventions.
 *
 * The written entry is not the one read: the exporter always writes the shaft
 * as `shaft.segments`, with the shoulder and shank scalars set so they add
 * nothing on re-read. What holds is the record: read again, the tool (its
 * `shaft` with it), the stickout and the holder are the ones first read, to
 * float rounding ({@link expectClose}). Only the holder's JSON comes back byte
 * for byte.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  FUSION_LIBRARY_VERSION,
  FUSION_SEGMENT_KEYS,
  fusionLibraryJson,
  fusionTool,
  type FusionTool,
} from '../src/export/fusion/index.js'
import { fusionType } from '../src/export/fusion/schema.js'
import { readFusionEntry } from '../src/import/fusion/index.js'
import { cylinder } from '../src/cones.js'
import { sliceAt, stackHeight, type RotatingToolAssembly } from '../src/index.js'
import { solid } from './tools.js'

const GUID = '0c0c0c0c-1111-4222-8333-444444444444'
const HOLDER_GUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/** A plain shank under every milling cutter below: what the types share. */
const shank = { SFDM: 8, OAL: 60, LB: 30, NOF: 3, HAND: true, CSP: false }

const ENTRIES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  [
    'flat end mill',
    { ...shank, DC: 10, LCF: 20, SFDM: 10, 'shoulder-length': 25, 'shoulder-diameter': 9 },
  ],
  ['ball end mill', { ...shank, DC: 8, LCF: 16 }],
  ['bull nose end mill', { ...shank, DC: 8, LCF: 16, RE: 1 }],
  ['chamfer mill', { ...shank, DC: 10, LCF: 2, TA: 45, 'tip-diameter': 1 }],
  ['counter sink', { ...shank, DC: 10, LCF: 5, SIG: 90, 'tip-diameter': 0 }],
  ['drill', { ...shank, DC: 8, LCF: 40, LB: 50, SIG: 118 }],
  ['spot drill', { ...shank, DC: 8, LCF: 4, SIG: 90, 'tip-diameter': 0 }],
  ['radius mill', { ...shank, DC: 6, LCF: 4, RE: 2, 'tip-length': 1 }],
  ['tap right hand', { ...shank, DC: 6, LCF: 12, TP: 1 }],
  ['tap left hand', { ...shank, DC: 6, LCF: 12, TP: 1 }],
  ['slot mill', { ...shank, DC: 20, LCF: 3, RE: 0.5 }],
  ['dovetail mill', { ...shank, DC: 12, LCF: 3, TA: 30, RE: 0.2 }],
  [
    'thread mill',
    {
      ...shank,
      DC: 6,
      LCF: 10,
      TP: 1,
      NT: 1,
      'thread-profile-angle': 60,
      'thread-tip-type': 'point',
    },
  ],
  [
    'face mill',
    {
      ...shank,
      DC: 50,
      LCF: 5,
      TA: 45,
      RE: 0.8,
      SFDM: 22,
      DCX: 60,
      'upper-radius': 0.5,
    },
  ],
]

/**
 * `actual` is `expected` to float rounding: numbers within `tolerance`,
 * everything else strict. A key whose value is undefined is absent, as
 * `toEqual` reads it.
 */
const expectClose = (
  actual: unknown,
  expected: unknown,
  tolerance = 1e-6,
  path = 'record',
): void => {
  if (typeof actual === 'number' && typeof expected === 'number') {
    expect(
      Math.abs(actual - expected),
      `${path}: ${actual} against ${expected}`,
    ).toBeLessThanOrEqual(tolerance)
    return
  }
  if (
    typeof actual !== 'object' ||
    actual === null ||
    typeof expected !== 'object' ||
    expected === null
  ) {
    expect(actual, path).toBe(expected)
    return
  }
  const fields = (value: object): Array<[string, unknown]> =>
    Object.entries(value)
      .filter(([, each]) => each !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
  const got = fields(actual)
  const want = fields(expected)
  expect(Array.isArray(actual), path).toBe(Array.isArray(expected))
  expect(
    got.map(([key]) => key),
    path,
  ).toEqual(want.map(([key]) => key))
  for (const [index, [key, value]] of want.entries()) {
    expectClose(got[index]?.[1], value, tolerance, `${path}.${key}`)
  }
}

/** Required values the exporter states its own way: the shoulder is the shaft writer's. */
const SHAFT_SCALARS = new Set(['shoulder-length', 'shoulder-diameter'])

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** What Autodesk's schema permits of each type, as `pnpm schema:fusion:adopt` reduced it. */
const digest = JSON.parse(readFileSync(join(ROOT, 'schemas/fusion/digest.json'), 'utf8')) as {
  types: Record<string, { recordAllowed: ReadonlyArray<string> }>
}

/** Assert a written record holds to the schema: its keys, its geometry, and its segments. */
const conforms = (tool: FusionTool): void => {
  const rules = fusionType(tool.type)!
  for (const key of rules.recordRequired) {
    expect(tool, `${tool.type} is missing ${key}`).toHaveProperty(key)
  }
  const allowed = digest.types[tool.type]?.recordAllowed ?? []
  for (const key of Object.keys(tool)) {
    expect(allowed, `${tool.type} writes ${key}, which it may not`).toContain(key)
  }
  for (const key of rules.geometryRequired) {
    expect(tool.geometry, `${tool.type} is missing geometry.${key}`).toHaveProperty(key)
  }
  for (const key of Object.keys(tool.geometry)) {
    expect(rules.geometryAllowed, `${tool.type} writes geometry.${key}`).toContain(key)
  }
  for (const segment of [...tool.shaft.segments, ...(tool.holder?.segments ?? [])]) {
    expect(Object.keys(segment).sort()).toEqual([...FUSION_SEGMENT_KEYS])
  }
}

/** An entry as a library states one. */
const entryOf = (
  type: string,
  geometry: Record<string, unknown>,
  fields: Record<string, unknown> = {},
): Record<string, unknown> => ({ type, guid: GUID, unit: 'millimeters', ...fields, geometry })

/** The entry read, then written as a library's text and read back. */
const roundTrip = (entry: Record<string, unknown>) => {
  const read = readFusionEntry(entry) as RotatingToolAssembly
  expect(read, 'the entry is read').not.toBeNull()
  const written = fusionTool({
    tool: read.tool,
    assembly: { stickout: read.stickout, holder: read.holder },
  })
  const tool = written.tool as FusionTool
  expect(tool, written.notes.map((note) => note.message).join(' | ')).not.toBeNull()
  const text = fusionLibraryJson({ version: FUSION_LIBRARY_VERSION, data: [tool] })
  const [entryAgain] = (JSON.parse(text) as { data: Array<unknown> }).data
  return { read, written: tool, notes: written.notes, again: readFusionEntry(entryAgain) }
}

describe('a Fusion entry read and written back', () => {
  it.each(ENTRIES)('%s', (type, geometry) => {
    const { read, written, again } = roundTrip(entryOf(type, geometry))
    expect(written.type).toBe(type)
    conforms(written)
    const required = fusionType(written.type)!.geometryRequired
    for (const key of required.filter((each) => each in geometry && !SHAFT_SCALARS.has(each))) {
      expect(written.geometry[key], `${type} geometry.${key}`).toBe(geometry[key])
    }
    // Fusion's tap states its hand by its type and has no `HAND` to carry the hand of cut.
    const hand = type.startsWith('tap') ? { hand: undefined } : {}
    expectClose(again, { ...read, tool: { ...read.tool, ...hand } })
  })
})

/** Entries whose shaft is more than a plain shank, each read, written and read again. */
const SHAFTS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  [
    'explicit segments',
    entryOf(
      'flat end mill',
      { ...shank, DC: 6, LCF: 12, LB: 40 },
      {
        shaft: {
          segments: [
            { height: 10, 'lower-diameter': 5.5, 'upper-diameter': 5.5 },
            { height: 5, 'lower-diameter': 5.5, 'upper-diameter': 8 },
          ],
        },
      },
    ),
  ],
  [
    'a tapered segment',
    entryOf(
      'ball end mill',
      { ...shank, DC: 4, LCF: 8 },
      { shaft: { segments: [{ height: 15, 'lower-diameter': 3.8, 'upper-diameter': 8 }] } },
    ),
  ],
  [
    'a necked tool',
    entryOf('flat end mill', {
      ...shank,
      DC: 6,
      LCF: 12,
      SFDM: 6,
      'shoulder-length': 25,
      'shoulder-diameter': 5.5,
    }),
  ],
  [
    'a wider shoulder',
    entryOf('flat end mill', {
      ...shank,
      DC: 10,
      LCF: 20,
      'shoulder-length': 25,
      'shoulder-diameter': 9,
    }),
  ],
  [
    'a counter sink with a cone remainder',
    entryOf('counter sink', { ...shank, DC: 10, LCF: 3, SIG: 90, 'tip-diameter': 1 }),
  ],
  [
    'a counter sink whose cone stands past LB',
    entryOf('counter sink', { ...shank, DC: 16, LCF: 1, SIG: 60, 'tip-diameter': 0, LB: 5 }),
  ],
  [
    'a face mill with a shaft',
    entryOf(
      'face mill',
      { ...shank, DC: 50, LCF: 5, TA: 45, RE: 0.8, SFDM: 22, OAL: 50, LB: 40, 'upper-radius': 0.5 },
      { shaft: { segments: [{ height: 10, 'lower-diameter': 40, 'upper-diameter': 30 }] } },
    ),
  ],
  [
    'an inch tool',
    entryOf(
      'flat end mill',
      { ...shank, DC: 0.375, LCF: 1, SFDM: 0.375, OAL: 3, LB: 1.75 },
      {
        unit: 'inches',
        shaft: { segments: [{ height: 0.5, 'lower-diameter': 0.35, 'upper-diameter': 0.35 }] },
      },
    ),
  ],
  [
    'a metric tool on round inches',
    entryOf('flat end mill', {
      ...shank,
      DC: 6.35,
      LCF: 19.05,
      LB: 31.75,
      OAL: 63.5,
      'shoulder-length': 25.4,
      'shoulder-diameter': 6,
    }),
  ],
  [
    'segments past LB',
    entryOf(
      'flat end mill',
      { ...shank, DC: 6, LCF: 12, LB: 20 },
      { shaft: { segments: [{ height: 20, 'lower-diameter': 5.5, 'upper-diameter': 5.5 }] } },
    ),
  ],
]

describe('a shaft read and written back', () => {
  it.each(SHAFTS)('%s', (_name, entry) => {
    const { read, written, notes, again } = roundTrip(entry)
    conforms(written)
    expect(notes.filter((note) => note.field === 'shaft.segments')).toEqual([])
    expectClose(again, read)
  })

  it('writes the segments below the stickout, and a shoulder that adds nothing', () => {
    const { written } = roundTrip(SHAFTS[0]![1])
    expect(written.shaft.segments).toEqual([
      { height: 10, 'lower-diameter': 5.5, 'upper-diameter': 5.5 },
      { height: 5, 'lower-diameter': 5.5, 'upper-diameter': 8 },
    ])
    expect(written.geometry).toMatchObject({
      LCF: 12,
      'shoulder-length': 12,
      'shoulder-diameter': 5.5,
      SFDM: 8,
      OAL: 60,
      LB: 40,
    })
  })

  it('strips the cone the reader adds back, and sets the shoulder at its top', () => {
    const { read, written } = roundTrip(SHAFTS[4]![1])
    // A 90° cone from ⌀1 to ⌀10 stands 4.5 tall; the flutes take 3 of it.
    expect(read.tool.shaft?.[0]?.thickness).toBeCloseTo(1.5)
    expect(written.shaft.segments).toEqual([])
    expect(written.geometry['shoulder-length']).toBe(4.5)
  })
})

describe('a holder read and written back', () => {
  const holder = {
    type: 'holder',
    unit: 'millimeters',
    guid: HOLDER_GUID,
    gaugeLength: 70,
    segments: [
      { height: 20, 'lower-diameter': 25, 'upper-diameter': 30 },
      { height: 50, 'lower-diameter': 40, 'upper-diameter': 40 },
    ],
    description: 'ER16 chuck',
    vendor: 'Holdco',
  }
  const { read, written, again } = roundTrip(
    entryOf('flat end mill', { ...shank, DC: 8, LCF: 16 }, { holder }),
  )

  it('comes back byte for byte', () => {
    expect(JSON.stringify(written.holder)).toBe(JSON.stringify(holder))
  })

  it('comes back as the same record, the tool and its stickout with it', () => {
    expect(read.holder).toMatchObject({ clamping: 'bore', boreDiameter: 8 })
    expectClose(again, read)
  })
})

describe('a shaft nobody stated whole', () => {
  it('reads assumed, and is not written: Fusion requires the SFDM it does not state', () => {
    const read = readFusionEntry(entryOf('flat end mill', { ...shank, DC: 6, LCF: 12, SFDM: 0 }))
    expect(read?.tool.provenance).toEqual({ shank: 'assumed' })
    const written = fusionTool({
      tool: read!.tool,
      assembly: { stickout: read!.stickout, holder: null },
    })
    expect(written.tool).toBeNull()
    expect(
      written.notes.filter((note) => note.kind === 'skipped').map((note) => note.field),
    ).toEqual(['geometry.SFDM', 'geometry.shoulder-diameter', undefined])
    expect(written.notes).not.toContainEqual(expect.objectContaining({ field: 'geometry.OAL' }))
  })
})

describe('what Fusion cannot carry', () => {
  it('cuts a shaft that is not one plain shank above the stickout, and says so', () => {
    // A neck reaching past where the holder grips.
    const tool = solid({
      guid: GUID,
      diameter: 6,
      fluteLength: 12,
      fluteCount: 2,
      shaft: [cylinder(5.5, 30), cylinder(6, 20)],
    })
    const written = fusionTool({ tool, assembly: { stickout: 30, holder: null } })
    expect((written.tool as FusionTool).shaft.segments).toEqual([
      { height: 18, 'lower-diameter': 5.5, 'upper-diameter': 5.5 },
    ])
    expect(written.notes).toContainEqual(
      expect.objectContaining({ kind: 'dropped', field: 'shaft.segments' }),
    )
  })

  it('strips the cone at the stickout written, not at the one it was read at', () => {
    // A 60° cone from a point to ⌀16 stands 13.86 tall; read at LB 20 the flutes take 4 of it.
    const entry = entryOf('counter sink', {
      ...shank,
      DC: 16,
      LCF: 4,
      SIG: 60,
      'tip-diameter': 0,
      SFDM: 16,
      LB: 20,
    })
    const read = readFusionEntry(entry) as RotatingToolAssembly
    const written = fusionTool({ tool: read.tool, assembly: { stickout: 12, holder: null } })
    const again = readFusionEntry(written.tool) as RotatingToolAssembly
    const before = read.tool.shaft ?? []
    const after = again.tool.shaft ?? []
    // The cone once, to the stickout, and the shank above it: no second cone.
    expect(after).toHaveLength(2)
    expect(after[0]?.thickness).toBeCloseTo(8)
    expect(after[1]).toEqual(cylinder(16, 48))
    expectClose(sliceAt(after, 8), sliceAt(before, 8))
    expect(stackHeight(after)).toBeCloseTo(stackHeight(before))
    expect(written.notes).not.toContainEqual(
      expect.objectContaining({ kind: 'filled', field: 'shaft.segments' }),
    )
  })

  it('drops the cone whole where the reader stacks it taller than the shaft, and says so', () => {
    const entry = entryOf('counter sink', {
      ...shank,
      DC: 16,
      LCF: 4,
      SIG: 60,
      'tip-diameter': 0,
      SFDM: 16,
      LB: 8,
    })
    const read = readFusionEntry(entry) as RotatingToolAssembly
    const written = fusionTool({ tool: read.tool, assembly: { stickout: 20, holder: null } })
    expect(written.notes).toContainEqual(
      expect.objectContaining({ kind: 'filled', field: 'shaft.segments' }),
    )
  })

  it('writes a coned shaft whole where it does not start with the cone, and says so', () => {
    const tool = solid({
      guid: GUID,
      kind: 'Countersink',
      diameter: 10,
      fluteLength: 3,
      tipAngleDeg: 90,
      tipDiameter: 1,
      fluteCount: 2,
      shaft: [cylinder(7, 10), cylinder(8, 47)],
    })
    const written = fusionTool({ tool, assembly: { stickout: 30, holder: null } })
    expect((written.tool as FusionTool).shaft.segments).toEqual([
      { height: 10, 'lower-diameter': 7, 'upper-diameter': 7 },
    ])
    expect(written.notes).toContainEqual(
      expect.objectContaining({ kind: 'filled', field: 'shaft.segments' }),
    )
  })
})

/** Justin Mimbs' table on #322: what the conventions used to turn these into. */
const THREADED: ReadonlyArray<readonly [string, string, Record<string, unknown>]> = [
  ['a multi-tooth thread mill', 'thread mill', { NT: 4, TP: 1.5 }],
  [
    'a single-point range mill with a flat tip',
    'thread mill',
    { TPN: 1, TPX: 2, 'thread-tip-type': 'flat', 'thread-tip-width': 0.1 },
  ],
  ['a tap with a lead', 'tap right hand', { TP: 1, partialThreadCount: 5 }],
]

describe('a threaded entry read and written back', () => {
  it.each(THREADED)('keeps what %s states', (_name, type, stated) => {
    const geometry = { ...shank, DC: 6, LCF: 10, 'thread-profile-angle': 60, ...stated }
    const { read, written, again } = roundTrip(entryOf(type, geometry))
    expect(written.geometry).toMatchObject(stated)
    // The tool may gain a convention it did not state (a tip); its shaft and stickout may not.
    expect(again?.tool.shaft).toEqual(read.tool.shaft)
    expect(again?.stickout).toBe(read.stickout)
  })

  it('fills a point and one tooth only where the record states neither', () => {
    const { written } = roundTrip(entryOf('thread mill', { ...shank, DC: 6, LCF: 10, TP: 1 }))
    expect(written.geometry).toMatchObject({ NT: 1, 'thread-tip-type': 'point' })
  })
})
