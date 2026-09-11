/**
 * Kennametal rows -> records: the adapter half of the interchange seam.
 *
 * **These are new.** The Python package this ports carried no tests for its
 * three record mappers — they were exercised by `test_csv_to_fusion.py` in the
 * source repository, which belongs to the conversion half and did not come
 * across, so the mappers arrived here with their behaviour asserted nowhere.
 * A record is this package's public output; it gets tests.
 *
 * What each case pins is a decision the module docstring argues for: that a
 * tap's unit is per row and a drill's is per family, that an absent optional
 * column means something specific rather than zero, and that an absent
 * material-groups column is a different claim from a blank cell in one.
 */

import { describe, expect, it } from 'vitest'

import { VendorResponseError } from '../src/errors.js'
import type { BoundFamily, FamilyFacts } from '../src/family.js'
import { checkColumnMap, UNSPECIFIED, type ToolKind } from '../src/records.js'
import type { ScrapedRow } from '../src/scrape.js'
import {
  PRODUCT_LINE_COLUMN,
  drillRecord,
  endmillRecord,
  tapRecord,
} from '../src/vendors/kennametal/records.js'

/** A bound family, with only the facts a given mapper actually reads. */
function family(
  kind: ToolKind,
  labels: Record<string, string>,
  facts: FamilyFacts = {},
): BoundFamily {
  return {
    id: 'x',
    rows: 1,
    kind,
    brand: 'kennametal',
    columns: checkColumnMap('x.csv', kind, labels),
    records: () => {
      throw new Error('unused')
    },
    ...facts,
  }
}

const DRILL_LABELS = { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'L3' }
const ENDMILL_LABELS = { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'AP1MAX' }
const TAP_LABELS = { SFDM: 'D', OAL: 'L', LCF: 'L3', TP: 'Thread Pitch' }

describe('a drill', () => {
  const cfg = family('drill', DRILL_LABELS, {
    unit: 'millimeters',
    bmc: 'carbide',
    coolantThrough: true,
    nonFerrous: false,
    flutes: 2,
    pointAngle: 140,
  })

  const row: ScrapedRow = {
    'Material Number': '4151623',
    'ISO Catalog Number': 'B041A01000CPG',
    Grade: 'KC7325',
    D1_mm: '10',
    D_mm: '10',
    L_mm: '89',
    L3_mm: '47',
    'Material Groups': 'P0 P1 N4',
  }

  it('reads the family’s unit, not the row’s', () => {
    // Every drill table publishes both unit columns, so `unit` is config and
    // never inferred: it decides which column is read and what a machinist is
    // shown. Getting it wrong converts cleanly and prints 5.9531 mm where the
    // part ordered is a 15/64 in KenDrill TXD.
    const record = drillRecord(row, cfg, cfg.columns)

    expect(record.unit).toBe('millimeters')
    expect(record.geometry.DC).toBe(10)
  })

  it('takes flute count and point angle from facts, not columns', () => {
    // Neither is published on any drill table; both are per-family constants
    // carrying their own provenance.
    const record = drillRecord(row, cfg, cfg.columns)

    expect(record.geometry.NOF).toBe(2)
    expect(record.geometry.SIG).toBe(140)
  })

  it('collapses the material groups to ISO classes, and says the vendor stated them', () => {
    const record = drillRecord(row, cfg, cfg.columns)

    expect(record.materialGroups).toEqual(['P', 'N'])
    expect(record.materialGroupsSource).toBe('vendor-stated')
  })

  it('tells an unswept CSV apart from a part the sweep rated for nothing', () => {
    // The material groups are not scraped with the variant table: a second CLI
    // step writes the column. So an absent column is "never swept" — no
    // evidence — and a blank cell under a present one is the vendor's index
    // saying this part is rated for nothing. `parseCsv` fills `''` only for
    // cells under a column that is in the header, which is what keeps the two
    // distinguishable at all.
    const unswept = { ...row }
    delete (unswept as Record<string, string>)['Material Groups']

    expect(drillRecord(unswept, cfg, cfg.columns).materialGroups).toBeNull()
    expect(drillRecord(unswept, cfg, cfg.columns).materialGroupsSource).toBe(UNSPECIFIED)

    const swept = drillRecord({ ...row, 'Material Groups': '' }, cfg, cfg.columns)
    expect(swept.materialGroups).toEqual([])
    expect(swept.materialGroupsSource).toBe('vendor-stated')
  })

  it('carries the coating column where the table publishes one', () => {
    // The carbide `Grade` a drill table also carries reaches no record: it is
    // what the tool is made of in Kennametal's vocabulary, and `substrate`
    // already carries the cutting material as a fact.
    expect(drillRecord({ ...row, Coating: 'TiAlN' }, cfg, cfg.columns).coating).toBe('TiAlN')
    expect(drillRecord(row, cfg, cfg.columns).coating).toBe('')
  })

  it('carries non-ferrous, which only a drill states', () => {
    expect(drillRecord(row, cfg, cfg.columns).nonFerrous).toBe(false)
  })

  it('names the part when the vendor left a required cell empty', () => {
    // `checkColumnMap` has already refused a family that maps none, so what
    // this catches is a *row* the vendor left empty — a scrape problem, not a
    // config one, and it says so.
    expect(() => drillRecord({ ...row, L3_mm: '' }, cfg, cfg.columns)).toThrow(
      /4151623: no value for LCF/,
    )
    expect(() => drillRecord({ ...row, L3_mm: '' }, cfg, cfg.columns)).toThrow(VendorResponseError)
  })

  it('refuses a cell that is not a number', () => {
    // `Number('n/a')` is NaN, which would reach a record as a geometry value
    // and a catalog as a blank field.
    expect(() => drillRecord({ ...row, D1_mm: 'n/a' }, cfg, cfg.columns)).toThrow(/is not a number/)
  })

  it('refuses a family that states no point angle', () => {
    const missing = family('drill', DRILL_LABELS, {
      unit: 'millimeters',
      bmc: 'carbide',
      coolantThrough: true,
      nonFerrous: false,
      flutes: 2,
    })

    expect(() => drillRecord(row, missing, missing.columns)).toThrow(
      /must state pointAngle as a fact/,
    )
  })
})

