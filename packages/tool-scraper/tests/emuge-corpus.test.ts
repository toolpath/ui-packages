/**
 * The scraped EMUGE-FRANKEN data, where a machine holds a scrape.
 *
 * Not a test of the scraper — a test of what it produced. `tests/corpus.ts`
 * explains why these skip with a named reason rather than pass silently in CI.
 *
 * What is checked here cannot be checked from a fixture. A fixture proves the
 * adapter handles a necked part and a plain one; only the catalog proves that
 * EMUGE really publishes both inside one family, that no part number is claimed
 * by two of the four CSVs, and that every one of the ~21,900 rows survives
 * `toRecords` — which is where the closed coolant and cutting-material
 * vocabularies are met by every value the vendor actually ships, rather than by
 * the seven and the nine a fixture names.
 */

import { describe, expect, it } from 'vitest'

import { checkIdentityColumns, dimensionalColumn } from '../src/conventions.js'
import type { FamilyDefinition } from '../src/family.js'
import { FAMILIES } from '../src/families/emuge.js'
import { boundFamily, toRecords } from '../src/registry.js'
import { unionHeader } from '../src/scrape.js'
import { MATERIAL_NUMBER_COLUMN, CATALOG_NUMBER_COLUMN } from '../src/vendors/emuge/scrape.js'
import { rows } from './corpus.js'

const NAMES = Object.keys(FAMILIES)
const DECLARED = new Map(Object.entries(FAMILIES).map(([name, cfg]) => [name, cfg.rows]))

