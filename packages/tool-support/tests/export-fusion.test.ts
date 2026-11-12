/**
 * What the Fusion exporter writes, and what it refuses to.
 *
 * Every emitted record is checked against the schema table — which is itself
 * held against Autodesk's published document by `export-fusion-schema.test.ts`
 * — so "this loads in Fusion" is asserted from the spec rather than from a
 * golden file somebody captured once.
 */

import { describe, expect, it } from 'vitest'

import {
  FUSION_GEOMETRY_KINDS,
  FUSION_GUID_PATTERN,
  FUSION_LIBRARY_VERSION,
  FUSION_MATERIALS,
  FUSION_UNITS,
  fusionLibrary,
  fusionLibraryJson,
  fusionTool,
  sanitizeName,
  type CatalogPreset,
  type FusionTool,
} from '../src/export/fusion/index.js'
import { fusionType } from '../src/export/fusion/schema.js'
import {
  ToolSchema,
  measuredHolder,
  parametricHolder,
  type Holder,
  type HolderDimensions,
  type MeasuredProfile,
  type Tool,
} from '../src/index.js'
import { shaft, solid } from './tools.js'

/** Who makes the tools below, and how they are listed. */
const listing = {
  guid: '9da403e4-b6e7-4019-8f8b-d13955d7aae7',
  unitSystem: 'millimeters',
  description: '6mm 4-flute flat end mill',
  vendor: 'Example Tools Inc',
  productId: 'PROD-001',
  substrate: 'carbide',
  coolantThrough: false,
} as const

/** Every length in millimetres, as everything in this package states them. */
const endMill: Tool = solid({
  ...listing,
  name: 'TDMX0600',
  diameter: 6,
  fluteLength: 18,
  cornerRadius: 0,
  fluteCount: 4,
  // A relief as wide as the shank: plain shank, and no shoulder.
  shaft: shaft({ shank: 6, overallLength: 57, fluteLength: 18, neck: { diameter: 6, length: 3 } }),
})

/** `endMill`'s listing, under another kind and other dimensions. */
const another = (fields: Partial<Tool>): Tool => solid({ ...listing, name: 'TDMX0600', ...fields })

const HOLDER_GUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/** A BT40/ER32, published rather than measured. */
const holder: Holder = parametricHolder(
  {
    noseDiameter: 33,
    noseLength: 45,
    bodyDiameter: 45,
    bodyLength: 5,
    projection: 50,
    flangeDiameter: 63,
    gaugeLength: 50,
  },
  { guid: HOLDER_GUID, unitSystem: 'millimeters', description: 'BT40 ER32', colletSeries: 'ER32' },
)

/** Assert a record satisfies the schema table for its own type. */
const conforms = (record: Record<string, unknown>): void => {
  const rules = fusionType(String(record.type))
  expect(rules, `no rules for ${String(record.type)}`).not.toBeNull()
  if (rules === null) return

  for (const key of rules.recordRequired) {
    expect(record[key], `${String(record.type)} is missing ${key}`).toBeDefined()
  }
  expect(String(record.guid)).toMatch(FUSION_GUID_PATTERN)
  expect(FUSION_UNITS).toContain(record.unit)

  const geometry = (record.geometry ?? {}) as Record<string, unknown>
  for (const key of rules.geometryRequired) {
    expect(geometry[key], `${String(record.type)} is missing geometry.${key}`).toBeDefined()
  }
  const allowed = new Set(rules.geometryAllowed)
  for (const key of Object.keys(geometry)) {
    expect(
      allowed.has(key),
      `${String(record.type)} writes geometry.${key}, which it may not`,
    ).toBe(true)
  }
}

