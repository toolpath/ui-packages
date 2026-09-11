/**
 * The interchange seam: the canonical vocabulary, the column map, and where a
 * bad one is caught.
 *
 * The point of the second half is *when* a mapping fault surfaces. Before the
 * seam existed the mapper read `row['AP1MAX_mm']` directly, so a family that
 * published no such column failed from inside a loop, on row 1, after a scrape
 * had already run — and the message named the column, which is the one piece
 * of information whoever wrote the config already had. Now the map is checked
 * when the registry binds and the message names the family.
 *
 * The "over the real families" cases arrive with `families/`.
 */

import { describe, expect, it } from 'vitest'

import { ScraperConfigError } from '../src/errors.js'
import { recordGuid } from '../src/identity.js'
import {
  RECORD_GEOMETRY,
  DIMENSIONAL,
  DIMENSIONAL_COLUMNS,
  GEOMETRY_FIELDS,
  ISO_MATERIAL_GROUPS,
  NON_ISO_NAMES,
  REQUIRED_GEOMETRY,
  type ToolKind,
  checkColumnMap,
  checkColumnsExist,
  familyUnits,
  toolRecord,
  UNSPECIFIED,
} from '../src/records.js'

describe('the vocabulary is ISO 13399’s', () => {
  it('uses the standard’s own codes for seven of the ten', () => {
    // Not a CAM vendor's invention, which is the claim the package makes and
    // therefore the one worth pinning. Fusion implements a subset of the same
    // dictionary, which is why they also appear there.
    const standard = Object.entries(GEOMETRY_FIELDS)
      .filter(([name, field]) => field.iso === name)
      .map(([name]) => name)

    expect(new Set(standard)).toEqual(new Set(['DC', 'OAL', 'LCF', 'RE', 'NOF', 'SIG', 'TP']))
  })

  it('names the three that are Autodesk’s as such', () => {
    // A canonical name that is one CAM vendor's invention is a departure from
    // the standard, and this package's claim to be using the standard is only
    // as good as the departures being counted. Adding a fourth has to be a
    // deliberate act rather than a name that slipped in.
    expect(new Set(NON_ISO_NAMES)).toEqual(
      new Set(['SFDM', 'shoulder-length', 'shoulder-diameter']),
    )
  })

  it('records the ISO counterpart where one is pinned', () => {
    // `SFDM` is Autodesk's "Shaft Diameter" and ISO's shank diameter is `DMM`
    // — a name Autodesk did not use, not a measurement ISO lacks. The two
    // hyphenated keys are left unpinned instead of mapped to their nearest
    // code, because "nearest" is not "the same".
    expect(GEOMETRY_FIELDS.SFDM.iso).toBe('DMM')
    expect(GEOMETRY_FIELDS['shoulder-length'].iso).toBeNull()
    expect(GEOMETRY_FIELDS['shoulder-diameter'].iso).toBeNull()
  })

  it('leaves out the length that is always a copy', () => {
    // `LB` and `assemblyGaugeLength` are `OAL` under another name on a bare
    // tool. An adapter that could supply them separately could supply a tool
    // that claims a holder it does not have.
    expect(GEOMETRY_FIELDS).not.toHaveProperty('LB')
    expect(GEOMETRY_FIELDS).not.toHaveProperty('assemblyGaugeLength')
  })

  it('says what every field measures', () => {
    // The definition is quoted back at whoever mapped a column to the wrong
    // field, so an empty one turns a useful failure into `LCF ()`.
    for (const [name, field] of Object.entries(GEOMETRY_FIELDS)) {
      expect(field.definition.trim(), name).not.toBe('')
    }
  })

  it('fixes the material groups as ISO 513’s, in one order', () => {
    // A vendor publishing its own order — Destiny Tool does — reorders onto
    // this sequence. A consumer that renders a facet from one array and a
    // tool's own list from another has no way to notice the two disagree.
    expect(ISO_MATERIAL_GROUPS).toEqual(['P', 'M', 'K', 'N', 'S', 'H', 'C'])
  })
})

