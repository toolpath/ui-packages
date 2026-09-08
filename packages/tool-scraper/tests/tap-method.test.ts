/**
 * The one fact a tap family cannot be added without, and what it has to be.
 *
 * A form tap and a cut tap of the same size are the same numbers: identical
 * `DC`, `TP`, `SFDM`, `OAL` and `LCF`, and often the same substrate, coating
 * and thread designation. Nothing on a record separates them but
 * `threadMethod`, and getting it wrong is not a display fault — a shop drills a
 * larger hole before a former than before a cut tap, so a former labelled
 * `cutting` is a broken tap rather than a wrong label.
 *
 * `tests/registry.test.ts` already checks that every tap family declares the
 * fact, in the table that says the same thing about `bmc` and `coolantThrough`.
 * This holds it to three things that table cannot: that the value is one of the
 * two the domain publishes, that it is `vendor-stated` rather than assumed, and
 * that its citation names something specific enough to re-check.
 *
 * **`vendor-stated` is the bar, and it is not a formality.** Both vendors
 * publish the distinction outright — Kennametal in a `newTapType` facet on the
 * same endpoint the scrape already calls, EMUGE in the category split between
 * `FG01` and `FG02` — so there is nothing here to assume, and a family that
 * arrives with an `assumed` method is one nobody looked the answer up for.
 * Neither cites a CSV filename: `khsst_spiral_point_plug_inch` is this
 * package's own name for the file and reading it back would be the table citing
 * itself.
 *
 * Derived from the family tables rather than from a roster of names, so a fifth
 * tap family is covered the day it is written.
 */

import { describe, expect, it } from 'vitest'

import { THREAD_METHODS } from '@toolpath/tool-support'

import { FAMILIES } from '../src/families/index.js'

const taps = Object.entries(FAMILIES).filter(([, cfg]) => cfg.kind === 'tap')

describe('every tap family says how its taps make a thread', () => {
  it('has taps to check at all', () => {
    // The guard the scan needs: a filter that matched nothing would pass every
    // assertion below by never running one.
    expect(taps.length).toBeGreaterThan(0)
  })

  it.each(taps)('%s states a method the domain publishes', (name, cfg) => {
    const fact = cfg.facts?.threadMethod
    expect(fact, `${name}: no threadMethod fact`).toBeDefined()
    expect(THREAD_METHODS, name).toContain(fact?.value)
  })

  it.each(taps)('%s cites the vendor rather than assuming', (name, cfg) => {
    const fact = cfg.facts?.threadMethod
    expect(fact?.source, name).toBe('vendor-stated')

    // A `vendor-stated` fact carries a `cite` by construction — the union in
    // `provenance.ts` will not compile without one — so what is left to check
    // is that it says something. `checkFact` refuses the empty string; this
    // refuses a citation too short to re-run, and one that names the CSV this
    // package invented rather than anything the vendor published.
    const cite = fact?.source === 'vendor-stated' ? fact.cite : ''
    expect(cite.length, name).toBeGreaterThan(40)
    expect(cite, name).not.toContain('.csv')
  })

  it('covers both methods, so neither branch is theoretical', () => {
    // Until 2026-09-07 this package scraped EMUGE's `FG01` and not its `FG02`,
    // which meant every tap in the corpus was a cutting tap and no test could
    // have noticed. A vocabulary with one live value is a field nobody has
    // exercised.
    const stated = new Set(taps.map(([, cfg]) => cfg.facts?.threadMethod?.value))
    expect([...stated].sort()).toEqual([...THREAD_METHODS].sort())
  })
})
