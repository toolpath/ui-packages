/**
 * Scrape cutting-tool geometry from vendor catalogs into records.
 *
 * A small vendor-neutral core plus one adapter per manufacturer under
 * `vendors/`. The line between them is **what a fact is about**: a module
 * under `vendors/` knows one manufacturer's transport, its column vocabulary
 * or its own dimension codes, and a module beside this one knows the domain —
 * what a tool record is, how a guid is minted, what the ISO workpiece groups
 * are.
 *
 * Two adapters share no code with each other, and
 * `tests/vendor-boundary.test.ts` asserts it from the package tree rather than
 * from a list. What they share is the core, and that sharing is the point: it
 * is what makes two vendors' catalogs comparable.
 *
 * ## This entry point is records, not files
 *
 * Every scrape returns rows. Writing them to a CSV, and the provenance sidecar
 * that goes beside one, is `@toolpath/tool-scraper/node` — a separate entry
 * point, because a backend embedding this wants the data and a maintainer
 * running the CLI wants the file, and only one of those two needs `fs`.
 *
 * ## Three record types, one guid space
 *
 * `ToolRecord` is the uniform output for **cutting tools**, and `HolderRecord`
 * and `ColletRecord` are the toolholding half — `registry.toRecords` and
 * `registry.toHolding` map one family's scrape onto them through the adapter
 * its brand binds. All three are minted by `identity.recordGuid` in one
 * namespace per brand, which is what lets a consumer build a catalog from
 * holders and tools together and refuse a collision between them.
 *
 * They are three types rather than one because the vocabularies do not overlap:
 * a tool answers `DC`, a flute count and a workpiece material group; a holder
 * answers a taper, a clamping mode and a gage length; a collet answers a series
 * and a capacity band. `holding.ts` states that at length, and `families/index.ts`
 * already drew the same line for the config tables.
 *
 * **A vendor may publish holders, collets, both or neither, and none of it is
 * required.** REGO-FIX ships toolholding and no cutting tools; MariTool ships
 * holders and no collets; Harvey, EMUGE-FRANKEN and Destiny Tool ship neither.
 * A brand with no mapper for a kind still scrapes, still writes a CSV and still
 * checks a receipt — `registry.toHolding` is the only call that refuses, and it
 * names the brand and what that brand does map.
 */

export * from './columns.js'
export * from './conventions.js'
export * from './errors.js'
export * from './family.js'
export * from './fetch.js'
export * from './holding.js'
export * from './identity.js'
export * from './measure.js'
export * from './profiles.js'
export * from './provenance.js'
export * from './records.js'
export * from './scrape.js'
export * from './thread.js'