describe('a tool with a holder', () => {
  const written = fusionTool({ tool: endMill, assembly: { stickout: 24, holder } })

  it('is written', () => {
    expect(written.tool).not.toBeNull()
  })

  it('conforms to the schema for its type', () => {
    conforms(written.tool as unknown as Record<string, unknown>)
  })

  it('states the stickout as LB and closes the gauge-length identity', () => {
    // The quantity this package exists because four unconnected places
    // disagreed about it. Fusion calls it `LB`, the dictionary calls it `LBH`,
    // an assembly calls it `stickout`, and the assembly gauge length is that
    // plus the holder's own: 50 + 24 = 74.
    const tool = written.tool as FusionTool
    expect(tool.geometry.LB).toBe(24)
    expect(tool.holder?.gaugeLength).toBe(50)
    expect(tool.geometry.assemblyGaugeLength).toBe(74)
  })

  it('runs the holder from the nose toward the machine', () => {
    // Autodesk states it on the segment array: ordered from the cutter end to
    // the machine tool, so the nose is first. The heights sum to the gauge
    // length because the gauge length *is* that sum — this fixture's vendor
    // happens to publish the same figure, and `a published holder that does not
    // reach its own gauge line` is the case where one does not.
    const segments = (written.tool as FusionTool).holder?.segments ?? []
    expect(segments[0]?.['lower-diameter']).toBe(33)
    expect(segments.reduce((total, segment) => total + segment.height, 0)).toBe(50)
  })

  it('never writes GRADE, which the schema calls a dead legacy property', () => {
    expect(written.tool).not.toHaveProperty('GRADE')
  })
})

describe('a bare tool', () => {
  const written = fusionTool({ tool: endMill })

  it('loads without a holder, which is why the default derives', () => {
    // Fusion requires LB and assemblyGaugeLength on every cutting tool, and a
    // bare catalog tool states neither. The default supplies them rather than
    // producing a document Fusion refuses.
    expect(written.tool).not.toBeNull()
    conforms(written.tool as unknown as Record<string, unknown>)
    expect(written.tool).not.toHaveProperty('holder')
  })

  it('says every value it supplied', () => {
    const filled = written.notes.filter((note) => note.kind === 'filled').map((note) => note.field)
    expect(filled).toContain('geometry.LB')
    expect(filled).toContain('geometry.assemblyGaugeLength')
  })

  it('writes nothing at all under fill: none, and says what is missing', () => {
    const strict = fusionTool({ tool: endMill, fill: 'none' })
    expect(strict.tool).toBeNull()
    expect(strict.notes.some((note) => note.field === 'geometry.LB')).toBe(true)
  })
})

describe('a spot drill that states no tip diameter', () => {
  const spot = another({
    kind: 'SpotDrill',
    diameter: 6,
    fluteLength: 18,
    shaft: shaft({ shank: 6, overallLength: 57, fluteLength: 18 }),
    fluteCount: 2,
    tipAngleDeg: 90,
  })

  it('comes to a point, which Fusion’s spot drill requires stated', () => {
    const written = fusionTool({ tool: spot })
    const tool = written.tool as FusionTool
    expect(tool.type).toBe('spot drill')
    expect(tool.geometry['tip-diameter']).toBe(0)
    expect(written.notes).toContainEqual(
      expect.objectContaining({ kind: 'filled', field: 'geometry.tip-diameter' }),
    )
  })
})

describe('a tool whose shank and end are assumed', () => {
  // A Fusion entry with no SFDM and no OAL: its shaft is filled at the cut to LB, which
  // nobody stated.
  const assumed = {
    ...endMill,
    provenance: { shank: 'assumed' as const, overallLength: 'assumed' as const },
  }

  it('writes neither SFDM nor OAL from it, and is short of them as a tool stating neither', () => {
    const written = fusionTool({ tool: assumed, assembly: { stickout: 24, holder } })
    expect(written.tool).toBeNull()
    const skipped = written.notes.filter((note) => note.kind === 'skipped')
    expect(skipped.map((note) => note.field)).toEqual(['geometry.OAL', 'geometry.SFDM', undefined])
  })

  it('is written from the same stack once the shaft is stated', () => {
    const tool = fusionTool({ tool: endMill, assembly: { stickout: 24, holder } }).tool
    expect(tool?.geometry).toMatchObject({ SFDM: 6, OAL: 57 })
  })
})

