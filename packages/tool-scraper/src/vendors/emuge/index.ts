/**
 * EMUGE-FRANKEN — end mills, twist drills and taps, from a SAP Commerce API.
 *
 * Not a catalog to parse: the storefront renders its listings in the browser,
 * so the "scrape" is a JSON client against the same unauthenticated API the
 * site's own Vue front end reads. See `scrape.ts` for the three calls it takes
 * and why, `value.ts` for the grammar of a vendor value string, and
 * `records.ts` for what the vendor states that no other vendor here does — a
 * point angle per drill, an ISO 513 rating per part — and the one thing it
 * states nowhere at all, which is a tap's flute count.
 *
 * `value.ts` is pure and holds the parsing risk; `scrape.ts` is the only module
 * that reads through a `Fetcher`.
 */

export * from './records.js'
export * from './scrape.js'
export * from './value.js'
