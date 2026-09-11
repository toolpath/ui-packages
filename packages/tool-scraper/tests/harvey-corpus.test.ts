/**
 * The scraped Harvey data, where a machine holds a scrape.
 *
 * Not a test of the scraper — a test of what it produced. `tests/corpus.ts`
 * explains why these skip with a named reason rather than pass silently in CI.
 *
 * What is checked here cannot be checked from a fixture: that 12,773 tool
 * numbers across 52 files collide with none of the others, and that every one
 * of those rows becomes a record. A coating grid read one column off would
 * still produce a plausible fixture; it would not produce a catalog with no
 * repeated part number in it.
 */

import { describe, expect, it } from 'vitest'

import { CAD_DXF_COLUMN, checkIdentityColumns } from '../src/conventions.js'
import { PRODUCT_PAGES } from '../src/families/harvey.js'
import { UNSPECIFIED } from '../src/records.js'
import { boundFamily, toRecords } from '../src/registry.js'
import { TOOL_NUMBER_COLUMN } from '../src/vendors/harvey/scrape.js'
import { rows } from './corpus.js'

const NAMES = Object.keys(PRODUCT_PAGES)

describe('the scraped Harvey catalog', () => {
  // A loop rather than `it.each`, so the test context — and therefore the skip
  // that names what is missing — reaches `corpus.rows`.
  for (const name of NAMES) {
    it(`${name}: holds the number of parts its config declares`, (ctx) => {
      // The one count nothing computes from the file it is checking: it came
      // from Harvey's own add-to-cart payloads during reconnaissance.
      expect(rows(ctx, name)).toHaveLength(boundFamily(name).rows)
    })
  }

  it('gives every part in the catalog a number nothing else claims', (ctx) => {
    const seen = new Map<string, string>()
    const collisions: string[] = []

    for (const name of NAMES) {
      for (const row of rows(ctx, name)) {
        const number = row[TOOL_NUMBER_COLUMN] ?? ''
        const already = seen.get(number)
        if (already !== undefined) collisions.push(`${number}: ${already} and ${name}`)
        seen.set(number, name)
      }
    }

    expect(collisions).toEqual([])
    expect(seen.size).toBe(NAMES.reduce((sum, name) => sum + boundFamily(name).rows, 0))
  })

  for (const name of NAMES) {
    it(`${name}: turns every row into a record`, (ctx) => {
      const cfg = boundFamily(name)
      const scraped = rows(ctx, name)
      const warnings: string[] = []

      // Through `toRecords` rather than the mapper directly: it is what a
      // consumer calls, so the identity and column checks it runs first are
      // exercised against 52 real headers rather than only against a fixture.
      const records = toRecords(
        name,
        { header: Object.keys(scraped[0] ?? {}), rows: scraped, source: name, familyCode: null },
        { warn: (m) => warnings.push(m) },
      )

      expect(records).toHaveLength(scraped.length)
      for (const record of records) {
        // The relationships a mis-read column breaks first. Deliberately not
        // `reach >= LCF`: a keyseat cutter is a wide disc on a short neck, and
        // eight real parts have a cutter width greater than their neck length.
        expect(record.geometry.DC, record.materialNumber).toBeGreaterThan(0)
        expect(record.geometry.SFDM, record.materialNumber).toBeGreaterThan(0)
        expect(record.geometry.LCF, record.materialNumber).toBeLessThanOrEqual(
          record.geometry.OAL as number,
        )
        expect((record.geometry.RE as number) * 2, record.materialNumber).toBeLessThanOrEqual(
          (record.geometry.DC as number) + 1e-9,
        )
        expect(record.unit).toBe(cfg.unit)
        expect(record.substrate).toBe('carbide')
        // No evidence, over the whole catalog: a Harvey variant table carries no
        // material index, and the per-part page's list varies by coating within a
        // family, so no family fact stands in for it.
        expect(record.materialGroups, record.materialNumber).toBeNull()
        expect(record.materialGroupsSource, record.materialNumber).toBe(UNSPECIFIED)
      }
    })
  }

  for (const name of NAMES) {
    it(`${name}: carries its identity column and a CAD link on every row`, (ctx) => {
      const scraped = rows(ctx, name)
      const header = Object.keys(scraped[0] ?? {})

      expect(() => checkIdentityColumns('harvey', header)).not.toThrow()
      // Harvey publishes a DXF for every real part; a row without one is a row
      // whose tool number did not join, which is how a footnote marker left on
      // a number would show up.
      for (const row of scraped) expect(row[CAD_DXF_COLUMN], row[TOOL_NUMBER_COLUMN]).toBeTruthy()
    })
  }
})