describe('the unit suffix is the core’s business', () => {
  it('suffixes a dimension with the family’s unit system', () => {
    // A vendor declares `DC: 'D1'` and never `'D1_mm'`. Which suffix to read
    // is exactly the question `unit` exists to answer, and a map that
    // hardcoded one would put the answer in the place least able to notice it
    // was wrong — a wrong `unit` on a family that publishes both columns
    // converts cleanly and shows 9.525 mm where a machinist ordered 3/8.
    const columns = checkColumnMap('x', 'drill', {
      DC: 'D1',
      SFDM: 'D',
      OAL: 'L',
      LCF: 'L3',
    })

    expect(columns.column('DC', 'millimeters')).toBe('D1_mm')
    expect(columns.column('DC', 'inches')).toBe('D1_in')
  })

  it('leaves a count or an angle unsuffixed', () => {
    // `NOF` and `SIG` are published in one column whatever the unit system, so
    // suffixing them would look for a column that was never scraped.
    const columns = checkColumnMap('x', 'drill', {
      DC: 'D1',
      SFDM: 'D',
      OAL: 'L',
      LCF: 'L3',
      NOF: 'Z',
    })

    expect(columns.column('NOF', 'inches')).toBe('Z')
  })

  it('treats thread pitch as dimensional but unsuffixed', () => {
    // The one field where the two lists disagree, and it is not an oversight.
    // A pitch *is* a length — `1/TPI` inches on an inch tap, millimetres on a
    // metric one — but the Kennametal thread-pitch step derives a single
    // `Thread Pitch` column already in the tap's native system. Suffixing it
    // would look for `Thread Pitch_in`.
    expect(DIMENSIONAL.has('TP')).toBe(true)
    expect(DIMENSIONAL_COLUMNS.has('TP')).toBe(false)

    const columns = checkColumnMap('x', 'tap', {
      SFDM: 'D',
      OAL: 'L',
      LCF: 'L3',
      TP: 'Thread Pitch',
    })
    expect(columns.column('TP', 'inches')).toBe('Thread Pitch')
  })

  it('resolves an unmapped field to no column', () => {
    // Not to a guessed one. An endmill family with no `Re` column is a
    // square-end family, and the adapter reads that absence as radius 0.
    const columns = checkColumnMap('x', 'endmill', {
      DC: 'D1',
      SFDM: 'D',
      OAL: 'L',
      LCF: 'AP1MAX',
    })

    expect(columns.column('RE', 'millimeters')).toBeNull()
  })

  it('keeps every dimensional field a canonical one', () => {
    for (const name of DIMENSIONAL) {
      expect(GEOMETRY_FIELDS, name).toHaveProperty(name)
    }
  })
})

describe('what the loader refuses, and how it says so', () => {
  it('names the family and the missing field', () => {
    expect(() =>
      checkColumnMap('gomill_pro.csv', 'endmill', {
        DC: 'D1',
        SFDM: 'D',
        OAL: 'L',
      }),
    ).toThrow(ScraperConfigError)

    try {
      checkColumnMap('gomill_pro.csv', 'endmill', {
        DC: 'D1',
        SFDM: 'D',
        OAL: 'L',
      })
      expect.unreachable('should have thrown')
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain('gomill_pro.csv')
      // The field *and* what it means, because "LCF" alone assumes the reader
      // already knows the vocabulary they are being asked to map into.
      expect(message).toContain('LCF')
      expect(message).toContain('flute length')
    }
  })

  it('refuses a typo in a canonical name rather than ignoring it', () => {
    // `LFC` would otherwise sit in the map doing nothing at all, and the
    // geometry it was meant to fill would be silently absent from every tool
    // in the family — a shipped library that is quietly wrong, not a crash.
    expect(() =>
      checkColumnMap('x.csv', 'endmill', {
        DC: 'D1',
        SFDM: 'D',
        OAL: 'L',
        LCF: 'AP1MAX',
        LFC: 'oops',
      }),
    ).toThrow(/maps LFC/)
  })

  it('refuses an unknown kind rather than skipping the check', () => {
    // A kind absent from `REQUIRED_GEOMETRY` would look up an empty list of
    // required fields and pass every map, including an empty one.
    expect(() => checkColumnMap('x.csv', 'reamer', {})).toThrow(/unknown tool kind/)
  })

  it('does not treat an inherited property as a tool kind', () => {
    // `Object.hasOwn` rather than `in`: `'constructor' in REQUIRED_GEOMETRY`
    // is true, and would reach a `.filter` on a function.
    expect(() => checkColumnMap('x.csv', 'constructor', {})).toThrow(/unknown tool kind/)
  })

  it('requires of every kind the fields that have no other source', () => {
    // `REQUIRED_GEOMETRY` is a claim about what a vendor must publish, so it
    // is asserted rather than left to whatever the current families happen to
    // map. A tap requires no `DC` because its major diameter is *derived* from
    // the thread designation; an endmill requires no `RE` because a square-end
    // family publishes none and zero is the right answer.
    expect(REQUIRED_GEOMETRY.tap).not.toContain('DC')
    expect(REQUIRED_GEOMETRY.endmill).not.toContain('RE')

    for (const [kind, required] of Object.entries(REQUIRED_GEOMETRY)) {
      for (const name of required) {
        expect(GEOMETRY_FIELDS, kind).toHaveProperty(name)
      }
      expect(required, kind).toEqual(expect.arrayContaining(['SFDM', 'OAL', 'LCF']))
    }
  })

  it('returns a map that cannot be confused with the raw object', () => {
    // So a caller cannot accidentally use the unvalidated literal it was
    // handed — and a later mutation of that literal cannot reach the map.
    const labels = { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'L3' }
    const columns = checkColumnMap('x', 'drill', labels)

    expect(columns.labels).toEqual(labels)
    expect(columns.labels).not.toBe(labels)
  })
})

