/**
 * What a scrape hands back.
 *
 * Rows rather than a written file and a count: a Node backend embedding this
 * wants the rows, and writing a CSV is one of several things it might then do
 * with them. `@toolpath/tool-scraper/node` is what turns one into a CSV and a
 * receipt beside it. The two pieces of provenance a receipt needs —
 * where the rows came from, and under which vendor family code — travel with
 * the rows rather than being reconstructed by the caller, because finding the
 * request again is the most expensive part of adding a vendor.
 */

/** One scraped row: the vendor's own column labels, and its own strings. */
export type ScrapedRow = Readonly<Record<string, string>>

/** One family's scrape: the rows, and enough provenance to write a receipt. */
export interface ScrapeResult {
  /**
   * The CSV column order, positional.
   *
   * Kept beside the rows rather than derived from them: a row whose cell is
   * empty still has to occupy its column, and deriving the header from the
   * first row's keys would drop a column the vendor left blank on that row.
   */
  readonly header: readonly string[]
  readonly rows: readonly ScrapedRow[]
  /**
   * The URL the rows came from. A request, not a page: this is the thing to
   * re-issue when a column changes shape.
   */
  readonly source: string
  /**
   * The vendor's own family code where there is one. REGO-FIX and Destiny Tool
   * have none — their scrape target is a set of index filters — so it is null
   * rather than an empty string, which would read as a code the vendor left
   * blank.
   */
  readonly familyCode: string | null
}

/**
 * Where a scraper reports something it could not resolve but did not fail on.
 *
 * Injected rather than printed: a backend wants these in its own log, and a
 * CLI wants them on stderr. Defaults to `console.warn`, so a call site that
 * does not care passes nothing.
 */
export type Warn = (message: string) => void

/** Options every record mapper accepts. */
export interface MapperOptions {
  warn?: Warn
}

/** The default: stderr, where a message nobody injected a sink for belongs. */
export const consoleWarn: Warn = (message) => {
  console.warn(message)
}

/**
 * Rows to the header they imply: the union of their keys, in first-seen order.
 *
 * A union rather than the first row's keys, and the reason is the same for both
 * vendors that build a `ScrapeResult` this way. A REGO-FIX collet family is
 * mixed-unit — `D1_mm` on its metric rows and `D1_in` on its inch ones — and a
 * MariTool CSV mixes three holder styles, so which spec keys a part publishes is
 * a function of its style. Keying off row one drops whichever came second.
 *
 * It lived in both adapters, byte for byte, until 2026-08-29. Building the
 * header of a {@link ScrapeResult} is this module's business rather than any
 * manufacturer's — the same call `pause` and `conventions.CAD_COLUMN` already
 * got, and the one `tests/vendor-boundary.test.ts` now makes automatically.
 */
export function unionHeader(rows: readonly ScrapedRow[]): string[] {
  const header: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!header.includes(key)) header.push(key)
    }
  }
  return header
}

/**
 * Milliseconds between requests, wherever a scrape or a mirror loops.
 *
 * Politeness, not rate-limit avoidance, and one number rather than a copy per
 * loop: the Kennametal CAD annotate step, its material sweep and the
 * vendor-neutral STEP mirror all wanted the same 400 ms, and three constants
 * saying so drifted apart the moment one of them was tuned.
 */
export const REQUEST_DELAY_MS = 400

/**
 * Wait between requests, skipped entirely at zero.
 *
 * Politeness, not rate-limit avoidance. It lived in the Kennametal adapter
 * because that is the only vendor whose scrape loops — and the vendor-boundary
 * test is what moved it: `node/cad-mirror.ts` needed it too, and a core module
 * reaching into one manufacturer for a three-line helper is exactly the leak
 * that rule exists to catch. Same call `conventions.CAD_COLUMN` got.
 */
export async function pause(ms: number): Promise<void> {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))
}
