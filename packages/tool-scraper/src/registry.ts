/**
 * Which adapter serves which family — the composition root.
 *
 * `families/` is the config table and `vendors/` are the adapters; this is the
 * one module that knows both, and it exists so that neither has to. Putting
 * the binding in the config table made the table import a manufacturer, which
 * `tests/vendor-boundary.test.ts` refuses for good reason: the table is read
 * by every test, and none of those should drag a vendor's scraper in behind it.
 *
 * **This is the seam a per-vendor distribution would replace with an
 * entry-point registry.** When a vendor package can be installed from outside
 * the tree, the {@link ADAPTERS} table below becomes a lookup over those and
 * nothing else here changes shape. Until then one repository holds every
 * adapter, which is what lets one commit change the record contract and every
 * adapter together.
 *
 * ## Binding is lazy, not an import side effect
 *
 * A mapping fault has to surface as an error naming the family, not as a
 * missing-key fault from inside a mapper on row 1 of a scrape that already
 * ran. Binding at import would buy that and charge for it: a consumer that
 * imports one helper should not pay to validate a catalog it never reads.
 *
 * So it is memoised instead: the first call to {@link boundFamilies} validates
 * every family and every fact, and the failure still names the family and the
 * key. What changes is only *when* — first use rather than import — and every
 * entry point into this package goes through here.
 */

import { checkIdentityColumns } from './conventions.js'
import {
  familyBrand,
  type BoundFamily,
  type BoundToolholding,
  type RecordMappers,
} from './family.js'
import { COLLET_FAMILIES, FAMILIES, HOLDER_FAMILIES } from './families/index.js'
import { IncompletePartError, ScraperConfigError } from './errors.js'
import type {
  ColletMapper,
  HolderMapper,
  HoldingMappers,
  HoldingRecord,
  ToolholdingKind,
} from './holding.js'
import { checkFact, type Fact } from './provenance.js'
import { checkColumnMap, checkColumnsExist, type ToolRecord } from './records.js'
import { consoleWarn, type MapperOptions, type ScrapeResult } from './scrape.js'
import { RECORD_MAPPERS as DESTINYTOOL } from './vendors/destinytool/records.js'
import { RECORD_MAPPERS as EMUGE } from './vendors/emuge/records.js'
import { RECORD_MAPPERS as HARVEY } from './vendors/harvey/records.js'
import { HOLDING_MAPPERS as KM_HOLDING } from './vendors/kennametal/holding.js'
import { RECORD_MAPPERS as KENNAMETAL } from './vendors/kennametal/records.js'
import { HOLDING_MAPPERS as MARITOOL_HOLDING } from './vendors/maritool/holding.js'
import { HOLDING_MAPPERS as REGOFIX_HOLDING } from './vendors/regofix/holding.js'

/**
 * Brand -> its row-to-record mappers, by tool kind.
 *
 * One entry serves two brands: Kennametal and WIDIA are the same AEM platform
 * and the same table vocabulary, so one adapter covers both, exactly as one
 * scraper does. A brand absent from here can still be scraped — REGO-FIX ships
 * toolholding and no cutting tools, and only cutting tools go through a column
 * map.
 */
export const ADAPTERS: Record<string, RecordMappers> = {
  kennametal: KENNAMETAL,
  widia: KENNAMETAL,
  destinytool: DESTINYTOOL,
  harvey: HARVEY,
  emuge: EMUGE,
}

/**
 * Brand -> its toolholding mappers, by the kind of thing they build.
 *
 * The toolholding counterpart of {@link ADAPTERS}, and **partial in both
 * directions on purpose**. A brand absent from here can still be scraped: its
 * families bind, its CSVs are written, and its receipt is checked, exactly as
 * before — what it cannot do is mint records. A brand present with a mapper for
 * only one kind is the same statement one level down; MariTool publishes ER
 * collets that this package does not scrape, so it maps holders and nothing
 * else.
 *
 * That is what makes minting records additive rather than a break. Nothing here
 * changes what a vendor with no entry does today, and the refusal only happens
 * where a caller explicitly asks for records from a family whose brand maps
 * none — {@link toHolding}, which names the brand and what it does map.
 *
 * One entry serves two brands for the reason {@link ADAPTERS} states: Kennametal
 * and WIDIA are the same platform and the same table vocabulary.
 */
export const HOLDING_ADAPTERS: Record<string, HoldingMappers> = {
  kennametal: KM_HOLDING,
  widia: KM_HOLDING,
  regofix: REGOFIX_HOLDING,
  maritool: MARITOOL_HOLDING,
}

/**
 * Check every fact of one family and project its value onto the config under
 * its own key.
 *
 * **This is what stops a fact being a second source of truth.** The fact is
 * the only authored copy; the plain key is a projection with one owner.
 * Readers keep saying `family.unit` and never learn about provenance, which is
 * right — provenance is evidence for a person and a gate, not an input to
 * arithmetic.
 *
 * `FamilyDefinition` declares no constant keys, so a family that also set the
 * plain key is a compile error and there is nothing left to check at runtime.
 */
