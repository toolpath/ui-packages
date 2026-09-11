/**
 * Reading a scrape, when there is one on this machine.
 *
 * Some tests check the **scraped data** rather than the scraper: that every
 * holder satisfies the taper arithmetic, that every collet round-trips to its
 * own designation, that the material sweep filled a column. They are worth
 * having and they cannot run in CI, because the CSVs they read are vendor data
 * and are never committed.
 *
 * So they skip, **with a named reason and the environment variable that turns
 * the skip into a failure**. A machine holding a scrape checks it; CI skips
 * and says why. A silent pass would be worse than no test — it would report
 * the corpus as checked on a machine that has never seen it.
 *
 * ## What this is worth to the port specifically
 *
 * These are the strongest thing said about the TypeScript being a port rather
 * than a rewrite. The CSVs on a machine that keeps a corpus were produced by
 * the Python; a green run here says this code reproduces them. `pnpm check`
 * skips all of it, which is right — and is exactly why the escape hatch is a
 * variable a person sets deliberately.
 */

import { existsSync, readFileSync } from 'node:fs'
import type { TestContext } from 'vitest'

import { parseCsv } from '../src/node/csv.js'
import { familyCsv } from '../src/node/paths.js'
import type { ScrapeResult, ScrapedRow } from '../src/scrape.js'
import { describeRoot } from '../src/node/paths.js'

/**
 * Set this where a scrape is expected to exist — a machine that keeps the
 * corpus, or a job whose whole purpose is checking it. A missing CSV then
 * fails instead of skipping, which is the difference between "not checked
 * here" and "checked, and it is gone".
 */
const REQUIRE_ENV = 'TOOLPATH_REQUIRE_CORPUS'

/**
 * One family's scraped CSV, or a skip naming what is absent and where.
 *
 * The reason carries the resolved root, because "no corpus" and "a corpus
 * somewhere this run is not looking" are the same symptom and different
 * problems — and `TOOLPATH_SCRAPE_ROOT` is what separates them.
 */
function csvPath(ctx: TestContext, name: string): string {
  const path = familyCsv(name)
  if (!existsSync(path)) {
    const message =
      `${name} has not been scraped on this machine — ${describeRoot()}. ` +
      `Set ${REQUIRE_ENV}=1 to make this a failure instead.`
    if (process.env[REQUIRE_ENV]) throw new Error(message)
    ctx.skip(message)
  }
  return path
}

export function rows(ctx: TestContext, name: string): ScrapedRow[] {
  return parseCsv(readFileSync(csvPath(ctx, name), 'utf8')).rows
}

/**
 * One family's scraped CSV as a {@link ScrapeResult}, for the calls that take
 * one — `registry.toRecords` and `registry.toHolding`.
 *
 * The header is the file's own and not the union of the rows' keys: a row whose
 * cell is empty still occupies its column, and `checkIdentityColumns` reads the
 * header, so deriving it would hide exactly the failure that check exists for.
 *
 * `source` says the file rather than a URL. Re-issuing the request is not a
 * thing a test can do, and a fabricated URL in a `ScrapeResult` would be the
 * one field of it that was not evidence.
 */
export function scrape(ctx: TestContext, name: string): ScrapeResult {
  const parsed = parseCsv(readFileSync(csvPath(ctx, name), 'utf8'))
  return { ...parsed, source: `file://${familyCsv(name)}`, familyCode: null }
}

/** One row of a scraped CSV, by its catalog number. */
export function row(ctx: TestContext, name: string, catalogNumber: string): ScrapedRow {
  for (const entry of rows(ctx, name)) {
    if (entry['ISO Catalog Number'] === catalogNumber) return entry
  }
  throw new Error(`${catalogNumber} not in ${name}`)
}
