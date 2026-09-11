/**
 * MariTool category listings -> toolholding rows.
 *
 * The fifth vendor and the first whose transport needed no discovery at all:
 * `www.maritool.com` is an osCommerce-family storefront that server-renders
 * everything, so the whole transport is a paced `GET`. There is no JSON API,
 * no sitemap and no application bundle to read — see
 * `docs/MARITOOL_CATALOG.md` for what was tried and what the tree looks like.
 *
 * ## Two sources, and both are needed
 *
 * **The roster** is a leaf category's listing page. Every row carries the
 * part number (`Part#:`), the store's `products_id`, the product name and the
 * CAD assets, and the page states its own row total — `(of 51 products)` —
 * which is the second opinion `receipts.checkRows` gets for free from a
 * hand-counted `rows` and which nothing here computes from the rows it just
 * collected.
 *
 * **The geometry** is a `Product Specifications` name/value table on each
 * part's own page, so this is one request per part. The table's labels are
 * MariTool's own and are carried into the CSV verbatim, which is the standing
 * rule; the header is their union in first-seen order, because which keys a
 * part publishes is a function of its style. A shrink-fit holder states
 * `Shank Size` and `Nose Diameter`, a collet chuck states `Collet Size` and
 * `Collet Grip Range`, and a hydraulic chuck states `Hydraulic Type`.
 *
 * ## What the vendor gets wrong
 *
 * Four faults found on 2026-08-29. Three are reported as warnings rather than
 * fixed — two disagreeing vendor cells cannot say which one is wrong, and a
 * scraper that corrects one becomes a place tool data is authored by hand.
 * This is the same call `vendors/regofix/scrape.ts` made on its three.
 *
 * The fourth is resolved rather than reported, and the difference is where the
 * answer came from: `docs/ADDING-A-VENDOR.md` says that when a vendor label is
 * unclear you **ask**, and record the answer and its date. That is what
 * happened — see fault 2.
 *
 * 1. **`BT40-ER32-60` publishes no `Taper` row at all**, alone among the 529
 *    parts in scope. Its row is kept with `taper` and `contact` empty rather
 *    than dropped or filled in from its part number: the CSV is a receipt, and
 *    the hole is what the vendor published.
 * 2. **`Collet Size` carries a collet *nut* designation on two parts.**
 *    `CAT40-ER25-3.0MD` and `BT30-ER25-60M` both state `ER25M`, and `ER25M` is
 *    not a collet series — `HSK40E-ER16-3.0M` puts exactly that shape of value
 *    in its own `Collet Nut` cell, which is the column it belongs in.
 *
 *    **`ER25M` is the mini collet nut series, and the collet it closes is a
 *    plain ER25** (JG 2026-09-02). So {@link colletSeries} resolves the cell to
 *    the collet the holder actually takes, and the two parts join to the ER25
 *    collets they fit. Until that answer existed the string was written through
 *    as designated and warned about, because widening a series on a guess is
 *    how a machinist is offered a collet that does not seat — and the cost of
 *    being wrong the other way was one option, not a purchase.
 *
 *    **Nothing is lost by resolving it.** `Collet Size` is one of the vendor's
 *    own labels and is carried into the CSV verbatim, so the receipt still says
 *    `ER25M` and still says which of the two parts has a mini nut. What changes
 *    is only `CST`, which is a derived join key rather than a record of what the
 *    vendor published — the same thing the spacing rule below does to it.
 * 3. **`Collet Size` is spaced inconsistently within one style** — `ER 11`
 *    and `ER11` are both published. {@link colletSeries} closes the space,
 *    because `CST` is a join key and two spellings of one series join to
 *    nothing.
 * 4. **Two parts publish no `Product Specifications` table**, both in the
 *    CAT50 `Collet Chucks` leaf. They state their geometry as English prose in
 *    a `Product Info` bullet list instead — *"Gage length is 100mm (3.93
 *    inch)"* — and that is a sentence, not a table. They are skipped with a
 *    named warning; a regex over the prose would be this package authoring
 *    tool data by hand.
 *
 * ## Where the units are
 *
 * `Gage Length` is metric on some parts and imperial on others **inside one
 * CSV, and inside one category page**: `HSK40E-ER11-40` gages `40mm` where
 * `HSK40E-ER16-3.0M` gages `3.0` inches, and both are rows of
 * `c23_46_1552_1558`. So no MariTool family declares a `unit`, and the gage
 * length is promoted into an `L1_in`/`L1_mm` pair with exactly one cell filled
 * — the shape `regofix.colletRow` already gives `Square_in`/`Square_mm`.
 *
 * **Nothing is converted.** The vendor's own imperial conversion is unusable
 * (its prose calls 40 mm "1.6 inches" where the figure is 1.5748), and
 * computing one here would put a number in the file that the vendor never
 * published. The raw `Gage Length` cell is kept beside the pair.
 *
 * Every other measured cell — `Shank Size`, `Nose Diameter`, `Collet Grip
 * Range` — stays verbatim under MariTool's own label, unsuffixed and
 * unpromoted. That is deliberate: `conventions.dimensionalColumn` takes its
 * suffix from a family's declared `unit`, and these families have none to give
 * it. An adapter choosing `_in` for those cells itself is exactly the mistake
 * a declared `unit` exists to prevent, and `HSK40E-SF.125-45` is the row that
 * proves it — gaged in millimetres, bored in inches.
 */