describe('units', () => {
  const inchTool = another({
    unitSystem: 'inches',
    kind: 'DrillBit',
    diameter: 25.4,
    fluteLength: 50.8,
    shaft: shaft({ shank: 25.4, overallLength: 101.6, fluteLength: 50.8 }),
    fluteCount: 2,
    tipAngleDeg: 118,
  })

  it('writes lengths in the record’s own unit and leaves angles and counts alone', () => {
    const written = fusionTool({ tool: inchTool })
    const geometry = (written.tool as FusionTool).geometry
    // An inch tool's numbers are stated in inches, not in the millimetres this
    // domain stores. A point angle and a flute count are the same in both, and
    // converting the angle would print a 118-degree drill point as 4.65.
    expect(geometry.DC).toBe(1)
    expect(geometry.OAL).toBe(4)
    expect(geometry.SIG).toBe(118)
    expect(geometry.NOF).toBe(2)
  })

  it('takes the binary noise back off a converted length', () => {
    // 38.1 mm is exactly 1.5 in, and `38.1 / 25.4` is `1.5000000000000002`.
    // Unrounded, that is the number that lands in a file a machinist reads.
    // Six places is far below any machining tolerance, so nothing stated is
    // lost — the same rule the scraper's `round6` keeps on the way in.
    const written = fusionTool({
      tool: { ...inchTool, fluteLength: 38.1 },
    })
    expect((written.tool as FusionTool).geometry.LCF).toBe(1.5)
  })
})

describe('refusals', () => {
  it('refuses a tool with no guid rather than minting one', () => {
    // A guid invented at export time would make every re-export look to Fusion
    // like a new tool.
    const { guid: _dropped, ...anonymous } = endMill
    const written = fusionTool({ tool: anonymous })
    expect(written.tool).toBeNull()
    expect(written.notes[0]?.kind).toBe('skipped')
    expect(written.notes[0]?.field).toBe('guid')
  })

  it('refuses a guid that is not one, rather than writing it or throwing', () => {
    const written = fusionTool({ tool: { ...endMill, guid: 'TDMX0600' } })
    expect(written.tool).toBeNull()
    expect(written.notes[0]?.field).toBe('guid')
  })

  it('writes no description where the tool has neither one nor a name', () => {
    const { description: _description, ...plain } = endMill
    const unnamed = fusionTool({ tool: { ...plain, name: '' } }).tool as FusionTool
    expect(unnamed).not.toHaveProperty('description')
    expect((fusionTool({ tool: plain }).tool as FusionTool).description).toBe('TDMX0600')
  })

  it('never meets a tool with no cutting diameter: the record refuses one', () => {
    const { diameter: _dropped, ...rest } = endMill
    expect(ToolSchema.safeParse(rest).success).toBe(false)
  })

  it('refuses a bull nose with no stated corner radius rather than flattening it', () => {
    // `RE` is required for a bull nose and is a measurement, not a convention.
    // Supplying zero would export a bull nose as a flat end mill.
    const { cornerRadius: _dropped, ...rest } = endMill
    const written = fusionTool({ tool: { ...rest, kind: 'RadiusEndmill' } })
    expect(written.tool).toBeNull()
    expect(written.notes.some((note) => note.field === 'geometry.RE')).toBe(true)
  })

  it('coerces a substrate Fusion has no word for, and says so', () => {
    const written = fusionTool({ tool: { ...endMill, substrate: 'diamond' } })
    expect((written.tool as FusionTool).BMC).toBe('unspecified')
    expect(FUSION_MATERIALS).toContain((written.tool as FusionTool).BMC)
    const coerced = written.notes.find((note) => note.kind === 'coerced')
    expect(coerced?.field).toBe('BMC')
  })
})

