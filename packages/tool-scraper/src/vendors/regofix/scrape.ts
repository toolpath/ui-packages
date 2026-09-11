/**
 * REGO-FIX powRgrip product index -> toolholding rows.
 *
 * Nothing here is shared with any other adapter beyond `conventions` —
 * REGO-FIX is a Drupal site, not Kennametal's AEM platform, so the transport,
 * the identity fields and the dimension source are all different. See
 * `docs/REGOFIX_PRODUCTFINDER_API.md` for how the endpoint was found.
 *
 * ## Two sources, and both are needed
 *
 * **The roster** comes from the ProductFinder's Elasticsearch proxy: one POST
 * returns every variant of a group with its part number, its designation, its
 * PG series and its CAD links. It carries no geometry beyond the projection
 * length.
 *
 * **The geometry** comes from a per-part DIN 4000 XML on the vendor's CDN,
 * linked from each hit. Three of its codes are pinned to a meaning by
 * REGO-FIX's own published tables and the rest are not:
 *
 * - **`B3`** — projection from the flange face. The `L` column of the BT/PG
 *   table in the PG product catalog, row for row.
 * - **`B4`** — gage length. `B4 - B3 == 48.4` on every row, and 48.4 mm is
 *   BT 30's gauge-line-to-flange distance in the vendor's own standards table.
 * - **`A1`** — diameter at the collet end. The `D` column of that same BT/PG
 *   table, row for row.
 *
 * `A2`, `B1`, `B2` and `B3_WOA` are carried into the CSV verbatim under their
 * raw DIN codes and are **not** promoted onto a record. Nothing available here
 * says what they measure, and the standing rule is to leave a vendor code
 * unlabelled rather than guess at it (JG 2026-08-07). `conventions.DIN_PREFIX`
 * is what keeps them from reading as promoted dimensions: a column named
 * `A2_mm` would sit in the CSV looking exactly like `L1_mm`, which is mapped.
 *
 * There is a lead on pinning them honestly. REGO-FIX publishes
 * `DXF_ISO13399/DXF` and `DXF_ISO13399/PDF` beside the `XML_DIN4000/XML` this
 * module reads, so the standard this package's canonical names come from is
 * already in the vendor's own source material.
 *
 * `A4` is 46 on every BT 30 holder — the flange diameter, a property of the
 * taper and not of the part — so it is checked rather than stored.
 *
 * ## What the vendor gets wrong
 *
 * Three faults found on 2026-08-07, all reported as warnings rather than
 * fixed: two disagreeing vendor cells cannot say which one is wrong, and a
 * scraper that corrects one becomes a place tool data is authored by hand.
 *
 * 1. `4130.70646`'s XML states its own part number as `4130.71646`.
 * 2. `J22`, the XML's own product-line label, says "PG-SG secuRgrip
 *    Werkzeughalter" on several plain BT 30 holders that are not secuRgrip
 *    parts. It is never read.
 * 3. `o_mm` on a tapping collet repeats the previous row's value twice
 *    (`1715.08215` and `1725.08215`). This is why the nominal size is parsed
 *    from the vendor's own designation and `o_mm` is only ever a cross-check.
 */

import {
  CAD_COLUMN,
  COLLET_DESIGNATION_COLUMN,
  COLLET_SERIES_COLUMN,
  CONTACT_COLUMN,
  DIN_PREFIX,
  GAGE_COLUMNS,
} from '../../conventions.js'
import { VendorResponseError } from '../../errors.js'
import { statusOf, type Fetcher } from '../../fetch.js'
import { convertLength, fractionValue } from '../../measure.js'
import { compare } from '../../order.js'
import {
  consoleWarn,
  unionHeader,
  type ScrapeResult,
  type ScrapedRow,
  type Warn,
} from '../../scrape.js'

/**
 * The Searchkit proxy the ProductFinder posts its Elasticsearch queries to.
 * Discovered by reading the app bundle, which constructs
 * `SearchkitManager(origin + '/' + lang, {searchUrlPath: '/elastic/post'})`.
 */
export const SEARCH_URL = 'https://us.rego-fix.com/en/elastic/post'

/**
 * Where a part's DIN 4000 XML lives. The filename is the part number with its
 * dot removed, which is also `field_sku_ngram`.
 */
