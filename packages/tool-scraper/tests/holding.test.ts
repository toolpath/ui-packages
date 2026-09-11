/**
 * The toolholding core: reading a dimension, and the two gates.
 *
 * Nothing here is a vendor. `holding.ts` owns what a holder and a collet *are*
 * — the unit fallback, the millimetre projection, and the states a record may
 * not be in — and every one of those is a decision the reference implementation
 * arrived at against real published rows. So the cases below quote those rows
 * as literals rather than inventing round numbers: `16ERSS0312` really does put
 * an inch value in a metric column, `16ER010M` really does state 0.5 mm as
 * `0.02` in, and a test built on 1.0 and 2.0 would pass against either
 * tolerance rule.
 */

import { describe, expect, it, vi } from 'vitest'

import { CAD_COLUMN } from '../src/conventions.js'
import { IncompletePartError, ScraperConfigError, VendorResponseError } from '../src/errors.js'
import type { BoundToolholding } from '../src/family.js'
import {
  asUnit,
  cadModel,
  checkUnitAgreement,
  clampingMode,
  colletRecord,
  contactMode,
  dim,
  holderRecord,
  holdingFact,
  millimeters,
  OPTIONAL_COLLET_FIELDS,
  OPTIONAL_HOLDER_FIELDS,
  published,
  unitSystem,
  type ColletRecord,
  type HolderRecord,
  type HoldingMappers,
  type OptionalHolderField,
} from '../src/holding.js'
import { recordGuid } from '../src/identity.js'
import { UNSPECIFIED } from '../src/records.js'
import { HOLDING_ADAPTERS, boundHolding, resetBindings, toHolding } from '../src/registry.js'
import type { ScrapeResult, ScrapedRow } from '../src/scrape.js'

/** The fields a holder cannot be built without, so a case can vary one. */
const HOLDER = {
  brand: 'kennametal',
  materialNumber: '1258023',
  catalogNumber: 'BT30ER16060M',
  description: '',
  unit: 'millimeters',
  taper: 'BT30',
  contact: 'taper',
  clamping: 'collet',
  style: 'er-collet-chuck',
  colletSeries: 'ER16',
  gaugeLength: 60,
  // Every optional field stated, so a `{ ...HOLDER, bore: 12 }` override never
  // collides with a declaration — and `unpublished: []` is then the honest one:
  // this fixture leaves nothing out. The contract itself is exercised by its own
  // block below, where leaving one out is the point.
  bore: null,
  usableLength: null,
  clampingLength: null,
  adjustmentRange: null,
  bodyDiameter: null,
  lockNutDiameter: null,
  cadModelUrl: null,
  // The looked-up-and-found-nothing case, which is the one a fixture wants as a
  // default: `unspecified` would refuse every override that sets a URL.
  cadModelSource: 'vendor-stated',
  cadDxfUrl: null,
  unpublished: [],
} as const

/** The same for a collet. */
const COLLET = {
  brand: 'kennametal',
  materialNumber: '1125005',
  catalogNumber: '16ER010M',
  description: '',
  unit: 'millimeters',
  series: 'ER16',
  style: 'er-standard',
  nominal: 1,
  clampMin: 0.5,
  clampMax: 1,
  bodyDiameter: null,
  functionalLength: null,
  overallLength: null,
  clampingLength: null,
  tapRange: null,
  squareSize: null,
  unpublished: [],
} as const

describe('reading one dimension', () => {
  it('reads the family’s own unit column', () => {
    expect(dim({ D1_mm: '12', D1_in: '0.4724' }, 'D1', 'millimeters')).toBe(12)
    expect(dim({ D1_mm: '12', D1_in: '0.4724' }, 'D1', 'inches')).toBe(0.4724)
  })

  it('falls back to the other system where that is all the vendor published', () => {
    // The load-bearing case, not a defensive one: Kennametal's `D1` is a unit
    // pair on the BT30 hydraulic chucks and metric-only on the HSK63A HP line —
    // an *inch* family with no `D1_in` column at all. A bare suffixed read
    // yields null there and produces a bore-clamping holder with no bore, which
    // matches no tool and raises nothing.
    expect(dim({ D1_mm: '9.525' }, 'D1', 'inches')).toBe(0.375)
    expect(dim({ D1_in: '0.375' }, 'D1', 'millimeters')).toBe(9.525)
  })

  it('rounds a converted value, which removes error rather than adding precision', () => {
    // `9.525 / 25.4` is 0.37500000000000006 in binary floating point, and that
    // is the number that would land in a catalog and in a prefix-matched size
    // string.
    expect(9.525 / 25.4).not.toBe(0.375)
    expect(dim({ D1_mm: '9.525' }, 'D1', 'inches')).toBe(0.375)
  })

  it('answers null for a cell the vendor left blank, and for one it never wrote', () => {
    // Blank is a real state and not a fault: `LF` is empty on all nine ER8
    // collets and populated on the other 101.
    expect(dim({ LF_mm: '', LF_in: '' }, 'LF', 'millimeters')).toBeNull()
    expect(dim({}, 'LF', 'millimeters')).toBeNull()
  })

  it('refuses a range rather than summing it, because measure.fractionValue does', () => {
    expect(dim({ D1_in: '.035-.040' }, 'D1', 'inches')).toBeNull()
  })
})

