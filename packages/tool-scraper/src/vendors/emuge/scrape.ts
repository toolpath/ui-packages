/**
 * EMUGE-FRANKEN's SAP Commerce API -> cutting-tool rows.
 *
 * Nothing here parses HTML, because there is none to parse: the storefront is
 * SAP Commerce (Hybris) behind a Vue front end, and a category page
 * server-renders a `<title>`, a base64 CMS blob and an empty
 * `<category-detail-page>` element. The data comes from the JSON API that
 * element's component reads. `docs/EMUGE_FRANKEN_COMMERCE_API.md` records how
 * the endpoint was found, what it answers with, and what was tried first.
 *
 * ```
 * GET {BASE}/search/products?query=<facet query>&currentPage=&pageSize=
 *     &searchQueryContext=KLAMMER_GROUPING   -- grouped products
 *     &searchQueryContext=VARIANT_SEARCH     -- one group's orderable parts
 * GET {BASE}/products?productCodes=<up to 30>&fields=FULL
 * ```
 *
 * ## Three calls, because the fields are in three places
 *
 * A *klammer* product is EMUGE's grouping — `H301025`, "Solid Carbide End Mill
 * TOP-Cut VAR" — and its variants are the parts somebody orders. Neither one
 * alone carries a record:
 *
 * - the **grouped listing** states the product line, the category and the
 *   version, and no dimensions;
 * - the **variant listing** states the material number, the catalog number and
 *   every dimension, under `mainDrawing.technicalDetails`;
 * - the **per-part detail** states what appears in neither — the end mill's
 *   flute count, the drill's point angle, the tap's thread symbol and pitch,
 *   and `applicationMaterials`, which is the vendor's own ISO 513 index.
 *
 * The third is the reason a scrape is not two calls. It is batched 30 codes at
 * a time, so it costs one request per 30 parts rather than one per part.
 *
 * ## Two buckets of property, and only one of them gets a unit suffix
 *
 * `mainDrawing.technicalDetails` is the dimension table — that is the bucket
 * whose columns carry `_mm`/`_in` from the family's declared unit. Everything
 * in the flat `technicalDetails` keeps its bare label, which is what puts a
 * tap's `pitch [mm]` in a column called `pitch`: `records.DIMENSIONAL_COLUMNS`
 * excludes `TP` from unit pairing, so the core reads that column by its bare
 * label, and a suffix here would name a column nothing scraped.
 *
 * Values are written **verbatim** — `1 1/2 "`, `3 mm`, `140 deg` — the call
 * `vendors/harvey/scrape.ts` makes and for the same reason: the CSV is the
 * receipt, and EMUGE's own fractional inches and stated units are part of what
 * it published. `records.ts` is where a cell becomes a number, through
 * `value.ts`.
 *
 * ## What the vendor gets wrong
 *
 * Warned about, never corrected — two disagreeing vendor cells cannot say which
 * one is wrong, and a scraper that picks becomes a place tool data is authored
 * by hand.
 *
 * - **`number of flutes Z` is `999` on 64 end mill variants** (2026-09-01), a
 *   sentinel rather than a count. `records.ts` refuses it; a CSV cell keeps it,
 *   because that is what the vendor published.
 * - **`name` comes back German on the US English storefront** — "TOP-Cut VAR
 *   HM-Schaftfräser / lang Typ N ALCR" with `lang=en&country=US`. Recorded as
 *   sent.
 * - **The same property is spelled two ways across categories**: `coating` on
 *   an end mill and `Coating` on a tap, `Cutting material` on both. Two
 *   columns, because relabelling one onto the other would be this adapter
 *   deciding what the vendor meant.
 * - **The same measurement is published under two unit tags** — the drill
 *   detail record carries `nominal diameter d₁ [in]` beside the millimetre one.
 *   `value.bareLabel` strips the tag, so both want one column; {@link put} lets
 *   the later one win and says so, rather than dropping a number out of the
 *   receipt in silence.
 */

