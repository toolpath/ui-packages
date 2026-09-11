/**
 * Destiny Tool — solid end mills, sold direct from a live Firestore database.
 *
 * Not a server-rendered vendor catalog: the storefront is a Next.js SPA built
 * on Firebase Studio with no product data in the HTML, so the "scrape" is a
 * paginated Firestore REST client rather than an HTML table parser. See
 * `scrape.ts` for the endpoint and `records.ts` for what the adapter derives
 * from free-text descriptions that the vendor's structured fields leave blank.
 */

export * from './records.js'
export * from './scrape.js'
