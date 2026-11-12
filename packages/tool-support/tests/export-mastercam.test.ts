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
import { MC_TOOL_TYPE_COERCED } from '../src/export/mastercam/schema.js'
import { guidText } from '../src/export/mastercam/guid.js'
import { CAM_TYPES, isoGeometry } from '../src/export/catalog.js'
import { fusionHolder } from '../src/export/fusion/index.js'
import {
  ToolSchema,
  measuredHolder,
  parametricHolder,
  type Holder,
  type InsertTool,
  type Tool,
  type ToolKind,
} from '../src/index.js'
import { readFusionEntry } from '../src/import/fusion/index.js'
import { MM_PER_INCH } from '../src/units.js'
import { shaft, solid } from './tools.js'

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

const endmill: Tool = solid({
  name: '3/8 3FL Rough EM',
  guid: TOOL_GUID,
  unitSystem: 'inches',
  vendor: 'Helical Solutions',
  productId: '95506432',
  substrate: 'carbide',
  coolantThrough: true,
  diameter: 9.525,
  fluteLength: 34.925,
  fluteCount: 3,
  // A 5/16 in neck 1/4 in past the flutes, on a 3/8 in shank.
  shaft: shaft({
    shank: 9.525,
    overallLength: 88.9,
    fluteLength: 34.925,
    neck: { diameter: 7.9375, length: 6.35 },
  }),
})

/** A stepped holder measured from its gage line, `z` ascending toward the nose. */
const holder: Holder = measuredHolder(
  {
    points: [
      [0, 22.225],
      [50.8, 22.225],
      [50.8, 14],
      [88.9, 14],
      [88.9, 9],
      [101.6, 9],
    ],
    datum: 'gage-line',
  },
  {
    guid: HOLDER_GUID,
    name: 'CAT40 ER16 4in',
    vendor: 'Haas',
    productId: '04-0007',
    colletSeries: 'ER16',
  },
)

/** A solid fixture as the insert tool a face mill is: its body, with the solid tool's figures. */
const asInsert = (tool: Tool): InsertTool => ({
  type: 'insert',
  kind: 'FaceEndmill',
  name: tool.name,
  ...(tool.guid === undefined ? {} : { guid: tool.guid }),
  body: {
    diameter: tool.diameter,
    fluteLength: tool.fluteLength,
    ...(tool.fluteCount === undefined ? {} : { pockets: tool.fluteCount }),
  },
  ...(tool.shaft === undefined ? {} : { shaft: tool.shaft }),
  insert: tool.cornerRadius === undefined ? {} : { cornerRadius: tool.cornerRadius },
})

/** `endmill` as another kind, under another guid. */
const as = (kind: ToolKind, guid: string, fields: Partial<Tool> = {}): Tool => ({
  ...endmill,
  kind,
  guid,
  ...fields,
})