export const DIN4000_URL =
  'https://static.rego-fix.com/sites/default/files/products/' + 'XML_DIN4000/XML/{sku}.xml'

/**
 * Gauge line to flange face, JIS B 6339 / MAS 403 size 30, as published in the
 * vendor's own interface table (PG product catalog, "BT MAS 403":
 * `BT 30 | 31.75 | 46 | 2 | 48.4 | 20 | M 12`). Used to *verify* that `B4` is
 * the gage length rather than to compute one — both numbers are scraped, and
 * their difference is what identifies the code.
 */
export const BT30_GAUGE_TO_FLANGE = 48.4

/** Flange diameter of a BT 30 taper, from the same row. `A4` on every holder. */
export const BT30_FLANGE_DIAMETER = 46.0

/**
 * DIN 4000 codes carried into the CSV verbatim because nothing here says what
 * they measure. Written out rather than "everything else" so that a code the
 * vendor adds later shows up as an unhandled key instead of silently appearing
 * as a column.
 */
export const UNPINNED_DIN_CODES = ['A2', 'B1', 'B2', 'B3_WOA'] as const

const PROPERTY = /<PropertyName source="din_mk">([^<]*)<\/PropertyName>\s*<Value>([^<]*)<\/Value>/g

/**
 * `PG 25 Ø 3.5 mm`, `PG 15-CF Ø 1/4"`, `PGST 25 Ø 16.0 mm`,
 * `PG 15-TAP Ø 0.141" x 0.110"`, `PG 15-TAP Ø 3.5 x 2.7 mm`.
 *
 * Two things here are easy to get wrong and both were, on the first pass. The
 * series alternation is `PG(?:ST)?` and not `PGST?`, which is "PGS" followed
 * by an optional T and matches none of the 293 plain PG collets. And **an inch
 * designation marks every number while a metric one marks only the last**: a
 * tapping collet is `Ø 0.141" x 0.110"` but `Ø 3.5 x 2.7 mm`, so a pattern
 * that demands a unit after the first number reads no metric tapping collet at
 * all.
 */
const COLLET_TITLE =
  /^(?<series>PG(?:ST)? ?\d+)(?<variant>-[A-Z-]+)? *Ø *(?<size>[\d./]+)(?<sizeUnit>"?)(?: *x *(?<square>[\d./]+)"?)?(?<metric> *mm)?$/

/** `BT 30 / PG 25 x 075`, `BT+ 30 / PG 15 x 070 H`. */
const HOLDER_TITLE =
  /^(?<taper>BT\+? ?\d+)(?<taperVariant>-[A-Z]+)? *\/ *(?<series>PG ?\d+) *x *(?<projection>\d+)/

/**
 * `form_name`, the vendor's own field, mapped to this catalog's `contact`
 * axis. `Plus +` is REGO-FIX's designation for the dual-contact shank that
 * seats on the spindle face as well as the cone — the same distinction
 * Kennametal sells as BTKV. It is a **scraped fact here**, not family config,
 * because REGO-FIX publishes both forms in one product group:
 * `BT 30 / PG 25 x 080 H` and `BT+ 30 / PG 25 x 080 H` are two rows of one
 * table.
 *
 * There is no default. A third form is a stop-and-ask, and `BT-OM 30` is
 * already sitting in that table undefined — nothing on the vendor's site or in
 * its catalog says what OM designates, so its three parts are deliberately not
 * scraped (JG 2026-08-07).
 */
export const CONTACT_BY_FORM: Record<string, string> = {
  Standard: 'taper',
  'Plus +': 'face',
}

/**
 * The taper designations this package scrapes, and what they mean.
 *
 * `BT-OM 30` is published in the same product group and is **not** here: the
 * family page, the product catalog and the ProductFinder all print the token
 * and none of them says what OM designates, so recording a spindle interface
 * for it would be a guess about which machine a holder fits (JG 2026-08-07).
 * Its three parts are a stop-and-ask, not an omission to fix silently.
 */
export const SCRAPED_TAPERS = ['BT 30', 'BT+ 30'] as const

/** One Elasticsearch `_source`: every value is a list, even a single one. */
export type Source = Record<string, unknown>