import { DESCRIPTION_COLUMN, dimensionalColumn, type UnitSystem } from '../../conventions.js'
import { VendorResponseError } from '../../errors.js'
import type { Fetcher } from '../../fetch.js'
import {
  consoleWarn,
  pause,
  REQUEST_DELAY_MS,
  unionHeader,
  type ScrapeResult,
  type ScrapedRow,
  type Warn,
} from '../../scrape.js'
import { bareLabel } from './value.js'

/**
 * The `emugefrankenUSA` base site, which is the US storefront.
 *
 * Both halves are stated in `window.appConfig` on every page of the site
 * (`apiNodeUrl` and `basesiteId`), and the `/api/v2/{basesiteId}` shape is what
 * the front end's own client builds.
 */
export const BASE = 'https://api.emuge-franken-group.com/api/v2/emugefrankenUSA'

/** Answered in full at 500; the largest group seen holds 214 variants. */
export const SEARCH_PAGE_SIZE = 500

/**
 * Codes per `productCodes=` request.
 *
 * Thirty is what the storefront's own product-comparison call uses, and it is
 * answered whole — 30 codes in, 30 records out. Raising it is a request-volume
 * decision about somebody else's server, so it stays where the vendor put it.
 */
export const DETAIL_BATCH = 30

/** Grouped products: one row per product line, no dimensions. */
const KLAMMER_GROUPING = 'KLAMMER_GROUPING'

/** One group's orderable parts, with their dimension table. */
const VARIANT_SEARCH = 'VARIANT_SEARCH'

/** The CSV columns this adapter names, as against the vendor's own labels. */
export const MATERIAL_NUMBER_COLUMN = 'Material Number'
export const CATALOG_NUMBER_COLUMN = 'ISO Catalog Number'
export const GROUP_COLUMN = 'klammerProductCode'
export const DIMENSION_FEATURE_COLUMN = 'dimensionFeatureValue'
export const NAME_COLUMN = 'name'
export const APPLICATION_MATERIALS_COLUMN = 'applicationMaterials'

/**
 * One family's scrape target: a category, optionally narrowed by one facet.
 *
 * The facet is how the two end mill families are split — EMUGE indexes every
 * milling variant under `AMM_EINHS` (`AMM_EINHS_Z` inch, `AMM_EINHS_M` metric)
 * — so a family declares one unit and scrapes only the parts published in it.
 */
export interface EmugeTarget {
  /** The vendor's category code: `FF01` end mills, `FB01` drills, `FG01` taps. */
  readonly category: string
  /** A facet code and value, both the vendor's own. */
  readonly facet?: { readonly code: string; readonly value: string }
}

/** What a scrape accepts. */
export interface EmugeOptions {
  /** The unit system the family declares — decides the dimensional suffix. */
  readonly unit: UnitSystem
  readonly warn?: Warn
  /** Milliseconds between requests. Zero in tests; the shared delay otherwise. */
  readonly delayMs?: number
}

/** One `{ property, value }` pair, as the API writes them. */
interface Detail {
  property?: string
  value?: string
}

/** A grouped product, as `KLAMMER_GROUPING` answers. */
interface GroupedProduct {
  code?: string
  productListInfo?: string
  /** How many orderable parts the vendor says this group has. */
  numberOfMaterials?: number
  technicalDetails?: Detail[]
}

/** One orderable part, as `VARIANT_SEARCH` answers. */
interface VariantProduct {
  code?: string
  articleCode?: string
  name?: string
  dimensionFeatureValue?: string
  /**
   * True on the grouped product itself, which the variant listing returns
   * alongside its variants — see {@link fetchGroupVariants}.
   */
  klammerProduct?: boolean
  mainDrawing?: { technicalDetails?: Detail[] }
}

/** One part's full record, as `productCodes=&fields=FULL` answers. */
interface ProductDetail {
  code?: string
  technicalDetails?: Detail[]
  applicationMaterials?: { code?: string }[]
}