import { Parser } from 'htmlparser2'

import {
  CAD_COLUMN,
  CAD_DXF_COLUMN,
  COLLET_SERIES_COLUMN,
  CONTACT_COLUMN,
  DESCRIPTION_COLUMN,
  GAGE_COLUMNS,
  type UnitSystem,
} from '../../conventions.js'
import { VendorResponseError } from '../../errors.js'
import type { Fetcher } from '../../fetch.js'
import { compare } from '../../order.js'
import {
  consoleWarn,
  pause,
  REQUEST_DELAY_MS,
  unionHeader,
  type ScrapeResult,
  type ScrapedRow,
  type Warn,
} from '../../scrape.js'

export const BASE = 'https://www.maritool.com'

/**
 * The CSV columns this adapter builds rather than lifts from a spec table.
 *
 * `products_id` is the store's internal id and an ordinary column: a
 * re-created product would change it, and every guid minted off it with it —
 * which is why identity is the part number. It is carried anyway because it is
 * what a re-fetch of one part is addressed by.
 */
export const MATERIAL_COLUMN = 'Material Number'
export const STORE_ID_COLUMN = 'products_id'
export const TAPER_COLUMN = 'taper'
export const CLAMPING_COLUMN = 'clamping'
export const STYLE_COLUMN = 'style'

/** MariTool's own label for the cell `conventions.GAGE_COLUMNS` is promoted from. */
export const GAGE_LABEL = 'Gage Length'

/** MariTool's own label for the cell {@link COLLET_SERIES_COLUMN} comes from. */
export const COLLET_SIZE_LABEL = 'Collet Size'

/** MariTool's own label for the cell {@link TAPER_FORMS} is looked up by. */
export const TAPER_LABEL = 'Taper'

/**
 * Every `Taper` cell this package is willing to read, and what it means.
 *
 * A closed table rather than a pattern, and keyed on the cell upper-cased
 * because MariTool publishes the dual-contact suffix in two casings
 * (`CAT50 DUAL CONTACT` and `CAT50 Dual Contact` are both in the catalog). An
 * unlisted value throws naming itself: a spindle interface this package cannot
 * name is a guess about which machine a holder fits, which is the call
 * `regofix.CONTACT_BY_FORM` made on `BT-OM 30`.
 *
 * **`contact` is `face` on every HSK size, and MariTool does not say so.** It
 * is the interface's definition rather than a property of the part: an HSK
 * shank is a hollow taper that seats on the flange face at the same time as
 * the cone, which is what DIN 69893 / ISO 12164 specify and what the `A`, `E`
 * and `F` forms vary the flange of rather than the contact. MariTool marks
 * `DUAL CONTACT` only on its 7/24 tapers, where it is an option, and there is
 * nothing to mark on an HSK because there is no single-contact HSK to
 * distinguish it from.
 */
