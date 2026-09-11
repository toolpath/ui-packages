/**
 * Vendor CAD model URLs: material number in, a static STEP link out.
 *
 * Kennametal's product pages don't host their CAD models — a third party does
 * (CDS Visual, on `product-config.net`), and the page reaches it in one of two
 * ways. For an *assembly* it POSTs a job, polls a batch, and gets back a
 * transient generated ZIP. For a **single part with no child components** —
 * every holder in this catalog — it takes a different branch entirely and asks
 * for a pre-built static file:
 *
 * ```
 * GET https://www.product-config.net/catalog3/cad?d=kennametal&id=<material>
 * ```
 *
 * That returns `staticURLs`, a map of format key -> permanent CloudFront URL,
 * and the files behind it are ordinary objects with a `Last-Modified` in 2024.
 * The response also states `authenticatedDownload: false`, which is what makes
 * a direct link viable: no login, no session, no token.
 *
 * `docs/KENNAMETAL_CAD_API.md` documents the endpoint and the format keys.
 * This module scrapes one of them — `stp-lwm`, the lightweight STEP, which is
 * the collision model to give a CAM package as holder geometry.
 *
 * ## Why the download half is not in this module
 *
 * Mirroring every STEP file onto disk is a maintainer's batch job — it takes
 * an output directory, writes ~54 KB per part with a rate-limit pause between,
 * and has no return value a caller wants. It lives in `node/cad-mirror.ts` and
 * is reachable only from the CLI.
 *
 * What a backend consuming this package wants is the permanent URL, which is
 * what {@link lightweightStepUrl} and {@link annotateCadUrls} give it — to
 * link to, or to fetch on demand, rather than to bulk-mirror. The seam was
 * already here: the annotate step writes a URL precisely so that downloading
 * is a separate, later, optional step.
 */

import { CAD_COLUMN } from '../../conventions.js'
import { statusOf, type Fetcher } from '../../fetch.js'
import { REQUEST_DELAY_MS, pause, type ScrapeResult, type ScrapedRow } from '../../scrape.js'

export const CAD_API = 'https://www.product-config.net/catalog3/cad?d=kennametal&id={material}'

/**
 * The `staticURLs` key for the lightweight STEP — CDS calls it LWM, the vendor
 * UI calls it "3D Anti Collision Model", and it is the simplified solid rather
 * than the full graphical model (`stp-gtm`).
 *
 * The column it is written to is `conventions.CAD_COLUMN`, shared with every
 * other vendor's scraper because a consumer reads exactly one. What is
 * Kennametal-specific is *which* of CDS Visual's formats fills it — that is
 * this constant, and it stays here.
 */
export const LIGHTWEIGHT_STEP = 'stp-lwm'

/** The subset of the CDS payload this module reads. */
export interface CadPayload {
  cadAvailable?: boolean
  staticURLs?: Record<string, unknown>
}

/** The CAD metadata for one material number. */
export async function fetchCad(fetcher: Fetcher, material: string): Promise<CadPayload> {
  return fetcher.json<CadPayload>(CAD_API.replace('{material}', material))
}

/**
 * The lightweight STEP URL from a CAD payload, or null when there is none.
 *
 * Null is a real state and not an error: the vendor's own UI carries a "we do
 * not have any CAD models available for download" case, and a holder without a
 * published model is a holder this package should say nothing about rather
 * than offer a dead link for. All twenty holders scraped so far do have one,
 * which is exactly why the absent case needs a test rather than a reassuring
 * assumption.
 */
export function lightweightStepUrl(payload: CadPayload): string | null {
  if (!payload.cadAvailable) return null
  const url = (payload.staticURLs ?? {})[LIGHTWEIGHT_STEP]
  return typeof url === 'string' && url ? url : null
}

/**
 * {@link fetchCad}, with a 404 read as "the vendor publishes none".
 *
 * The docstring below promises a row whose lookup finds no model keeps an
 * empty cell and is never dropped. That held only for the `cadAvailable:
 * false` payload — a 404 threw out of the loop and abandoned the whole file
 * part-annotated, past `main()`'s catch and onto a stack trace. Any other
 * status is still a failed request and still stops the run.
 *
 * Duck-typed through `statusOf` rather than `instanceof`, so a caller's own
 * {@link Fetcher} gets the same handling — the same call `vendors/regofix`
 * makes for the holders whose DIN 4000 document does not exist.
 */
async function cadFor(fetcher: Fetcher, material: string): Promise<CadPayload> {
  try {
    return await fetchCad(fetcher, material)
  } catch (error) {
    if (statusOf(error) === 404) return { cadAvailable: false }
    throw error
  }
}

/** What {@link annotateCadUrls} answers with. */
export interface CadAnnotation {
  scrape: ScrapeResult
  /**
   * How many rows got a URL — deliberately not the row count, so a run that
   * silently found nothing reads as `0 of 12` at the call site instead of as
   * success.
   */
  found: number
}

/**
 * Add (or refresh) the CAD model column on a toolholding scrape.
 *
 * Safe to re-run, like the thread-pitch and material-group steps: an existing
 * column is rebuilt rather than duplicated. A row whose lookup finds no model
 * keeps an empty cell; the row is never dropped, because the holder still
 * exists.
 */
export async function annotateCadUrls(
  fetcher: Fetcher,
  scrape: ScrapeResult,
  delayMs: number = REQUEST_DELAY_MS,
): Promise<CadAnnotation> {
  if (scrape.rows.length === 0) return { scrape, found: 0 }

  const column = CAD_COLUMN
  const header = scrape.header.includes(column) ? [...scrape.header] : [...scrape.header, column]

  let found = 0
  const rows: ScrapedRow[] = []
  for (const [index, row] of scrape.rows.entries()) {
    if (index) await pause(delayMs)
    const url = lightweightStepUrl(await cadFor(fetcher, row['Material Number'] ?? ''))
    if (url) found += 1
    rows.push({ ...row, [column]: url ?? '' })
  }

  return { scrape: { ...scrape, header, rows }, found }
}