describe('the column check that needs the CSV', () => {
  it('names the family and the field for a column absent from the header', () => {
    // The other half of "fails at load, not at row 1". `checkColumnMap` can
    // only see the map; this sees the header. A family that maps
    // `LCF: 'AP1MAX'` against a table publishing `AP1MAX_in` alone, and is
    // tagged metric, resolves to a column that is not there — and a per-row
    // failure would name one row out of ninety-three.
    const cfg = {
      unit: 'millimeters' as const,
      columns: checkColumnMap('x', 'endmill', {
        DC: 'D1',
        SFDM: 'D',
        OAL: 'L',
        LCF: 'AP1MAX',
      }),
    }

    expect(() =>
      checkColumnsExist('gomill_pro.csv', cfg, ['D1_mm', 'D_mm', 'L_mm', 'AP1MAX_in']),
    ).toThrow(/gomill_pro\.csv/)
    expect(() =>
      checkColumnsExist('gomill_pro.csv', cfg, ['D1_mm', 'D_mm', 'L_mm', 'AP1MAX_in']),
    ).toThrow(/LCF -> AP1MAX_mm/)
  })

  it('checks both column sets for a family that declares no unit', () => {
    // The asymmetry is real rather than an omission: a tap's system comes from
    // its own `Thread System` column, so one family holds metric and inch taps
    // and anything checking its columns has to check both.
    expect(familyUnits({ unit: 'inches' })).toEqual(['inches'])
    expect(familyUnits({})).toEqual(['millimeters', 'inches'])

    const cfg = {
      columns: checkColumnMap('x', 'tap', { SFDM: 'D', OAL: 'L', LCF: 'L3' }),
    }
    expect(() => checkColumnsExist('taps.csv', cfg, ['D_mm', 'L_mm', 'L3_mm'])).toThrow(
      /SFDM -> D_in/,
    )
  })

  it('passes a header that carries every mapped column', () => {
    const cfg = {
      unit: 'millimeters' as const,
      columns: checkColumnMap('x', 'drill', {
        DC: 'D1',
        SFDM: 'D',
        OAL: 'L',
        LCF: 'L3',
        NOF: 'Z',
      }),
    }

    expect(() =>
      checkColumnsExist('x.csv', cfg, ['D1_mm', 'D_mm', 'L_mm', 'L3_mm', 'Z']),
    ).not.toThrow()
  })
})

/** Every key an end mill record always carries, per `RECORD_GEOMETRY`. */
const ENDMILL = {
  DC: 6.0,
  RE: 0,
  SFDM: 6.0,
  OAL: 57,
  LCF: 13,
  'shoulder-length': 13,
  'shoulder-diameter': 6.0,
  NOF: 4,
}

/** The same for a tap, whose kind declares `TP` and no shoulder at all. */
const TAP = { DC: 6.0, TP: 1, SFDM: 6.0, OAL: 80, LCF: 20, NOF: 3 }