describe('a measured holder', () => {
  /** `[z, r]`, z from the gage line toward the cutting end. */
  const profile: MeasuredProfile = {
    points: [
      [-30, 22],
      [0, 31.5],
      [40, 22.5],
      [60, 16.5],
    ],
    datum: 'gage-line',
  }
  const facts = { guid: HOLDER_GUID, unitSystem: 'millimeters', colletSeries: 'ER16' } as const

  it('cuts at the gage line and runs nose first', () => {
    const written = fusionTool({
      tool: endMill,
      assembly: { stickout: 24, holder: measuredHolder(profile, facts) },
    })
    const holderOut = (written.tool as FusionTool).holder
    // Everything above the gage line — the taper and the retention knob — is
    // gone, so the stack is 60 long and starts at the nose.
    expect(holderOut?.gaugeLength).toBe(60)
    expect(holderOut?.segments[0]?.['lower-diameter']).toBe(33)
    expect(holderOut?.segments.reduce((total, segment) => total + segment.height, 0)).toBe(60)
  })

  it('states the height it drew on a nose-datumed profile, and measures the assembly from it', () => {
    // No gauge plane was solved, so the whole stack is written, and the gauge
    // length is that stack's height: 90.
    const written = fusionTool({
      tool: endMill,
      assembly: { stickout: 24, holder: measuredHolder({ ...profile, datum: 'nose' }, facts) },
    })
    const tool = written.tool as FusionTool
    expect(tool.holder?.segments.reduce((total, segment) => total + segment.height, 0)).toBe(90)
    expect(tool.holder?.gaugeLength).toBe(90)
    expect(tool.geometry.assemblyGaugeLength).toBe(114)
  })
})

describe('a published holder that reaches its gauge line above the flange', () => {
  /**
   * A BT 30 collet chuck, published the way DIN 4000 publishes one.
   *
   * `projection` is nose to the flange face and `gaugeLength` is nose to the
   * gauge line, and on a BT 30 those differ by 48.4 mm — the gauge-line-to-
   * flange distance, which is a property of the taper rather than of the part.
   * The holder's stack runs the flange up to the gauge line, so the stack and
   * the vendor's figure agree.
   */
  const chuck: HolderDimensions = {
    noseDiameter: 10,
    noseLength: 10.55,
    bodyDiameter: 12.02,
    bodyLength: 9.6,
    projection: 50,
    flangeDiameter: 46,
    gaugeLength: 98.4,
  }
  const facts = { guid: HOLDER_GUID, unitSystem: 'millimeters', colletSeries: 'PG 6' } as const

  const held = (dimensions: HolderDimensions) =>
    fusionTool({
      tool: endMill,
      assembly: { stickout: 24, holder: parametricHolder(dimensions, facts) },
    })

  it('draws the whole stack up to the gauge line, and states that height', () => {
    const tool = held(chuck).tool as FusionTool
    const segments = tool.holder?.segments ?? []
    expect(segments.reduce((total, segment) => total + segment.height, 0)).toBeCloseTo(98.4, 9)
    expect(segments.at(-1)?.['lower-diameter']).toBe(46)
    expect(tool.holder?.gaugeLength).toBe(98.4)
  })

  it('measures the assembly from the same place it measured the holder', () => {
    expect((held(chuck).tool as FusionTool).geometry.assemblyGaugeLength).toBe(122.4)
  })

  it('has nothing to report about the gauge length', () => {
    expect(held(chuck).notes.filter((note) => note.field === 'holder.gaugeLength')).toHaveLength(0)
  })

  it('still gives Fusion a gauge length where the vendor publishes none', () => {
    // Without a gauge line the flange's height is unstated, so the stack stops
    // at the flange face — and that height, which the shape fully draws, is the
    // gauge length the assembly is measured from: 50 + 24.
    const tool = held({ ...chuck, gaugeLength: null }).tool as FusionTool
    const segments = tool.holder?.segments ?? []
    expect(segments.reduce((total, segment) => total + segment.height, 0)).toBeCloseTo(50, 9)
    expect(tool.holder?.gaugeLength).toBe(50)
    expect(tool.geometry.assemblyGaugeLength).toBe(74)
  })
})