describe('projecting into millimetres', () => {
  it('is a no-op on a metric record and an exact conversion on an inch one', () => {
    expect(millimeters(12, 'millimeters')).toBe(12)
    expect(millimeters(0.375, 'inches')).toBe(9.525)
    expect(millimeters(null, 'inches')).toBeNull()
  })

  it('rounds every conversion through one place', () => {
    expect(asUnit(9.525, 'millimeters', 'inches')).toBe(0.375)
    expect(asUnit(9.525, 'millimeters', 'millimeters')).toBe(9.525)
  })
})

describe('the cross-unit report', () => {
  it('says nothing when the two columns agree to their printed precision', () => {
    // `16ER010M` publishes CCCN as 0.5 mm and 0.02 in. That is 0.508 mm, which
    // is 1.6 % off as a ratio and correct to the two decimals the inch cell
    // states — the case a relative tolerance gets wrong.
    const warn = vi.fn()
    const row = { CCCN_mm: '0.5', CCCN_in: '0.02' }

    expect(checkUnitAgreement(row, 'CCCN', '16ER010M (1125005)', warn)).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it('reports a value sitting in the wrong column', () => {
    // `16ERSS0312` states `D1` metric as 0.3125 — the inch value in the metric
    // column, a factor of 25.4 out. Both cells are in the vendor's own HTML.
    const warn = vi.fn()
    const row = { D1_mm: '0.3125', D1_in: '0.3125' }

    expect(checkUnitAgreement(row, 'D1', '16ERSS0312 (7195328)', warn)).toBe(true)
    expect(warn.mock.calls[0]?.[0]).toContain('D1 disagrees across unit systems')
    expect(warn.mock.calls[0]?.[0]).toContain('the native column is used')
  })

  it('reports a pair that disagrees by more than either cell’s rounding', () => {
    // `25ER130M` publishes CCCN as both 12.0 mm and 0.437 in, which is 11.1 mm.
    const warn = vi.fn()

    expect(checkUnitAgreement({ CCCN_mm: '12', CCCN_in: '0.437' }, 'CCCN', '25ER130M', warn)).toBe(
      true,
    )
  })

  it('says nothing where only one of the two columns is published', () => {
    const warn = vi.fn()

    expect(checkUnitAgreement({ L1_mm: '98.4' }, 'L1', 'BT 30 / PG 6 x 050', warn)).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('the vocabularies a cell is read against', () => {
  it('reads a contact and a clamping mode, and refuses a word it has no meaning for', () => {
    expect(contactMode('face', 'x')).toBe('face')
    expect(clampingMode('hydraulic', 'x')).toBe('hydraulic')
    expect(unitSystem('inches', 'x')).toBe('inches')

    // A *present* value nobody has mapped is the vendor's vocabulary having
    // moved, which must stop the family rather than drop one row.
    expect(() => contactMode('dual', 'BT+ 30')).toThrow(VendorResponseError)
    expect(() => clampingMode('press', 'PG 25')).toThrow(VendorResponseError)
    expect(() => unitSystem('metric', '16ER010M')).toThrow(VendorResponseError)
  })

  it('lists what it does know, so the message names the fix', () => {
    expect(() => clampingMode('press', 'PG 25')).toThrow(/bore, collet, shrink, hydraulic/)
  })
})

describe('a cell the vendor left blank', () => {
  it('refuses as an incomplete part, which is the one refusal a family survives', () => {
    expect(() => published('', 'BT40-ER32-60', 'taper')).toThrow(IncompletePartError)
    expect(() => published(undefined, 'BT40-ER32-60', 'taper')).toThrow(
      /BT40-ER32-60: publishes no taper/,
    )
    expect(() => published(null, 'x', 'L1 gage length')).toThrow(IncompletePartError)
  })

  it('lets a real zero through, because zero is a measurement', () => {
    expect(published(0, 'x', 'V adjustment range')).toBe(0)
  })
})

describe('a family fact a toolholding mapper cannot proceed without', () => {
  const family = {
    catalogName: 'Kennametal BT30 ER Collet Adapters Metric',
    kind: 'holder',
  } as unknown as BoundToolholding

  it('projects the value it was given', () => {
    expect(holdingFact(family, 'taper', 'BT30')).toBe('BT30')
  })

  it('names the family and the key rather than defaulting', () => {
    // Every default is a claim the family never made: a missing `taper` becoming
    // `''` ships a holder that fits no spindle and raises nothing.
    expect(() => holdingFact(family, 'taper', undefined)).toThrow(ScraperConfigError)
    expect(() => holdingFact(family, 'taper', undefined)).toThrow(
      /Kennametal BT30 ER Collet Adapters Metric: a holder family must state taper as a fact/,
    )
  })
})

describe('building a holder', () => {
  it('mints identity and derives the millimetre twins', () => {
    const record = holderRecord({
      ...HOLDER,
      unit: 'inches',
      gaugeLength: 2.5,
      clamping: 'shrink',
      colletSeries: null,
      bore: 0.375,
    })

    expect(record.kind).toBe('holder')
    expect(record.guid).toBe(recordGuid('kennametal', '1258023'))
    expect(record.vendor).toBe('Kennametal')
    expect(record.productLink).toBe('https://www.kennametal.com/us/en/products/p.1258023.html')
    // Derived from the native value rather than read from the other column, so
    // the pair cannot state two different sizes on one record.
    expect(record.boreMm).toBe(9.525)
    expect(record.gaugeLengthMm).toBe(63.5)
  })

  it('defaults a declared dimension to null, and freezes the result', () => {
    const { bore: _bore, lockNutDiameter: _nut, ...rest } = HOLDER
    const record = holderRecord({
      ...rest,
      clamping: 'collet',
      unpublished: ['bore', 'lockNutDiameter'],
    })

    expect(record.bore).toBeNull()
    expect(record.lockNutDiameter).toBeNull()
    expect(record.unpublished).toEqual(['bore', 'lockNutDiameter'])
    expect(Object.isFrozen(record)).toBe(true)
    // `Object.freeze` on the record is shallow, and every record of a family
    // shares one array — an adapter's module constant.
    expect(Object.isFrozen(record.unpublished)).toBe(true)
  })
})

describe('the fields a vendor publishes no column for', () => {
  it('refuses a field left out and not declared', () => {
    // The rule this module's own factory used to state only in prose: writing
    // `usableLength: null` in an adapter is how a null becomes a default nobody
    // notices. A consumer cannot tell that null from REGO-FIX having no L2
    // column, and the two lead to opposite decisions about whether to show the
    // holder at all.
    const { usableLength: _omitted, ...rest } = HOLDER

    expect(() => holderRecord(rest)).toThrow(ScraperConfigError)
    expect(() => holderRecord(rest)).toThrow(
      /the kennametal holder mapper: left usableLength out without declaring/,
    )
  })

  it('refuses a field declared unpublished and then supplied', () => {
    expect(() =>
      holderRecord({ ...HOLDER, bodyDiameter: 42, unpublished: ['bodyDiameter'] }),
    ).toThrow(/declares the vendor publishes no bodyDiameter and supplied 42/)
  })

  it('accepts a declared field supplied as null — the same claim twice', () => {
    expect(holderRecord({ ...HOLDER, unpublished: ['bodyDiameter'] }).bodyDiameter).toBeNull()
  })

  it('refuses a declaration naming something that is not an optional field', () => {
    expect(() =>
      // `taper` is required and can never be a vendor's blank, so declaring it
      // is a typo rather than a fact — and a typo that silently did nothing
      // would leave a real omission undeclared somewhere else.
      holderRecord({ ...HOLDER, unpublished: ['taper' as OptionalHolderField] }),
    ).toThrow(/declares taper unpublished, which is not one of/)
  })

  it('holds the collet half to the same contract', () => {
    const { squareSize: _omitted, ...rest } = COLLET

    expect(() => colletRecord(rest)).toThrow(
      /the kennametal collet mapper: left squareSize out without declaring/,
    )
    expect(colletRecord({ ...rest, unpublished: ['squareSize'] }).squareSize).toBeNull()
  })

  it('lists every field a mapper is allowed to declare', () => {
    // The two lists are what `checkUnpublished` reads at runtime, and a field
    // added to one of the unions without being added here would be a field no
    // mapper could ever declare — the omission would then be refused with no way
    // to state the truth.
    expect(OPTIONAL_HOLDER_FIELDS).toEqual([
      'colletSeries',
      'bore',
      'usableLength',
      'clampingLength',
      'adjustmentRange',
      'bodyDiameter',
      'lockNutDiameter',
      'cadModelUrl',
      'cadDxfUrl',
    ])
    expect(OPTIONAL_COLLET_FIELDS).toEqual([
      'nominal',
      'bodyDiameter',
      'functionalLength',
      'overallLength',
      'clampingLength',
      'tapRange',
      'squareSize',
    ])
  })
})

describe('reading a CAD model off a row', () => {
  // The three states the record used to collapse into one null. Kennametal
  // publishes no CAD link on a family page, so its column arrives only from the
  // separate `cad` pass — until it runs, every row of a family is blank for a
  // reason that has nothing to do with the vendor.
  it('says nothing where no lookup has run', () => {
    expect(cadModel({ 'ISO Catalog Number': 'BT30ER16060M' })).toEqual({
      cadModelUrl: null,
      cadModelSource: UNSPECIFIED,
    })
  })

  it('says the vendor publishes none where the lookup ran and found none', () => {
    expect(cadModel({ [CAD_COLUMN]: '' })).toEqual({
      cadModelUrl: null,
      cadModelSource: 'vendor-stated',
    })
  })

  it('carries the URL where the vendor publishes one', () => {
    expect(cadModel({ [CAD_COLUMN]: 'https://cdn.test/a.stp' })).toEqual({
      cadModelUrl: 'https://cdn.test/a.stp',
      cadModelSource: 'vendor-stated',
    })
  })

  it('refuses a record carrying a URL that nothing looked for', () => {
    // Not a state any mapper can reach through `cadModel`; it is the one pair
    // that says a record was assembled two different ways.
    expect(() =>
      holderRecord({
        ...HOLDER,
        cadModelUrl: 'https://cdn.test/a.stp',
        cadModelSource: UNSPECIFIED,
      }),
    ).toThrow(/carries a CAD model URL and calls its source unspecified/)
  })
})

describe('the holder gate', () => {
  it('refuses a shank-gripping holder with no bore, whichever mode it grips by', () => {
    // The exact shape of the HSK63A bug: a bore-clamping holder with no bore
    // matches no tool, raises nothing, and looks like an empty result.
    for (const clamping of ['bore', 'shrink', 'hydraulic'] as const) {
      expect(() => holderRecord({ ...HOLDER, clamping, colletSeries: null, bore: null })).toThrow(
        IncompletePartError,
      )
    }
  })

  it('refuses a holder that claims both ways of gripping', () => {
    expect(() => holderRecord({ ...HOLDER, clamping: 'bore', bore: 12 })).toThrow(
      VendorResponseError,
    )
    expect(() => holderRecord({ ...HOLDER, clamping: 'collet', bore: 12 })).toThrow(
      VendorResponseError,
    )
  })

  it('refuses a collet chuck that names no series', () => {
    expect(() => holderRecord({ ...HOLDER, colletSeries: null })).toThrow(IncompletePartError)
  })

  it('accepts a shank-gripping holder that publishes a bore and no series', () => {
    const record: HolderRecord = holderRecord({
      ...HOLDER,
      clamping: 'shrink',
      colletSeries: null,
      bore: 12,
    })

    expect(record.bore).toBe(12)
    expect(record.colletSeries).toBeNull()
  })

  it('accepts an absent CAD model and refuses a malformed one', () => {
    // A consumer renders this as a download button, and a truncated link is the
    // one failure that looks like a working feature until somebody clicks it.
    expect(holderRecord({ ...HOLDER, cadModelUrl: null }).cadModelUrl).toBeNull()
    expect(holderRecord({ ...HOLDER, cadModelUrl: 'https://cdn.test/a.STEP' }).cadModelUrl).toBe(
      'https://cdn.test/a.STEP',
    )

    for (const url of ['http://cdn.test/a.stp', 'https://cdn.test/a.dxf', 'cdn.test/a.stp']) {
      expect(() => holderRecord({ ...HOLDER, cadModelUrl: url }), url).toThrow(VendorResponseError)
    }
  })
})

describe('building a collet and its gate', () => {
  it('derives the capacity twins from the native values', () => {
    const record: ColletRecord = colletRecord({
      ...COLLET,
      unit: 'inches',
      nominal: 0.3125,
      clampMin: 0.3125,
      clampMax: 0.3125,
    })

    expect(record.kind).toBe('collet')
    expect(record.clampMinMm).toBe(7.9375)
    expect(record.clampMaxMm).toBe(7.9375)
    expect(Object.isFrozen(record)).toBe(true)
  })

  it('accepts a zero-width capacity, which is a sealed collet and not a bug', () => {
    // `16ERSS0312` clamps one exact size: CCCX == CCCN == D1. A zero-width
    // range is still a range.
    expect(colletRecord({ ...COLLET, nominal: 1, clampMin: 1, clampMax: 1 }).clampMin).toBe(1)
  })

  it('refuses an inverted capacity', () => {
    expect(() => colletRecord({ ...COLLET, clampMin: 2, clampMax: 1 })).toThrow(VendorResponseError)
  })

  it('refuses a nominal size outside its own published capacity', () => {
    // The gate with teeth, and in the native unit: these are the values a
    // consumer compares, and every contradictory cell found so far sits in the
    // column `dim` ignores.
    expect(() => colletRecord({ ...COLLET, nominal: 2 })).toThrow(
      /nominal 2 is outside its own capacity 0.5-1/,
    )
  })

  it('lets a designation sit just outside the size it measures', () => {
    // `40ERSS1000` is designated 1 inch and clamps 0.9938 — in *both* unit
    // columns, so it is the vendor stating an undersized sealed collet rather
    // than one cell rounded differently from the other. A gate that refused it
    // would end a twelve-row family over a name.
    const sealed = colletRecord({
      ...COLLET,
      unit: 'inches',
      catalogNumber: '40ERSS1000',
      series: 'ER40',
      style: 'er-sealed',
      nominal: 1,
      clampMin: 0.9938,
      clampMax: 0.9938,
    })
    expect(sealed.nominal).toBe(1)

    // And still refuses the error it is there for: a cell in the wrong unit
    // system, which is what `16ERSS0312` has in its metric `D1`.
    expect(() =>
      colletRecord({ ...COLLET, nominal: 0.3125, clampMin: 3.175, clampMax: 3.175 }),
    ).toThrow(VendorResponseError)
  })

  it('accepts a collet whose nominal size the vendor does not publish', () => {
    expect(colletRecord({ ...COLLET, nominal: null }).nominal).toBeNull()
  })

  it('twins the clamping length, and leaves the display-only lengths alone', () => {
    // `L9` is compared rather than only shown: it is `tool-support`'s
    // `Collet.clampLength`, the one input to `maxStickout`.
    const record = colletRecord({ ...COLLET, unit: 'inches', clampingLength: 0.71 })

    expect(record.clampingLength).toBe(0.71)
    expect(record.clampingLengthMm).toBe(18.034)
    expect(colletRecord(COLLET).clampingLength).toBeNull()
    expect(colletRecord(COLLET).clampingLengthMm).toBeNull()
  })

  it('carries the tap range as the vendor’s own words, and the square as a number', () => {
    const record = colletRecord({
      ...COLLET,
      catalogNumber: '16ERTC025',
      nominal: 6.477,
      clampMin: 6.477,
      clampMax: 6.477,
      tapRange: 'M6 & M6.3',
      squareSize: 4.851,
    })

    // Two thread designations, not a dimension: nothing parses it, and nothing
    // converts it.
    expect(record.tapRange).toBe('M6 & M6.3')
    expect(record.squareSize).toBe(4.851)
    expect(colletRecord(COLLET).tapRange).toBeNull()
    expect(colletRecord(COLLET).squareSize).toBeNull()
  })

  it('refuses a square that is not smaller than what it clamps', () => {
    // A tap's square across flats is inscribed in its shank. A square at or
    // past the clamping diameter is two labels swapped or a cell in the wrong
    // unit — the failure `dim`'s native read cannot see.
    expect(() => colletRecord({ ...COLLET, squareSize: 1 })).toThrow(
      /square size 1 is not smaller than the 1 it clamps/,
    )
    expect(() => colletRecord({ ...COLLET, squareSize: 4.851 })).toThrow(VendorResponseError)
  })
})

/** One family's scrape, from rows written the way that vendor writes them. */
function scrapeOf(rows: ScrapedRow[]): ScrapeResult {
  const header: string[] = []
  for (const row of rows)
    for (const key of Object.keys(row)) if (!header.includes(key)) header.push(key)
  return { header, rows, source: 'https://test.invalid', familyCode: null }
}

const ADAPTER_ROW: ScrapedRow = {
  'Material Number': '1258023',
  'ISO Catalog Number': 'BT30ER16060M',
  CST: 'ER16',
  L1_mm: '60',
  D11_mm: '32',
  CAD_STEP_URL: 'https://cdn.test/a.stp',
}

describe('one family’s scrape, as records', () => {
  const FAMILY = 'bt30_er_collet_adapters_metric.csv'

  it('binds a toolholding family to the mapper its brand supplies for its kind', () => {
    expect(boundHolding(FAMILY).kind).toBe('holder')
    expect(boundHolding(FAMILY).records).toBeTypeOf('function')
    expect(boundHolding('er_standard_collets_metric.csv').kind).toBe('collet')
  })

  it('refuses a family name nothing declares, by listing what it knows', () => {
    expect(() => boundHolding('nope.csv')).toThrow(ScraperConfigError)
    expect(() => boundHolding('nope.csv')).toThrow(/unknown toolholding family \(known: /)
  })

  it('maps every row through the family’s own facts', () => {
    const [record] = toHolding(FAMILY, scrapeOf([ADAPTER_ROW])) as HolderRecord[]

    expect(record?.taper).toBe('BT30')
    expect(record?.contact).toBe('taper')
    expect(record?.clamping).toBe('collet')
    expect(record?.style).toBe('er-collet-chuck')
    expect(record?.unit).toBe('millimeters')
    expect(record?.colletSeries).toBe('ER16')
    expect(record?.gaugeLength).toBe(60)
    expect(record?.lockNutDiameter).toBe(32)
    // Kennametal publishes no description column for toolholding, and `''` is
    // the honest answer where a vendor publishes none.
    expect(record?.description).toBe('')
  })

  // A holder family routinely sells metric and inch bores from one table, and
  // the vendor says which in the part's own catalog number rather than in any
  // column. Before this the family's `unit` fact decided for every row, which
  // showed 6.35 mm to a machinist who ordered a 1/4 in bore.
  it('reads each row’s unit from the catalog number, not from the family', () => {
    const metric = { ...ADAPTER_ROW, 'ISO Catalog Number': 'CVKV50HPVTT06M350' }
    const inch = {
      ...ADAPTER_ROW,
      'Material Number': '1258024',
      'ISO Catalog Number': 'CV40ZTTHT050275',
    }

    const records = toHolding(FAMILY, scrapeOf([metric, inch])) as HolderRecord[]

    // The `M` marks the size before it, and sits mid-number as often as at the end.
    expect(records[0]?.unit).toBe('millimeters')
    expect(records[1]?.unit).toBe('inches')
    // Same published `L1_mm: '60'` on both rows: the metric one displays it and
    // the inch one converts, which is the whole point of the field.
    expect(records[0]?.gaugeLength).toBe(60)
    expect(records[1]?.gaugeLength).toBeCloseTo(60 / 25.4, 6)
    // The inch row's twin is a round trip through `round6`, so it agrees to the
    // micron rather than exactly — which is the existing conversion's precision.
    expect(records[0]?.gaugeLengthMm).toBeCloseTo(60, 6)
    expect(records[1]?.gaugeLengthMm).toBeCloseTo(60, 4)
  })

  // A collet family does not mix the two systems, and its designation is a
  // series rather than a size — so the fact stays where it was.
  it('leaves a collet reading the family’s fact', () => {
    const collets = toHolding(
      'er_standard_collets_inch.csv',
      scrapeOf([
        {
          'Material Number': '2000001',
          'ISO Catalog Number': '16ER0250',
          'Collet Series': 'ER16',
          D1_in: '0.25',
          CCCN_in: '0.2402',
          CCCX_in: '0.2559',
        },
      ]),
    )

    expect(collets[0]?.unit).toBe('inches')
  })

  it('refuses a scrape whose identity column was renamed', () => {
    // The failure this catches: a re-scrape that still parses, still has the
    // right row count, and mints every guid off an empty string.
    const renamed = { ...ADAPTER_ROW, 'Material No': '1258023' }
    delete (renamed as Record<string, string>)['Material Number']

    expect(() => toHolding(FAMILY, scrapeOf([renamed]))).toThrow(ScraperConfigError)
  })

  it('drops one incomplete part with a warning and keeps the rest of the family', () => {
    const warn = vi.fn()
    const blank = { ...ADAPTER_ROW, 'Material Number': '1258024', L1_mm: '' }

    const records = toHolding(FAMILY, scrapeOf([ADAPTER_ROW, blank]), { warn })

    expect(records).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('publishes no L1 gage length')
    expect(warn.mock.calls[0]?.[0]).toContain('no record written for it')
  })

  it('still fails the family on a fault that is not one blank cell', () => {
    // A vendor's vocabulary having moved must not be skipped past quietly, which
    // is how a scraper starts publishing a catalog nobody checked.
    const bad = { ...ADAPTER_ROW, CAD_STEP_URL: 'https://cdn.test/a.pdf' }

    expect(() => toHolding(FAMILY, scrapeOf([bad]))).toThrow(VendorResponseError)
  })

  it('reads a tap collet’s capacity off D1, because it publishes no band', () => {
    // The tap families state neither `CCCN` nor `CCCX`. Their `D1` is an exact
    // clamping diameter — 0.255 in is the ANSI shank of a 1/4-20 tap — so the
    // honest capacity is a zero-width band at it, the shape a sealed collet
    // already has. Keyed on the square the vendor publishes, not on the
    // family's style string.
    const row: ScrapedRow = {
      'Material Number': '1026403',
      'ISO Catalog Number': '16ERTC025',
      'Collet Series': 'ER16',
      'Tap Range_mm': 'M6 & M6.3',
      'Tap Range_in': '#14 & 1/4',
      D1_mm: '6.477',
      D1_in: '0.255',
      BDX_in: '0.6693',
      S10_mm: '4.851',
      S10_in: '0.191',
      L_in: '1.08',
      L9_in: '0.71',
    }

    const [record] = toHolding('er_tap_collets_ansi.csv', scrapeOf([row])) as ColletRecord[]

    expect(record?.unit).toBe('inches')
    expect(record?.style).toBe('er-tap')
    expect(record?.series).toBe('ER16')
    expect(record?.clampMin).toBe(0.255)
    expect(record?.clampMax).toBe(0.255)
    expect(record?.squareSize).toBe(0.191)
    expect(record?.clampingLength).toBe(0.71)
    // The inch column, because the family is inch-native — the metric one says
    // `M6 & M6.3` about the very same part.
    expect(record?.tapRange).toBe('#14 & 1/4')
  })

  it('still refuses a round collet that publishes no capacity at all', () => {
    // The fallback above is keyed on the square. Without one, a missing band is
    // an incomplete part exactly as it was.
    const warn = vi.fn()
    const row: ScrapedRow = {
      'Material Number': '1025778',
      'ISO Catalog Number': '11ER010M',
      'Collet Series': 'ER11',
      D1_mm: '1',
    }

    expect(toHolding('er_standard_collets_metric.csv', scrapeOf([row]), { warn })).toHaveLength(0)
    expect(warn.mock.calls[0]?.[0]).toContain('publishes no CCCN clamping minimum')
  })

  it('names the brand and what it does map when a kind has no mapper', () => {
    // A toolholding family whose brand maps nothing still binds, scrapes and
    // writes a receipt — this is the one call that cannot proceed without a
    // mapper, so this is where the absence is reported.
    const kept = HOLDING_ADAPTERS['kennametal'] as Required<HoldingMappers>
    try {
      HOLDING_ADAPTERS['kennametal'] = { collet: kept.collet }
      resetBindings()

      expect(() => toHolding(FAMILY, scrapeOf([ADAPTER_ROW]))).toThrow(
        /brand "kennametal" has no holder mapper \(it maps: collet\)/,
      )
    } finally {
      HOLDING_ADAPTERS['kennametal'] = kept
      resetBindings()
    }
  })
})
