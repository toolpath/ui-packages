/**
 * Every scraped holder and collet, converted — the check the unit tests cannot
 * make.
 *
 * `tests/holding.test.ts` puts one hand-written row in front of each gate.
 * This runs every holder and collet row of the real catalog through the mappers
 * their brands bind — 1,192 Kennametal holder rows alone, across the six spindle
 * interfaces `kennametal --holders` walks — which is the only thing that says the
 * column vocabulary in three adapters matches the columns three vendors actually
 * publish. It skips where a machine keeps no corpus — see
 * `tests/corpus.ts` — and `TOOLPATH_REQUIRE_CORPUS=1` turns that skip into a
 * failure.
 *
 * ## What is asserted per family, and why it is not a row count
 *
 * A count pinned here would be a snapshot of one scrape, and a re-scrape that
 * legitimately gained a part would fail it. What holds across any scrape is
 * that **every row becomes a record or a warning naming what it lacks**, and
 * that is what each family is held to: `records + dropped === rows`. A row that
 * vanished silently, or a family that raised, fails.
 *
 * The one exception is `ToolholdingDefinition.rows`, the count a human wrote
 * down at scrape time. That is an independent restatement rather than a
 * snapshot — every other count is computed from the same file it is checking —
 * so a family whose CSV disagrees with it is a scrape that lost rows.
 */

import { describe, expect, it } from 'vitest'

import { COLLET_FAMILIES, HOLDER_FAMILIES } from '../src/families/index.js'
import type { ColletRecord, HolderRecord, HoldingRecord } from '../src/holding.js'
import {
  BORE_CLAMPINGS,
  CLAMPING_MODES,
  CONTACT_MODES,
  NOMINAL_SLACK,
  millimeters,
} from '../src/holding.js'
import { recordGuid } from '../src/identity.js'
import { boundHolding, toHolding } from '../src/registry.js'
import { rows, scrape } from './corpus.js'

const HOLDERS = Object.keys(HOLDER_FAMILIES)
const COLLETS = Object.keys(COLLET_FAMILIES)

/**
 * One family's rows as records, with the two kinds of warning told apart.
 *
 * `toHolding` passes its `warn` down to the mapper, so one sink carries both a
 * dropped part and a cross-unit report. They are not the same thing at all —
 * one row vanished, the other is a note about a row that converted fine — and a
 * test that counted them together would read 45 reports as 45 lost parts.
 */
function convert(ctx: Parameters<typeof scrape>[0], name: string) {
  const warnings: string[] = []
  const records = toHolding(name, scrape(ctx, name), { warn: (m) => warnings.push(m) })
  const dropped = warnings.filter((m) => m.includes('no record written for it'))
  return {
    records,
    dropped,
    reports: warnings.filter((m) => !dropped.includes(m)),
    rowCount: rows(ctx, name).length,
  }
}

/** The identity and unit invariants every toolholding record is held to. */
function checkIdentity(record: HoldingRecord, name: string): void {
  const where = `${name}: ${record.catalogNumber}`

  expect(record.guid, where).toBe(recordGuid(record.brand, record.materialNumber))
  expect(record.materialNumber, where).not.toBe('')
  expect(record.catalogNumber, where).not.toBe('')
  expect(record.productLink, where).toContain(encodeURI(record.materialNumber))
  expect(['millimeters', 'inches'], where).toContain(record.unit)
}

