/**
 * A library this exporter writes, read back by SQLite.
 *
 * `sqlite-encoder.test.ts` proves the bytes are a database. This proves the
 * database is a *tool library*: that a tool's eight rows land in the eight
 * tables, that a holder's silhouette comes back the shape it went in, and that
 * an assembly's stickout survives the one arithmetic step the format makes you
 * do — `CScalar = overall length − stickout`, read back the other way.
 *
 * Everything is asserted through `node:sqlite` rather than against the
 * exporter's own bookkeeping, for the reason the encoder's suite gives: a
 * library written slightly wrong opens and answers most questions.
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { mastercamLibrary } from '../src/export/mastercam/index.js'
import { guidText } from '../src/export/mastercam/guid.js'
import type { CatalogTool } from '../src/export/catalog.js'
import type { CatalogHolder } from '../src/export/mastercam/holder.js'
import type { HolderProfile } from '../src/profile.js'
import { MM_PER_INCH } from '../src/units.js'

const scratch = mkdtempSync(join(tmpdir(), 'toolpath-mastercam-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

let written = 0
const open = (bytes: Uint8Array): DatabaseSync => {
  written += 1
  const path = join(scratch, `library-${written}.TOOLDB`)
  writeFileSync(path, bytes)
  const db = new DatabaseSync(path, { readOnly: true })
  expect(db.prepare('pragma integrity_check').get()).toEqual({ integrity_check: 'ok' })
  return db
}

const TOOL_GUID = '11111111-2222-4333-8444-555555555555'
const HOLDER_GUID = '66666666-7777-4888-8999-aaaaaaaaaaaa'

const endmill: CatalogTool = {
  form: 'flat end mill',
  label: '3/8 3FL Rough EM',
  guid: TOOL_GUID,
  unit: 'inches',
  vendor: 'Helical Solutions',
  catalogNumber: '95506432',
  substrate: 'carbide',
  coolantThrough: true,
  number: 101,
  geometry: {
    DC: 9.525,
    OAL: 88.9,
    LCF: 34.925,
    SFDM: 9.525,
    NOF: 3,
    'shoulder-length': 41.275,
  },
}

/** A stepped holder measured from its gage line, `z` ascending toward the nose. */
const holderProfile: HolderProfile = {
  points: [
    [0, 22.225],
    [50.8, 22.225],
    [50.8, 14],
    [88.9, 14],
    [88.9, 9],
    [101.6, 9],
  ],
  datum: 'gage-line',
  colletSeries: 'ER16',
  colletProtrusion: null,
}

const holder: CatalogHolder = {
  guid: HOLDER_GUID,
  holder: holderProfile,
  label: 'CAT40 ER16 4in',
  vendor: 'Haas',
  catalogNumber: '04-0007',
}

