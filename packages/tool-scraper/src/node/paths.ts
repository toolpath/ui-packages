/**
 * Where a scrape lands.
 *
 * **Scraped output is never committed.** A CSV is a vendor's data and a
 * working file, not source, and this repository is public — which is a second
 * reason, independent of size, to keep it out. Git was carrying the provenance
 * of those CSVs for free; now that it is not, every scrape writes a
 * {@link receipts} sidecar beside its file.
 *
 * This module is in `node/` rather than beside the config tables: resolving a
 * root needs `process.env` and a path relative to this file's own location,
 * and a family table that needed either would be unimportable in anything that
 * only wants to read records.
 */

import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { familyBrand } from '../family.js'
import { familyConfig } from '../families/index.js'
import type { BrandName } from '../identity.js'

/**
 * Where scraped CSVs are read from and written to.
 *
 * Set it when the package is installed rather than run from a checkout: the
 * default below is derived from this file's own location, which is right in a
 * working tree and meaningless inside `node_modules`. Every command prints the
 * resolved root for exactly that reason — a scrape that wrote somewhere
 * surprising should say so on the way, not be discovered later.
 */
export const SCRAPE_ROOT_ENV = 'TOOLPATH_SCRAPE_ROOT'

/** `packages/tool-scraper/scrape-out`, which `.gitignore` already covers. */
export const DEFAULT_SCRAPE_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../scrape-out',
)

/** `~` expanded, the way a shell would. */
function expandHome(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
}

/** The directory holding every vendor's scraped CSVs. */
export function scrapeRoot(): string {
  const override = process.env[SCRAPE_ROOT_ENV]
  return override ? resolve(expandHome(override)) : DEFAULT_SCRAPE_ROOT
}

/**
 * One line naming the resolved root and how it was resolved.
 *
 * Printed by every command. The distinction it carries is the one that matters
 * when a scrape goes somewhere unexpected: whether the path came from the
 * environment or from this package's own location.
 */
export function describeRoot(): string {
  const how = process.env[SCRAPE_ROOT_ENV] ? 'set' : 'default'
  return `scrape root: ${scrapeRoot()} (${SCRAPE_ROOT_ENV} ${how})`
}

/**
 * Where one vendor's scraped CSVs live — the receipts.
 *
 * Per brand rather than per adapter, and the distinction is worth holding on
 * to: an adapter is a fact about *code*, a scraped table is a fact about who
 * published it. WIDIA's tables are WIDIA's even though Kennametal's adapter is
 * what fetched them.
 */
export function csvDir(brand: BrandName): string {
  return join(scrapeRoot(), brand, 'csv')
}

/**
 * One vendor's mirrored STEP models.
 *
 * Nothing is redistributed from here: these are a local working copy for
 * measuring a holder, and only a derived profile is ever meant to leave.
 */
export function stepDir(brand: BrandName): string {
  return join(scrapeRoot(), brand, 'step')
}

/**
 * One vendor's measured holder profiles, one JSON per holder family.
 *
 * Beside {@link stepDir} rather than under it: a STEP model is the vendor's
 * binary and a profile is this package's own derived measurement, and only the
 * second one is ever meant to leave.
 */
export function profilesDir(brand: BrandName): string {
  return join(scrapeRoot(), brand, 'profiles')
}

/**
 * The merged profiles document, across every vendor.
 *
 * At the root rather than under a brand, because it is the cross-vendor
 * document — keyed by guid, which is the one namespace holders of every brand
 * share.
 */
export function profilesJson(): string {
  return join(scrapeRoot(), 'profiles.json')
}

/**
 * Where one family's CSV lives, resolved through its own brand.
 *
 * Takes a bare CSV name rather than a path, so a caller cannot pass a file
 * from somewhere else and have it silently treated as this family's receipt.
 */
export function familyCsv(name: string): string {
  return join(csvDir(familyBrand(familyConfig(name))), name)
}
