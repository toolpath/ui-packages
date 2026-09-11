/**
 * The scraped MariTool data, where a machine holds a scrape.
 *
 * Not a test of the scraper — a test of what it produced. `tests/corpus.ts`
 * explains why these skip with a named reason rather than pass silently in CI.
 *
 * What is checked here cannot be checked from a fixture, and the reason is the
 * same one that makes MariTool the odd vendor in this package: **the unit
 * system is per part rather than per family.** A fixture proves the promotion
 * handles a metric cell and an imperial one; only the catalog proves the vendor
 * really mixes them, that no row came out with both cells filled or neither,
 * and that the promotion did not quietly read a whole family one way.
 *
 * There is no `toRecords` half here, unlike `harvey-corpus`. MariTool ships
 * toolholding and no cutting tools, so it binds no record mapper and no column
 * map — the REGO-FIX case. The columns below are the receipt itself, and the
 * records those columns become are `tests/holding-corpus.test.ts`.
 */

import { describe, expect, it } from 'vitest'

import {
  COLLET_SERIES_COLUMN,
  CONTACT_COLUMN,
  GAGE_COLUMNS,
  checkIdentityColumns,
} from '../src/conventions.js'
import { HOLDER_FAMILIES } from '../src/families/maritool.js'
import {
  CLAMPING_COLUMN,
  MATERIAL_COLUMN,
  STORE_ID_COLUMN,
  STYLE_COLUMN,
  TAPER_COLUMN,
  TAPER_FORMS,
} from '../src/vendors/maritool/scrape.js'
import { rows } from './corpus.js'

/** Every family and the row total its config declares, widened off the literal table. */
const FAMILIES: readonly (readonly [string, number])[] = Object.entries(HOLDER_FAMILIES).map(
  ([name, cfg]) => [name, cfg.rows] as const,
)
const NAMES = FAMILIES.map(([name]) => name)
const DECLARED = new Map(FAMILIES)

/** Every interface `TAPER_FORMS` can name, which is what a row may state. */
const TAPERS = new Set(Object.values(TAPER_FORMS).map((form) => form.taper))

describe('the scraped MariTool catalog', () => {
  // A loop rather than `it.each`, so the test context — and therefore the skip
  // that names what is missing — reaches `corpus.rows`.
  for (const name of NAMES) {
    it(`${name}: holds the number of parts its config declares`, (ctx) => {
      // The one count nothing computes from the file it is checking: it came
      // from the vendor's own `(of N products)` totals, leaf by leaf, minus the
      // parts that publish no spec table.
      expect(rows(ctx, name)).toHaveLength(DECLARED.get(name)!)
    })
  }

  for (const name of NAMES) {
    it(`${name}: carries its identity column, filled on every row`, (ctx) => {
      // MariTool publishes one number per part and no catalog designation, so
      // `Material Number` is the whole of a row's identity and an empty one
      // mints a guid off an empty string.
      const scraped = rows(ctx, name)

      expect(() => checkIdentityColumns('maritool', Object.keys(scraped[0] ?? {}))).not.toThrow()
      for (const row of scraped) {
        expect(row[MATERIAL_COLUMN], JSON.stringify(row[STORE_ID_COLUMN])).toBeTruthy()
      }
    })
  }

  it('gives every holder a part number nothing else in the catalog claims', (ctx) => {
    // `scrapeHolders` dedupes by `products_id` within one family's leaves and
    // cannot see across families. A part listed under two tapers would be
    // written into two CSVs, and the receipts would both agree with themselves.
    const seen = new Map<string, string>()
    const collisions: string[] = []

    for (const name of NAMES) {
      for (const row of rows(ctx, name)) {
        const number = row[MATERIAL_COLUMN] ?? ''
        const already = seen.get(number)
        if (already !== undefined) collisions.push(`${number}: ${already} and ${name}`)
        seen.set(number, name)
      }
    }

    expect(collisions).toEqual([])
    expect(seen.size).toBe(FAMILIES.reduce((sum, [, declared]) => sum + declared, 0))
  })

  for (const name of NAMES) {
    it(`${name}: fills exactly one gage-length cell on every row`, (ctx) => {
      // The claim the whole `L1_in`/`L1_mm` pair exists to make. Both filled is
      // a conversion nobody asked for; neither filled is a part whose gage
      // length was lost, which is the one dimension a holder is bought for.
      for (const row of rows(ctx, name)) {
        const filled = [GAGE_COLUMNS.inches, GAGE_COLUMNS.millimeters].filter(
          (column) => (row[column] ?? '') !== '',
        )

        expect(filled, `${row[MATERIAL_COLUMN]}: ${JSON.stringify(filled)}`).toHaveLength(1)
        expect(Number(row[filled[0]!]), row[MATERIAL_COLUMN]).toBeGreaterThan(0)
      }
    })
  }

  it('really does hold both unit systems, inside one family', (ctx) => {
    // The fact the pair was built for, stated against the catalog rather than
    // against a fixture. If this ever fails, MariTool has normalised its own
    // table and the pair is two columns where one would do.
    const mixed = NAMES.filter((name) =>
      [GAGE_COLUMNS.inches, GAGE_COLUMNS.millimeters].every((column) =>
        rows(ctx, name).some((row) => (row[column] ?? '') !== ''),
      ),
    )

    expect(mixed.length).toBeGreaterThan(0)
  })

  for (const name of NAMES) {
    it(`${name}: names a spindle interface, and a contact mode with it`, (ctx) => {
      // `taper` and `contact` are scraped rather than declared, which is why
      // `tests/registry.test.ts` refuses a fact for them — and why a lost
      // column has to be visible here instead. One part in the catalog states
      // no Taper and keeps both cells empty; the pair is what must never split.
      for (const row of rows(ctx, name)) {
        const taper = row[TAPER_COLUMN] ?? ''
        const contact = row[CONTACT_COLUMN] ?? ''

        expect(taper === '', `${row[MATERIAL_COLUMN]}: ${taper}/${contact}`).toBe(contact === '')
        if (taper === '') continue
        expect(TAPERS, row[MATERIAL_COLUMN]).toContain(taper)
        expect(['taper', 'face'], row[MATERIAL_COLUMN]).toContain(contact)
      }
    })
  }

  for (const name of NAMES) {
    it(`${name}: classifies every holder, and gives a collet chuck a series`, (ctx) => {
      // `clamping` and `style` come from the leaf, so an empty one is a leaf
      // whose parts were written under no classification at all. `CST` is what
      // joins a collet chuck to a collet family, and only a collet chuck has one.
      for (const row of rows(ctx, name)) {
        const clamping = row[CLAMPING_COLUMN] ?? ''

        expect(['collet', 'shrink', 'hydraulic'], row[MATERIAL_COLUMN]).toContain(clamping)
        expect(row[STYLE_COLUMN], row[MATERIAL_COLUMN]).toBeTruthy()
        if (clamping === 'collet') {
          expect(row[COLLET_SERIES_COLUMN], row[MATERIAL_COLUMN]).toMatch(/^ER\d+$/)
        }
      }
    })
  }
})
