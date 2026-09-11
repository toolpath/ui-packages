/**
 * The package resolves the way a consumer gets it, and its errors are
 * catchable.
 *
 * Thin on purpose, and it earns its place anyway: it is what makes the repo's
 * `pnpm check` gate live over this package from its first TypeScript commit,
 * rather than passing over a directory with nothing in it to run.
 *
 * The `instanceof` cases are not ceremony. `Error` is a built-in, so a
 * subclass loses its prototype chain under a downlevel target unless it is
 * restored by hand — and the symptom is a `catch` block that silently never
 * matches, which is the worst possible way to find out.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  AEM_BRANDS,
  HttpError,
  ScraperConfigError,
  VendorResponseError,
  createFetcher,
  statusOf,
  type BoundFamily,
  type FetcherOptions,
  type ScrapeResult,
  type ScrapedRow,
  type ToolRecord,
  type Warn,
} from '../src/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  bin: Record<string, string>
  exports: Record<string, { types: string; import: string }>
}

/** `./dist/node/main.js` -> `src/node/main.ts`, the file it is built from. */
function sourceFor(distPath: string): string {
  return join(ROOT, distPath.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts'))
}

describe('the package surface', () => {
  it('exports the two error types', () => {
    expect(ScraperConfigError).toBeTypeOf('function')
    expect(VendorResponseError).toBeTypeOf('function')
  })

  it('exports the types its own signatures are written in', () => {
    // The type imports above are the assertion: a consumer that cannot name
    // `ScrapeResult` cannot type a wrapper around `scrapeFamily`, and the
    // entry point used to export neither it nor `ScrapedRow` while exporting
    // every function that takes or returns one. A missing name fails
    // `check-types` rather than this expectation.
    const surface: [ScrapeResult | null, ScrapedRow | null, BoundFamily | null, ToolRecord | null] =
      [null, null, null, null]
    const options: FetcherOptions = {}
    const warn: Warn = () => {}

    expect(surface).toHaveLength(4)
    expect(warn).toBeTypeOf('function')
    expect(createFetcher(options)).toBeTypeOf('object')
    expect(HttpError).toBeTypeOf('function')
    expect(statusOf(new HttpError('https://example.test', 404))).toBe(404)
    expect(AEM_BRANDS).toContain('kennametal')
  })
})

describe('a scraper error', () => {
  it('leads its message with the subject, as the Python SystemExit did', () => {
    const error = new ScraperConfigError(
      'godrill_3xd_metric.csv',
      'a drill family must map DC (cutting diameter)',
    )

    expect(error.message).toBe(
      'godrill_3xd_metric.csv: a drill family must map DC (cutting diameter)',
    )
    expect(error.subject).toBe('godrill_3xd_metric.csv')
  })

  it('survives instanceof, so a caller can tell the two apart', () => {
    const config = new ScraperConfigError('a', 'b')
    const vendor = new VendorResponseError('a', 'b')

    expect(config).toBeInstanceOf(ScraperConfigError)
    expect(config).toBeInstanceOf(Error)
    expect(config).not.toBeInstanceOf(VendorResponseError)
    expect(vendor).toBeInstanceOf(VendorResponseError)
    expect(vendor).not.toBeInstanceOf(ScraperConfigError)
  })

  it('names itself, so an unhandled throw reads as what it is', () => {
    expect(new ScraperConfigError('a', 'b').name).toBe('ScraperConfigError')
    expect(new VendorResponseError('a', 'b').name).toBe('VendorResponseError')
  })
})

describe('the manifest', () => {
  it('points every export at a module that exists', () => {
    // A subpath added to `exports` without the file behind it resolves at
    // publish time and fails at a consumer's `import`, which is the worst
    // place to find out.
    for (const [subpath, entry] of Object.entries(manifest.exports)) {
      expect(existsSync(sourceFor(entry.import)), subpath).toBe(true)
    }
  })

  it('points the bin at the executable, not at the CLI module', () => {
    // `cli.ts` is also imported — `@toolpath/tool-scraper/node` re-exports
    // `run` so a consumer can drive a command without a subprocess. It
    // therefore cannot carry a top-level "if this is the entry point" guard:
    // run through the `bin` symlink, `process.argv[1]` is the symlink's name,
    // the guard never matched, and the installed command printed nothing and
    // exited 0. `main.ts` is the executable and does nothing else.
    expect(manifest.bin['toolpath-scrape']).toBe('./dist/node/main.js')

    const main = readFileSync(join(ROOT, 'src/node/main.ts'), 'utf8')
    expect(main).toContain('#!/usr/bin/env node')
    expect(main).toContain('process.exitCode = await main()')

    const cli = readFileSync(join(ROOT, 'src/node/cli.ts'), 'utf8')
    expect(cli).not.toContain('#!/usr/bin/env node')
    expect(cli).not.toContain('process.exitCode')
  })
})