function project<T extends object>(table: string, name: string, cfg: T): T {
  const facts = (cfg as { facts?: Record<string, Fact> }).facts ?? {}
  const projected: Record<string, unknown> = { ...(cfg as object) }
  for (const [key, fact] of Object.entries(facts)) {
    checkFact(`${table} ${name}`, key, fact)
    projected[key] = fact.value
  }
  return projected as T
}

let families: Map<string, BoundFamily> | null = null
let toolholding: Map<string, BoundToolholding> | null = null

/**
 * Every cutting-tool family, validated and bound to its record mapper.
 *
 * Memoised, so calling it twice is free and a fault is reported once.
 */
export function boundFamilies(): Map<string, BoundFamily> {
  if (families !== null) return families

  const bound = new Map<string, BoundFamily>()
  for (const [name, cfg] of Object.entries(FAMILIES)) {
    const brand = cfg.brand ?? 'kennametal'
    const mappers = ADAPTERS[brand]
    if (mappers === undefined) {
      throw new ScraperConfigError(
        name,
        `brand ${JSON.stringify(brand)} has no record adapter — a vendor ` +
          `that ships cutting tools needs one ` +
          `(known: ${Object.keys(ADAPTERS).sort().join(', ')})`,
      )
    }

    const records = mappers[cfg.kind]
    if (records === undefined) {
      throw new ScraperConfigError(
        name,
        `brand ${JSON.stringify(brand)} has no ${cfg.kind} mapper ` +
          `(it maps: ${Object.keys(mappers).sort().join(', ')})`,
      )
    }

    const projected = project('tool', name, cfg)
    bound.set(name, {
      ...projected,
      columns: checkColumnMap(name, cfg.kind, cfg.columns),
      records,
    } as BoundFamily)
  }

  families = bound
  return bound
}

/**
 * Every holder and collet family, with its facts checked and projected, and
 * bound to the mapper its brand supplies for its kind.
 *
 * Their facts pass the same gate cutting-tool families' do: a taper or a
 * clamping mode is a per-family constant no variant table states, exactly like
 * a drill's flute count.
 *
 * **A family whose brand maps nothing binds `undefined` rather than throwing**,
 * which is where this differs from {@link boundFamilies}. A cutting-tool family
 * with no mapper is a catalog fault — nothing can be done with it — but a
 * toolholding family with no mapper is the state every one of them was in until
 * records existed, and it still scrapes, writes a CSV and checks a receipt.
 * Refusing at bind time would take that away from every consumer that never
 * asked for a record. {@link toHolding} is where the absence is reported, at
 * the one call that cannot proceed without it.
 */
export function boundToolholding(): Map<string, BoundToolholding> {
  if (toolholding !== null) return toolholding

  const bound = new Map<string, BoundToolholding>()
  for (const [kind, families_] of [
    ['holder', HOLDER_FAMILIES],
    ['collet', COLLET_FAMILIES],
  ] as const satisfies readonly (readonly [ToolholdingKind, object])[]) {
    for (const [name, cfg] of Object.entries(families_)) {
      const mappers = HOLDING_ADAPTERS[familyBrand(cfg)]
      bound.set(name, {
        ...project(kind, name, cfg),
        kind,
        records: mappers?.[kind],
      } as BoundToolholding)
    }
  }

  toolholding = bound
  return bound
}

/** One bound toolholding family by CSV name. */
export function boundHolding(name: string): BoundToolholding {
  const cfg = boundToolholding().get(name)
  if (cfg === undefined) {
    throw new ScraperConfigError(
      name,
      `unknown toolholding family (known: ${[...boundToolholding().keys()].sort().join(', ')})`,
    )
  }
  return cfg
}

/** One bound cutting-tool family by CSV name. */
export function boundFamily(name: string): BoundFamily {
  const cfg = boundFamilies().get(name)
  if (cfg === undefined) {
    throw new ScraperConfigError(
      name,
      `unknown cutting-tool family (known: ` + `${[...boundFamilies().keys()].sort().join(', ')})`,
    )
  }
  return cfg
}