describe('a library Mastercam’s schema would recognise', () => {
  const { document, notes } = mastercamLibrary({
    holders: [holder],
    tools: [
      {
        tool: endmill,
        assembly: { holderGuid: HOLDER_GUID, stickout: 42.8625 },
        cuttingData: { spindleSpeed: 15_000, feedRate: 225, plungeRate: 25, retractRate: 50 },
      },
    ],
  })
  const db = open(document)

  it('writes every table the schema declares', () => {
    const count = db.prepare("select count(*) c from sqlite_master where type = 'table'").get() as {
      c: number
    }
    expect(count.c).toBe(79)
  })

  it('carries Mastercam’s own seed rows under its own guids', () => {
    expect(db.prepare('select count(*) c from TlToolType').get()).toEqual({ c: 20 })
    expect(db.prepare('select count(*) c from TlOpType').get()).toEqual({ c: 10 })
    const grade = db.prepare('select ID, Name from TlToolGrade').get() as {
      ID: Uint8Array
      Name: string
    }
    expect(grade.Name).toBe('Mastercam Default Grade')
    expect(guidText(grade.ID)).toBe('f9c5c3cc-570b-410d-a827-8dab6bbf50e1')
  })

  it('states the schema version in the header', () => {
    expect(db.prepare('select version from _Header').get()).toEqual({ version: 32 })
    expect(db.prepare('select MCMajorVersion m, MCMinorVersion n from _UpdateLog').get()).toEqual({
      m: 28,
      n: 230,
    })
  })

  it('writes the tool under the caller’s own guid', () => {
    const item = db.prepare('select ID, Name, Description from TlAssemblyItem where ID = ?').get(
      // The guid goes in as Mastercam's byte order, which is what makes this a
      // round trip rather than a tautology.
      db.prepare('select MainTool from TlAssembly').get()?.['MainTool'] as Uint8Array,
    ) as { ID: Uint8Array; Name: string }
    expect(guidText(item.ID)).toBe(TOOL_GUID)
    expect(item.Name).toBe('3/8 3FL Rough EM')
  })

  it('converts every length into inches', () => {
    const mill = db.prepare('select * from TlToolMill').get() as Record<string, number>
    expect(mill['OverallDiameter']).toBeCloseTo(0.375, 10)
    expect(mill['OverallLength']).toBeCloseTo(3.5, 10)
    expect(mill['CuttingDepth']).toBeCloseTo(1.375, 10)
    expect(mill['ShoulderLength']).toBeCloseTo(1.625, 10)
    expect(mill['FluteCount']).toBe(3)
    expect(mill['MCToolType']).toBe(10)
    // The format has no metric mode; the reference sets this to 0 on all 176
    // of its items and holds metric tools as converted inches.
    expect(db.prepare('select IsMetric from TlAssemblyItem limit 1').get()).toEqual({ IsMetric: 0 })
  })

  it('puts the tool in exactly one subtype table', () => {
    expect(db.prepare('select count(*) c from TlToolEndmill').get()).toEqual({ c: 1 })
    for (const table of ['TlToolDrill', 'TlToolReamer', 'TlToolThreading']) {
      expect(db.prepare(`select count(*) c from ${table}`).get(), table).toEqual({ c: 0 })
    }
    expect(db.prepare('select TaperAngle, TlRadiusType from TlToolEndmill').get()).toEqual({
      // 180 is "not tapered" — a zero here would describe a needle.
      TaperAngle: 180,
      TlRadiusType: 0,
    })
  })

  it('carries the cutting data as inches per minute', () => {
    expect(db.prepare('select SpindleSpeed, FeedRate from TlOpParams').get()).toEqual({
      SpindleSpeed: 15_000,
      FeedRate: 225,
    })
    // A milling tool gets milling defaults, not a drilling cycle.
    expect(db.prepare('select count(*) c from TlMillingOpParams').get()).toEqual({ c: 1 })
    expect(db.prepare('select count(*) c from TlHolemakingOpParams').get()).toEqual({ c: 0 })
  })

  it('sets the stickout through the root component’s CScalar', () => {
    const root = db
      .prepare(
        `select c.CScalar s from TlAssemblyComponent c join TlAssembly a on a.ID = c.TlAssemblyID
         where c.TlAssemblyItemID = a.MainHolder`,
      )
      .get() as { s: number }
    const tool = db
      .prepare(
        `select c.CScalar s from TlAssemblyComponent c join TlAssembly a on a.ID = c.TlAssemblyID
         where c.TlAssemblyItemID = a.MainTool`,
      )
      .get() as { s: number }
    expect(tool.s).toBe(0)
    // Read the stickout back out the way the reference library's own names
    // confirm it: overall length less what the holder swallows.
    expect(3.5 - root.s).toBeCloseTo(42.8625 / MM_PER_INCH, 10)
    expect(3.5 - root.s).toBeCloseTo(1.6875, 10)
  })

  it('draws the holder as a closed nose-up silhouette in inches', () => {
    const segments = db
      .prepare('select Segment, Type, x0, y0, x1, y1 from TlProfileData order by Segment')
      .all() as { Segment: number; Type: number; x0: number; y0: number; x1: number; y1: number }[]
    expect(segments.length).toBeGreaterThan(4)
    expect(segments.every((segment) => segment.Type === 2)).toBe(true)
    // Starts on the axis at the nose and ends on the axis at the top: what
    // Mastercam revolves into a solid rather than a tube.
    expect(segments[0]?.x0).toBe(0)
    expect(segments[0]?.y0).toBe(0)
    expect(segments[segments.length - 1]?.x1).toBe(0)
    // The profile runs 101.6 mm from gage line to nose, so the top sits there.
    expect(segments[segments.length - 1]?.y1).toBeCloseTo(101.6 / MM_PER_INCH, 10)
    // Nose radius first: the last profile point, 9 mm across the flats.
    expect(segments[1]?.x1).toBeCloseTo(9 / MM_PER_INCH, 10)
    // Every vertex is a real measurement, and the walk only ever goes up.
    for (const segment of segments) {
      expect(segment.y1).toBeGreaterThanOrEqual(segment.y0 - 1e-12)
    }
  })

  it('has nothing to report about a tool it could write in full', () => {
    expect(notes).toEqual([])
  })
})

