/**
 * The bulk STEP mirror — a maintainer's tool, not part of the library.
 *
 * A vendor's CAD step resolves each part's permanent URL and writes it into
 * `conventions.CAD_COLUMN`. This reads that column back and downloads every
 * file — and it is vendor-neutral for the same reason the column is: two
 * adapters write it and neither owns it.
 *
 * **It is here rather than beside the lookup, and that is a decision.** Three
 * things make it a poor fit for a package a Node backend imports:
 *
 * 1. It is filesystem-bound by nature. There is no sensible "return the data
 *    instead" version — a family is roughly a megabyte of STEP, and more at
 *    scale.
 * 2. It is a batch job with rate-limit pauses, not a request-scoped call.
 *    Eight-plus seconds of serial fetch-and-sleep inside a request handler is
 *    the wrong shape; putting it in a worker is the consumer's decision, not
 *    this package's.
 * 3. These are the vendor's CAD binaries. The stance is that they are mirrored
 *    locally for measuring a holder and never redistributed, and a public
 *    module offering a one-call bulk downloader is a different exposure than a
 *    command a maintainer runs.
 *
 * What a consumer wants is the URL — to link to, or to fetch one of on demand
 * — which is what the annotate step already gives it. The seam was there
 * before this split: the column exists precisely so downloading is a separate,
 * later, optional step.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { CAD_COLUMN, CAD_DXF_COLUMN, catalogColumn } from '../conventions.js'
import type { Fetcher } from '../fetch.js'
import type { BrandName } from '../identity.js'
import { REQUEST_DELAY_MS, consoleWarn, pause, type ScrapedRow, type Warn } from '../scrape.js'

/**
 * What one part's mirrored STEP model is called.
 *
 * REGO-FIX's catalog number is the vendor's own title — `BT 30 / PG 25 x 075`
 * — and a separator in it was being honoured as one: `downloadStep` creates
 * the parent directory, so the file landed in a `BT 30 ` subdirectory instead
 * of flat in `outDir`, against what this module promises. The number stays
 * readable, which is the whole reason the file is named for it.
 *
 * **Exported because two things now resolve it**, and two answers to "what is
 * this part's file called" is one too many — the same argument
 * {@link cadCoverage} makes for counting the column here. `node/holder-import.ts`
 * reads back what this writes, and a mirror that flattened a separator while a
 * reader did not would report every REGO-FIX holder as unmirrored.
 */
export function stepFileName(catalogNumber: string): string {
  return `${catalogNumber.replaceAll(/[/\\]/g, '-')}.stp`
}

/** One STEP file onto disk. Returns the bytes written. */
export async function downloadStep(fetcher: Fetcher, url: string, dest: string): Promise<number> {
  // Straight to `dest` rather than through a temp file: these are ~54 KB
  // static CDN objects, and a half-written one is caught by whatever tries to
  // import it, not by anything here.
  const data = await fetcher.bytes(url)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, data)
  return data.byteLength
}

/** One mirrored file. */
export interface MirroredStep {
  catalogNumber: string
  bytes: number
}

/** How much of one family the vendor publishes a downloadable model for. */
export interface CadCoverage {
  /** Rows in the CSV. */
  rows: number
  /** Rows carrying a {@link CAD_COLUMN} a mirror could download. */
  step: number
  /**
   * Rows **nothing has looked a model up for** — the CSV carries no
   * {@link CAD_COLUMN} at all.
   *
   * Counted apart from the blanks in `step` because the two are different
   * facts and only one of them is about the vendor. A Kennametal family that
   * the `cad` pass has not run over is entirely `unspecified`, and reading that
   * as "publishes no models" is how a maintainer concludes a catalog has no CAD
   * when what it has is an un-run step — see `holding.cadModel`, which draws the
   * same line at the record.
   *
   * Always `0` or `rows`: the column is a property of the CSV's header, so it is
   * present for every row of a family or for none.
   */
  unspecified: number
  /** Rows carrying a {@link CAD_DXF_COLUMN}. */
  dxf: number
}

