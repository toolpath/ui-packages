/**
 * Harvey Tool — miniature end mills and keyseat cutters, from a printed-catalog
 * table rendered as a web page.
 *
 * No JSON API and no XHR: a product page inlines its entire variant table as a
 * JavaScript literal beside a `<thead>` that names the columns, and the two are
 * joined by position. `literal.ts`, `header.ts`, `lexicon.ts` and `value.ts` are
 * pure and hold the parsing risk; `scrape.ts` and `catalog.ts` are the only
 * modules that read through a `Fetcher`.
 *
 * The one structural thing to know before reading any of it: **one HTML row is
 * up to nine orderable parts.** See `scrape.ts`, and
 * `docs/HARVEY_PRODUCT_TABLE.md` for the transport.
 */

export * from './catalog.js'
export * from './header.js'
export * from './lexicon.js'
export * from './literal.js'
export * from './records.js'
export * from './scrape.js'
export * from './value.js'