describe('a library Mastercam’s schema would recognise', () => {
  const { document, notes } = mastercamLibrary({
    holders: [holder],
    tools: [
      {
        tool: endmill,
        number: 101,
        assemblies: [{ holderGuid: HOLDER_GUID, stickout: 42.8625 }],
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

  it('skips a kind Mastercam has no code for, and says which', () => {
    const { notes } = mastercamLibrary({
      tools: [{ tool: as('LollipopMill', guidFor('aaaaaaaa')) }],
    })
    expect(notes).toEqual([
      {
        subject: guidFor('aaaaaaaa'),
        kind: 'skipped',
        message: expect.stringContaining('lollipop mill') as unknown as string,
      },
    ])
  })

  it('reports a coercion as one whole sentence', () => {
    // The note is shown to whoever has to act on it, so `because` is reported
    // verbatim rather than wrapped in a sentence built here. A template that
    // added its own subject produced "a face mill is written as a face mill is
    // a flat-bottomed cutter" — which reads as nonsense and named the form
    // twice.
    for (const [form, entry] of Object.entries(MC_TOOL_TYPE_COERCED)) {
      const kind = (Object.keys(CAM_TYPES) as ToolKind[]).find((each) => CAM_TYPES[each] === form)
      expect(kind, form).toBeDefined()
      const tool = as(kind!, guidFor('99999999'))
      // A face mill is an insert tool: its body, with the solid tool's figures.
      const written = kind === 'FaceEndmill' ? asInsert(tool) : tool
      const { notes } = mastercamLibrary({ tools: [{ tool: written }] })
      const coercion = notes.find((note) => note.field === 'MCToolType')
      expect(coercion, form).toBeDefined()
      const message = coercion?.message ?? ''
      expect(message, form).toBe(entry.because)
      // Naming the form more than once is the shape the broken template had,
      // and a correct message never needs to.
      expect(message.split(form).length - 1, `${form} is named once`).toBeLessThanOrEqual(1)
      expect(entry.because, form).toMatch(/written as/)
    }
  })

  it('coerces a form whose silhouette a confirmed code draws', () => {
    const { document, notes } = mastercamLibrary({
      tools: [{ tool: as('KeyseatCutter', guidFor('bbbbbbbb')) }],
    })
    expect(notes).toHaveLength(1)
    expect(notes[0]?.kind).toBe('coerced')
    expect(notes[0]?.field).toBe('MCToolType')
    const db = open(document)
    expect(db.prepare('select MCToolType from TlToolMill').get()).toEqual({ MCToolType: 10 })
  })

  it('skips a tool with no overall length rather than writing a tool with no solid', () => {
    const { shaft: _dropped, ...open } = as('FlatEndmill', guidFor('cccccccc'))
    const { notes } = mastercamLibrary({ tools: [{ tool: open }] })
    expect(notes[0]?.kind).toBe('skipped')
    expect(notes[0]?.message).toContain('overall length')
    // One with no diameter never reaches it: the record refuses it.
    const { diameter: _diameter, ...narrow } = endmill
    expect(ToolSchema.safeParse(narrow).success).toBe(false)
  })

  it('writes a Fusion tool’s stated overall length, and skips one whose end was assumed', () => {
    const entry = (geometry: Record<string, number>) =>
      readFusionEntry({
        type: 'flat end mill',
        guid: guidFor('dddddddd'),
        unit: 'millimeters',
        geometry: { DC: 6, LCF: 12, LB: 30, ...geometry },
      })!.tool
    // No SFDM: the shank is assumed, the length stated.
    expect(isoGeometry(entry({ OAL: 60 }))).toMatchObject({ OAL: 60 })
    expect(isoGeometry(entry({ OAL: 60 }))).not.toHaveProperty('SFDM')
    expect(isoGeometry(entry({ SFDM: 6 }))).toMatchObject({ SFDM: 6 })
    expect(isoGeometry(entry({ SFDM: 6 }))).not.toHaveProperty('OAL')
    const noShank = mastercamLibrary({ tools: [{ tool: entry({ OAL: 60 }) }] })
    expect(noShank.notes.filter((note) => note.kind === 'skipped')).toEqual([])
    const mill = open(noShank.document).prepare('select * from TlToolMill').get() as Record<
      string,
      number
    >
    expect(mill['OverallLength']).toBeCloseTo(60 / MM_PER_INCH, 10)
    // No OAL: the stack ends at LB, which is not the end of the tool.
    const noEnd = mastercamLibrary({ tools: [{ tool: entry({ SFDM: 6 }) }] })
    expect(noEnd.notes[0]?.kind).toBe('skipped')
    expect(noEnd.notes[0]?.message).toContain('overall length')
  })

  it('skips a tool with no guid rather than minting one', () => {
    const { guid: _dropped, ...anonymous } = endmill
    const { notes } = mastercamLibrary({ tools: [{ tool: anonymous }] })
    expect(notes).toHaveLength(1)
    expect(notes[0]?.kind).toBe('skipped')
    expect(notes[0]?.field).toBe('guid')
  })

  it('skips a tool or a holder whose guid is not one, rather than throwing', () => {
    const { notes } = mastercamLibrary({
      tools: [{ tool: { ...endmill, guid: 'TDMX-0600' } }],
      holders: [{ ...holder, guid: '{not-a-guid}' }],
    })
    expect(notes.map((note) => [note.kind, note.field])).toEqual([
      ['skipped', 'guid'],
      ['skipped', 'guid'],
    ])
  })

  it('states a holder’s gauge length as the Fusion exporter does', () => {
    // A ⌀20 nose 10 long whose vendor states a 60 mm gauge length: the stated
    // figure, in both formats, rather than the 10 mm of stack each draws.
    const nose = parametricHolder(
      {
        noseDiameter: 20,
        noseLength: 10,
        bodyDiameter: null,
        bodyLength: null,
        projection: null,
        flangeDiameter: null,
        gaugeLength: 60,
      },
      { guid: HOLDER_GUID },
    )
    const db = open(mastercamLibrary({ holders: [nose] }).document)
    const row = db.prepare('select GaugeLength g from TlAssemblyItem').get() as { g: number }
    expect(row.g).toBeCloseTo(60 / MM_PER_INCH, 12)
    expect(fusionHolder(nose).holder?.gaugeLength).toBe(60)

    // With none stated, both state the height of the stack they wrote.
    const unstated = { ...nose, gaugeLength: null }
    const again = open(mastercamLibrary({ holders: [unstated] }).document)
    const height = again.prepare('select GaugeLength g from TlAssemblyItem').get() as { g: number }
    expect(height.g).toBeCloseTo(10 / MM_PER_INCH, 12)
    expect(fusionHolder(unstated).holder?.gaugeLength).toBe(10)
  })

  it('leaves nothing behind when it skips a tool', () => {
    // Every refusal happens before the first row is written. A tool skipped
    // after its `TlAssemblyItem` had been added would leave an item with no
    // tool under it — a row Mastercam would show as an entry that is not
    // anything.
    const { document, notes } = mastercamLibrary({
      tools: [
        {
          tool: solid({
            kind: 'CornerRoundingMill',
            guid: guidFor('0e0e0e0e'),
            diameter: 3,
            fluteLength: 5,
            shaft: shaft({ shank: 3, overallLength: 63.5, fluteLength: 5 }),
            fluteCount: 3,
          }),
        },
      ],
    })
    expect(notes.map((note) => note.kind)).toEqual(['skipped'])
    const db = open(document)
    for (const table of ['TlAssemblyItem', 'TlTool', 'TlToolMill', 'TlLocator', 'TlConnection']) {
      expect(db.prepare(`select count(*) c from ${table}`).get(), table).toEqual({ c: 0 })
    }
  })

  it('supplies a drill point angle loudly when the catalog states none', () => {
    const { document, notes } = mastercamLibrary({
      tools: [
        {
          tool: as('DrillBit', guidFor('dddddddd'), { substrate: 'hss' }),
        },
      ],
    })
    expect(notes.map((note) => note.kind)).toContain('filled')
    const db = open(document)
    expect(db.prepare('select TipAngle from TlToolDrill').get()).toEqual({ TipAngle: 118 })
  })

  it('writes an inch tap’s pitch as the inch pitch its threads per inch make', () => {
    // A 32 threads-per-inch tap, stated as the millimetre pitch the record
    // always carries. Converting the reciprocal as a length would give a number
    // that looks like a pitch and is wrong by its own square.
    const { document } = mastercamLibrary({
      tools: [
        {
          tool: as('CuttingTap', guidFor('eeeeeeee'), {
            unitSystem: 'inches',
            thread: { pitch: MM_PER_INCH / 32 },
          }),
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
          tool: as('CuttingTap', guidFor('ffffffff'), {
            unitSystem: 'millimeters',
            thread: { pitch: 0.8 },
          }),
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
          tool: as('FlatEndmill', guidFor('12345678')),
          assemblies: [{ holderGuid: HOLDER_GUID, stickout: 40 }],
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
        tool: as('FlatEndmill', `0000000${at}-2222-4333-8444-555555555555`),
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

describe('the tool type and its radius columns agree', () => {
  /**
   * Every pairing the reference library uses, and it uses no others: across
   * 53 endmill-family rows the radius type follows from the tool type without
   * exception. A flat end mill never carries a radius.
   */
  const PAIRS: Readonly<Record<number, number>> = {
    10: 0, // Endmill1 Flat   — none
    11: 3, // Endmill2 Sphere — full
    12: 0, // Chamfer Mill    — none
    15: 4, // Radius Mill     — rounder
    19: 2, // Endmill3 Bull   — corner
    21: 0, // Engrave Tool    — none
  }

  const exported = (tool: Tool | InsertTool) => {
    const { document, notes } = mastercamLibrary({ tools: [{ tool }] })
    const db = open(document)
    const row = db
      .prepare(
        `select m.MCToolType t, e.TlRadiusType r, e.CornerRadius c
         from TlToolMill m join TlToolEndmill e on e.ID = m.ID`,
      )
      .get() as { t: number; r: number; c: number }
    return { row, notes }
  }

  it('writes a flat end mill that states a corner radius as a bull nose', () => {
    // The pairing a real catalog actually hits: a corner-radius end mill whose
    // vendor called it flat. Writing type 10 beside a corner radius is a row
    // Mastercam never produces.
    const { row, notes } = exported(
      as('FlatEndmill', '0a0a0a0a-1111-4222-8333-444444444444', { cornerRadius: 3.175 }),
    )
    expect(row.t).toBe(19)
    expect(row.r).toBe(2)
    expect(row.c).toBeCloseTo(3.175 / MM_PER_INCH, 10)
    expect(notes.map((note) => note.kind)).toContain('coerced')
  })

  it('gives a ball nose the radius its own type promises', () => {
    // Half the diameter, by definition. A stated radius of nothing would
    // otherwise write a full radius of zero.
    const { row } = exported(
      solid({
        kind: 'BallEndmill',
        guid: '0b0b0b0b-1111-4222-8333-444444444444',
        diameter: 6.35,
        fluteLength: 19.05,
        shaft: shaft({ shank: 6.35, overallLength: 76.2, fluteLength: 19.05 }),
        fluteCount: 2,
      }),
    )
    expect(row.t).toBe(11)
    expect(row.r).toBe(3)
    expect(row.c).toBeCloseTo(6.35 / 2 / MM_PER_INCH, 10)
  })

  it('drops a radius from a type that cannot hold one', () => {
    const { row, notes } = exported(
      as('ChamferEndmill', '0c0c0c0c-1111-4222-8333-444444444444', {
        tipAngleDeg: 90,
        cornerRadius: 1,
      }),
    )
    expect(row.t).toBe(12)
    expect(row.r).toBe(0)
    expect(row.c).toBe(0)
    expect(notes.map((note) => note.kind)).toContain('dropped')
  })

  it.each([
    ['FlatEndmill', undefined],
    ['FlatEndmill', 3.175],
    ['BallEndmill', undefined],
    ['BallEndmill', 3.175],
    ['RadiusEndmill', 0.508],
    ['RadiusEndmill', undefined],
    ['CornerRoundingMill', 1.5748],
    ['ChamferEndmill', undefined],
    ['ChamferEndmill', 1],
    ['KeyseatCutter', undefined],
    ['KeyseatCutter', 3.175],
    ['FaceEndmill', 3.175],
    ['TaperedEndmill', undefined],
  ] as const)('pairs %s with a radius of %s the way Mastercam does', (kind, radius) => {
    const tool = as(kind, '0d0d0d0d-1111-4222-8333-444444444444', {
      tipAngleDeg: 90,
      // A corner rounding mill's radius is the round it cuts, its diameter the
      // cut below the round grown by it on each side.
      ...(radius === undefined
        ? {}
        : kind === 'CornerRoundingMill'
          ? { roundingRadius: radius, diameter: endmill.diameter + 2 * radius }
          : { cornerRadius: radius }),
    })
    const { row } = exported(kind === 'FaceEndmill' ? asInsert(tool) : tool)
    expect(PAIRS[row.t], `MCToolType ${row.t}`).toBeDefined()
    expect(row.r, `MCToolType ${row.t}`).toBe(PAIRS[row.t])
    // A radius type of none and a radius are not written together.
    if (row.r === 0) expect(row.c).toBe(0)
    else expect(row.c).toBeGreaterThan(0)
  })
})

describe('one tool set up in several holders', () => {
  const SECOND_HOLDER = '77777777-8888-4999-8aaa-bbbbbbbbbbbb'
  const longHolder: Holder = { ...holder, guid: SECOND_HOLDER, name: 'CAT40 ER16 6in' }

  const built = mastercamLibrary({
    holders: [holder, longHolder],
    tools: [
      {
        tool: endmill,
        number: 101,
        assemblies: [
          { holderGuid: HOLDER_GUID, stickout: 42.8625, number: 101 },
          { holderGuid: SECOND_HOLDER, stickout: 63.5, number: 107 },
        ],
      },
    ],
  })

  it('writes one tool row and two assemblies', () => {
    const db = open(built.document)
    // The defect this replaces wrote every one of the tool's rows twice under
    // the same primary key, which SQLite reports as a non-unique index entry —
    // and the exporter said nothing at all.
    expect(db.prepare('select count(*) c from TlTool').get()).toEqual({ c: 1 })
    expect(db.prepare('select count(*) c from TlToolMill').get()).toEqual({ c: 1 })
    expect(db.prepare('select count(*) c from TlAssembly').get()).toEqual({ c: 2 })
    expect(db.prepare('select count(distinct hex(ID)) c from TlAssembly').get()).toEqual({ c: 2 })
    expect(db.prepare('select count(*) c from TlAssemblyComponent').get()).toEqual({ c: 4 })
  })

  it('gives each assembly its own holder, stickout and carousel position', () => {
    const db = open(built.document)
    const setups = db
      .prepare(
        `select a.ToolNumber n, hi.Name holder, round(m.OverallLength - c.CScalar, 6) stickout
         from TlAssembly a
         join TlAssemblyItem hi on hi.ID = a.MainHolder
         join TlToolMill m on m.ID = a.MainTool
         join TlAssemblyComponent c
           on c.TlAssemblyID = a.ID and c.TlAssemblyItemID = a.MainHolder
         order by a.ToolNumber`,
      )
      .all() as { n: number; holder: string; stickout: number }[]
    expect(setups.map((setup) => setup.n)).toEqual([101, 107])
    expect(setups.map((setup) => setup.holder)).toEqual(['CAT40 ER16 4in', 'CAT40 ER16 6in'])
    expect(setups[0]?.stickout).toBeCloseTo(42.8625 / MM_PER_INCH, 9)
    expect(setups[1]?.stickout).toBeCloseTo(63.5 / MM_PER_INCH, 9)
  })

  it('says that the single tool row can only state one carousel position', () => {
    // `TlTool.ToolNumber` and the legacy record hold one number between them,
    // so the second position lives on its assembly and nowhere else.
    const dropped = built.notes.filter((note) => note.field === 'TlTool.ToolNumber')
    expect(dropped).toHaveLength(1)
    expect(dropped[0]?.kind).toBe('dropped')
    const db = open(built.document)
    expect(db.prepare('select ToolNumber from TlTool').get()).toEqual({ ToolNumber: 101 })
  })

  it('has nothing to say when the set-ups agree on the number', () => {
    const { notes } = mastercamLibrary({
      holders: [holder, longHolder],
      tools: [
        {
          tool: endmill,
          number: 101,
          assemblies: [
            { holderGuid: HOLDER_GUID, stickout: 42.8625, number: 101 },
            { holderGuid: SECOND_HOLDER, stickout: 63.5, number: 101 },
          ],
        },
      ],
    })
    expect(notes).toEqual([])
  })

  it('takes the same tool or holder twice without writing it twice', () => {
    const { document } = mastercamLibrary({
      holders: [holder, holder],
      tools: [
        {
          tool: endmill,
          number: 101,
          assemblies: [{ holderGuid: HOLDER_GUID, stickout: 42.8625 }],
        },
        {
          tool: endmill,
          number: 101,
          assemblies: [{ holderGuid: HOLDER_GUID, stickout: 42.8625 }],
        },
      ],
    })
    const db = open(document)
    expect(db.prepare('select count(*) c from TlHolder').get()).toEqual({ c: 1 })
    expect(db.prepare('select count(*) c from TlTool').get()).toEqual({ c: 1 })
    expect(db.prepare('select count(*) c from TlAssembly').get()).toEqual({ c: 1 })
  })

  it('tells two set-ups in one holder apart when the caller names them', () => {
    const { document } = mastercamLibrary({
      holders: [holder],
      tools: [
        {
          tool: endmill,
          number: 101,
          assemblies: [
            { holderGuid: HOLDER_GUID, stickout: 30, guid: '99999999-1111-4222-8333-444444444444' },
            { holderGuid: HOLDER_GUID, stickout: 50, guid: '99999999-2222-4333-8444-555555555555' },
          ],
        },
      ],
    })
    const db = open(document)
    expect(db.prepare('select count(*) c from TlAssembly').get()).toEqual({ c: 2 })
    expect(db.prepare('select count(*) c from TlTool').get()).toEqual({ c: 1 })
  })
})

describe('exporting twice', () => {
  it('produces the same bytes, so a re-export updates rather than accumulates', () => {
    const request = {
      holders: [holder],
      tools: [
        {
          tool: endmill,
          number: 101,
          assemblies: [{ holderGuid: HOLDER_GUID, stickout: 42.8625 }],
        },
      ],
    }
    const first = mastercamLibrary(request).document
    const second = mastercamLibrary(request).document
    expect(Buffer.from(second)).toEqual(Buffer.from(first))
  })
})
