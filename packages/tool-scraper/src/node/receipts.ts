/**
 * What a scrape did, written beside what it produced.
 *
 * The CSVs are not committed — they are vendor data, and a public repository
 * is the wrong place for it — so `git log` cannot answer "when was this
 * scraped, from which URL, under which family code, how many rows". Each
 * scrape writes a sidecar instead. It is cheap now and effectively impossible
 * to backfill: nothing in a CSV records the URL it came from, and a re-scrape
 * a month later answers a different question than the one asked.
 *
 * **The row count is the interesting field.** `families/` states how many rows
 * a human counted at scrape time, and a receipt states how many the scrape
 * actually wrote. Every other count in a pipeline like this is computed from
 * the same file it is checking, so a scrape that silently lost rows agrees
 * with itself; two independently-arrived-at numbers do not.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, basename, join } from 'node:path'
import { createRequire } from 'node:module'

import { VendorResponseError } from '../errors.js'
import type { BrandName } from '../identity.js'
import { compare } from '../order.js'

/**
 * The suffix a receipt takes, beside the CSV it describes.
 *
 * A suffix rather than a parallel directory, so a CSV and its receipt cannot
 * be separated by moving one — and so a directory listing shows immediately
 * which scrapes have one.
 */
export const SUFFIX = '.scrape.json'

/**
 * This package's version, or `unknown` when it cannot be read.
 *
 * Not an error: the package runs perfectly well from a source checkout, and
 * refusing to record a scrape over a missing version string would be the tail
 * wagging the dog. `unknown` is the honest value and reads as one.
 */
export function scraperVersion(): string {
  try {
    const require = createRequire(import.meta.url)
    const manifest = require('../../package.json') as { version?: string }
    return manifest.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/** One scrape: what was fetched, from where, when, and how much of it. */
export interface Receipt {
  /**
   * The CSV this describes, by name — so a receipt read on its own says what
   * it belongs to.
   */
  csv: string
  brand: BrandName
  /**
   * The URL the rows came from. A request, not a page: this is the thing to
   * re-issue when a column changes shape, and finding it again is the most
   * expensive part of adding a vendor.
   */
  source: string
  /** How many rows were written. See the module docstring. */
  rows: number
  /** UTC, ISO 8601, to the second. */
  scrapedAt: string
  scraper: string
  /**
   * The vendor's own family code where there is one. REGO-FIX and Destiny Tool
   * have none — their scrape target is a set of index filters — so it is null
   * rather than an empty string, which would read as a code the vendor left
   * blank.
   */
  familyCode: string | null
}

/** Where the receipt for `csvPath` goes. */
export function pathFor(csvPath: string): string {
  return join(dirname(csvPath), basename(csvPath) + SUFFIX)
}

/** What {@link write} needs to record. */
export interface ReceiptInput {
  brand: BrandName
  source: string
  rows: number
  familyCode?: string | null
  /** The moment to stamp. Injectable so a test is not a clock. */
  now?: Date
}

/**
 * Record a scrape beside its CSV, replacing any earlier receipt.
 *
 * Replacing rather than appending: a receipt describes the file sitting next
 * to it, and a history of scrapes that produced files no longer there is a
 * log, not a receipt.
 */
export function write(csvPath: string, input: ReceiptInput): string {
  const stamped = input.now ?? new Date()
  const receipt: Receipt = {
    csv: basename(csvPath),
    brand: input.brand,
    source: input.source,
    rows: input.rows,
    scrapedAt: `${stamped.toISOString().slice(0, 19)}+00:00`,
    scraper: scraperVersion(),
    familyCode: input.familyCode ?? null,
  }

  const out = pathFor(csvPath)
  mkdirSync(dirname(out), { recursive: true })
  // Sorted keys, so a re-scrape's receipt diffs only where it differs.
  const ordered = Object.fromEntries(Object.entries(receipt).sort(([a], [b]) => compare(a, b)))
  writeFileSync(out, `${JSON.stringify(ordered, null, 2)}\n`)
  return out
}

/**
 * The receipt beside `csvPath`, or null when the scrape predates them.
 *
 * Null rather than a throw: a CSV somebody scraped before this existed is
 * still a usable CSV, and refusing it would be refusing data over its
 * paperwork.
 */
export function read(csvPath: string): Receipt | null {
  const path = pathFor(csvPath)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as Receipt
}

/**
 * Refuse a scrape whose row count disagrees with the declared one.
 *
 * The one check two independent numbers make possible. A silently truncated
 * response, a facet that started filtering, a vendor discontinuing half a
 * family — all of them produce a CSV that parses cleanly and is wrong, and
 * none of them is visible from the file alone.
 *
 * Throwing rather than warning, because the declared count is a human's
 * statement about the vendor's own page: if the scrape now disagrees with it,
 * one of the two needs updating and neither can be guessed at from here.
 */
export function checkRows(family: string, declared: number, receipt: Receipt): void {
  if (receipt.rows !== declared) {
    throw new VendorResponseError(
      family,
      `the scrape wrote ${receipt.rows} rows where this family declares ` +
        `${declared} — either the vendor changed the family or the scrape ` +
        `lost rows. Re-count and update \`rows\`, or find out which.`,
    )
  }
}
