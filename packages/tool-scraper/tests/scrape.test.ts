/**
 * The vendor-neutral half of a scrape: pacing, and the header a result implies.
 *
 * `unionHeader` was asserted twice — once in `regofix.test.ts` and once in
 * `maritool.test.ts` — because the function itself existed twice. Both cases
 * are here, because both reasons are real and neither is a fact about a
 * manufacturer: a mixed-unit collet family and a mixed-style holder family
 * break a first-row header for the same reason.
 */

import { describe, expect, it } from 'vitest'

import { REQUEST_DELAY_MS, pause, unionHeader } from '../src/scrape.js'

describe('the header a set of rows implies', () => {
  it('is the union of every row’s keys, in first-seen order', () => {
    // REGO-FIX's case: keying the header off the first row would drop `D1_in`
    // from a group whose metric collets happen to come first — which is every
    // group, since the rows are sorted by part number.
    expect(
      unionHeader([
        { a: '1', D1_mm: '3' },
        { a: '2', D1_in: '0.125' },
      ]),
    ).toEqual(['a', 'D1_mm', 'D1_in'])
  })

  it('keeps a key a later row is the first to publish', () => {
    // MariTool's case: which spec keys a part publishes is a function of its
    // style, and all three styles share a CSV — keying off row one drops
    // `Hydraulic Type` from every family whose collet chucks sort first.
    expect(
      unionHeader([
        { a: '1', 'Collet Size': 'ER16' },
        { a: '2', 'Hydraulic Type': 'HC' },
      ]),
    ).toEqual(['a', 'Collet Size', 'Hydraulic Type'])
  })

  it('names a column once however many rows carry it', () => {
    expect(unionHeader([{ a: '1', b: '2' }, { a: '3' }, { b: '4', a: '5' }])).toEqual(['a', 'b'])
  })

  it('is empty for no rows rather than throwing', () => {
    // A scrape that legitimately found nothing is the caller's to refuse — and
    // both callers do, by name. This one only builds a header.
    expect(unionHeader([])).toEqual([])
  })
})

describe('pacing', () => {
  it('skips the wait entirely at zero, which is what a test passes', async () => {
    const before = Date.now()
    await pause(0)

    expect(Date.now() - before).toBeLessThan(50)
  })

  it('states one delay for every loop in the package', () => {
    // Politeness, not rate-limit avoidance. Pinned because three constants
    // saying so drifted apart the moment one of them was tuned.
    expect(REQUEST_DELAY_MS).toBe(400)
  })
})
