/**
 * The half of this package that touches the filesystem.
 *
 * A scrape returns rows; turning them into a CSV, writing the provenance
 * sidecar that goes beside one, resolving where a vendor's files live and
 * mirroring the vendor's CAD binaries all need `fs`, and a backend that only
 * wants records should not have to import any of it.
 *
 * So they are a separate entry point — `@toolpath/tool-scraper/node` — and the
 * main one stays what a library ought to be: functions in, values out.
 */

export * from './cad-mirror.js'
export * from './cli.js'
export * from './csv.js'
export * from './holder-import.js'
export * from './paths.js'
export * from './receipts.js'