describe('every scraped toolholding family converts', () => {
  for (const name of [...HOLDERS, ...COLLETS]) {
    it(`${name}: every row becomes a record or a warning naming what it lacks`, (ctx) => {
      const { records, dropped, reports, rowCount } = convert(ctx, name)

      expect(rowCount, name).toBe(boundHolding(name).rows)
      expect(records.length + dropped.length, name).toBe(rowCount)
      for (const warning of dropped) {
        expect(warning, name).toMatch(/publishes no |names no /)
      }
      // The other kind: a cell that converted fine and whose two unit columns
      // disagree. It reports and never gates — `holding.checkUnitAgreement` says
      // why — so it must not cost a row.
      for (const warning of reports) {
        expect(warning, name).toContain('disagrees across unit systems')
      }
      // A family that converted nothing at all is a mapper reading columns the
      // vendor does not publish, which every per-row assertion below would pass
      // over in silence.
      expect(records.length, name).toBeGreaterThan(0)
    })
  }

  it('mints one guid per part across the whole toolholding catalog', (ctx) => {
    // The claim `identity.recordGuid` rests on: holders and collets share one
    // guid space per brand, so a collision between two of them is what a
    // consumer building a catalog from both has to be able to refuse.
    const seen = new Map<string, string>()

    for (const name of [...HOLDERS, ...COLLETS]) {
      for (const record of convert(ctx, name).records) {
        expect(seen.get(record.guid) ?? record.catalogNumber).toBe(record.catalogNumber)
        seen.set(record.guid, record.catalogNumber)
      }
    }
    expect(seen.size).toBeGreaterThan(0)
  })
})

describe('every scraped holder', () => {
  for (const name of HOLDERS) {
    it(`${name}: states an interface, a way of gripping, and a gage length`, (ctx) => {
      for (const record of convert(ctx, name).records as HolderRecord[]) {
        const where = `${name}: ${record.catalogNumber}`
        checkIdentity(record, name)

        expect(record.kind).toBe('holder')
        expect(record.taper, where).not.toBe('')
        expect(CONTACT_MODES, where).toContain(record.contact)
        expect(CLAMPING_MODES, where).toContain(record.clamping)
        expect(record.style, where).not.toBe('')

        // The gate, restated over the real catalog: a holder grips a shank or a
        // collet and never both, and the one that grips a shank publishes a bore.
        if (BORE_CLAMPINGS.includes(record.clamping)) {
          expect(record.bore, where).not.toBeNull()
          expect(record.colletSeries, where).toBeNull()
        } else {
          expect(record.colletSeries, where).not.toBeNull()
          expect(record.bore, where).toBeNull()
        }

        expect(record.gaugeLength, where).toBeGreaterThan(0)
        expect(record.gaugeLengthMm, where).toBe(millimeters(record.gaugeLength, record.unit))
        expect(record.boreMm, where).toBe(millimeters(record.bore, record.unit))

        if (record.cadModelUrl !== null) {
          expect(record.cadModelUrl, where).toMatch(/^https:\/\/.+\.ste?p$/i)
        }
      }
    })
  }

  /**
   * The taper spellings a Kennametal catalog number may open with, for a family
   * that declares `taper`.
   *
   * `BTKV40` and `BT40` are one cone: the KV lines seat on the flange face as
   * well, which `HolderRecord.contact` carries, so a BTKV family declares the
   * plain taper on purpose — `families/kennametal.ts` and
   * `profiles.TAPER_PREFIXES` both record that. Anything else is a real
   * disagreement.
   */
  const spellings = (taper: string): string[] =>
    taper.startsWith('BT')
      ? [taper, `BTKV${taper.slice(2)}`]
      : taper.startsWith('CV')
        ? [taper, `CVKV${taper.slice(2)}`]
        : [taper]

  // **A family's `taper` is one fact for a whole table, and the vendor writes it
  // into every part number.** Kennametal has at least one family that sells two
  // spindle sizes from one table — `100105369` is eight `PSC50HC…` and ten
  // `PSC63HC…` — where either value the fact could take is wrong for the rest of
  // the rows, and a wrong taper is a holder offered for a spindle it does not
  // fit. That family is left out of the config with a note; this is what stops a
  // second one arriving quietly, because nothing else in the pipeline reads the
  // interface out of a part number.
  it('agrees with the interface the vendor writes into every catalog number', (ctx) => {
    for (const name of HOLDERS) {
      const { records } = convert(ctx, name)
      for (const record of records as HolderRecord[]) {
        // Kennametal and WIDIA lead with the interface; the other two vendors
        // number their holders their own way, so this asks nothing of them.
        if (record.brand !== 'kennametal' && record.brand !== 'widia') continue
        const allowed = spellings(record.taper)
        expect(
          allowed.some((prefix) => record.catalogNumber.startsWith(prefix)),
          `${name}: ${record.catalogNumber} declares ${record.taper}`,
        ).toBe(true)
      }
    }
  })

  it('gives every holder a gage length in the range a real spindle tool has', (ctx) => {
    // Not a gate — it is one number per part and a vendor may legitimately
    // publish an outlier — but a corpus-wide sanity bound that a lost decimal
    // point or a millimetre value read as inches would break.
    for (const name of HOLDERS) {
      for (const record of convert(ctx, name).records as HolderRecord[]) {
        expect(record.gaugeLengthMm, `${name}: ${record.catalogNumber}`).toBeGreaterThan(20)
        expect(record.gaugeLengthMm, `${name}: ${record.catalogNumber}`).toBeLessThan(500)
      }
    }
  })
})