describe('the record itself', () => {
  const base = {
    brand: 'kennametal' as const,
    vendor: 'Kennametal',
    materialNumber: '4151623',
    catalogNumber: 'X',
    description: '',
    kind: 'endmill' as ToolKind,
    unit: 'millimeters' as const,
    substrate: 'carbide',
    coating: 'AlTiN',
    // A whole end mill's geometry, because `RECORD_GEOMETRY` now refuses a
    // partial one — a field a kind always has is not a field a mapper may skip.
    geometry: ENDMILL,
    coolantThrough: false,
  }

  it('is frozen', () => {
    // It is an interchange value. A mapper that mutated one would be reaching
    // back across the seam this type exists to draw.
    const record = toolRecord({ ...base, materialGroups: ['P'], materialGroupsSource: 'derived' })

    expect(Object.isFrozen(record)).toBe(true)
    expect(Object.isFrozen(record.geometry)).toBe(true)
    expect(Object.isFrozen(record.materialGroups)).toBe(true)
    // @ts-expect-error `unit` is readonly
    expect(() => (record.unit = 'inches')).toThrow(TypeError)
  })

  describe('the product line', () => {
    // Three states, kept three the way `materialGroups`' three are: a vendor
    // that names a line, a vendor that names none, and never a nameless name.
    it('defaults to null, so an adapter that says nothing says nothing', () => {
      expect(toolRecord(base).productLine).toBeNull()
    })

    it('keeps the vendor’s own name verbatim', () => {
      expect(toolRecord({ ...base, productLine: 'FRANKEN TOP-Cut VAR' }).productLine).toBe(
        'FRANKEN TOP-Cut VAR',
      )
      // Destiny Tool really does publish these two in lower case beside
      // `Viper` and `Raptor`. Case-folding here would be this package
      // authoring a vendor's catalog.
      expect(toolRecord({ ...base, productLine: 'viper-mini' }).productLine).toBe('viper-mini')
    })

    it('refuses the empty string', () => {
      // `''` is the one state a consumer cannot tell from a name, which is the
      // whole reason the field is nullable rather than a string. It is the
      // same argument `UNSPECIFIED` makes one field along.
      expect(() => toolRecord({ ...base, productLine: '' })).toThrow(ScraperConfigError)
      expect(() => toolRecord({ ...base, productLine: '' })).toThrow(/productLine/)
    })
  })

  it('mints the guid itself, in the record’s own brand namespace', () => {
    // Not an adapter's input: three copies of `recordGuid(brand, material)`
    // would be three places to drift on the join key every downstream consumer
    // uses. The brand is on the record for the same reason — `vendor` is a
    // display string, and no namespace can be looked up by one.
    const record = toolRecord(base)

    expect(record.guid).toBe(recordGuid('kennametal', '4151623'))
    expect(record.guid).not.toBe(recordGuid('widia', '4151623'))
  })

  it('defaults to the unspecified label rather than to an empty index', () => {
    // The default that matters: an adapter that says nothing about workpiece
    // materials has produced no evidence, which is not the same claim as a
    // vendor index that rates the part for nothing. The source is a label and
    // never absent, so "we do not know what this is for" is something a reader
    // sees rather than something it has to infer from a null.
    const record = toolRecord({
      ...base,
      kind: 'tap',
      coating: '',
      geometry: TAP,
      threadMethod: 'cutting',
    })

    expect(record.materialGroups).toBeNull()
    expect(record.materialGroupsSource).toBe(UNSPECIFIED)
    expect(UNSPECIFIED).not.toBeNull()
    expect(ISO_MATERIAL_GROUPS).not.toContain(UNSPECIFIED)
    expect(record.nonFerrous).toBeNull()
  })

  it('carries a thread method on a tap, and none on anything else', () => {
    // The one field that separates a form tap from a cut tap. Every other
    // number on the two records is the same number, so a tap that reaches a
    // consumer without it is a tap the consumer cannot drill the right hole
    // for — and `null` is the answer on a drill or an end mill because the
    // question does not apply, not because the answer is unknown.
    const tap = toolRecord({ ...base, kind: 'tap', geometry: TAP, threadMethod: 'forming' })

    expect(tap.threadMethod).toBe('forming')
    expect(toolRecord(base).threadMethod).toBeNull()
  })

  it('refuses a tap that states no method, and a non-tap that states one', () => {
    // Both halves are load-bearing. A tap with no method is a family that never
    // declared the fact — `fact()` catches that first, and this is the second
    // gate for a mapper that reached round it. A method on a drill is a line
    // copied out of the tap mapper, and it would read downstream as a claim
    // about a tool the word does not describe.
    expect(() => toolRecord({ ...base, kind: 'tap', geometry: TAP })).toThrow(ScraperConfigError)
    expect(() => toolRecord({ ...base, kind: 'tap', geometry: TAP })).toThrow(
      /4151623.*a tap record states threadMethod null/,
    )
    expect(() => toolRecord({ ...base, threadMethod: 'cutting' })).toThrow(
      /endmill record states threadMethod "cutting"/,
    )
    expect(() =>
      toolRecord({
        ...base,
        kind: 'drill',
        geometry: { DC: 6.0, SFDM: 6.0, OAL: 80, LCF: 20, NOF: 2 },
        threadMethod: 'forming',
      }),
    ).toThrow(/a drill record states threadMethod "forming"/)
  })

  it('keeps an empty index as a real answer, distinct from no index', () => {
    // Kennametal's 129 taps are swept and rated for nothing. Reading that as
    // "unconstrained" would put every tap under every material; reading it as
    // "not swept" would drop the one thing the sweep established.
    const rated = toolRecord({ ...base, materialGroups: [], materialGroupsSource: 'vendor-stated' })

    expect(rated.materialGroups).toEqual([])
    expect(rated.materialGroupsSource).toBe('vendor-stated')
  })

  it('refuses groups labelled unspecified, and a label attributing nothing', () => {
    // Stated groups the label calls unspecified, and an attributed source with
    // no groups behind it, are the two ways the three states collapse back into
    // an unreadable one. Neither is constructible.
    expect(() => toolRecord({ ...base, materialGroups: ['P'] })).toThrow(ScraperConfigError)
    expect(() => toolRecord({ ...base, materialGroups: ['P'] })).toThrow(/4151623.*materialGroups/)
    expect(() =>
      toolRecord({ ...base, materialGroups: ['P'], materialGroupsSource: UNSPECIFIED }),
    ).toThrow(ScraperConfigError)
    expect(() => toolRecord({ ...base, materialGroupsSource: 'derived' })).toThrow(
      ScraperConfigError,
    )
  })

  it('refuses a kind’s geometry with a field missing', () => {
    // The failure this replaces was silent: a mapper that stopped writing
    // `shoulder-length` produced a record a consumer read as a tool with none,
    // and nothing anywhere said whether that was the vendor's silence or a bug.
    const { LCF: _dropped, ...short } = ENDMILL

    expect(() => toolRecord({ ...base, geometry: short })).toThrow(ScraperConfigError)
    expect(() => toolRecord({ ...base, geometry: short })).toThrow(/4151623.*LCF/)
  })

  it('refuses a field the kind does not declare at all', () => {
    // A measurement written into a record nothing downstream expects to find
    // there is invisible until a consumer does not read it.
    expect(() => toolRecord({ ...base, geometry: { ...ENDMILL, SIG: 140 } })).toThrow(
      /does not carry SIG/,
    )
  })

  it('lets a declared-optional field be absent, and only that one', () => {
    // Harvey's two deburring families publish right- and left-hand tooth counts
    // and no flute count. `NOF` is the end mill's one `sometimes` entry, so its
    // absence is the vendor's silence rather than a gap.
    const { NOF: _none, ...deburring } = ENDMILL
    const record = toolRecord({ ...base, geometry: deburring })

    expect(record.geometry.NOF).toBeUndefined()
    expect(RECORD_GEOMETRY.endmill.sometimes).toEqual(['NOF'])
    expect(RECORD_GEOMETRY.drill.sometimes).toEqual(['SIG'])
  })

  it('states a geometry a drill and a tap really differ on', () => {
    // The two kinds are not narrower end mills: a drill declares a point angle
    // and no corner radius, a tap a thread pitch and no shoulder. The table is
    // what says so, rather than each mapper deciding for itself. `SIG` is
    // declared and optional — EMUGE-FRANKEN leaves one drill's cell empty —
    // while `RE` is not part of a drill record at all, which is the difference
    // `sometimes` exists to state.
    expect([...RECORD_GEOMETRY.drill.always, ...RECORD_GEOMETRY.drill.sometimes]).toContain('SIG')
    expect([...RECORD_GEOMETRY.drill.always, ...RECORD_GEOMETRY.drill.sometimes]).not.toContain(
      'RE',
    )
    expect(RECORD_GEOMETRY.tap.always).toContain('TP')
    expect(RECORD_GEOMETRY.tap.always).not.toContain('shoulder-length')
  })

  it('copies the geometry and the groups it was handed', () => {
    // The adapter's working object must not stay reachable through the record.
    const geometry: Record<string, number> = { ...ENDMILL }
    const groups = ['P']
    const record = toolRecord({
      ...base,
      geometry,
      materialGroups: groups,
      materialGroupsSource: 'vendor-stated',
    })

    geometry.DC = 99
    groups.push('N')
    expect(record.geometry.DC).toBe(6.0)
    expect(record.materialGroups).toEqual(['P'])
  })
})