describe('a tap', () => {
  const cfg = family('tap', TAP_LABELS, {
    bmc: 'hss',
    coolantThrough: false,
    threadMethod: 'cutting',
  })

  const metric: ScrapedRow = {
    'Material Number': '1',
    'ISO Catalog Number': 'T100',
    Coating: 'TiN',
    'D1-TDZ': 'M6X1',
    'Thread System': 'metric',
    'Thread Pitch': '1',
    Z: '3',
    D_mm: '6.3',
    L_mm: '80',
    L3_mm: '20',
  }

  const inch: ScrapedRow = {
    'Material Number': '2',
    'ISO Catalog Number': 'T200',
    Coating: 'Bright',
    'D1-TDZ': '#4-40',
    'Thread System': 'inch',
    'Thread Pitch': '0.025',
    Z: '2',
    D_in: '0.141',
    L_in: '2',
    L3_in: '0.5',
  }

  it('takes its unit from its own row, not the family', () => {
    // A metric and an inch tap can sit in one family, so `Thread System` is a
    // per-row fact where a drill's unit is config.
    expect(tapRecord(metric, cfg, cfg.columns).unit).toBe('millimeters')
    expect(tapRecord(inch, cfg, cfg.columns).unit).toBe('inches')
  })

  it('derives the major diameter from the designation', () => {
    // A tap table publishes a thread designation and no major-diameter column,
    // so `DC` is arithmetic over a standard rather than a column read.
    expect(tapRecord(metric, cfg, cfg.columns).geometry.DC).toBe(6)
    expect(tapRecord(inch, cfg, cfg.columns).geometry.DC).toBeCloseTo(0.112, 10)
  })

  it('reads the pitch from one unsuffixed column in the row’s own unit', () => {
    // `TP` is dimensional but not paired: the thread-pitch step derives a
    // single column already in the tap's native system.
    expect(tapRecord(metric, cfg, cfg.columns).geometry.TP).toBe(1)
    expect(tapRecord(inch, cfg, cfg.columns).geometry.TP).toBe(0.025)
  })

  it('carries the coating, which is all a tap table publishes', () => {
    // A tap has no carbide grade — that is Kennametal's table shape, not a rule
    // about taps everywhere — so `Coating` is the only treatment there is.
    expect(tapRecord(metric, cfg, cfg.columns).coating).toBe('TiN')
    expect(tapRecord(metric, cfg, cfg.columns).substrate).toBe('hss')
  })

  it('puts the designation in the description, and nothing else', () => {
    // The designation is part of what a tap *is*, and the catalog number alone
    // does not carry the size. It no longer *leads* with the catalog number:
    // that is already `catalogNumber`, and a description restating another
    // field on the same record is the thing `ToolRecord.description` refuses.
    const record = tapRecord(metric, cfg, cfg.columns)

    expect(record.description).toBe('M6X1')
    expect(record.description).not.toContain(record.catalogNumber)
  })

  it('refuses a Thread System that is not one of the two', () => {
    // This module read anything that was not `inch` as metric while
    // `thread.ts` read anything that was not `metric` as inch, so a blank tag
    // produced a record whose DC was in inches and whose OAL came from `_mm`.
    // The row carries both column sets, so the tag is the only thing varying.
    const tagged = (system: string): ScrapedRow => ({
      ...metric,
      'Thread System': system,
      D_in: '0.25',
      L_in: '3',
      L3_in: '1',
    })

    for (const bad of ['', 'Inch', 'Metric', 'imperial']) {
      expect(() => tapRecord(tagged(bad), cfg, cfg.columns), bad).toThrow(VendorResponseError)
    }
    expect(tapRecord(tagged('metric'), cfg, cfg.columns).unit).toBe('millimeters')
  })

  it('reads coolant-through from a fact like every other kind', () => {
    // It was hardcoded `false` here until 2026-08-29, which is the same answer
    // with nothing standing behind it. The three tap families now state it as
    // an assumed fact, so the claim is on one page with a date and initials
    // beside it rather than in a mapper.
    expect(tapRecord(metric, cfg, cfg.columns).coolantThrough).toBe(false)

    const silent = family('tap', TAP_LABELS, { bmc: 'hss' })
    expect(() => tapRecord(metric, silent, silent.columns)).toThrow(
      /must state coolantThrough as a fact/,
    )
  })

  it('reads how the thread is made from a fact, and refuses a family without one', () => {
    // Kennametal's variant table publishes the thread's *class* — `Thread
    // Tolerance Class ANSI`, `Tap Pitch Diameter Limit`, `Type of Thread` — and
    // never how it is produced. That is in the vendor's `newTapType` facet, so
    // the family states it and the mapper reads it, exactly as it does
    // `coolantThrough`. All three of Kennametal's tap families are cutting.
    expect(tapRecord(metric, cfg, cfg.columns).threadMethod).toBe('cutting')

    const silent = family('tap', TAP_LABELS, { bmc: 'hss', coolantThrough: false })
    expect(() => tapRecord(metric, silent, silent.columns)).toThrow(
      /must state threadMethod as a fact/,
    )
  })

  it('carries no material groups, because no tap CSV is swept', () => {
    // Kennametal indexes no tap by workpiece material — all 129 carry none.
    // An unswept CSV has no column at all, which is no evidence rather than an
    // index that rates the tap for nothing.
    const record = tapRecord(metric, cfg, cfg.columns)

    expect(record.materialGroups).toBeNull()
    expect(record.materialGroupsSource).toBe(UNSPECIFIED)

    const swept = tapRecord({ ...metric, 'Material Groups': '' }, cfg, cfg.columns)
    expect(swept.materialGroups).toEqual([])
    expect(swept.materialGroupsSource).toBe('vendor-stated')
  })
})