export const TAPER_FORMS: Record<string, { taper: string; contact: string }> = {
  BT30: { taper: 'BT30', contact: 'taper' },
  'BT30 DUAL CONTACT': { taper: 'BT30', contact: 'face' },
  BT40: { taper: 'BT40', contact: 'taper' },
  'BT40 DUAL CONTACT': { taper: 'BT40', contact: 'face' },
  CAT40: { taper: 'CAT40', contact: 'taper' },
  'CAT40 DUAL CONTACT': { taper: 'CAT40', contact: 'face' },
  CAT50: { taper: 'CAT50', contact: 'taper' },
  'CAT50 DUAL CONTACT': { taper: 'CAT50', contact: 'face' },
  HSK25E: { taper: 'HSK25E', contact: 'face' },
  HSK40E: { taper: 'HSK40E', contact: 'face' },
  HSK50A: { taper: 'HSK50A', contact: 'face' },
  HSK50E: { taper: 'HSK50E', contact: 'face' },
  HSK63A: { taper: 'HSK63A', contact: 'face' },
  HSK63F: { taper: 'HSK63F', contact: 'face' },
  HSK80F: { taper: 'HSK80F', contact: 'face' },
  HSK100A: { taper: 'HSK100A', contact: 'face' },
}

/** A collet series `CST` can join a collet family on: `ER11`, `ER32`. */
const COLLET_SERIES = /^ER\d+$/

/**
 * A `Gage Length` cell: a number, an optional unit, an optional nose form.
 *
 * All five shapes MariTool publishes, and the last two are the ones a simpler
 * pattern misses: `3.0`, `40mm`, `3.5"`, `7.8 Inches`, `120mm Tapered`. The
 * qualifier alternatives — `Tapered`, `Slim`, `Slim Nose`, `Slim Tapered` —
 * are captured only so they can be dropped; see {@link parseGageLength}.
 *
 * `inches` leads the unit alternation because a regex alternation is ordered
 * and `in` would otherwise match the first two letters of `Inches` and leave
 * `ches` as a nose form.
 */
