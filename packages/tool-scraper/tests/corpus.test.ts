/**
 * The scraped data, where a scrape exists on this machine.
 *
 * These check the **data** rather than the scraper, so they skip with a named
 * reason where there is no corpus — see `corpus.ts`. Point
 * `TOOLPATH_SCRAPE_ROOT` at a directory holding scraped CSVs and set
 * `TOOLPATH_REQUIRE_CORPUS=1` to make a missing one a failure.
 *
 * They are the port's acceptance gate: the CSVs a corpus holds were written by
 * the Python this replaces, so a green run here says the TypeScript reproduces
 * what the Python produced — not that it parses, that it *agrees*.
 */

import { describe, expect, it } from 'vitest'

import { CAD_COLUMN } from '../src/conventions.js'
import { FAMILIES, HOLDER_FAMILIES } from '../src/families/index.js'
import {
  MATERIALS_COLUMN,
  MATERIAL_GROUPS,
  parseMaterialGroups,
} from '../src/vendors/kennametal/materials.js'
import { BT30_GAUGE_TO_FLANGE, colletRow } from '../src/vendors/regofix/scrape.js'
import { row, rows } from './corpus.js'

const ADAPTERS = 'bt30_er_collet_adapters_metric.csv'
const CHUCKS = 'bt30_hydraulic_chucks_form_ad_metric.csv'
const RF_HOLDERS = 'regofix_bt30_pg_holders.csv'
const STANDARD = 'regofix_pg_collets_standard.csv'
const TAPPING = 'regofix_pg_collets_tap.csv'
const SHORT_TAIL = 'regofix_pgst_collets.csv'

/** The Kennametal-platform families the material sweep applies to. */
const PLATFORM = Object.entries(FAMILIES)
  .filter(([, cfg]) => ['kennametal', 'widia'].includes(cfg.brand ?? 'kennametal'))
  .map(([name, cfg]) => [name, cfg.kind] as const)

const CUTTERS = PLATFORM.filter(([, kind]) => kind !== 'tap').map(([n]) => n)
const TAPS = PLATFORM.filter(([, kind]) => kind === 'tap').map(([n]) => n)

describe('the vendor CAD column', () => {
  for (const name of [ADAPTERS, CHUCKS])
    it(`${name}: every URL names the row it sits on`, (ctx) => {
      // The tripwire for a misaligned scrape. A per-row scrape's real failure
      // mode is not a bad request, it is the right shape of answer attached to
      // the wrong part — a working download that hands you a different holder's
      // model, which no schema check and no type would catch. Kennametal names
      // the file after the catalog number, so a URL that landed on the wrong row
      // says so: `BT30ER16060M_LWM.stp` beside a row for `BT30ER16100M` is the
      // bug.
      const scraped = rows(ctx, name)

      expect(scraped.length, name).toBeGreaterThan(0)
      for (const r of scraped) {
        const catalog = r['ISO Catalog Number']
        expect(r[CAD_COLUMN], catalog).toMatch(new RegExp(`/${catalog}_LWM\\.stp$`))
      }
    })

  for (const name of [ADAPTERS, CHUCKS])
    it(`${name}: every holder has a model`, (ctx) => {
      // Not a rule about the vendor — a record of the data as scraped. All
      // twenty have one today; if a future family does not, this failing is the
      // prompt to check that the absence is real rather than a broken run.
      for (const r of rows(ctx, name)) {
        expect(r[CAD_COLUMN], r['ISO Catalog Number']).not.toBe('')
      }
    })
})