/** What every `/search/products` response carries. */
interface SearchPage<T> {
  pagination?: { totalPages?: number }
  products?: T[]
}

/** The facet query for a target's grouped products. */
export function groupQuery(target: EmugeTarget): string {
  const base = `:relevance:allCategories:${target.category}:klammerProduct:false`
  return target.facet === undefined ? base : `${base}:${target.facet.code}:${target.facet.value}`
}

/** The facet query for one group's variants. */
export function variantQuery(klammerCode: string): string {
  return `:relevance:klammerProductCode:${klammerCode}`
}

/**
 * One `/search/products` URL.
 *
 * `lang` and `country` are the front end's own defaults for this base site and
 * are what make the property labels English; without them the API answers in
 * German.
 */
export function searchUrl(query: string, context: string, page: number, sort?: string): string {
  const params = new URLSearchParams({
    query,
    currentPage: String(page),
    pageSize: String(SEARCH_PAGE_SIZE),
    searchQueryContext: context,
    lang: 'en',
    country: 'US',
  })
  if (sort !== undefined) params.set('sort', sort)
  return `${BASE}/search/products?${params.toString()}`
}

/** The batched per-part detail URL. */
export function detailUrl(codes: readonly string[]): string {
  const params = new URLSearchParams({
    productCodes: codes.join(','),
    fields: 'FULL',
    lang: 'en',
    country: 'US',
  })
  return `${BASE}/products?${params.toString()}`
}

/**
 * Every page of one search, paced.
 *
 * `totalPages` rather than an empty page, because the API states it and a walk
 * that stopped on emptiness would page forever against a response shape that
 * changed.
 */
async function pages<T>(
  fetcher: Fetcher,
  url: (page: number) => string,
  delayMs: number,
): Promise<T[]> {
  const found: T[] = []
  let page = 0
  for (;;) {
    if (page > 0) await pause(delayMs)
    const answer = await fetcher.json<SearchPage<T>>(url(page))
    found.push(...(answer.products ?? []))
    const total = answer.pagination?.totalPages ?? 0
    page += 1
    if (page >= total) return found
  }
}

/** Every grouped product under one target. */
export async function fetchGroups(
  fetcher: Fetcher,
  target: EmugeTarget,
  delayMs: number = REQUEST_DELAY_MS,
): Promise<GroupedProduct[]> {
  const query = groupQuery(target)
  return pages<GroupedProduct>(fetcher, (page) => searchUrl(query, KLAMMER_GROUPING, page), delayMs)
}

/**
 * Every orderable part in one group.
 *
 * `sort=prod-detail-variant` is the vendor's own variant order — the sequence
 * its product page lists sizes in — so a re-scrape diffs against the last one
 * rather than against a relevance ranking that moved.
 *
 * **The grouped product comes back inside its own variant listing**, last, and
 * it is not a part: `klammerProduct` is true on it, it carries the base article
 * code with no size suffix (`TA219744` against the variants' `TA219744.0300`),
 * and it has no `mainDrawing.technicalDetails` at all. `KLAMMER_GROUPING`
 * queries filter it out with `:klammerProduct:false` and `VARIANT_SEARCH` ones
 * do not, so the flag is read here instead — the vendor's own discriminator
 * rather than a guess from the missing dimensions.
 *
 * It cost exactly one bogus row per group, which is the kind of thing only a
 * real scrape finds: the first drill run wrote 2,687 rows where the family
 * declares 2,670, and `node/receipts.checkRows` is what said so (JG 2026-09-01).
 */
export async function fetchGroupVariants(
  fetcher: Fetcher,
  klammerCode: string,
  delayMs: number = REQUEST_DELAY_MS,
): Promise<VariantProduct[]> {
  const query = variantQuery(klammerCode)
  const found = await pages<VariantProduct>(
    fetcher,
    (page) => searchUrl(query, VARIANT_SEARCH, page, 'prod-detail-variant'),
    delayMs,
  )
  return found.filter((product) => product.klammerProduct !== true)
}

