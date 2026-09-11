/**
 * The `Thread Pitch` column Kennametal's tap tables do not publish.
 *
 * The arithmetic is in `thread.ts` — parsing a thread designation is a
 * standard, not a vendor's. What is Kennametal's, and therefore here, is that
 * the designation arrives in a column named `D1-TDZ`, that the thread system
 * arrives in a `Thread System` tag column this package appends at scrape time,
 * and that a pitch column has to be derived at all because the vendor's table
 * carries none.
 */

import { VendorResponseError } from '../../errors.js'
import type { ScrapeResult, ScrapedRow } from '../../scrape.js'
import { threadPitch, type ThreadSystem } from '../../thread.js'

/** The vendor's column holding the thread designation — `#2-56`, `M6 X 1`. */
export const DESIGNATION_COLUMN = 'D1-TDZ'

/** The constant column the scraper tags on, because the table states none. */
export const SYSTEM_COLUMN = 'Thread System'

/** The column this module derives. */
export const PITCH_COLUMN = 'Thread Pitch'

/**
 * Add (or replace) the `Thread Pitch` column on a tap scrape.
 *
 * Safe to re-run: an existing pitch column is dropped and rebuilt, and the
 * column is always reinserted directly after `D1-TDZ`, so re-running produces
 * a byte-identical result rather than appending a second copy.
 *
 * Returns a new result rather than rewriting a file in place, so this step
 * composes with the others instead of needing a CSV between them.
 */
export function addThreadPitch(scrape: ScrapeResult): ScrapeResult {
  const header = scrape.header.filter((name) => name !== PITCH_COLUMN)
  const at = header.indexOf(DESIGNATION_COLUMN)
  if (at === -1) {
    throw new VendorResponseError(
      PITCH_COLUMN,
      `the scrape has no ${DESIGNATION_COLUMN} column to derive a pitch from`,
    )
  }
  header.splice(at + 1, 0, PITCH_COLUMN)

  const rows: ScrapedRow[] = scrape.rows.map((row) => ({
    ...row,
    [PITCH_COLUMN]: threadPitch(
      row[DESIGNATION_COLUMN] ?? '',
      (row[SYSTEM_COLUMN] ?? '') as ThreadSystem,
    ),
  }))

  return { ...scrape, header, rows }
}