/**
 * Every `_source` matching an AND of term filters, newest index first.
 *
 * One request: the index holds 4142 products in total and the largest group
 * asked for here is 321, so there is nothing to page. `size` is an explicit
 * ceiling rather than a page length, and going over it throws — a silently
 * truncated roster is the failure this whole package is built to notice.
 */
export async function search(
  fetcher: Fetcher,
  filters: Record<string, string>,
  size = 500,
): Promise<Source[]> {
  const query = {
    bool: {
      filter: Object.entries(filters).map(([k, v]) => ({ term: { [k]: v } })),
    },
  }
  const payload = await fetcher.postJson<{
    hits?: { total: number | { value: number }; hits: { _source: Source }[] }
  }>(SEARCH_URL, { size, query })

  const hits = payload.hits
  if (hits === undefined) {
    throw new VendorResponseError(
      SEARCH_URL,
      `response carries no "hits" — the proxy changed shape ` +
        `(keys: ${Object.keys(payload).sort().join(', ')})`,
    )
  }
  // Elasticsearch 6 answers with a bare number and 7+ with `{value, relation}`
  // unless `rest_total_hits_as_int` is set. Reading only the number would make
  // this guard a silent no-op the day the proxy is upgraded — which is exactly
  // the truncated roster it exists to refuse.
  const total = typeof hits.total === 'object' ? hits.total.value : hits.total
  if (total > size) {
    throw new VendorResponseError(
      JSON.stringify(filters),
      `${total} products but only ${size} requested — raise \`size\` ` +
        `rather than shipping a truncated roster`,
    )
  }
  return hits.hits.map((hit) => hit._source)
}

/**
 * A field of an Elasticsearch `_source`, which stores every value as a list
 * even when there is exactly one.
 *
 * Missing and empty are both null: `o_inch` is absent on a metric collet,
 * which is the vendor saying it is metric rather than a gap.
 */
