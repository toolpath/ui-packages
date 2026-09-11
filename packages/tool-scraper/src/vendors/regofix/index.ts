/**
 * REGO-FIX — toolholding only, and nothing here is shared with Kennametal.
 *
 * Different CMS, different transport, and — the part that surprises — the
 * roster and the geometry are two different fetches. See
 * `docs/REGOFIX_PRODUCTFINDER_API.md`.
 */

export * from './holding.js'
export * from './scrape.js'