describe('every scraped collet', () => {
  for (const name of COLLETS) {
    it(`${name}: states a series and a capacity it fits inside`, (ctx) => {
      for (const record of convert(ctx, name).records as ColletRecord[]) {
        const where = `${name}: ${record.catalogNumber}`
        checkIdentity(record, name)

        expect(record.kind).toBe('collet')
        expect(record.series, where).not.toBe('')
        expect(record.style, where).not.toBe('')
        expect(record.clampMin, where).toBeLessThanOrEqual(record.clampMax)
        expect(record.clampMinMm, where).toBe(millimeters(record.clampMin, record.unit))
        expect(record.clampMaxMm, where).toBe(millimeters(record.clampMax, record.unit))

        if (record.nominal !== null) {
          // The same slack `holding.checkCollet` applies, and for the same
          // reason: `nominal` is the size the vendor designates the collet by
          // and the band is what it measures. `40ERSS1000` is designated 1 inch
          // and clamps 0.9938 — in both unit columns, so it is the vendor's
          // statement rather than a rounding of one.
          expect(record.nominal, where).toBeGreaterThanOrEqual(
            record.clampMin * (1 - NOMINAL_SLACK),
          )
          expect(record.nominal, where).toBeLessThanOrEqual(record.clampMax * (1 + NOMINAL_SLACK))
        }
      }
    })
  }

  it('holds a series that joins to a holder, and one that deliberately does not', (ctx) => {
    // Both directions of the join, over the real catalog. A PGST collet matches
    // no PG holder because REGO-FIX designates it `PGST 15` and sells dedicated
    // short-tail holders for it — `families/regofix.ts` records why widening the
    // string is the wrong fix.
    const series = new Set<string>()
    for (const name of COLLETS) {
      for (const record of convert(ctx, name).records as ColletRecord[]) series.add(record.series)
    }

    const taken = new Set<string>()
    for (const name of HOLDERS) {
      for (const record of convert(ctx, name).records as HolderRecord[]) {
        if (record.colletSeries !== null) taken.add(record.colletSeries)
      }
    }

    expect([...taken].filter((s) => series.has(s)).length).toBeGreaterThan(0)
    expect([...series]).toContain('PGST15')
    expect([...taken]).not.toContain('PGST15')
  })
})