export function one(source: Source, field: string): string | number | null {
  const values = source[field]
  if (!Array.isArray(values) || values.length === 0) return null
  const value: unknown = values[0]
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

/** `one`, as the string every caller wanted it as. */
function text(source: Source, field: string): string {
  const value = one(source, field)
  return value === null ? '' : String(value)
}

/**
 * DIN 4000 property codes to their values, empty ones dropped.
 *
 * The document repeats a `<PropertyName>`/`<Value>` pair per property and
 * states most of them empty, so dropping blanks is what makes "the vendor
 * published this" and "the vendor published a hole" different states.
 *
 * Throws on a document with no properties at all rather than returning an
 * empty map, for the reason `kennametal.parseVariantTable` throws on an
 * unparseable response: reporting a changed format as no data looks exactly
 * like a discontinued part.
 */
export function parseDin4000(xml: string): Record<string, string> {
  const properties: Record<string, string> = {}
  let found = false

  for (const match of xml.matchAll(PROPERTY)) {
    found = true
    const [, name, value] = match
    if (name && value?.trim()) properties[name] = value.trim()
  }

  if (!found) {
    throw new VendorResponseError(
      'DIN 4000 document',
      'carries no din_mk properties — the format changed shape',
    )
  }
  return properties
}

/**
 * One part's DIN 4000 properties, or null when the vendor publishes none.
 *
 * Null is a real state — two of the BT+ 30 holders have DXF and PDF but no XML
 * — and it is distinguished from a failed request, which throws. A holder with
 * no XML has no gage length and cannot be converted, so it is the caller that
 * decides what to do about it.
 */
export async function fetchDin4000(
  fetcher: Fetcher,
  sku: string,
): Promise<Record<string, string> | null> {
  try {
    const xml = await fetcher.text(DIN4000_URL.replace('{sku}', sku.replaceAll('.', '')))
    return parseDin4000(xml)
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

/** One of the three DIN codes this package is willing to map, as a number. */
function pinned(properties: Record<string, string>, code: string, sku: string): number {
  const raw = properties[code]
  if (!raw) {
    throw new VendorResponseError(sku, `DIN 4000 document publishes no ${code}`)
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new VendorResponseError(sku, `DIN 4000 ${code} is ${JSON.stringify(raw)}, not a number`)
  }
  return value
}

/**
 * A number as the vendor would print it: no trailing `.0` on an integer.
 *
 * The CSV is read back as a number, so this only decides what a human and a
 * git diff see — and `10` rather than `10.0` is what the vendor's own
 * designation says.
 */
export function plain(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/**
 * `1/4` or `3.5` — the vendor prints both, and both are exact here.
 *
 * The grammar is `measure.fractionValue`'s; what stays here is the refusal.
 * `3/` divides by zero and an absent regex capture arrives as `''`, and both
 * would otherwise travel into a row as a nominal size — as would `0`, which
 * reads as a number and is not a collet this vendor makes.
 */
export function parseSize(size: string): number {
  const value = fractionValue(size)
  if (value === null || value <= 0) {
    throw new RangeError(`unrecognized size: ${JSON.stringify(size)}`)
  }
  return value
}

/** Round to `places` decimals, as Python's `round(x, places)` does here. */
function round(value: number, places: number): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

/**
 * The part's STEP model, absolute, or empty when none is published.
 *
 * The index gives protocol-relative CDN URLs, and `conventions.CAD_COLUMN`
 * holds a URL a consumer can fetch — so the scheme is added here rather than
 * left for every reader to guess at.
 */
export function cadUrl(source: Source): string {
  const urls = source['field_technical_drawings_url']
  if (!Array.isArray(urls)) return ''
  for (const url of urls) {
    if (typeof url === 'string' && url.endsWith('.stp')) {
      return url.startsWith('//') ? `https:${url}` : url
    }
  }
  return ''
}

/**
 * One search hit plus its DIN 4000 properties -> one row.
 *
 * Column names are the shared toolholding vocabulary rather than REGO-FIX's
 * own, so a consumer reads a REGO-FIX holder exactly as it reads a Kennametal
 * one — `L1` is the gage length whoever published it. The DIN codes those came
 * from are in this module's docstring; the ones that stay unmapped keep their
 * raw code behind `conventions.DIN_PREFIX`.
 *
 * **This is the one place a REGO-FIX label is rewritten, and it is a
 * holder-geometry label rather than an identity or a dimension code.** The
 * identity columns are Kennametal's, adopted here because this vendor came
 * second — see `conventions.IDENTITY_COLUMNS`.
 *
 * `D1` is deliberately absent. A powRgrip holder clamps through a collet, and
 * a collet-clamping holder that also carried a bore would be claiming two ways
 * of gripping one tool.
 */
export function holderRow(
  source: Source,
  properties: Record<string, string>,
  warn: Warn = consoleWarn,
): ScrapedRow {
  const title = text(source, 'title')
  const sku = text(source, 'field_sku_fulltext')

  const parsed = HOLDER_TITLE.exec(title)?.groups
  if (!parsed) {
    throw new VendorResponseError(
      sku,
      `cannot read a taper and series off ${JSON.stringify(title)}`,
    )
  }

  const form = text(source, 'form_name')
  const contact = CONTACT_BY_FORM[form]
  if (contact === undefined) {
    throw new VendorResponseError(
      `${sku} (${title})`,
      `form_name ${JSON.stringify(form)} is not a contact mode this package ` +
        `knows — add it to CONTACT_BY_FORM once the vendor says what it ` +
        `designates`,
    )
  }

  const gauge = pinned(properties, 'B4', sku)
  const projection = pinned(properties, 'B3', sku)
  if (Math.abs(gauge - projection - BT30_GAUGE_TO_FLANGE) > 1e-9) {
    throw new VendorResponseError(
      `${sku} (${title})`,
      `B4 - B3 is ${gauge - projection}, not the ${BT30_GAUGE_TO_FLANGE} mm ` +
        `this taper puts between its gauge line and its flange — B4 is not ` +
        `the gage length here`,
    )
  }

  const flange = pinned(properties, 'A4', sku)
  if (Math.abs(flange - BT30_FLANGE_DIAMETER) > 1e-9) {
    throw new VendorResponseError(
      `${sku} (${title})`,
      `A4 is ${flange}, not the ${BT30_FLANGE_DIAMETER} mm flange of a BT 30 taper`,
    )
  }

  const stated = properties['J21']
  if (stated !== undefined && stated !== sku) {
    warn(
      `  WARNING: ${sku} (${title}): its DIN 4000 document calls itself ` +
        `${stated} — the index part number is used`,
    )
  }

  const row: Record<string, string> = {
    'Material Number': sku,
    'ISO Catalog Number': title,
    [COLLET_SERIES_COLUMN]: (parsed['series'] ?? '').replaceAll(' ', ''),
    [CONTACT_COLUMN]: contact,
    [GAGE_COLUMNS.millimeters]: plain(gauge),
    D2_mm: plain(pinned(properties, 'A1', sku)),
    B3_mm: plain(projection),
    [CAD_COLUMN]: cadUrl(source),
  }
  for (const code of UNPINNED_DIN_CODES) {
    row[`${DIN_PREFIX}${code}`] = properties[code] ?? ''
  }
  return row
}

/**
 * Report where the index's `o_mm` contradicts the vendor's designation.
 *
 * Reports, never gates: two disagreeing vendor cells cannot say which one is
 * wrong, and correcting one here would make this module a place tool data is
 * authored by hand.
 *
 * **The tolerance is the vendor's own printed precision, not a feel.** `o_mm`
 * is stated to two decimals, so half a unit in its last place — 0.005 mm — is
 * exactly how far it may legitimately sit from the exact size. The four
 * disagreements in the catalog today are 0.01, 0.01, 0.12 and 1.48 mm; the
 * last two are tapping collets whose `o_mm` repeats the previous row's value
 * outright.
 */
function crossCheckOmm(row: Record<string, string>, nominalMm: number, warn: Warn): void {
  const stated = row['o_mm']
  if (!stated) return
  if (Math.abs(Number(stated) - nominalMm) > 0.005 + 1e-9) {
    warn(
      `  WARNING: ${row['Material Number']} (${row['ISO Catalog Number']}): ` +
        `the index says o_mm = ${stated} where the designation is ` +
        `${nominalMm} mm; the designation is used`,
    )
  }
}

/**
 * One search hit -> one row, with the nominal size read off the vendor's own
 * designation.
 *
 * **The size comes from the title, not from `o_mm`.** `o_mm` is rounded to two
 * decimals, which puts a 1/8 in collet at 3.18 mm where the part is 3.175 —
 * five microns out, against the two-micron tolerance a fit test sizes its
 * equality to, so every inch collet would have failed to match its own shank
 * size. It is also wrong outright on two tapping collets, where it repeats the
 * previous row's value. The title states the vendor's designation exactly
 * (`Ø 1/4"`, `Ø 3.5 mm`) and says which unit system it is in, so it is both
 * more precise and the only source here that carries a unit at all.
 *
 * `o_mm` is kept as a cross-check column rather than dropped, the same way
 * Kennametal's contradictory unit cells are kept: it is what the vendor said.
 */
export function colletRow(source: Source, warn: Warn = consoleWarn): ScrapedRow {
  const title = text(source, 'title')
  const sku = text(source, 'field_sku_fulltext')

  const parsed = COLLET_TITLE.exec(title)?.groups
  if (!parsed) {
    throw new VendorResponseError(sku, `cannot read a size off ${JSON.stringify(title)}`)
  }

  const inches = parsed['sizeUnit'] === '"'
  // Exactly one unit marker, or the designation does not state a system. Both
  // would mean a title like `Ø 1/4" mm`; neither means the vendor printed a
  // bare number, and this catalog does not guess a unit system.
  if (inches === Boolean(parsed['metric'])) {
    throw new VendorResponseError(
      sku,
      `${JSON.stringify(title)} states ${inches ? 'two unit systems' : 'none'}`,
    )
  }

  const nominal = parseSize(parsed['size'] ?? '')
  const unit = inches ? 'inches' : 'millimeters'
  const nominalMm = inches ? round(convertLength(nominal, 'inches', 'millimeters'), 6) : nominal

  // A powRgrip collet clamps one size to h6 (h9 on the turning and tapping
  // lines) rather than closing over a range, so its capacity is its nominal
  // diameter at both ends. That is the vendor's `Clamping range or tolerance`
  // row in the PG catalog's collet matrix, and it is the same shape as
  // Kennametal's sealed coolant-through collets, where CCCX == CCCN == D1 — a
  // zero-width range is still a range.
  const row: Record<string, string> = {
    'Material Number': sku,
    'ISO Catalog Number': title,
    [COLLET_DESIGNATION_COLUMN]: (parsed['series'] ?? '').replaceAll(' ', ''),
    unit,
    o_mm: plain(one(source, 'o_mm')),
    Square_mm: '',
    Square_in: '',
  }

  // The native cell is what a machinist ordered; the millimetre cell is what
  // fit arithmetic compares. On a metric collet they are the same cell, so
  // only an inch one gets a projection — and that projection is exact, because
  // the designation is a fraction rather than a printed decimal.
  for (const label of ['D1', 'CCCN', 'CCCX']) {
    row[inches ? `${label}_in` : `${label}_mm`] = plain(nominal)
    if (inches) row[`${label}_mm`] = plain(nominalMm)
  }

  if (parsed['square']) {
    const square = parseSize(parsed['square'])
    row[inches ? 'Square_in' : 'Square_mm'] = plain(square)
    // Projected for the same reason `D1` is: an inch tapping collet whose
    // square sits only in `Square_in` is invisible to mm-side fit arithmetic.
    if (inches) row['Square_mm'] = plain(round(convertLength(square, 'inches', 'millimeters'), 6))
  }

  crossCheckOmm(row, nominalMm, warn)
  return row
}

/** Options every REGO-FIX scrape accepts. */
export interface RegofixOptions {
  warn?: Warn
}

/**
 * Every powRgrip holder of `group` whose taper is in {@link SCRAPED_TAPERS}.
 *
 * Two requests' worth of work per part — the roster is one POST, then one DIN
 * 4000 document each. A part the vendor publishes no XML for is dropped with a
 * message rather than written with holes: a gage length is required, and a
 * holder without one fails conversion anyway.
 */
export async function scrapeHolders(
  fetcher: Fetcher,
  group = 'BT/PG',
  category = 'BT',
  options: RegofixOptions = {},
): Promise<ScrapeResult> {
  const warn = options.warn ?? consoleWarn
  const sources = await search(fetcher, {
    system_name: 'powRgrip',
    type: 'toolholders',
    product_category_name: category,
    product_group_name: group,
  })

  const wanted = sources
    .filter((s) => SCRAPED_TAPERS.some((taper) => text(s, 'title').startsWith(taper)))
    .sort((a, b) => compare(text(a, 'field_sku_fulltext'), text(b, 'field_sku_fulltext')))

  const rows: ScrapedRow[] = []
  for (const source of wanted) {
    const sku = text(source, 'field_sku_fulltext')
    const properties = await fetchDin4000(fetcher, sku)
    if (properties === null) {
      warn(
        `  SKIPPED ${sku} (${text(source, 'title')}): the vendor publishes ` +
          `no DIN 4000 document, so it has no gage length`,
      )
      continue
    }
    rows.push(holderRow(source, properties, warn))
  }

  return finish(rows, SEARCH_URL)
}

/**
 * Every powRgrip collet of one product group, in the given PG sizes.
 *
 * `sizes` are the vendor's `norm_size` values — the PG series numbers a BT 30
 * holder can take. It is an argument rather than "all of them" because the
 * sizes are what tie a collet family to the holders in this catalog: PG 32 and
 * PG 48 collets exist and no BT 30 holder accepts one.
 */
export async function scrapeCollets(
  fetcher: Fetcher,
  group: string,
  sizes: readonly string[],
  options: RegofixOptions = {},
): Promise<ScrapeResult> {
  const sources = await search(fetcher, {
    system_name: 'powRgrip',
    type: 'collets',
    product_group_name: group,
  })

  const wanted = sources
    .filter((s) => sizes.includes(String(one(s, 'norm_size'))))
    .sort((a, b) => compare(text(a, 'field_sku_fulltext'), text(b, 'field_sku_fulltext')))

  return finish(
    // `options.warn` unguarded: `colletRow` owns the fallback, and defaulting
    // it here too would be two layers deciding the same thing.
    wanted.map((s) => colletRow(s, options.warn)),
    SEARCH_URL,
  )
}

/** A scrape that produced no rows is a broken one, not an empty family. */
function finish(rows: ScrapedRow[], source: string): ScrapeResult {
  if (rows.length === 0) {
    throw new VendorResponseError(source, 'the scrape produced no rows')
  }
  return { header: unionHeader(rows), rows, source, familyCode: null }
}