describe('an end mill', () => {
  const labels = {
    ...ENDMILL_LABELS,
    RE: 'Re',
    'shoulder-length': 'L3',
    'shoulder-diameter': 'D3',
  }
  const cfg = family('endmill', labels, {
    unit: 'millimeters',
    bmc: 'carbide',
    coolantThrough: false,
  })

  const row: ScrapedRow = {
    'Material Number': '9',
    'ISO Catalog Number': 'E900',
    Grade: 'KCPM15',
    Z: '4',
    D1_mm: '12',
    D_mm: '12',
    L_mm: '83',
    AP1MAX_mm: '26',
    Re_mm: '1.5',
    L3_mm: '30',
    D3_mm: '11.6',
  }

  it('reads the three optional columns when present', () => {
    const record = endmillRecord(row, cfg, cfg.columns)

    expect(record.geometry.RE).toBe(1.5)
    expect(record.geometry['shoulder-length']).toBe(30)
    expect(record.geometry['shoulder-diameter']).toBe(11.6)
  })

  it('reads an absent corner radius as a square end', () => {
    // Not a missing value: no corner radius column is a square-end family, and
    // zero is the right answer rather than an absent one.
    const square = family('endmill', ENDMILL_LABELS, {
      unit: 'millimeters',
      bmc: 'carbide',
      coolantThrough: false,
    })

    expect(endmillRecord(row, square, square.columns).geometry.RE).toBe(0)
  })

  it('reads an absent L3 as the flute length', () => {
    // Nothing below the flutes to reach past, so the maximum flute length is
    // the shoulder length too (the WIDIA VariMill tables).
    const plain = family('endmill', ENDMILL_LABELS, {
      unit: 'millimeters',
      bmc: 'carbide',
      coolantThrough: false,
    })

    const record = endmillRecord(row, plain, plain.columns)
    expect(record.geometry['shoulder-length']).toBe(26)
    expect(record.geometry.LCF).toBe(26)
  })

  it('reads an absent D3 as the cutting diameter', () => {
    // A plain shank: the shoulder is the cutting diameter.
    const plain = family('endmill', ENDMILL_LABELS, {
      unit: 'millimeters',
      bmc: 'carbide',
      coolantThrough: false,
    })

    expect(endmillRecord(row, plain, plain.columns).geometry['shoulder-diameter']).toBe(12)
  })

  it('reads an empty optional cell as absent, not as zero', () => {
    // A zero corner radius and an unpublished one are the same number and
    // different facts; the fallback is what distinguishes them.
    const record = endmillRecord({ ...row, D3_mm: '' }, cfg, cfg.columns)

    expect(record.geometry['shoulder-diameter']).toBe(12)
  })

  it('takes the flute count from the vendor’s own Z column', () => {
    // Unlike a drill, an end mill table publishes it.
    expect(endmillRecord(row, cfg, cfg.columns).geometry.NOF).toBe(4)
  })

  it('refuses a row with no flute count', () => {
    expect(() => endmillRecord({ ...row, Z: '' }, cfg, cfg.columns)).toThrow(
      /no integer in column "Z"/,
    )
  })
})