describe('the material-group column', () => {
  for (const name of PLATFORM.map(([n]) => n))
    it(`${name}: carries the column`, (ctx) => {
      // Including the taps. A missing column and an empty one mean different
      // things — not swept yet, versus swept and the vendor publishes none — and
      // only the second is a fact about Kennametal.
      const scraped = rows(ctx, name)

      expect(scraped.length, name).toBeGreaterThan(0)
      expect(Object.keys(scraped[0]!), name).toContain(MATERIALS_COLUMN)
    })

  for (const name of TAPS)
    it(`${name}: carries no material group`, (ctx) => {
      // A vendor gap, verified 2026-08-05: all three tap families return zero
      // rows for all 32 groups. Pinned rather than assumed, so that a vendor who
      // starts indexing taps fails this and gets the column filled in, instead
      // of every tap going on matching nothing forever.
      for (const r of rows(ctx, name)) {
        expect(r[MATERIALS_COLUMN], r['Material Number']).toBe('')
      }
    })

  for (const name of CUTTERS)
    it(`${name}: every tool is indexed for something`, (ctx) => {
      for (const r of rows(ctx, name)) {
        expect(
          parseMaterialGroups(r[MATERIALS_COLUMN]).length,
          `${name}: ${r['Material Number']}`,
        ).toBeGreaterThan(0)
      }
    })

  for (const name of CUTTERS)
    it(`${name}: every scraped code is one the sweep knows`, (ctx) => {
      // `parseMaterialGroups` filters unknown codes out, so the raw cell is what
      // has to be checked — otherwise a vendor adding a group would be silently
      // discarded rather than prompting an update to MATERIAL_GROUPS.
      for (const r of rows(ctx, name)) {
        for (const code of (r[MATERIALS_COLUMN] ?? '').split(/\s+/).filter(Boolean)) {
          expect(MATERIAL_GROUPS, `${name}: ${code}`).toContain(code)
        }
      }
    })
})

describe('the REGO-FIX scrape', () => {
  it('every holder satisfies the taper arithmetic', (ctx) => {
    // The 48.4 mm check, over the whole family rather than one document. This
    // is what would catch a re-scrape where the vendor moved `B3` or `B4`,
    // which is the change that would silently redefine every gage length.
    const scraped = rows(ctx, RF_HOLDERS)

    expect(scraped).toHaveLength(HOLDER_FAMILIES[RF_HOLDERS]!.rows)
    for (const r of scraped) {
      expect(Number(r['L1_mm']) - Number(r['B3_mm']), r['ISO Catalog Number']).toBeCloseTo(
        BT30_GAUGE_TO_FLANGE,
        9,
      )
    }
  })

  it('every holder states a contact mode that matches its name', (ctx) => {
    // Both halves are present in the real family, and the designation is what
    // says which — so a lost `form_name` shows up as a mismatch rather than as
    // twenty-one plain-taper holders.
    const scraped = rows(ctx, RF_HOLDERS)
    const contacts = new Map(scraped.map((r) => [r['ISO Catalog Number']!, r['contact']!]))

    expect(new Set(contacts.values())).toEqual(new Set(['taper', 'face']))
    for (const [name, contact] of contacts) {
      expect(contact === 'face', name).toBe(name.startsWith('BT+'))
    }
  })

  for (const name of [STANDARD, TAPPING, SHORT_TAIL])
    it(`${name}: every collet round-trips to its own designation`, (ctx) => {
      // The nominal size, re-derived from the title and compared against the
      // column the scraper wrote — over all 321 collets rather than the seven
      // hand-written cases.
      for (const r of rows(ctx, name)) {
        const again = colletRow({
          title: [r['ISO Catalog Number']],
          field_sku_fulltext: [r['Material Number']],
        })
        expect(again['unit'], r['ISO Catalog Number']).toBe(r['unit'])
        expect(again['D1_mm'], r['ISO Catalog Number']).toBe(r['D1_mm'])
      }
    })

  it('holds both unit systems in one collet group', (ctx) => {
    // Which is the whole reason `unit` is a per-record fact here. If a
    // re-scrape ever produced a single-unit group, splitting the CSV would be
    // back on the table and this says so.
    const units = new Set(rows(ctx, STANDARD).map((r) => r['unit']))

    expect(units).toEqual(new Set(['millimeters', 'inches']))
  })

  it('carries a tapping collet’s drive square without it reading as a dimension', (ctx) => {
    // The second number in `Ø 3.5 x 2.7 mm` is the internal square, not a
    // second diameter. It is kept in its own column so nothing reads it as one.
    const r = row(ctx, TAPPING, 'PG 15-TAP Ø 3.5 x 2.7 mm')

    expect(r['Square_mm']).toBe('2.7')
    expect(r['D1_mm']).toBe('3.5')
  })
})