describe('the scraped EMUGE-FRANKEN catalog', () => {
  // A loop rather than `it.each`, so the test context — and therefore the skip
  // that names what is missing — reaches `corpus.rows`.
  for (const name of NAMES) {
    it(`${name}: holds the number of parts its config declares`, (ctx) => {
      expect(rows(ctx, name)).toHaveLength(DECLARED.get(name)!)
    })
  }

  for (const name of NAMES) {
    it(`${name}: carries both identity columns, filled on every row`, (ctx) => {
      // EMUGE is the first vendor since Kennametal to publish two, so it takes
      // no `conventions.IDENTITY_DEVIATIONS` entry — and an empty material
      // number would mint every guid off an empty string.
      const scraped = rows(ctx, name)

      expect(() => checkIdentityColumns('emuge', Object.keys(scraped[0] ?? {}))).not.toThrow()
      for (const row of scraped) {
        expect(row[MATERIAL_NUMBER_COLUMN], JSON.stringify(row)).toBeTruthy()
        expect(row[CATALOG_NUMBER_COLUMN], row[MATERIAL_NUMBER_COLUMN]).toBeTruthy()
      }
    })
  }

  const TAPS: readonly (readonly [string, FamilyDefinition])[] = Object.entries(
    FAMILIES as Record<string, FamilyDefinition>,
  ).filter(([, cfg]) => cfg.kind === 'tap')

  for (const [name, cfg] of TAPS) {
    const forming = cfg.facts?.threadMethod?.value === 'forming'
    const stated = forming ? 'lead taper form' : 'chamfer form'
    const absent = forming ? 'chamfer form' : 'lead taper form'

    it(`${name}: every part states a ${stated} and no ${absent}`, (ctx) => {
      // **The sensor for a family constant nothing else can check.**
      // `threadMethod` is a fact rather than a mapped column, so a scrape
      // cannot contradict it the way a lost column contradicts a declared
      // `unit` — the record would simply carry whatever the table said.
      //
      // But EMUGE states the same distinction a second way, per part: it grinds
      // a chamfer onto a tap that cuts and rolls a lead taper onto one that
      // forms, and publishes whichever applies in `technicalDetails`. Every one
      // of `FG01`'s 414 groups states `chamfer form` and none states `lead
      // taper form`; every one of `FG02`'s 137 states the reverse (JG
      // 2026-09-07). Both properties reach the CSV unmapped, so this is the
      // vendor's own second opinion on the fact, over the whole catalog rather
      // than over a fixture.
      //
      // A failure here is not a broken test. It is the vendor having moved a
      // tap between categories, or having renamed the property — and either way
      // the family's `threadMethod` is now a claim about parts that no longer
      // support it.
      for (const row of rows(ctx, name)) {
        expect(row[stated], row[MATERIAL_NUMBER_COLUMN]).toBeTruthy()
        expect(row[absent] ?? '', row[MATERIAL_NUMBER_COLUMN]).toBe('')
      }
    })
  }

  it('gives every part a number nothing else in the catalog claims', (ctx) => {
    // A part listed under two categories would be written into two CSVs, and
    // both receipts would agree with themselves. The two end mill families are
    // the case worth watching: they are one vendor category split by a facet,
    // so a part the facet does not classify could land in both or neither.
    const seen = new Map<string, string>()
    const collisions: string[] = []

    for (const name of NAMES) {
      for (const row of rows(ctx, name)) {
        const number = row[MATERIAL_NUMBER_COLUMN] ?? ''
        const already = seen.get(number)
        if (already !== undefined) collisions.push(`${number}: ${already} and ${name}`)
        seen.set(number, name)
      }
    }

    expect(collisions).toEqual([])
    expect(seen.size).toBe([...DECLARED.values()].reduce((sum, count) => sum + count, 0))
  })

  for (const name of NAMES) {
    it(`${name}: states every dimension in the unit its family declares`, (ctx) => {
      // The suffix comes from the family's `unit` and the value states its own,
      // so a family whose facet stopped narrowing would show up here as inch
      // values under `_mm` columns rather than as a clean wrong number.
      const scraped = rows(ctx, name)
      const unit = boundFamily(name).unit!
      const wrong = unit === 'inches' ? 'millimeters' : 'inches'
      const header = unionHeader(scraped)

      expect(header.filter((column) => column.endsWith(dimensionalColumn('', unit)))).not.toEqual(
        [],
      )
      expect(header.filter((column) => column.endsWith(dimensionalColumn('', wrong)))).toEqual([])
    })
  }

  for (const name of NAMES) {
    it(`${name}: turns every row into a record`, (ctx) => {
      // The whole catalog against the closed vocabularies: a coolant word or a
      // cutting material EMUGE ships and `records.ts` has no entry for refuses
      // here, naming the part, rather than on somebody else's scrape.
      const scraped = rows(ctx, name)
      const records = toRecords(name, {
        header: unionHeader(scraped),
        rows: scraped,
        source: 'corpus',
        familyCode: null,
      })

      expect(records).toHaveLength(scraped.length)
      for (const record of records) {
        expect(record.guid, record.materialNumber).toMatch(/^[0-9a-f-]{36}$/)
        expect(record.geometry.DC, record.materialNumber).toBeGreaterThan(0)
        expect(record.geometry.OAL, record.materialNumber).toBeGreaterThan(0)
      }
    })
  }

  it('really does publish a necked end mill beside a plain one, in one family', (ctx) => {
    // The fact the per-row `shoulder-*` fallback exists for, stated against the
    // catalog rather than against a fixture. It is also what makes the two neck
    // columns legal in a family-wide column map: `checkColumnsExist` needs them
    // in the header, and only a necked line puts them there.
    for (const name of ['emuge_end_mills_inch.csv', 'emuge_end_mills_mm.csv']) {
      const scraped = rows(ctx, name)
      const unit = boundFamily(name).unit!
      const neck = dimensionalColumn('neck length l₃', unit)

      expect(unionHeader(scraped), name).toContain(neck)
      expect(
        scraped.some((row) => (row[neck] ?? '') !== ''),
        name,
      ).toBe(true)
      expect(
        scraped.some((row) => (row[neck] ?? '') === ''),
        name,
      ).toBe(true)
    }
  })
})