describe('what does not travel', () => {
  const guidFor = (seed: string): string => `${seed}-2222-4333-8444-555555555555`

  it('skips a form Mastercam has no code for, and says which', () => {
    const { notes } = mastercamLibrary({
      tools: [
        {
          tool: { ...endmill, guid: guidFor('aaaaaaaa'), form: 'lollipop mill' },
        },
      ],
    })
    expect(notes).toEqual([
      {
        subject: guidFor('aaaaaaaa'),
        kind: 'skipped',
        message: expect.stringContaining('lollipop mill') as unknown as string,
      },
    ])
  })

  it('coerces a form whose silhouette a confirmed code draws', () => {
    const { document, notes } = mastercamLibrary({
      tools: [{ tool: { ...endmill, guid: guidFor('bbbbbbbb'), form: 'slot mill' } }],
    })
    expect(notes).toHaveLength(1)
    expect(notes[0]?.kind).toBe('coerced')
    expect(notes[0]?.field).toBe('MCToolType')
    const db = open(document)
    expect(db.prepare('select MCToolType from TlToolMill').get()).toEqual({ MCToolType: 10 })
  })

  it('skips a tool with no diameter rather than writing a tool with no solid', () => {
    const { notes } = mastercamLibrary({
      tools: [
        {
          tool: {
            ...endmill,
            guid: guidFor('cccccccc'),
            geometry: { OAL: 88.9, NOF: 3 },
          },
        },
      ],
    })
    expect(notes[0]?.kind).toBe('skipped')
    expect(notes[0]?.message).toContain('cutting diameter')
  })

  it('supplies a drill point angle loudly when the catalog states none', () => {
    const { document, notes } = mastercamLibrary({
      tools: [
        {
          tool: { ...endmill, guid: guidFor('dddddddd'), form: 'drill', substrate: 'hss' },
        },
      ],
    })
    expect(notes.map((note) => note.kind)).toContain('filled')
    const db = open(document)
    expect(db.prepare('select TipAngle from TlToolDrill').get()).toEqual({ TipAngle: 118 })
  })

  it('reads an inch tap’s TP as threads per inch, not as a length', () => {
    // The hazard `geometry.ts` records: converting a reciprocal as a length
    // gives a number that looks like a pitch and is wrong by its own square.
    const { document } = mastercamLibrary({
      tools: [
        {
          tool: {
            ...endmill,
            guid: guidFor('eeeeeeee'),
            form: 'tap right hand',
            unit: 'inches',
            geometry: { ...endmill.geometry, TP: 32 },
          },
        },
      ],
    })
    const db = open(document)
    expect(db.prepare('select ThreadPitch from TlToolThreading').get()).toEqual({
      ThreadPitch: 1 / 32,
    })
  })

  it('reads a metric tap’s TP as a pitch in millimetres', () => {
    const { document } = mastercamLibrary({
      tools: [
        {
          tool: {
            ...endmill,
            guid: guidFor('ffffffff'),
            form: 'tap right hand',
            unit: 'millimeters',
            geometry: { ...endmill.geometry, TP: 0.8 },
          },
        },
      ],
    })
    const db = open(document)
    const row = db.prepare('select ThreadPitch p from TlToolThreading').get() as { p: number }
    expect(row.p).toBeCloseTo(0.8 / MM_PER_INCH, 12)
  })

  it('writes a tool on its own when its assembly names a holder nobody shipped', () => {
    const { document, notes } = mastercamLibrary({
      tools: [
        {
          tool: { ...endmill, guid: guidFor('12345678') },
          assembly: { holderGuid: HOLDER_GUID, stickout: 40 },
        },
      ],
    })
    expect(notes[0]?.kind).toBe('dropped')
    expect(notes[0]?.field).toBe('TlAssembly')
    const db = open(document)
    expect(db.prepare('select count(*) c from TlAssembly').get()).toEqual({ c: 0 })
    expect(db.prepare('select count(*) c from TlToolMill').get()).toEqual({ c: 1 })
  })
})

describe('rows several tools share', () => {
  it('gives one brand one manufacturer row, however many tools name it', () => {
    const { document } = mastercamLibrary({
      holders: [holder],
      tools: Array.from({ length: 6 }, (_, at) => ({
        tool: {
          ...endmill,
          guid: `0000000${at}-2222-4333-8444-555555555555`,
          vendor: 'Helical Solutions',
        },
      })),
    })
    const db = open(document)
    // Six tools, one brand; the holder's brand and Mastercam's own seed row
    // beside it. Deriving the key from each tool's guid instead would give six
    // rows all called the same thing.
    const brands = db.prepare('select Name from TlManufacturer order by Name').all()
    expect(brands.map((row) => row['Name'])).toEqual(['Haas', 'Helical Solutions', 'Mastercam'])
    expect(db.prepare('select count(*) c from TlToolMill').get()).toEqual({ c: 6 })
  })
})

describe('exporting twice', () => {
  it('produces the same bytes, so a re-export updates rather than accumulates', () => {
    const request = {
      holders: [holder],
      tools: [{ tool: endmill, assembly: { holderGuid: HOLDER_GUID, stickout: 42.8625 } }],
    }
    const first = mastercamLibrary(request).document
    const second = mastercamLibrary(request).document
    expect(Buffer.from(second)).toEqual(Buffer.from(first))
  })
})
