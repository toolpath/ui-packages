/**
 * The two Harvey tables, held to each other and to what the adapter reads.
 *
 * `families/harvey.ts` carries a family's config and, beside it, the product
 * page to fetch — a second table, because `FamilyDefinition` has no key for a
 * path and widening it for one vendor would put a Harvey fact in the type every
 * family in the catalog is written against. A second table can drift from the
 * first, so this is what stops it.
 */

import { describe, expect, it } from 'vitest'

import { FAMILIES, PRODUCT_PAGES } from '../src/families/harvey.js'
import { ALL_FAMILIES } from '../src/families/index.js'
import { boundFamilies, boundFamily } from '../src/registry.js'
import { CATEGORY_ROOTS } from '../src/vendors/harvey/catalog.js'

const NAMES = Object.keys(FAMILIES)

describe('the family table', () => {
  it('covers the 52 product pages the four category trees reach', () => {
    // Measured by walking the trees on 2026-08-29. A 53rd page is Harvey
    // extending its catalog, and `toolpath-scrape harvey --catalog` is how it
    // gets noticed.
    expect(NAMES).toHaveLength(52)
    expect(CATEGORY_ROOTS).toHaveLength(4)
  })

  it('names a product page for every family and no others', () => {
    expect(Object.keys(PRODUCT_PAGES).sort()).toEqual([...NAMES].sort())
  })

  it('gives every family a path under /products/', () => {
    for (const [name, path] of Object.entries(PRODUCT_PAGES)) {
      expect(path, name).toMatch(/^\/products\/[a-z0-9-]+$/)
    }
  })

  it('gives every family a distinct page and a distinct vendor code', () => {
    // Two families scraping one page would write two CSVs of the same rows.
    expect(new Set(Object.values(PRODUCT_PAGES)).size).toBe(52)
    expect(new Set(NAMES.map((n) => FAMILIES[n as keyof typeof FAMILIES].familyCode)).size).toBe(52)
  })

  it('lands in the merged catalog under a name nobody else claims', () => {
    for (const name of NAMES) expect(ALL_FAMILIES[name]).toBeDefined()
  })
})

describe('what every family declares', () => {
  it('binds, which checks its column map and every one of its facts', () => {
    // The registry runs `checkColumnMap` and `checkFact` over the whole
    // catalog, so a fact missing the note its source kind requires fails here
    // naming the family.
    expect(() => boundFamilies()).not.toThrow()
  })

  it('declares a unit, because a Harvey scrape cannot start without one', () => {
    // The unit decides every `_mm`/`_in` in the header the scrape writes. A
    // family without one is a scrape that cannot name its own columns.
    for (const name of NAMES) {
      expect(boundFamily(name).unit, name).toMatch(/^(inches|millimeters)$/)
    }
  })

  it('declares carbide and a profile', () => {
    for (const name of NAMES) {
      const cfg = boundFamily(name)
      expect(cfg.bmc, name).toBe('carbide')
      expect(cfg.profile, name).toBeTruthy()
    }
  })

  it('maps the four fields the endmill contract requires', () => {
    // Checked at bind time too; asserted here so the claim that all 80 tables
    // publish all four is visible rather than implied.
    for (const name of NAMES) {
      const mapped = boundFamily(name).columns.mapped()
      for (const field of ['DC', 'SFDM', 'OAL', 'LCF']) expect(mapped, name).toContain(field)
    }
  })

  it('names exactly one coolant-through family', () => {
    // The negative is derived from that: Harvey publishes no coolant column, so
    // a family whose title does not name it is not one.
    const through = NAMES.filter((name) => boundFamily(name).coolantThrough)
    expect(through).toEqual(['harvey_endmill_032.csv'])
  })

  it('maps NOF everywhere the vendor publishes a flute count', () => {
    // The two exceptions are the deburring families, which state right- and
    // left-hand tooth counts instead. An absent NOF there is the vendor's
    // silence, not a forgotten mapping.
    const without = NAMES.filter((name) => !boundFamily(name).columns.mapped().includes('NOF'))
    expect(without.sort()).toEqual(['harvey_endmill_015.csv', 'harvey_endmill_023.csv'])
  })

  it('maps RE on every family that is not a ball nose or a square end', () => {
    // A ball family publishes no radius column and gets `RE = DC / 2` from its
    // profile; a square one gets 0. Anything else has to publish a column, or
    // its corner radius would silently be zero.
    for (const name of NAMES) {
      const cfg = boundFamily(name)
      if (cfg.profile === 'Ball' || cfg.profile === 'Square') continue
      expect(cfg.columns.mapped(), `${name} (${cfg.profile})`).toContain('RE')
    }
  })
})