/**
 * One family's scrape, as {@link ToolRecord}s — the package's uniform output.
 *
 * **This is what a consumer wants and what nothing shipped until now.** Every
 * CLI command ends at a vendor-labelled CSV, and a CSV is the receipt: four
 * vendors, four column vocabularies, and a `D1_mm` that means one thing in
 * Kennametal's table and another in ISO 13399's dictionary. The adapters that
 * resolve that have been here the whole time and only the tests called them.
 *
 * It lives in the registry rather than beside `toolRecord` because it needs
 * both halves — the config table and the vendor mappers — and the main entry
 * point deliberately imports no vendor. Reach it through the `./registry`
 * subpath.
 *
 * The two checks run **before the first row**, in the order a failure is
 * cheapest to read:
 *
 * 1. {@link checkIdentityColumns} — a re-scrape whose part-number column was
 *    renamed still parses, still has the right row count, and mints every guid
 *    off an empty string.
 * 2. {@link checkColumnsExist} — a mapped column the CSV does not carry names
 *    the family and the field here, instead of naming one row out of ninety-three
 *    from inside a mapper.
 *
 * `familyName` is the CSV filename the catalog is keyed by
 * (`'harvey_endmill_025.csv'`), which is what `boundFamily` takes.
 *
 * ## One incomplete part does not end the family
 *
 * The rows are mapped together, so until 2026-09-01 every refusal was equally
 * fatal — and the refusals are not equal. A part the vendor left a required
 * cell blank on is one bad row among thousands of good ones; EMUGE-FRANKEN
 * omits `overall length l₁` on roughly 175 of its 7,021 end mill variants, and
 * both end mill families converted to nothing at all because of them.
 *
 * So an {@link IncompletePartError} is warned about and the row is dropped.
 * **Nothing else is.** A cutting material with no mapping, a column a family
 * stopped mapping, a response that changed shape — those say the vendor's
 * vocabulary or this package's catalog has moved, and a scraper that skipped
 * quietly past them would publish a catalog nobody checked. `columns.required`
 * is the only place that raises the skippable one.
 *
 * A dropped row is **not** a relaxed contract. `records.RECORD_GEOMETRY` still
 * says an end mill always has an `OAL`, and every record returned here still
 * has one: the part without it becomes no record rather than a record with a
 * hole. Where a vendor genuinely never publishes a field, `sometimes` is still
 * the answer — a drill's `SIG` is that, and it stays that.
 *
 * The count of what was dropped is not returned. A caller that needs it has
 * the row count it passed in and the length it got back, and the warnings name
 * every part by number.
 */
export function toRecords(
  familyName: string,
  scrape: ScrapeResult,
  options?: MapperOptions,
): ToolRecord[] {
  const cfg = boundFamily(familyName)
  const warn = options?.warn ?? consoleWarn

  checkIdentityColumns(familyBrand(cfg), scrape.header)
  checkColumnsExist(familyName, cfg, scrape.header)

  const records: ToolRecord[] = []
  for (const row of scrape.rows) {
    try {
      records.push(cfg.records(row, cfg, cfg.columns, options))
    } catch (error) {
      if (!(error instanceof IncompletePartError)) throw error
      warn(`  WARNING: ${error.message} — no record written for it`)
    }
  }
  return records
}

/**
 * One toolholding family's scrape, as {@link HoldingRecord}s.
 *
 * {@link toRecords}'s counterpart, and deliberately the same shape: the two
 * checks run before the first row, one incomplete part does not end the family,
 * and the count of what was dropped is not returned because the caller has the
 * row count it passed in and the length it got back.
 *
 * **It refuses only where a caller asked for something this package cannot
 * give.** A toolholding family whose brand maps no mapper binds one anyway
 * (see {@link boundToolholding}) and scrapes exactly as it did before; this is
 * the one call that cannot proceed without one, so this is where the absence is
 * named — with the brand and with what that brand does map, the way
 * {@link boundFamilies} names a missing tool mapper.
 *
 * `checkColumnsExist` has no counterpart here: a holder family carries no
 * `ColumnMap`, because the columns a holder publishes are the vendor's own and
 * are read by that vendor's mapper rather than through a canonical name. What
 * does still run is {@link checkIdentityColumns}, which catches the failure that
 * matters most — a re-scrape whose part-number column was renamed still parses,
 * still has the right row count, and mints every guid off an empty string.
 */
export function toHolding(
  familyName: string,
  scrape: ScrapeResult,
  options?: MapperOptions,
): HoldingRecord[] {
  const cfg = boundHolding(familyName)
  const warn = options?.warn ?? consoleWarn
  const brand = familyBrand(cfg)

  const mapper = cfg.records
  if (mapper === undefined) {
    const mappers = HOLDING_ADAPTERS[brand]
    throw new ScraperConfigError(
      familyName,
      `brand ${JSON.stringify(brand)} has no ${cfg.kind} mapper ` +
        (mappers === undefined
          ? `— it maps no toolholding at all, so this family ends at rows and ` +
            `a receipt (brands that map some: ` +
            `${Object.keys(HOLDING_ADAPTERS).sort().join(', ')})`
          : `(it maps: ${Object.keys(mappers).sort().join(', ')})`),
    )
  }

  checkIdentityColumns(brand, scrape.header)

  const records: HoldingRecord[] = []
  for (const row of scrape.rows) {
    try {
      records.push(
        cfg.kind === 'holder'
          ? (mapper as HolderMapper)(row, cfg, options)
          : (mapper as ColletMapper)(row, cfg, options),
      )
    } catch (error) {
      if (!(error instanceof IncompletePartError)) throw error
      warn(`  WARNING: ${error.message} — no record written for it`)
    }
  }
  return records
}

/**
 * Forget what has been bound.
 *
 * For tests that put a family in front of the gate. Nothing in a running
 * scrape should need it — the tables are module constants, so a second bind
 * would produce the same answer.
 */
export function resetBindings(): void {
  families = null
  toolholding = null
}
