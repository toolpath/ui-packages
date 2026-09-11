/**
 * Kennametal and WIDIA — one adapter, because they are one platform.
 *
 * Both run the same AEM/Hybris component on the same URL shape; only the host,
 * the component node name and the vendor string differ, and `identity.BRANDS`
 * is where that is recorded. Treating them as two adapters would duplicate
 * every module here to encode one differing node name.
 *
 * **Their data directories are still separate**, and the distinction is worth
 * holding on to: an adapter is a fact about *code*, a receipt is a fact about
 * *who published it*. So WIDIA's scraped tables live under WIDIA's own brand
 * even though this module is what scraped them, and a CSV is resolved through
 * its family's `brand` rather than through the adapter that wrote it. A future
 * brand on this same platform is a `BRANDS` entry and a data directory, and no
 * code here at all.
 */

export * from './cad.js'
export * from './catalog.js'
export * from './family.js'
export * from './holding.js'
export * from './materials.js'
export * from './records.js'
export * from './scrape.js'
export * from './thread-column.js'