describe('the product line', () => {
  const cfg = family('drill', DRILL_LABELS, {
    unit: 'millimeters',
    bmc: 'carbide',
    coolantThrough: true,
    nonFerrous: false,
    flutes: 2,
    pointAngle: 140,
  })

  const row: ScrapedRow = {
    'Material Number': '4151623',
    'ISO Catalog Number': 'B041A01000CPG',
    D1_mm: '10',
    D_mm: '10',
    L_mm: '89',
    L3_mm: '47',
  }

  it('is the leading segment the family page states', () => {
    // The variants table names no line anywhere; the column is a tag
    // `scrape.scrapeFamily` writes from the family page's own `h1`.
    const record = drillRecord({ ...row, [PRODUCT_LINE_COLUMN]: 'GOdrill™' }, cfg, cfg.columns)

    expect(record.productLine).toBe('GOdrill™')
  })

  // A CSV scraped before the option existed has no such column, and a family
  // page with no heading writes none. Both are rows that are otherwise
  // complete — `null` is the answer, never `''`.
  it('is null where the CSV carries no such column', () => {
    expect(drillRecord(row, cfg, cfg.columns).productLine).toBeNull()
    expect(
      drillRecord({ ...row, [PRODUCT_LINE_COLUMN]: '' }, cfg, cfg.columns).productLine,
    ).toBeNull()
  })
})

describe('every mapper', () => {
  it('names the vendor as the brand publishes it, not by the internal key', () => {
    // `vendor` is what a downstream consumer displays and joins on; `widia` is
    // a key in this package's own table and not a thing the vendor calls
    // itself.
    const cfg = family('tap', TAP_LABELS, {
      bmc: 'hss',
      coolantThrough: false,
      threadMethod: 'cutting',
    })
    const row: ScrapedRow = {
      'Material Number': '1',
      'ISO Catalog Number': 'T100',
      Coating: 'TiN',
      'D1-TDZ': 'M6X1',
      'Thread System': 'metric',
      'Thread Pitch': '1',
      Z: '3',
      D_mm: '6.3',
      L_mm: '80',
      L3_mm: '20',
    }

    expect(tapRecord(row, cfg, cfg.columns).vendor).toBe('Kennametal')
    expect(tapRecord(row, { ...cfg, brand: 'widia' }, cfg.columns).vendor).toBe('WIDIA')

    // And the brand key travels with it, because the guid is minted in that
    // brand's namespace and `vendor` is a display string nothing can look one
    // up by. WIDIA's six tools moved namespace on 2026-08-07 for the same
    // reason: a material number is a vendor-local integer.
    const widia = tapRecord(row, { ...cfg, brand: 'widia' }, cfg.columns)
    expect(widia.brand).toBe('widia')
    expect(widia.guid).not.toBe(tapRecord(row, cfg, cfg.columns).guid)
  })

  it('freezes the record it returns', () => {
    const cfg = family('drill', DRILL_LABELS, {
      unit: 'millimeters',
      bmc: 'carbide',
      coolantThrough: true,
      nonFerrous: false,
      flutes: 2,
      pointAngle: 140,
    })
    const record = drillRecord(
      {
        'Material Number': '1',
        'ISO Catalog Number': 'X',
        Grade: 'G',
        D1_mm: '1',
        D_mm: '1',
        L_mm: '1',
        L3_mm: '1',
      },
      cfg,
      cfg.columns,
    )

    expect(Object.isFrozen(record)).toBe(true)
    expect(Object.isFrozen(record.geometry)).toBe(true)
  })
})
