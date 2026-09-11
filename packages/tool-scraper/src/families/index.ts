/**
 * Per-family scrape config: what to fetch, and how its columns are labelled.
 *
 * One module per vendor, merged here. The split is the point: a REGO-FIX
 * family is named whatever REGO-FIX calls it without anybody checking
 * Kennametal's list first, and adding a vendor is a new file rather than an
 * edit to a table three other vendors depend on.
 *
 * **Config, not code.** Nothing here imports an adapter — `registry` is the
 * one module that knows both, and `tests/vendor-boundary.test.ts` refuses the
 * alternative. In the source package this table briefly did the binding
 * itself, which made the config import a manufacturer; the table is read by
 * every test, and none of them should drag a vendor's scraper in behind it.
 *
 * Three kinds of key, and they are worth telling apart:
 *
 * - **Scrape targets** — `familyCode`, and whatever else names the thing to
 *   fetch. This is what makes a scrape re-runnable without going back to the
 *   browser to find the family page again.
 * - **`columns`** — the vendor's own column labels, keyed by canonical ISO
 *   13399 name, *without* a unit suffix. `registry.bindFamilies` runs each
 *   through `records.checkColumnMap`, so a typo fails when the registry binds,
 *   naming the family.
 * - **`facts`** — the per-family constants no vendor table states, each
 *   carrying its provenance. The registry checks and projects them, so readers
 *   say `family.unit` and never learn about provenance.
 *
 * **Where a scrape lands is not here.** Resolving a data root needs `fs` and
 * `process.env`, which would make this table unimportable in anything that
 * never writes a file. It is `node/paths.ts`.
 */

import { ScraperConfigError } from '../errors.js'
import type { FamilyDefinition, ToolholdingDefinition } from '../family.js'
import { FAMILIES as DESTINYTOOL } from './destinytool.js'
import { FAMILIES as EMUGE } from './emuge.js'
import { FAMILIES as HARVEY } from './harvey.js'
import { HOLDER_FAMILIES as MARITOOL_HOLDERS } from './maritool.js'
import {
  COLLET_FAMILIES as KM_COLLETS,
  FAMILIES as KENNAMETAL,
  HOLDER_FAMILIES as KM_HOLDERS,
} from './kennametal.js'
import { COLLET_FAMILIES as RF_COLLETS, HOLDER_FAMILIES as RF_HOLDERS } from './regofix.js'

/**
 * One flat table, refusing a CSV name two vendors both claim.
 *
 * A flat object is what every reader wants, and a spread is how it would
 * normally be built — which is exactly the problem: the second vendor's entry
 * would silently replace the first's, and the collision would surface as a
 * family that scrapes into a file already holding someone else's rows. Two
 * vendors shipping `end_mills_inch.csv` is not far-fetched; it is the first
 * name either of them would pick.
 */
function merge<T>(...tables: Readonly<Record<string, T>>[]): Record<string, T> {
  const merged: Record<string, T> = {}
  for (const table of tables) {
    for (const [name, cfg] of Object.entries(table)) {
      if (Object.hasOwn(merged, name)) {
        throw new ScraperConfigError(
          name,
          'claimed by two vendors — a CSV name is the key of this table and ' +
            'has to be unique across all of them',
        )
      }
      merged[name] = cfg
    }
  }
  return merged
}

/** Every cutting-tool family, keyed by the CSV it is scraped into. */
export const FAMILIES: Record<string, FamilyDefinition> = merge<FamilyDefinition>(
  KENNAMETAL,
  DESTINYTOOL,
  HARVEY,
  EMUGE,
)

/**
 * Every toolholding family — holders, and the collets that go in them.
 *
 * Separate tables rather than a `kind` on one, because a holder and a collet
 * are not variants of a thing: they carry different discriminants (a holder
 * states a taper and a clamping mode; a collet states a series and a capacity
 * band) and a scrape of one is not a scrape of the other.
 */
export const HOLDER_FAMILIES: Record<string, ToolholdingDefinition> = merge<ToolholdingDefinition>(
  KM_HOLDERS,
  RF_HOLDERS,
  MARITOOL_HOLDERS,
)

export const COLLET_FAMILIES: Record<string, ToolholdingDefinition> = merge<ToolholdingDefinition>(
  KM_COLLETS,
  RF_COLLETS,
)

/**
 * Every family this package knows, by CSV name — tools and toolholding alike.
 *
 * Built once rather than searched per call, so a lookup can refuse an unknown
 * name by listing what it does know.
 *
 * Through {@link merge} and not a spread, for the reason {@link merge} exists:
 * a spread here would let a name claimed by two of the three tables resolve
 * silently to whichever was spread last, and this is the table `familyConfig`
 * — and therefore `familyBrand`, and therefore where a CSV is written — reads.
 */
export const ALL_FAMILIES: Record<string, FamilyDefinition | ToolholdingDefinition> = merge<
  FamilyDefinition | ToolholdingDefinition
>(FAMILIES, HOLDER_FAMILIES, COLLET_FAMILIES)

/** One family's config by CSV name, refusing a name nothing declares. */
export function familyConfig(name: string): FamilyDefinition | ToolholdingDefinition {
  const cfg = ALL_FAMILIES[name]
  if (cfg === undefined) {
    throw new ScraperConfigError(
      name,
      `unknown family CSV (known: ${Object.keys(ALL_FAMILIES).sort().join(', ')})`,
    )
  }
  return cfg
}

export { familyBrand, familyId } from '../family.js'
