/**
 * What the Fusion importer reads back, and what it leaves out.
 *
 * Records are written the way `ToolLibrary.toJson()` writes them — lengths in
 * the record's own unit — and the round trip is held against the exporter, so
 * the two directions cannot drift apart unnoticed.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { CatalogTool } from '../src/export/catalog.js'
import { fusionTool, type FusionTool } from '../src/export/fusion/index.js'
import { fromFusionLibrary, fromFusionTool } from '../src/import/fusion/index.js'

const GUID = '9da403e4-b6e7-4019-8f8b-d13955d7aae7'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const digest = JSON.parse(readFileSync(join(ROOT, 'fusion/digest.json'), 'utf8')) as {
  types: Record<string, unknown>
}

const inchEndMill = {
  type: 'flat end mill',
  unit: 'inches',
  guid: GUID,
  BMC: 'carbide',
  description: '3/8 4FL',
  vendor: 'Example Tools Inc',
  'product-id': 'EX-375',
  'post-process': { number: 12, comment: '' },
  geometry: {
    DC: 0.375,
    SFDM: 0.375,
    OAL: 2.5,
    LCF: 1,
    LB: 1.25,
    NOF: 4,
    RE: 0,
    SIG: 0,
    HAND: true,
    CSP: false,
    'thread-tip-type': 'point',
  },
}

const holder = { type: 'holder', unit: 'millimeters', guid: GUID, segments: [] }

describe('one tool', () => {
  it('converts an inch tool’s lengths to millimetres and leaves counts and angles alone', () => {
    const read = fromFusionTool(inchEndMill)
    expect(read).not.toBeNull()
    const geometry = read?.tool.geometry ?? {}
    expect(geometry.DC).toBe(9.525)
    expect(geometry.OAL).toBe(63.5)
    expect(geometry.LCF).toBe(25.4)
    expect(geometry.NOF).toBe(4)
    expect(geometry.SIG).toBe(0)
    expect(read?.unit).toBe('inches')
  })

  it('stores Fusion’s LB as the dictionary’s LBH', () => {
    const geometry = fromFusionTool(inchEndMill)?.tool.geometry ?? {}
    expect(geometry.LBH).toBe(31.75)
    expect(geometry).not.toHaveProperty('LB')
  })

  it('drops booleans and enums, which a numeric geometry cannot hold', () => {
    const read = fromFusionTool(inchEndMill)
    expect(read?.tool.geometry).not.toHaveProperty('HAND')
    expect(read?.tool.geometry).not.toHaveProperty('CSP')
    expect(read?.tool.geometry).not.toHaveProperty('thread-tip-type')
    expect(read?.notes).toEqual([])
  })

  it('carries identity beside the tool', () => {
    const read = fromFusionTool(inchEndMill)
    expect(read?.guid).toBe(GUID)
    expect(read?.tool.form).toBe('flat end mill')
    expect(read?.tool.label).toBe('EX-375')
    expect(read?.description).toBe('3/8 4FL')
    expect(read?.vendor).toBe('Example Tools Inc')
    expect(read?.catalogNumber).toBe('EX-375')
    expect(read?.number).toBe(12)
  })

  it('passes a millimetre tool through unchanged', () => {
    const read = fromFusionTool({
      ...inchEndMill,
      unit: 'millimeters',
      geometry: { DC: 6, OAL: 57, LCF: 18, NOF: 3, RE: 0.5 },
    })
    expect(read?.tool.geometry).toEqual({ DC: 6, OAL: 57, LCF: 18, NOF: 3, RE: 0.5 })
    expect(read?.unit).toBe('millimeters')
  })

  it('gives a ball end mill with no corner radius half its diameter, and says so', () => {
    for (const RE of [undefined, 0]) {
      const read = fromFusionTool({
        type: 'ball end mill',
        unit: 'millimeters',
        geometry: { DC: 8, ...(RE === undefined ? {} : { RE }) },
      })
      expect(read?.tool.geometry.RE).toBe(4)
      expect(read?.tool.provenance).toEqual({ RE: 'derived' })
      expect(read?.notes.map((note) => [note.kind, note.field])).toEqual([
        ['filled', 'geometry.RE'],
      ])
    }
  })

  it('reads a spot drill’s body diameter as DC when its tip is a point', () => {
    for (const type of ['spot drill', 'center drill']) {
      const read = fromFusionTool({
        type,
        unit: 'inches',
        geometry: { DC: 0, SFDM: 0.5, SIG: 90 },
      })
      expect(read?.tool.geometry.DC).toBe(12.7)
      expect(read?.tool.geometry.SIG).toBe(90)
      expect(read?.tool.provenance).toEqual({ DC: 'derived' })
      expect(read?.notes.map((note) => [note.kind, note.field])).toEqual([
        ['filled', 'geometry.DC'],
      ])
    }
  })

  it('fills a spot drill’s DC from SFDM when DC is absent', () => {
    const read = fromFusionTool({
      type: 'spot drill',
      unit: 'millimeters',
      geometry: { SFDM: 10, SIG: 90 },
    })
    expect(read?.tool.geometry).toEqual({ DC: 10, SFDM: 10, SIG: 90 })
    expect(read?.tool.provenance).toEqual({ DC: 'derived' })
    expect(read?.notes.map((note) => [note.kind, note.field])).toEqual([['filled', 'geometry.DC']])
  })

  it.each([
    ['absent', { DC: 0, SIG: 90 }],
    ['zero', { DC: 0, SFDM: 0, SIG: 90 }],
  ])('leaves a spot drill’s DC alone when SFDM is %s', (_, geometry) => {
    const read = fromFusionTool({ type: 'spot drill', unit: 'millimeters', geometry })
    expect(read?.tool.geometry).toEqual(geometry)
    expect(read?.tool).not.toHaveProperty('provenance')
    expect(read?.notes).toEqual([])
  })

  it('supplies no corner radius to a ball end mill with no diameter', () => {
    const read = fromFusionTool({
      type: 'ball end mill',
      unit: 'millimeters',
      geometry: { OAL: 50 },
    })
    expect(read?.tool.geometry).toEqual({ OAL: 50 })
    expect(read?.tool).not.toHaveProperty('provenance')
    expect(read?.notes).toEqual([])
  })

  it('supplies no corner radius to a flat end mill whose RE is 0', () => {
    const read = fromFusionTool({
      type: 'flat end mill',
      unit: 'millimeters',
      geometry: { DC: 8, RE: 0 },
    })
    expect(read?.tool.geometry).toEqual({ DC: 8, RE: 0 })
    expect(read?.tool).not.toHaveProperty('provenance')
    expect(read?.notes).toEqual([])
  })

  it('does not swap a chamfer mill’s DC for its SFDM', () => {
    const read = fromFusionTool({
      type: 'chamfer mill',
      unit: 'millimeters',
      geometry: { DC: 1, SFDM: 10, TA: 45 },
    })
    expect(read?.tool.geometry.DC).toBe(1)
  })

  it('reads a type with no form as other, and says so', () => {
    const read = fromFusionTool({ type: 'form mill', unit: 'millimeters', geometry: { DC: 10 } })
    expect(read?.tool.form).toBe('other')
    expect(read?.tool.geometry.DC).toBe(10)
    expect(read?.notes.map((note) => [note.kind, note.field])).toEqual([['coerced', 'type']])
  })

  it('reads a corner chamfer end mill, which mills but has no form, as other', () => {
    const read = fromFusionTool({
      type: 'corner chamfer end mill',
      unit: 'millimeters',
      geometry: { DC: 10 },
    })
    expect(read?.tool.form).toBe('other')
    expect(read?.notes.map((note) => [note.kind, note.field])).toEqual([['coerced', 'type']])
  })

  it('drops a key whose unit is unknown, and says so', () => {
    const read = fromFusionTool({
      type: 'drill',
      unit: 'inches',
      geometry: { DC: 0.25, 'mystery-length': 1 },
    })
    expect(read?.tool.geometry).toEqual({ DC: 6.35 })
    expect(read?.notes[0]).toMatchObject({ kind: 'dropped', field: 'geometry.mystery-length' })
  })

  it('reads a numeric string', () => {
    const read = fromFusionTool({ type: 'drill', unit: 'millimeters', geometry: { DC: '6.5' } })
    expect(read?.tool.geometry.DC).toBe(6.5)
  })

  it('reads exponent notation and drops a blank or non-numeric string', () => {
    const read = fromFusionTool({
      type: 'drill',
      unit: 'millimeters',
      geometry: { DC: '1e3', OAL: ' ', LCF: 'abc' },
    })
    expect(read?.tool.geometry).toEqual({ DC: 1000 })
    expect(read?.notes).toEqual([
      {
        subject: '(unnamed Fusion tool)',
        kind: 'dropped',
        field: 'geometry.OAL',
        message: '" " is not a number',
      },
      {
        subject: '(unnamed Fusion tool)',
        kind: 'dropped',
        field: 'geometry.LCF',
        message: '"abc" is not a number',
      },
    ])
  })

  it('names a non-finite number as itself, not as null', () => {
    const read = fromFusionTool({
      type: 'drill',
      unit: 'millimeters',
      geometry: { DC: Number.POSITIVE_INFINITY, OAL: Number.NaN },
    })
    expect(read?.tool.geometry).toEqual({})
    expect(read?.notes.map((note) => note.message)).toEqual([
      'Infinity is not a number',
      'NaN is not a number',
    ])
  })

  it('keeps a positive integer tool number and nothing else', () => {
    const numbered = (number: unknown) =>
      fromFusionTool({ ...inchEndMill, 'post-process': { number } })
    expect(numbered(12)?.number).toBe(12)
    for (const number of [0, -1, 2.5]) {
      expect(numbered(number)).not.toHaveProperty('number')
    }
  })

  it('carries HAND as hand and CSP as coolantThrough, only from a boolean', () => {
    const read = (geometry: Record<string, unknown>) =>
      fromFusionTool({ type: 'drill', unit: 'millimeters', geometry: { DC: 6, ...geometry } })
    expect(read({ HAND: true, CSP: true })).toMatchObject({ hand: 'right', coolantThrough: true })
    expect(read({ HAND: false, CSP: false })).toMatchObject({ hand: 'left', coolantThrough: false })
    const unstated = read({ HAND: 'true', CSP: 1 })
    expect(unstated).not.toHaveProperty('hand')
    expect(unstated).not.toHaveProperty('coolantThrough')
    expect(unstated?.tool.geometry).toEqual({ DC: 6 })
  })

  it('refuses a unit spelled any other way than Fusion spells it', () => {
    // Pinned: `Millimeters` is not Fusion's spelling, and a guess is refused.
    expect(fromFusionTool({ type: 'drill', unit: 'Millimeters', geometry: { DC: 6 } })).toBeNull()
  })

  it.each(['turning general', 'probe'])(
    'does not read a %s, which is not a milling tool',
    (type) => {
      expect(fromFusionTool({ type, unit: 'millimeters', geometry: { DC: 6 } })).toBeNull()
    },
  )

  it('reads every digest type it does not skip, and skips exactly the non-milling ones', () => {
    const skipped = Object.keys(digest.types).filter(
      (type) => fromFusionTool({ type, unit: 'millimeters', geometry: {} }) === null,
    )
    expect(skipped.sort()).toEqual([
      'electric arc wire',
      'holder',
      'laser cutter',
      'laser powder',
      'laser wire',
      'plasma cutter',
      'probe',
      'tool block',
      'turning boring',
      'turning general',
      'turning grooving',
      'turning threading',
      'waterjet',
    ])
  })

  it('refuses a holder, a non-tool and a record with no unit', () => {
    expect(fromFusionTool(holder)).toBeNull()
    expect(fromFusionTool(null)).toBeNull()
    expect(fromFusionTool('drill')).toBeNull()
    expect(fromFusionTool({ geometry: {} })).toBeNull()
    expect(fromFusionTool({ type: 'drill', geometry: { DC: 6 } })).toBeNull()
  })
})

describe('a library', () => {
  const library = {
    version: 33,
    data: [
      holder,
      inchEndMill,
      { type: 'drill', geometry: { DC: 6 } },
      { type: 'drill', unit: 'millimeters', guid: 'b', geometry: { DC: 6 } },
    ],
  }

  it('skips holders and indexes each tool by its place in data', () => {
    const { tools } = fromFusionLibrary(library)
    expect(tools.map((entry) => [entry.index, entry.guid])).toEqual([
      [1, GUID],
      [3, 'b'],
    ])
  })

  it('notes an entry it could not read, by index, and not the holder', () => {
    const { notes } = fromFusionLibrary(library)
    expect(notes).toEqual([expect.objectContaining({ subject: 'data[2]', kind: 'skipped' })])
  })

  it('reads a document with no data array as no tools, and says so', () => {
    const read = fromFusionLibrary({ version: 33 })
    expect(read.tools).toEqual([])
    expect(read.notes.map((note) => [note.subject, note.kind, note.field])).toEqual([
      ['(library)', 'skipped', 'data'],
    ])
  })

  it('reads an empty data array as nothing, with nothing to say', () => {
    expect(fromFusionLibrary({ version: 33, data: [] })).toEqual({ tools: [], notes: [] })
  })

  it('notes every entry that is not a record, by index', () => {
    const read = fromFusionLibrary({ version: 33, data: [null, 5, 'x', []] })
    expect(read.tools).toEqual([])
    expect(read.notes.map((note) => [note.subject, note.kind])).toEqual([
      ['data[0]', 'skipped'],
      ['data[1]', 'skipped'],
      ['data[2]', 'skipped'],
      ['data[3]', 'skipped'],
    ])
  })

  it('converts each tool by its own unit in a mixed library', () => {
    const { tools } = fromFusionLibrary({
      version: 33,
      data: [inchEndMill, { type: 'drill', unit: 'millimeters', geometry: { DC: 6.8 } }],
    })
    expect(tools[0]?.tool.geometry.DC).toBe(9.525)
    expect(tools[1]?.tool.geometry.DC).toBe(6.8)
  })

  it('notes a non-milling entry as skipped, and still not the holder', () => {
    const { tools, notes } = fromFusionLibrary({
      version: 33,
      data: [holder, { type: 'turning general', unit: 'millimeters', guid: 't', geometry: {} }],
    })
    expect(tools).toEqual([])
    expect(notes).toEqual([
      {
        subject: 'data[1]',
        kind: 'skipped',
        field: 'type',
        message: 'a "turning general" is not a milling or hole-making tool, so it is not read',
      },
    ])
  })
})

describe('the round trip', () => {
  // Values that are not inch-exact, so an inch record's six-decimal rounding
  // is exercised. A chamfer mill and a spot drill state `tip-diameter`, which
  // Fusion requires of them; without it the exporter returns `tool: null`.
  const geometries: Record<string, Record<string, number>> = {
    'flat end mill': { DC: 6, SFDM: 6, OAL: 57, LCF: 13.3, NOF: 3, LBH: 21.7 },
    drill: { DC: 6.8, SFDM: 6.8, OAL: 74.3, LCF: 34.1, NOF: 2, SIG: 140, LBH: 40.2 },
    'bull nose end mill': { DC: 10, SFDM: 10, OAL: 72.5, LCF: 22.2, NOF: 4, RE: 1.5, LBH: 30.3 },
    'chamfer mill': {
      DC: 1.1,
      SFDM: 8,
      OAL: 63.3,
      LCF: 9.7,
      NOF: 2,
      TA: 45,
      'tip-diameter': 1.1,
      LBH: 25.1,
    },
    'spot drill': {
      DC: 8.2,
      SFDM: 8.2,
      OAL: 61.7,
      LCF: 11.9,
      NOF: 2,
      SIG: 90,
      'tip-diameter': 0.3,
      LBH: 22.6,
    },
  }

  /** What the exporter fills and the importer then reads as stated. */
  const ADDED = ['assemblyGaugeLength', 'shoulder-diameter', 'shoulder-length']

  const cases = (['inches', 'millimeters'] as const).flatMap((unit) =>
    Object.entries(geometries).map(
      ([form, geometry]): CatalogTool => ({ form, guid: GUID, unit, geometry }),
    ),
  )

  it.each(cases.map((tool) => [`${tool.unit} ${tool.form}`, tool] as const))(
    'an exported %s reads back to the geometry it started from',
    (_, tool) => {
      const written = fusionTool({ tool }).tool as FusionTool
      expect(written).not.toBeNull()
      const read = fromFusionTool(written)
      expect(read?.tool.form).toBe(tool.form)
      expect(read?.guid).toBe(tool.guid)
      expect(read?.unit).toBe(tool.unit)
      expect(read?.notes).toEqual([])
      const geometry = read?.tool.geometry ?? {}
      for (const [key, value] of Object.entries(tool.geometry)) {
        expect(geometry[key], key).toBeCloseTo(value ?? Number.NaN, 4)
      }
      const extra = Object.keys(geometry).filter((key) => !(key in tool.geometry))
      expect(extra.sort()).toEqual(ADDED)
      // The exporter writes its defaults for HAND and CSP, and they come back.
      expect(read?.hand).toBe('right')
      expect(read?.coolantThrough).toBe(false)
    },
  )
})