/**
 * What a mirror of these rows would and would not get, without asking for any
 * of it.
 *
 * **This is the number that bounds anything built on measured geometry**, and
 * it is worth knowing before the download rather than after: two of the three
 * toolholding vendors publish a STEP model for every part, and MariTool — which
 * is 527 of the 601 holder rows — publishes one for about two thirds. A
 * pipeline scoped against 601 and run against 431 is a surprise at the end.
 *
 * Counted here rather than in the CLI because it is the same column read the
 * same way {@link mirrorFamilySteps} reads it, and two answers to "does this row
 * have a model" is one too many. Pure, and it makes no requests.
 *
 * **The DXF is counted and is not a fallback.** `conventions.CAD_DXF_COLUMN`
 * says why the two are different columns: a DXF is a drawing whose datum,
 * projection and layer semantics are the vendor's business, and deriving a
 * profile from one is a separate project rather than a way to cover the gap.
 */
export function cadCoverage(rows: readonly ScrapedRow[]): CadCoverage {
  let step = 0
  let unspecified = 0
  let dxf = 0
  for (const row of rows) {
    // `undefined` and `''` are two different answers here — the column absent
    // versus a cell the lookup left blank — and `?? ''` collapsed them until
    // 2026-09-10. See {@link CadCoverage.unspecified}.
    const cell = row[CAD_COLUMN]
    if (cell === undefined) unspecified += 1
    else if (cell.trim()) step += 1
    if ((row[CAD_DXF_COLUMN] ?? '').trim()) dxf += 1
  }
  return { rows: rows.length, step, unspecified, dxf }
}

/**
 * Every STEP model a holder scrape names, into `outDir`, one file per row.
 *
 * Named for the catalog number rather than the material number, because the
 * filename is what a human reads and `BT30ER16060M` says what the part is
 * where `1258023` does not.
 *
 * **`brand` is what says which column that number is in, and it is an argument
 * rather than a guess.** This read `row['ISO Catalog Number']` until 2026-09-02,
 * which is Kennametal's pair and REGO-FIX's adopted copy of it. MariTool
 * publishes one number per part, under `Material Number`, and no catalog
 * designation at all — `conventions.IDENTITY_DEVIATIONS` records why — so every
 * one of its 357 published models was skipped with a warning saying the row had
 * no catalog number to name it. `conventions.catalogColumn` is the lookup, and
 * it is a lookup rather than a fallback down a list of candidate columns for the
 * reason stated there.
 *
 * **`outDir` is a required argument and never inferred.** These files are a
 * local working copy, they are gitignored, and a default that pointed into a
 * tracked directory would be the one mistake that silently commits ~3 MB of
 * vendor binaries.
 *
 * A row with no CAD URL is skipped rather than failed — that is
 * `lightweightStepUrl`'s documented null case arriving here — and a skipped
 * row spends no delay, because the count that matters is downloads and a
 * family that is mostly blank should not sleep its way through the gaps.
 * {@link cadCoverage} is how many of them there will be, before any of it runs.
 */
export async function mirrorFamilySteps(
  fetcher: Fetcher,
  rows: readonly ScrapedRow[],
  brand: BrandName,
  outDir: string,
  delayMs: number = REQUEST_DELAY_MS,
  warn: Warn = consoleWarn,
): Promise<MirroredStep[]> {
  const written: MirroredStep[] = []
  const column = catalogColumn(brand)

  for (const row of rows) {
    const url = (row[CAD_COLUMN] ?? '').trim()
    if (!url) continue

    const catalogNumber = row[column] ?? ''
    if (!catalogNumber) {
      warn(`  SKIPPED a row with a CAD URL and no ${column} to name it`)
      continue
    }

    if (written.length > 0) await pause(delayMs)
    const bytes = await downloadStep(fetcher, url, join(outDir, stepFileName(catalogNumber)))
    written.push({ catalogNumber, bytes })
  }

  return written
}