/**
 * The full record for each of `codes`, by code, in batches of
 * {@link DETAIL_BATCH}.
 *
 * A code the vendor answers nothing for is warned about and left out of the
 * map; the row is still written, without the fields only this call carries. A
 * dropped row would lose a part somebody can order over a field that is
 * missing rather than wrong.
 */
export async function fetchDetails(
  fetcher: Fetcher,
  codes: readonly string[],
  delayMs: number = REQUEST_DELAY_MS,
  warn: Warn = consoleWarn,
): Promise<Map<string, ProductDetail>> {
  const found = new Map<string, ProductDetail>()

  for (let at = 0; at < codes.length; at += DETAIL_BATCH) {
    if (at > 0) await pause(delayMs)
    const batch = codes.slice(at, at + DETAIL_BATCH)
    const answer = await fetcher.json<ProductDetail[]>(detailUrl(batch))
    if (!Array.isArray(answer)) {
      throw new VendorResponseError(
        detailUrl(batch),
        'the detail endpoint answered something that is not a list of products',
      )
    }
    for (const product of answer) {
      if (product.code !== undefined) found.set(product.code, product)
    }
    const missing = batch.filter((code) => !found.has(code))
    if (missing.length > 0) {
      warn(
        `  WARNING: the detail endpoint published nothing for ${missing.join(', ')} — ` +
          `those rows carry no flute count, point angle, thread pitch or material index`,
      )
    }
  }

  return found
}

/**
 * Write one `{ property, value }` pair into a row under `column`.
 *
 * Two properties can land on one column, and both ways of it are the vendor's
 * doing rather than this adapter's:
 *
 * - **A later empty value never erases a filled one.** The three sources
 *   overlap, and an absent value is not a more specific statement than a
 *   present one — a part that states no coating does not unstate the group's.
 *   Silent, because it is the ordinary case rather than a surprise.
 * - **Two different non-empty values collide, and that is warned about.**
 *   {@link bareLabel} strips the unit tag, so `nominal diameter d₁ [mm]` and
 *   `nominal diameter d₁ [in]` — which the drill detail record really does
 *   publish side by side — are one column name. The later one still wins, so
 *   the CSV keeps a reading rather than a blank, but nothing about it is quiet:
 *   the receipt is short one number the vendor published, and `unionHeader`
 *   cannot show a column that was overwritten rather than missing.
 */
function put(
  row: Record<string, string>,
  column: string,
  detail: Detail,
  what: string,
  warn: Warn,
): void {
  if (detail.property === undefined) return
  const value = detail.value ?? ''
  const held = row[column]

  if (held !== undefined && held !== '') {
    if (value === '') return
    if (held !== value) {
      warn(
        `  WARNING: ${what}: ${JSON.stringify(detail.property)} and an earlier ` +
          `property both write ${JSON.stringify(column)} — it held ` +
          `${JSON.stringify(held)} and now states ${JSON.stringify(value)}`,
      )
    }
  }

  row[column] = value
}

/**
 * One orderable part as a row.
 *
 * The three property sources are written in the order they may override each
 * other: the group's, then the part's own, then its dimension table. Group and
 * part overlap — both state the coating and the cutting material — and the
 * part's is the more specific of the two.
 */