describe('the document and its text', () => {
  const { document, notes } = fusionLibrary({
    tools: [{ tool: endMill, assembly: { stickout: 24, holder } }],
    holders: [holder],
  })

  it('states a version the schema accepts and carries both entries', () => {
    expect(document.version).toBe(FUSION_LIBRARY_VERSION)
    expect(document.data).toHaveLength(2)
    expect(notes.filter((note) => note.kind === 'skipped')).toHaveLength(0)
  })

  it('writes every dimension with a decimal point, and every count without', () => {
    // `JSON.stringify(25.0)` is `"25"`, and an integer literal where Fusion
    // expects a dimension crashes its parser. Counts must stay integers.
    const text = fusionLibraryJson(document)
    expect(text).toContain('"LB": 24.0')
    expect(text).toContain('"assemblyGaugeLength": 74.0')
    expect(text).toContain('"height": 45.0')
    expect(text).toContain('"NOF": 4')
    expect(text).not.toContain('"NOF": 4.0')
  })

  it('round-trips through JSON.parse', () => {
    expect(JSON.parse(fusionLibraryJson(document))).toEqual(JSON.parse(JSON.stringify(document)))
  })

  it('writes every number under a key whose kind is known', () => {
    // Guards the rule above: a dimension this package cannot classify would be
    // serialized as whatever JavaScript felt like, which is the crash.
    const geometry = (document.data[0] as FusionTool).geometry
    for (const key of Object.keys(geometry)) {
      expect(FUSION_GEOMETRY_KINDS[key], `geometry.${key} has no kind`).toBeDefined()
    }
  })

  it('is byte-identical when the same catalog is exported twice', () => {
    const again = fusionLibrary({
      tools: [{ tool: endMill, assembly: { stickout: 24, holder } }],
      holders: [holder],
    })
    expect(fusionLibraryJson(again.document)).toBe(fusionLibraryJson(document))
  })
})

describe('a library name Fusion will take', () => {
  it('replaces what a path or a filename rejects', () => {
    expect(sanitizeName('a/b\\c')).toBe('a_b_c')
    expect(sanitizeName('weird:<>"|?*name')).toBe('weird_______name')
  })

  it('leaves an ordinary name alone', () => {
    expect(sanitizeName('Brother Core Alu')).toBe('Brother Core Alu')
  })

  it('always returns something', () => {
    expect(sanitizeName('')).toBe('_')
    expect(sanitizeName('   ')).toBe('_')
    expect(sanitizeName('...')).toBe('_')
  })

  it('caps the length', () => {
    expect(sanitizeName('x'.repeat(500))).toHaveLength(120)
  })
})