const GAGE_CELL = /^(\d+(?:\.\d+)?)\s*(inches|inch|in|mm|")?\s*(.*?)$/i

/** `(of 51 products)` — the vendor's own count of a leaf's roster. */
const ROSTER_TOTAL = /\(of\s*<b>\s*(\d+)\s*<\/b>\s*products\)/i

/**
 * `.../p341/CAT40-ER11-2.5-.../product_info.html` — the store id is `341`.
 *
 * **The slug can hold a slash**, so this cannot require one path segment
 * between the id and the filename: MariTool builds the slug out of the product
 * name and does not escape it, which puts
 * `.../p29006/CAT50-3/4-TAPERED-NOSE-SHRINK-FIT-TOOL-HOLDER-.750-5.0/product_info.html`
 * in the catalog. A single-segment pattern matches neither of the two CAT50
 * shrink-fit holders and leaves their rows with no page to fetch.
 */
const PRODUCT_PATH = /\/p(\d+)\/[^?#]*\/product_info\.html$/

/** The `<p>` a listing row states its part number on. */
const PART_NUMBER_LINE = /^Part#:\s*(.+)$/

/** The product page's header over its downloads block. */
const DOWNLOADS_HEADER = /^Available Downloads for\s+(.+)$/

/**
 * One leaf category to scrape, and how MariTool classifies what is in it.
 *
 * **`clamping` and `style` come from the leaf, not from a family constant.**
 * Each of the five CSVs is one taper and mixes all three holder styles, so
 * neither can be a family fact; and the leaf name is MariTool's own
 * classification of the part, so the column is vendor-stated rather than a
 * coinage. The values live in `families/maritool.ts` beside the cPath they
 * come from.
 *
 * Declared here and re-declared structurally by the config table rather than
 * imported from it, because `families/` must not import an adapter and an
 * adapter must not import the config — `tests/vendor-boundary.test.ts` refuses
 * both directions.
 */
export interface LeafTarget {
  /** MariTool's own category path, e.g. `23_25_42`. */
  readonly cPath: string
  /** How a holder in this leaf grips: `collet`, `shrink`, `hydraulic`. */
  readonly clamping: string
  /** The product style, as MariTool names the leaf: `er-collet-chuck`. */
  readonly style: string
}

/** One row of a leaf's listing, before its product page has been read. */
export interface ListingRow {
  /** The store's internal id, from the product link. */
  readonly productsId: string
  /** The `Part#:` line — the identity, and the guid seed. */
  readonly partNumber: string
  /** The vendor's own product name, which is where a nose form survives. */
  readonly name: string
  /** The vendor's own link to this part's page. */
  readonly productUrl: string
  /** Downloadable assets by their own code — `STP`, `DXF`, `DWG`, `PDF`. */
  readonly assets: Readonly<Record<string, string>>
}

/** One listing page: the vendor's row total, and the rows it rendered. */
export interface Listing {
  /** What `(of N products)` said. The whole leaf, not this page. */
  readonly total: number
  readonly rows: ListingRow[]
}

/** One product page: its spec table, and what its downloads header calls it. */
export interface Product {
  /** MariTool's own labels to its own values. Empty where none is published. */
  readonly specs: Record<string, string>
  /**
   * The part number the downloads header restates, or null where the part
   * publishes no assets and so carries no header.
   */
  readonly statedPartNumber: string | null
}

/**
 * A leaf category's listing page.
 *
 * The slug in a rewritten URL is ignored by the store, so this uses the
 * platform's own unrewritten form and invents no slug: three URL forms reach
 * the same page and only this one is derivable from a cPath alone.
 */
export function categoryUrl(cPath: string, page = 1): string {
  const url = `${BASE}/index.php?cPath=${cPath}`
  return page > 1 ? `${url}&page=${page}` : url
}

/** Whitespace collapsed, the way a browser renders a run of it. */
function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * One listing page's roster row total and its rendered rows.
 *
 * The rows are read off `<tr class="product-info">`, which is the vendor's own
 * marker for one, and the store id off the product link rather than off the
 * add-to-cart form's hidden input: the link is the first thing in the row and
 * is also what the next request needs.
 */
export function parseListing(html: string): Listing {
  const total = ROSTER_TOTAL.exec(html)
  if (total === null) {
    throw new VendorResponseError(
      'listing page',
      'states no "(of N products)" count — the page changed shape, and that ' +
        'count is the only independent check on the rows collected',
    )
  }

  const rows: ListingRow[] = []
  let row: {
    productsId: string
    partNumber: string
    name: string
    productUrl: string
    assets: Record<string, string>
  } | null = null
  // A depth counter rather than a flag: a row holds nested tables, and a flag
  // would clear on the first inner `</tr>`.
  let depth = 0
  // Where the text handler is currently writing, if anywhere.
  let sink: 'name' | 'part' | { asset: string } | null = null
  let text = ''

  const parser = new Parser(
    {
      onopentag: (tag, attribs) => {
        const classes = (attribs['class'] ?? '').split(/\s+/)

        if (tag === 'tr' && classes.includes('product-info') && depth === 0) {
          row = { productsId: '', partNumber: '', name: '', productUrl: '', assets: {} }
          depth = 1
          return
        }
        if (row === null) return
        if (tag === 'tr') depth++

        if (tag === 'a') {
          const href = attribs['href'] ?? ''
          const path = PRODUCT_PATH.exec(href)
          if (path !== null) {
            // The row links its part twice — once round the thumbnail and once
            // round the name — and only the second carries text. Both give the
            // same id, so the first wins and the second is where the name is.
            if (row.productsId === '') {
              row.productsId = path[1] ?? ''
              row.productUrl = href
            } else if (row.name === '') {
              sink = 'name'
              text = ''
            }
            return
          }
          if (classes.includes('asset-code')) {
            sink = { asset: href }
            text = ''
          }
          return
        }
        if (tag === 'p') {
          sink = 'part'
          text = ''
        }
      },

      ontext: (chunk) => {
        if (sink !== null) text += chunk
      },

      onclosetag: (tag) => {
        if (row === null) return

        if (sink !== null && (tag === 'a' || tag === 'p')) {
          const value = squash(text)
          if (sink === 'name') {
            row.name = value
          } else if (sink === 'part') {
            const stated = PART_NUMBER_LINE.exec(value)
            // Every row states one, but the same `<p>` shape also holds
            // `Brand:` and `Available Downloads`, so it is matched rather than
            // taken positionally.
            if (stated !== null && row.partNumber === '') row.partNumber = stated[1] ?? ''
          } else {
            // The link's own text is the vendor's code for the format.
            row.assets[value.toUpperCase()] = sink.asset
          }
          sink = null
        }

        if (tag === 'tr') {
          depth--
          if (depth === 0) {
            // A row this cannot read is a changed page, not a part with less
            // data: without a part number it has no identity and without a
            // link it has no geometry, and passing either on as an empty
            // string reaches the network as a request for nothing.
            if (row.partNumber === '' || row.productUrl === '') {
              throw new VendorResponseError(
                row.productsId === '' ? 'a listing row' : `products_id ${row.productsId}`,
                `states no ${row.partNumber === '' ? 'Part# line' : 'product link'} — ` +
                  `the listing changed shape`,
              )
            }
            rows.push(row)
            row = null
          }
        }
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()

  return { total: Number(total[1]), rows }
}

/** Options every MariTool scrape accepts. */
export interface MaritoolOptions {
  warn?: Warn
  /** Milliseconds between requests. Zero in a test, {@link REQUEST_DELAY_MS} live. */
  delayMs?: number
}

/**
 * Every part in one leaf category, paged until the vendor's own count is met.
 *
 * **The count is the gate, and it is the vendor's rather than ours.** A roster
 * that stopped a page early is the failure this package is built to notice,
 * and it cannot be noticed by counting the rows that were collected — that
 * number agrees with itself. `(of N products)` is a second opinion the store
 * computes from its own database, which is the check `regofix.search` gets
 * free from `hits.total`.
 *
 * A page that adds no new row stops the walk rather than looping: a paging
 * parameter the store has stopped honouring answers with page 1 forever.
 */
export async function roster(
  fetcher: Fetcher,
  cPath: string,
  options: MaritoolOptions = {},
): Promise<ListingRow[]> {
  const { delayMs = REQUEST_DELAY_MS } = options
  const rows: ListingRow[] = []
  const seen = new Set<string>()
  let total = 0

  for (let page = 1; page === 1 || rows.length < total; page++) {
    if (page > 1) await pause(delayMs)
    const listing = parseListing(await fetcher.text(categoryUrl(cPath, page)))
    if (page === 1) total = listing.total

    const before = rows.length
    for (const row of listing.rows) {
      // Within one leaf a repeated id is the store serving a page twice, not
      // the cross-leaf duplication `scrapeHolders` dedupes.
      if (seen.has(row.productsId)) continue
      seen.add(row.productsId)
      rows.push(row)
    }
    if (rows.length === before) break
  }

  if (rows.length !== total) {
    throw new VendorResponseError(
      `c${cPath}`,
      `the listing says ${total} products and paging collected ${rows.length} — ` +
        `a roster that lost rows agrees with every count computed from itself, ` +
        `so this is the one that has to refuse`,
    )
  }
  return rows
}

/**
 * One product page's `Product Specifications` table and downloads header.
 *
 * Both are found by their own `<div class="header">` rather than positionally,
 * because a page carries several such blocks and which ones are present varies
 * — 2 of the 529 parts in scope publish no spec table and roughly one in four
 * publishes no downloads.
 *
 * An empty `specs` is a real state and is not an error here: the caller is
 * what decides that a part with no geometry is skipped rather than written
 * with holes.
 */
export function parseProduct(html: string): Product {
  const specs: Record<string, string> = {}
  let statedPartNumber: string | null = null

  /** Which `<div class="header">` block the parser is currently under. */
  let section = ''
  let inHeader = false
  let cells: string[] | null = null
  let text = ''
  let capturing = false

  const parser = new Parser(
    {
      onopentag: (tag, attribs) => {
        const classes = (attribs['class'] ?? '').split(/\s+/)
        if (tag === 'div' && classes.includes('header')) {
          inHeader = true
          capturing = true
          text = ''
          return
        }
        if (section !== 'Product Specifications') return
        if (tag === 'tr') cells = []
        if (tag === 'td') {
          capturing = true
          text = ''
        }
      },

      ontext: (chunk) => {
        if (capturing) text += chunk
      },

      onclosetag: (tag) => {
        if (inHeader && tag === 'div') {
          section = squash(text)
          const stated = DOWNLOADS_HEADER.exec(section)
          if (stated !== null) statedPartNumber = stated[1] ?? null
          inHeader = false
          capturing = false
          return
        }
        if (section !== 'Product Specifications') return
        if (tag === 'td' && cells !== null) {
          // `&nbsp;` decodes to U+00A0, which `\s` matches but a naive trim
          // does not — the label cell is `<b>Balance Spec:&nbsp;</b>`.
          cells.push(squash(text.replace(/ /g, ' ')))
          capturing = false
          return
        }
        if (tag === 'tr' && cells !== null) {
          const [label, value] = cells
          if (label !== undefined && value !== undefined && label.endsWith(':')) {
            specs[label.slice(0, -1).trim()] = value
          }
          cells = null
        }
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()

  return { specs, statedPartNumber }
}

/** One part's page, fetched through the seam every transport here uses. */
export async function fetchProduct(fetcher: Fetcher, url: string): Promise<Product> {
  return parseProduct(await fetcher.text(url))
}

/** A gage length, read off the cell the vendor printed it in. */
export interface GageLength {
  readonly value: number
  readonly unit: UnitSystem
}

/**
 * A `Gage Length` cell as a number and the unit system it is stated in.
 *
 * **A bare number is inches.** That is the vendor's convention rather than
 * this package guessing: MariTool marks every metric cell `mm` and marks
 * nothing on an imperial one — 363 of the 473 in-scope cells sampled are bare
 * or carry an inch mark, and a gage length of "3.0" millimetres is not a
 * holder. The part number says nothing about it either way: `HSK40E-ER11-40`
 * is millimetres and `HSK40E-ER16-3.0M` is inches, where that `M` is a mini
 * nut.
 *
 * **The nose form is parsed off and given no column.** `120mm Tapered` is 120
 * millimetres, and `Tapered` is not a data type — it is not lost, because the
 * vendor states it in the product name too (*"BT40 ER11 120mm Tapered Nose
 * Collet Chuck Tool Holder"*), and the row carries that name verbatim in
 * `Description`. The raw cell stays in the CSV as well.
 *
 * Refused rather than returned as `NaN`, the rule `regofix.parseSize` holds: a
 * cell this cannot read would otherwise travel into a row as a gage length.
 */
export function parseGageLength(cell: string): GageLength {
  const parsed = GAGE_CELL.exec(squash(cell))
  const value = Number(parsed?.[1])
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`unrecognized gage length: ${JSON.stringify(cell)}`)
  }
  const unit = (parsed?.[2] ?? '').toLowerCase() === 'mm' ? 'millimeters' : 'inches'
  return { value, unit }
}

/**
 * A `Collet Size` cell that names the **nut** rather than the collet.
 *
 * `M` is MariTool's mini collet nut, and the collet a mini nut closes is the
 * plain one of that series (JG 2026-09-02). The vendor's own `Collet Nut`
 * column carries `ER11M`, `ER16M`, `ER20M` and `ER25M` beside a `Collet Size`
 * of plain `ER 11`, `ER 16`, `ER 20` and `ER 25` on 57 parts, which is the
 * column those values belong in.
 *
 * Anchored on `ER\d+` rather than stripping a trailing letter, so a suffix that
 * turns out to designate something else still reaches {@link holderRow}'s
 * warning instead of being quietly shortened into a series that fits nothing.
 */
const NUT_DESIGNATION = /^(ER\d+)M$/

/**
 * A `Collet Size` cell as the series `CST` joins a collet family on.
 *
 * **Derived, not a receipt.** `CST` is the key `families/kennametal.ts` states
 * the holder-to-collet join against, so what belongs in it is the series of the
 * collet the holder takes. The vendor's own cell is carried into the CSV under
 * its own label and untouched, which is where the two normalisations below are
 * still visible.
 *
 * Two things are closed, and both exist because two spellings of one series
 * join to nothing:
 *
 * - **Spacing.** MariTool publishes `ER 11` and `ER11` within one style, and
 *   the collet side of the join spells the series without a space.
 * - **A nut designation.** `ER25M` names a mini nut, not a collet series — see
 *   {@link NUT_DESIGNATION} and this module's docstring.
 *
 * Nothing else is. A cell this leaves as neither `ER<n>` nor a nut designation
 * is written through as the vendor designated it, and {@link holderRow} warns
 * that it joins to no collet.
 */
export function colletSeries(cell: string): string {
  const closed = cell.replace(/\s+/g, '')
  return NUT_DESIGNATION.exec(closed)?.[1] ?? closed
}

/**
 * One listing row plus its spec table -> one CSV row.
 *
 * The vendor's own labels are carried verbatim and in the order the page
 * states them; what this adds in front of them is the four axes the catalog
 * asks a holder about — `taper`, `contact`, `clamping`, `style` — plus the
 * collet series and the promoted gage length.
 *
 * **No bore column.** A collet chuck grips through a collet and a shrink-fit
 * holder's bore is stated under MariTool's own `Shank Size` label; promoting
 * either to `D1` would make a collet-clamping holder claim a clamping capacity
 * of its own, which is the reason `regofix.holderRow` has no `D1` either. For
 * the same reason `Collet Grip Range` is carried verbatim and never becomes
 * `CCCN`/`CCCX`: it is the ER series' range restated on the holder's page, a
 * pure function of `Collet Size` across every part sampled, and a real one
 * comes from a collet family joined on `CST`.
 */
export function holderRow(
  leaf: LeafTarget,
  listing: ListingRow,
  specs: Readonly<Record<string, string>>,
  warn: Warn = consoleWarn,
): ScrapedRow {
  const where = `${listing.partNumber} (${listing.name})`

  const row: Record<string, string> = {
    [MATERIAL_COLUMN]: listing.partNumber,
    [STORE_ID_COLUMN]: listing.productsId,
    [DESCRIPTION_COLUMN]: listing.name,
    [TAPER_COLUMN]: '',
    [CONTACT_COLUMN]: '',
    [CLAMPING_COLUMN]: leaf.clamping,
    [STYLE_COLUMN]: leaf.style,
  }

  const stated = squash(specs[TAPER_LABEL] ?? '')
  if (stated === '') {
    // One part in the catalog, and its row is kept rather than dropped: the
    // hole is what the vendor published, and a taper inferred from the part
    // number would be this package authoring the one column it exists to read.
    warn(`  WARNING: ${where}: its spec table states no Taper — the columns are left empty`)
  } else {
    const form = TAPER_FORMS[stated.toUpperCase()]
    if (form === undefined) {
      throw new VendorResponseError(
        where,
        `Taper ${JSON.stringify(stated)} is not a spindle interface this ` +
          `package knows — add it to TAPER_FORMS once it is clear which ` +
          `machine it fits`,
      )
    }
    row[TAPER_COLUMN] = form.taper
    row[CONTACT_COLUMN] = form.contact
  }

  const size = specs[COLLET_SIZE_LABEL]
  if (size !== undefined && size !== '') {
    const series = colletSeries(size)
    row[COLLET_SERIES_COLUMN] = series
    if (!COLLET_SERIES.test(series)) {
      warn(
        `  WARNING: ${where}: Collet Size ${JSON.stringify(size)} is not a ` +
          `collet series — it is written into CST as designated and joins to ` +
          `no collet`,
      )
    }
  }

  row[GAGE_COLUMNS.inches] = ''
  row[GAGE_COLUMNS.millimeters] = ''
  const gage = specs[GAGE_LABEL]
  if (gage !== undefined && gage !== '') {
    const { value, unit } = parseGageLength(gage)
    row[GAGE_COLUMNS[unit]] = String(value)
  }

  for (const [label, value] of Object.entries(specs)) {
    // A vendor label that lands on a column built above would silently replace
    // it — a `Description` spec row would overwrite the product name, and the
    // row would still look complete. None collides today; this is what says so
    // if one starts to.
    if (Object.hasOwn(row, label)) {
      warn(
        `  WARNING: ${where}: the spec table publishes a ${JSON.stringify(label)} ` +
          `row, which is already a column this scraper builds — the vendor's ` +
          `value is dropped`,
      )
      continue
    }
    row[label] = value
  }

  row[CAD_COLUMN] = listing.assets['STP'] ?? ''
  row[CAD_DXF_COLUMN] = listing.assets['DXF'] ?? ''
  return row
}

/**
 * Every in-scope holder under `leaves`, one CSV's worth.
 *
 * One request per leaf page for the roster, then one per part for its
 * geometry, paced by the package's shared politeness delay throughout.
 *
 * **Deduped by `products_id` across leaves.** MariTool lists a handful of
 * parts under two leaves, and a part is one row however many places the store
 * files it. The first leaf to reach it wins, which is what makes the row
 * order below independent of which duplicate was found.
 */
export async function scrapeHolders(
  fetcher: Fetcher,
  leaves: readonly LeafTarget[],
  options: MaritoolOptions = {},
): Promise<ScrapeResult> {
  const { warn = consoleWarn, delayMs = REQUEST_DELAY_MS } = options
  const rows: ScrapedRow[] = []
  const seen = new Set<string>()

  for (const leaf of leaves) {
    for (const listing of await roster(fetcher, leaf.cPath, options)) {
      if (seen.has(listing.productsId)) {
        warn(
          `  DUPLICATE ${listing.partNumber}: also listed under c${leaf.cPath} — ` +
            `the first leaf it was found in is the one carried`,
        )
        continue
      }
      seen.add(listing.productsId)

      await pause(delayMs)
      const { specs, statedPartNumber } = await fetchProduct(fetcher, listing.productUrl)

      if (Object.keys(specs).length === 0) {
        warn(
          `  SKIPPED ${listing.partNumber} (${listing.name}): the vendor ` +
            `publishes no Product Specifications table, so it has no geometry`,
        )
        continue
      }
      if (statedPartNumber !== null && statedPartNumber !== listing.partNumber) {
        warn(
          `  WARNING: ${listing.partNumber}: its downloads header calls it ` +
            `${statedPartNumber} — the listing's part number is used`,
        )
      }

      rows.push(holderRow(leaf, listing, specs, warn))
    }
    await pause(delayMs)
  }

  if (rows.length === 0) {
    throw new VendorResponseError(BASE, 'the scrape produced no rows')
  }

  rows.sort((a, b) => compare(a[MATERIAL_COLUMN] ?? '', b[MATERIAL_COLUMN] ?? ''))
  return {
    header: unionHeader(rows),
    rows,
    source: categoryUrl(leaves[0]?.cPath ?? ''),
    // MariTool's cPath is its own code for a category, and a family is scraped
    // from several — so the receipt records all of them, space-separated, and
    // `source` is the request to re-issue first.
    familyCode: leaves.map((leaf) => leaf.cPath).join(' '),
  }
}