describe('one record per vendor, hand-checked against the vendor’s own page', () => {
  it('reads a Kennametal ER collet adapter', (ctx) => {
    const record = convert(ctx, 'bt30_er_collet_adapters_metric.csv').records.find(
      (r) => r.catalogNumber === 'BT30ER11060M',
    ) as HolderRecord

    expect(record).toBeDefined()
    expect(record.brand).toBe('kennametal')
    expect(record.vendor).toBe('Kennametal')
    expect(record.unit).toBe('millimeters')
    expect(record.taper).toBe('BT30')
    expect(record.contact).toBe('taper')
    expect(record.clamping).toBe('collet')
    expect(record.style).toBe('er-collet-chuck')
    expect(record.colletSeries).toBe('ER11')
    expect(record.gaugeLength).toBe(60)
    expect(record.lockNutDiameter).toBe(16)
    expect(record.clampingLength).toBe(24)
    expect(record.adjustmentRange).toBe(36)
    expect(record.bore).toBeNull()
    // Published and deliberately not carried: torque figures, the stop-screw
    // drive size and the weight. A field arrives when something displays it.
    expect(record.cadModelUrl).toContain('BT30ER11060M_LWM.stp')
    expect(record.cadDxfUrl).toBeNull()
  })

  it('reads a REGO-FIX powRgrip holder, whose contact is a column', (ctx) => {
    const record = convert(ctx, 'regofix_bt30_pg_holders.csv').records.find(
      (r) => r.catalogNumber === 'BT 30 / PG 6 x 050',
    ) as HolderRecord

    expect(record).toBeDefined()
    expect(record.brand).toBe('regofix')
    expect(record.taper).toBe('BT30')
    // Scraped from the vendor's own `form_name`, not declared: REGO-FIX
    // publishes plain and dual-contact BT30 in one product group.
    expect(record.contact).toBe('taper')
    expect(record.clamping).toBe('collet')
    expect(record.style).toBe('pg-collet-chuck')
    expect(record.colletSeries).toBe('PG6')
    expect(record.gaugeLength).toBe(98.4)
    expect(record.bodyDiameter).toBe(10)
  })

  it('reads a MariTool holder, whose every discriminant is a column', (ctx) => {
    const record = convert(ctx, 'maritool_cat40_holders.csv').records.find(
      (r) => r.catalogNumber === 'CAT40-ER11-2.5',
    ) as HolderRecord

    expect(record).toBeDefined()
    expect(record.brand).toBe('maritool')
    expect(record.taper).toBe('CAT40')
    expect(record.contact).toBe('taper')
    expect(record.clamping).toBe('collet')
    expect(record.style).toBe('er-collet-chuck')
    expect(record.colletSeries).toBe('ER11')
    // The unit is promoted off which gage cell the scrape filled, because these
    // families declare no `unit` for one to be taken from.
    expect(record.unit).toBe('inches')
    expect(record.gaugeLength).toBe(2.5)
    expect(record.gaugeLengthMm).toBe(63.5)
    // The one vendor here that publishes prose about a part.
    expect(record.description).toBe('CAT40 ER11 2.5 COLLET CHUCK TOOL HOLDER')
    expect(record.cadDxfUrl).toContain('.dxf')
  })

  it('reads a Kennametal ER collet, capacity and all', (ctx) => {
    const record = convert(ctx, 'er_standard_collets_metric.csv').records.find(
      (r) => r.catalogNumber === '11ER010M',
    ) as ColletRecord

    expect(record).toBeDefined()
    expect(record.series).toBe('ER11')
    expect(record.style).toBe('er-standard')
    expect(record.nominal).toBe(1)
    // DIN 6499's 1 mm band is wrong at the small end of every series: this one
    // clamps 1.0 down to 0.5, and `CCCN`/`CCCX` are never derived.
    expect(record.clampMin).toBe(0.5)
    expect(record.clampMax).toBe(1)
    expect(record.bodyDiameter).toBe(11.5)
    expect(record.functionalLength).toBe(6.3)
    expect(record.overallLength).toBe(18)
  })

  it('reads an inch collet whose capacity is one exact size', (ctx) => {
    // `16ERSS0312` is the row whose `D1` metric cell holds the inch value. The
    // native column is what is read, so the record is right and the mismatch is
    // a warning — see `tests/holding.test.ts`.
    const record = convert(ctx, 'er16_collets_coolant_through_inch.csv').records.find(
      (r) => r.catalogNumber === '16ERSS0312',
    ) as ColletRecord

    expect(record).toBeDefined()
    expect(record.unit).toBe('inches')
    expect(record.nominal).toBe(0.3125)
    expect(record.clampMin).toBe(0.3125)
    expect(record.clampMax).toBe(0.3125)
    expect(record.clampMinMm).toBe(7.9375)
  })
})
