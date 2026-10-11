/**
 * What the Fusion importer reads back, and what it leaves out.
 *
 * Records are written the way `ToolLibrary.toJson()` writes them — lengths in
 * the record's own unit — and the round trip is held against the exporter, so
 * the two directions cannot drift apart unnoticed.
 */

import { describe, expect, it } from 'vitest'

import type { CatalogTool } from '../src/export/catalog.js'
import { fusionTool, type FusionTool } from '../src/export/fusion/index.js'
import { fromFusionLibrary, fromFusionTool } from '../src/import/fusion/index.js'

const GUID = '9da403e4-b6e7-4019-8f8b-d13955d7aae7'

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
      expect(read?.notes[0]?.kind).toBe('filled')
    }
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
    expect(read.notes[0]?.kind).toBe('skipped')
  })
})

describe('the round trip', () => {
  const tools: CatalogTool[] = [
    {
      form: 'flat end mill',
      guid: GUID,
      unit: 'millimeters',
      catalogNumber: 'PROD-001',
      geometry: { DC: 6, SFDM: 6, OAL: 57, LCF: 18, NOF: 4, LBH: 24 },
    },
    {
      form: 'drill',
      guid: GUID,
      unit: 'inches',
      geometry: { DC: 12.7, SFDM: 12.7, OAL: 101.6, LCF: 50.8, NOF: 2, SIG: 118 },
    },
  ]

  it.each(tools.map((tool) => [`${tool.unit} ${tool.form}`, tool] as const))(
    'an exported %s reads back to the geometry it started from',
    (_, tool) => {
      const written = fusionTool({ tool }).tool as FusionTool
      const read = fromFusionTool(written)
      expect(read?.tool.form).toBe(tool.form)
      expect(read?.guid).toBe(tool.guid)
      expect(read?.unit).toBe(tool.unit)
      expect(read?.tool.geometry).toMatchObject(tool.geometry)
    },
  )
})