describe('cutting-data presets', () => {
  /** A milling preset with every one of the seventeen fields Fusion requires. */
  const milling: CatalogPreset = {
    guid: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    name: 'Aluminium — roughing',
    'tool-coolant': 'flood',
    n: 8000,
    n_ramp: 8000,
    v_c: 150.8,
    v_f: 1600,
    v_f_leadIn: 1600,
    v_f_leadOut: 1600,
    v_f_transition: 1600,
    v_f_ramp: 800,
    v_f_plunge: 400,
    f_n: 0.2,
    'ramp-angle': 3,
    'use-stepdown': true,
    stepdown: 3,
    'use-stepover': true,
    stepover: 2.4,
  }

  it('carries a complete milling preset through', () => {
    const written = fusionTool({ tool: endMill, presets: [milling] })
    const presets = (written.tool as FusionTool)['start-values'].presets
    expect(presets).toHaveLength(1)
    expect(presets[0]?.v_f).toBe(1600)
    expect(written.notes.filter((note) => note.kind === 'skipped')).toHaveLength(0)
  })

  it('supplies the all-materials band when a preset states none', () => {
    const written = fusionTool({ tool: endMill, presets: [milling] })
    expect((written.tool as FusionTool)['start-values'].presets[0]?.material).toEqual({
      category: 'all',
      query: '',
      'use-hardness': false,
    })
  })

  it('drops a field the type does not model, and says which', () => {
    // A tap models nine fields and has no feedrate at all — it is fed by its
    // own pitch. A milling-shaped preset on one is legal (a preset item is
    // open) but Fusion would never show the extra fields.
    const tap = another({
      kind: 'CuttingTap',
      diameter: 6,
      fluteLength: 18,
      shaft: shaft({ shank: 6, overallLength: 57, fluteLength: 18 }),
      fluteCount: 3,
      thread: { pitch: 1 },
    })
    const written = fusionTool({ tool: tap, presets: [milling] })
    const preset = (written.tool as FusionTool)['start-values'].presets[0]
    expect(preset?.v_f).toBeUndefined()
    expect(preset?.n).toBe(8000)
    const dropped = written.notes.filter((note) => note.kind === 'dropped').map((n) => n.field)
    expect(dropped).toContain('start-values.presets[Aluminium — roughing].v_f')
  })

  it('catches the preset a hole-making generator leaves short', () => {
    // The regression this whole check exists for. An application that routes
    // spot drills through the same generator as drills writes the drill's
    // fields — and a spot drill additionally requires five feedrates a drill
    // does not model, so the record is short of what Fusion demands and
    // nothing said so.
    const holePreset: CatalogPreset = {
      guid: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      name: 'Aluminium — drill',
      'tool-coolant': 'flood',
      n: 5000,
      v_c: 90,
      v_f_plunge: 250,
      v_f_retract: 750,
      f_n: 0.05,
      'use-feed-per-revolution': false,
    }
    const spot = another({
      kind: 'SpotDrill',
      diameter: 6,
      fluteLength: 18,
      shaft: shaft({ shank: 6, overallLength: 57, fluteLength: 18 }),
      fluteCount: 2,
      tipAngleDeg: 120,
      tipDiameter: 6,
    })

    const written = fusionTool({ tool: spot, presets: [holePreset] })
    const skipped = written.notes.find((note) => note.kind === 'skipped')
    expect(skipped?.message).toContain('v_f')
    expect(skipped?.message).toContain('v_f_leadIn')
    expect(skipped?.message).toContain('v_f_transition')

    // And the same preset on a drill, which is what it was written for, is fine.
    const drill = another({
      kind: 'DrillBit',
      diameter: 6,
      fluteLength: 18,
      shaft: shaft({ shank: 6, overallLength: 57, fluteLength: 18 }),
      fluteCount: 2,
      tipAngleDeg: 140,
    })
    const fine = fusionTool({ tool: drill, presets: [holePreset] })
    expect(fine.notes.filter((note) => note.kind === 'skipped')).toHaveLength(0)
    expect((fine.tool as FusionTool)['start-values'].presets).toHaveLength(1)
  })

  it('honours Autodesk’s own conditional fields', () => {
    // `use-stepover: true` obliges a stepover. The rule is the schema's, and it
    // is per type — a drill's `use-feed-per-revolution` asks for different
    // fields than a turning tool's.
    const { stepover: _dropped, ...withoutStepover } = milling
    const written = fusionTool({ tool: endMill, presets: [withoutStepover] })
    const skipped = written.notes.find((note) => note.kind === 'skipped')
    expect(skipped?.message).toContain('stepover')
    expect((written.tool as FusionTool)['start-values'].presets).toHaveLength(0)
  })

  it('keeps the tool when a preset is refused', () => {
    // A tool with no feeds is still a usable tool; a tool that vanished is not.
    const { stepover: _dropped, ...broken } = milling
    const written = fusionTool({ tool: endMill, presets: [broken] })
    expect(written.tool).not.toBeNull()
    conforms(written.tool as unknown as Record<string, unknown>)
  })

  it('exports a tool with no presets at all', () => {
    const written = fusionTool({ tool: endMill, presets: [] })
    expect(written.tool).not.toBeNull()
    expect((written.tool as FusionTool)['start-values'].presets).toEqual([])
  })

  it('writes preset dimensions with a decimal point and flags without', () => {
    const { document } = fusionLibrary({ tools: [{ tool: endMill, presets: [milling] }] })
    const text = fusionLibraryJson(document)
    expect(text).toContain('"n": 8000.0')
    expect(text).toContain('"v_f": 1600.0')
    expect(text).toContain('"ramp-angle": 3.0')
    expect(text).toContain('"use-stepover": true')
    expect(text).toContain('"name": "Aluminium — roughing"')
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(document)))
  })
})