export function variantRow(
  group: GroupedProduct,
  variant: VariantProduct,
  detail: ProductDetail | undefined,
  unit: UnitSystem,
  warn: Warn = consoleWarn,
): ScrapedRow {
  const what = variant.code ?? ''
  const row: Record<string, string> = {
    [MATERIAL_NUMBER_COLUMN]: variant.code ?? '',
    [CATALOG_NUMBER_COLUMN]: variant.articleCode ?? '',
    [DESCRIPTION_COLUMN]: group.productListInfo ?? '',
    [GROUP_COLUMN]: group.code ?? '',
    [DIMENSION_FEATURE_COLUMN]: variant.dimensionFeatureValue ?? '',
    [NAME_COLUMN]: variant.name ?? '',
  }

  for (const property of group.technicalDetails ?? []) {
    put(row, bareLabel(property.property ?? ''), property, what, warn)
  }
  for (const property of detail?.technicalDetails ?? []) {
    put(row, bareLabel(property.property ?? ''), property, what, warn)
  }
  for (const property of variant.mainDrawing?.technicalDetails ?? []) {
    put(row, dimensionalColumn(bareLabel(property.property ?? ''), unit), property, what, warn)
  }

  // The vendor's own order, space-separated like every other multi-value cell
  // here. `records.ts` reorders onto `ISO_MATERIAL_GROUPS` — a consumer that
  // renders a facet from one order and a tool's list from another has no way to
  // notice the two disagree.
  //
  // **Written only where a detail record answered**, so that an empty cell
  // means the vendor's index rates this part for nothing and an absent key
  // means this package has no evidence either way. The second is the part whose
  // detail request answered nothing, which is warned about above.
  if (detail !== undefined) {
    row[APPLICATION_MATERIALS_COLUMN] = (detail.applicationMaterials ?? [])
      .map((m) => m.code ?? '')
      .filter((code) => code !== '')
      .join(' ')
  }

  return row
}

/**
 * One category — optionally one facet of it — as rows, one per orderable part.
 *
 * Paced between every request it makes, so unlike the Harvey command there is
 * nothing for a caller to pace between families.
 *
 * A target that yields no rows is refused rather than returned empty: a facet
 * value the vendor retired answers exactly like a category that was
 * discontinued, and only one of those is a scrape this package should write a
 * receipt for.
 */
export async function scrapeCategory(
  fetcher: Fetcher,
  target: EmugeTarget,
  options: EmugeOptions,
): Promise<ScrapeResult> {
  const { unit, warn = consoleWarn, delayMs = REQUEST_DELAY_MS } = options
  const source = searchUrl(groupQuery(target), KLAMMER_GROUPING, 0)

  const groups = await fetchGroups(fetcher, target, delayMs)
  const rows: ScrapedRow[] = []

  for (const group of groups) {
    if (group.code === undefined || group.code === '') {
      warn('  WARNING: a grouped product carries no code — skipped')
      continue
    }

    await pause(delayMs)
    const variants = await fetchGroupVariants(fetcher, group.code, delayMs)
    if (variants.length === 0) {
      warn(`  WARNING: ${group.code} publishes no variants — skipped`)
      continue
    }

    // The vendor's own count of the group, against what the walk kept. A second
    // number nothing here computed, which is the whole of its value — it is the
    // per-group form of the argument `family.rows` makes for a whole CSV, and it
    // fires at the group rather than at the end of a scrape that already ran.
    //
    // It is what the grouped product appearing inside its own variant listing
    // looked like before the flag was read: seventeen groups, each one row over.
    const declared = group.numberOfMaterials
    if (declared !== undefined && declared !== variants.length) {
      warn(
        `  WARNING: ${group.code} kept ${variants.length} parts where the vendor ` +
          `states ${declared} — the group's shape changed, or the walk did`,
      )
    }

    const codes = variants.map((v) => v.code ?? '').filter((code) => code !== '')
    await pause(delayMs)
    const details = await fetchDetails(fetcher, codes, delayMs, warn)

    for (const variant of variants) {
      if (variant.code === undefined || variant.code === '') {
        warn(`  WARNING: ${group.code} has a variant with no material number — skipped`)
        continue
      }
      rows.push(variantRow(group, variant, details.get(variant.code), unit, warn))
    }
  }

  if (rows.length === 0) {
    throw new VendorResponseError(
      source,
      `no rows from ${groups.length} grouped products — the category code, the ` +
        `facet or the response shape changed`,
    )
  }

  return { header: unionHeader(rows), rows, source, familyCode: target.category }
}
