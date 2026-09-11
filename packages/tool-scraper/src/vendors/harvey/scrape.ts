/**
 * One Harvey Tool product page -> one row per orderable part.
 *
 * The page is server-rendered HTML with its variant data inlined as a
 * JavaScript literal; `docs/HARVEY_PRODUCT_TABLE.md` records how that was found
 * and what was tried first. This module is the join between the two halves — a
 * `<thead>` in the DOM and a `tableData<N>` in a `<script>` — plus the one
 * structural thing Harvey's table does that no other vendor here does.
 *
 * ## One HTML row is up to nine orderable parts
 *
 * The table is a matrix. The `a*` cells are the geometry, shared; after them
 * comes a coating × flute grid where each coating is a `colspan`-ed header and
 * every non-empty cell under it is a different tool number at the same geometry.
 * **5,033 HTML rows become 12,799 CSV rows**, and that explosion is the whole
 * risk in this adapter: a coating or flute count read off the wrong column
 * produces a CSV that is the right length and wrong throughout.
 *
 * ## Harvey checks it for us, 5,033 times per scrape
 *
 * Every row carries an `atc` cell whose `j` is the add-to-cart payload, and that
 * payload independently lists every tool number on the row **in the same order
 * as the non-empty tool-number cells**:
 *
 * ```json
 * [{"T":"690508","C":"690508","Q":"1"},{"T":"679608","C":"679608","Q":"1"}]
 * ```
 *
 * So the explosion is checked against the vendor's own list on every row rather
 * than once against a hand count, and a grid that has shifted by one column
 * cannot pass. That check is {@link checkCartPayload}, and it is the reason the
 * declared `rows` counts in `families/harvey.ts` being seeded rather than
 * hand-counted is survivable.
 *
 * ## Two columns are synthesised, and neither has a cell to copy
 *
 * `Coating` is a fact about which *header* a tool number sits under, and
 * `FLUTES` is too on the matrix tables. Both are encoded in column position and
 * nowhere else, which is why they are built here rather than lifted, and why the
 * coating vocabulary is a closed list in `lexicon.ts`.
 *
 * `FLUTES` is one column either way — synthesised from the sub-label on a matrix
 * table and lifted from the row's own column on a `TOOL #` one — so the vendor's
 * `FLUTES` column is taken out of the geometry list rather than written twice.
 *
 * Everything else in the CSV is the vendor's own display string, verbatim —
 * `.250 (1/4)` reaches the file as `.250 (1/4)`. `value.ts` is what resolves one
 * when a record is built.
 */

import {
  CAD_COLUMN,
  CAD_DXF_COLUMN,
  DESCRIPTION_COLUMN,
  dimensionalColumn,
  type UnitSystem,
} from '../../conventions.js'
import { VendorResponseError } from '../../errors.js'
import type { Fetcher } from '../../fetch.js'
import { consoleWarn, type ScrapeResult, type ScrapedRow, type Warn } from '../../scrape.js'
import { flatHeader, isJunkLabel, type HeaderColumn } from './header.js'
import { readLiteral } from './literal.js'
import { parseValue } from './value.js'
import {
  CART_LABEL,
  FLUTES_LABEL,
  PRICE_LABEL,
  TOOL_NUMBER_LABEL,
  checkCoating,
  flutesInLabel,
  isDimensional,
} from './lexicon.js'

export const BASE = 'https://www.harveytool.com'

/** `cols1`..`cols10` and `tableData1`..`tableData10` exist on every page. */
export const MAX_TABLES = 10

/** The CSV columns this adapter synthesises or lifts from the page itself. */
export const TOOL_NUMBER_COLUMN = 'Tool #'
export const COATING_COLUMN = 'Coating'
export const FLUTES_COLUMN = 'FLUTES'
export const PRICE_COLUMN = 'PRICE_USD'

/**
 * The suffix an unlabelled annotation column takes, after the column it
 * annotates.
 *
 * Harvey gives these no header at all — see `docs/HARVEY_PRODUCT_TABLE.md` §5.3
 * — so a name has to be supplied, and naming one for what it annotates is the
 * only honest option available. Dropping them instead would lose a published
 * column; leaving them unnamed would collide with the column they follow.
 */
export const RATIO_SUFFIX = 'RATIO'

/**
 * The suffix an unlabelled column takes when it is *not* a ratio.
 *
 * Four such columns exist, on two families, and Harvey renders them in white
 * text: two carry the badge `LONG` on a handful of rows and two are entirely
 * empty. Naming them `RATIO` would be a claim about their contents that is
 * false, so which suffix a column gets is decided from the whole page's data
 * rather than from its header — see {@link ratioColumnKeys}.
 */
export const NOTE_SUFFIX = 'NOTE'

/** True where the cell carries a link, i.e. where it names a real part. */
const LINKED = /<a\b[^>]*\bhref\s*=/i

/** One cell of a `tableData<N>` row. `d` is the display HTML — the value. */
interface Cell {
  d?: string | null
  j?: string | null
}

type DataRow = Record<string, Cell | undefined>

/** One entry of `variantSimFileViewModel`. */
interface Variant {
  variantName?: string
  variantDxfFileLink?: string
  variantStepFileLink?: string
}

interface ViewModel {
  simFileViewModel?: {
    productCode?: string
    productTitle?: string
    variantSimFileViewModel?: Variant[]
  }
}

/** One geometry column: which key holds it, and what the CSV calls it. */
interface GeometryColumn {
  key: string
  /** The CSV column, unit suffix already applied where the label carries one. */
  column: string
  /** Harvey's own top label, before disambiguation. */
  label: string
}

/** One coating group: its tool-number columns, and the price they share. */
interface CoatingGroup {
  coating: string
  parts: { key: string; flutes: number | null }[]
  /** Every group on all 80 tables has exactly one, and it is last. */
  priceKey: string
}

/** One table's shape, worked out once and reused for all of its rows. */
interface TablePlan {
  geometry: GeometryColumn[]
  /** The `FLUTES` column's key, where the table publishes one. */
  flutesKey: string | null
  /** True where any group states a flute count in its own sub-label. */
  matrix: boolean
  groups: CoatingGroup[]
}

/** `<a href="...">14916</a>` -> `14916`. These cells carry no entities. */
export function cellText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** `$148.40 ` -> `148.40`. The column already says which currency. */
export function priceOf(html: string | null | undefined): string {
  return cellText(html).replace(/^\$/, '').trim()
}

/**
 * The CSV column each geometry column is written under.
 *
 * Three cases, and the second and third are the ones worth knowing:
 *
 * 1. **A label of its own** keeps it.
 * 2. **A repeated label with distinct meaningful sub-labels** takes the
 *    sub-label — `Interference Depth At Wall Angle*` is six real columns
 *    headed `0°` through `4°`, not one column and five annotations.
 * 3. **A repeated label with a junk sub-label**, or a column whose top label is
 *    junk outright, is the vendor's ratio annotation of the column before it and
 *    takes {@link RATIO_SUFFIX}.
 */
function geometryColumns(
  family: string,
  keys: string[],
  header: HeaderColumn[],
  unit: UnitSystem,
  ratioKeys: ReadonlySet<string>,
  warn: Warn,
): GeometryColumn[] {
  const positions = keys
    .map((key, index) => ({ key, head: header[index]! }))
    .filter(({ key, head }) => key !== 'atc' && /^a\d+$/.test(key) && head.top !== CART_LABEL)
    // The flute count leaves the geometry list and comes back as one
    // synthesised `FLUTES` column, because half these tables state it in a
    // column and half in a coating group's sub-label. Keeping both would put
    // two columns called `FLUTES` in one CSV.
    .filter(({ head }) => head.top !== FLUTES_LABEL)

  const byLabel = new Map<string, HeaderColumn[]>()
  for (const { head } of positions) {
    if (isJunkLabel(head.top)) continue
    byLabel.set(head.top, [...(byLabel.get(head.top) ?? []), head])
  }

  /** True where every occurrence of this label has its own real sub-label. */
  const subLabelled = new Map<string, boolean>()
  for (const [label, heads] of byLabel) {
    const subs = heads.map((h) => h.sub ?? '')
    subLabelled.set(
      label,
      heads.length > 1 && subs.every((s) => !isJunkLabel(s)) && new Set(subs).size === subs.length,
    )
  }

  const columns: GeometryColumn[] = []
  const seen = new Set<string>()

  for (const { key, head } of positions) {
    let label: string
    let dimensional: boolean

    if (isJunkLabel(head.top)) {
      const previous = columns[columns.length - 1]
      if (previous === undefined) {
        throw new VendorResponseError(
          family,
          `opens with an unlabelled column (${key}) — there is nothing for it to annotate`,
        )
      }
      label = `${previous.label} ${ratioKeys.has(key) ? RATIO_SUFFIX : NOTE_SUFFIX}`
      dimensional = false
      warn(
        `  WARNING: ${family}: column ${key} has no header of its own; ` +
          `written as ${JSON.stringify(label)}`,
      )
    } else if (subLabelled.get(head.top) === true) {
      label = `${head.top} ${head.sub}`
      dimensional = isDimensional(family, head.top)
    } else if (seen.has(head.top)) {
      label = `${head.top} ${RATIO_SUFFIX}`
      dimensional = false
    } else {
      label = head.top
      dimensional = isDimensional(family, head.top)
    }

    seen.add(head.top)
    const column = dimensional ? dimensionalColumn(label, unit) : label
    if (columns.some((c) => c.column === column)) {
      throw new VendorResponseError(
        family,
        `has two columns both written as ${JSON.stringify(column)} — the ` +
          `header no longer tells them apart`,
      )
    }
    columns.push({ key, column, label })
  }

  return columns
}

/**
 * The coating groups of one table, with each part column's flute count.
 *
 * A group runs from its first tool-number column to its price column. Every
 * group on all 80 tables has exactly one price and it comes last, so a group
 * that reaches its end without one is refused rather than given a blank price:
 * the grid would have shifted, and every part in it would be reading a
 * neighbour's cell.
 */
function coatingGroups(
  family: string,
  keys: string[],
  header: HeaderColumn[],
  warn: Warn,
): CoatingGroup[] {
  const groups: CoatingGroup[] = []
  let coating: string | null = null
  let parts: { key: string; flutes: number | null }[] = []

  for (const [index, key] of keys.entries()) {
    const head = header[index]!
    const sub = head.sub ?? ''

    if (/^s\d+$/.test(key)) {
      if (coating === null) {
        coating = checkCoating(family, head.top)
        parts = []
      } else if (coating !== head.top) {
        throw new VendorResponseError(
          family,
          `starts coating group ${JSON.stringify(head.top)} before ` +
            `${JSON.stringify(coating)} has a ${PRICE_LABEL} column`,
        )
      }
      parts.push({ key, flutes: sub === TOOL_NUMBER_LABEL ? null : flutesInLabel(sub) })
      continue
    }

    if (/^p\d+$/.test(key)) {
      if (coating === null) {
        throw new VendorResponseError(family, `has a price column (${key}) under no coating group`)
      }
      if (sub !== PRICE_LABEL) {
        throw new VendorResponseError(
          family,
          `has a price column (${key}) sub-headed ${JSON.stringify(sub)} rather ` +
            `than ${JSON.stringify(PRICE_LABEL)}`,
        )
      }
      groups.push({ coating, parts, priceKey: key })
      coating = null
    }
  }

  if (coating !== null) {
    throw new VendorResponseError(
      family,
      `leaves coating group ${JSON.stringify(coating)} without a price column`,
    )
  }

  return fillBlankFluteLabels(family, groups, warn)
}

/**
 * Fill a flute sub-label Harvey rendered as `&nbsp;` from a sibling group.
 *
 * Two tables in the catalog do this — `EndMill-008` table 2 and `EndMill-018`
 * table 2 — and in both the neighbouring coating groups label the same slot
 * correctly. A sibling qualifies only when it is the same width *and* agrees on
 * every other slot, so the fill is a copy of a row that is demonstrably the same
 * shape rather than of whichever group happened to be nearby. Two siblings that
 * disagree is a hard failure: there is no way to pick, and picking would put a
 * flute count on a real part on no evidence.
 */
function fillBlankFluteLabels(family: string, groups: CoatingGroup[], warn: Warn): CoatingGroup[] {
  return groups.map((group) => {
    // All stated is the matrix pattern with nothing missing; none stated is the
    // `TOOL #` pattern, where the row's own FLUTES column is the source and a
    // null here is not a gap. Only a mixture is a blank label to fill.
    const stated = group.parts.filter((p) => p.flutes !== null).length
    if (stated === 0 || stated === group.parts.length) return group

    const parts = group.parts.map((part, slot) => {
      if (part.flutes !== null) return part

      const candidates = new Set<number>()
      for (const other of groups) {
        if (other === group || other.parts.length !== group.parts.length) continue
        const agrees = group.parts.every(
          (p, i) => i === slot || p.flutes === null || p.flutes === other.parts[i]?.flutes,
        )
        const found = other.parts[slot]?.flutes
        if (agrees && found != null) candidates.add(found)
      }

      if (candidates.size !== 1) {
        throw new VendorResponseError(
          family,
          `has a blank flute label in the ${JSON.stringify(group.coating)} group ` +
            `at slot ${slot}, and ${candidates.size === 0 ? 'no' : 'more than one'} ` +
            `sibling group of the same shape states one`,
        )
      }

      const flutes = [...candidates][0]!
      warn(
        `  WARNING: ${family}: the ${JSON.stringify(group.coating)} group's flute ` +
          `label at slot ${slot} is blank; read as ${flutes} from a sibling group`,
      )
      return { ...part, flutes }
    })

    return { ...group, parts }
  })
}

/** Read one table's plan off its `cols<N>` keys and its flattened header. */
export function planTable(
  family: string,
  keys: string[],
  header: HeaderColumn[],
  unit: UnitSystem,
  options: { warn?: Warn; ratioKeys?: ReadonlySet<string> } = {},
): TablePlan {
  const { warn = consoleWarn, ratioKeys = new Set<string>() } = options
  if (keys.length !== header.length) {
    throw new VendorResponseError(
      family,
      `declares ${keys.length} data columns but its header flattens to ` +
        `${header.length} — the two are positional and no longer line up`,
    )
  }

  const geometry = geometryColumns(family, keys, header, unit, ratioKeys, warn)
  const groups = coatingGroups(family, keys, header, warn)
  if (groups.length === 0) {
    throw new VendorResponseError(family, 'publishes no coating group — there are no parts to read')
  }

  const flutesIndex = keys.findIndex(
    (key, i) => /^a\d+$/.test(key) && header[i]!.top === FLUTES_LABEL,
  )

  return {
    geometry,
    flutesKey: flutesIndex === -1 ? null : keys[flutesIndex]!,
    matrix: groups.some((g) => g.parts.some((p) => p.flutes !== null)),
    groups,
  }
}

/** One entry of a row's add-to-cart payload. */
export interface CartEntry {
  /** The part number with no footnote marker — what the CSV records. */
  number: string
  /** The same string as printed in the cell, footnote marker and all. */
  printed: string
}

/**
 * Every part the row's own add-to-cart payload lists, in cell order.
 *
 * `T` and `C` differ on the 36 parts whose printed number carries a footnote
 * marker: `C` keeps it, `T` does not. Both are read, and each does a different
 * job — `C` is what the cell says and is therefore what the cell can be checked
 * against, `T` is Harvey's own clean part number and is therefore what the CSV
 * records. Deriving the second from the first with a regex would work today and
 * be this package's guess rather than the vendor's statement.
 *
 * `Q` is `"1"` on all 12,799 entries and is not read.
 */
export function cartEntries(family: string, row: DataRow): CartEntry[] {
  const payload = row['atc']?.j
  if (typeof payload !== 'string' || payload === '') {
    throw new VendorResponseError(family, 'has a row with no add-to-cart payload to check against')
  }
  let parsed: { T?: string; C?: string }[]
  try {
    parsed = JSON.parse(payload) as { T?: string; C?: string }[]
  } catch (error) {
    throw new VendorResponseError(
      family,
      `has an unreadable add-to-cart payload: ${(error as Error).message}`,
    )
  }
  return parsed.map((entry) => ({ number: entry.T ?? '', printed: entry.C ?? entry.T ?? '' }))
}

/** Refuse an explosion the vendor's own payload does not agree with. */
export function checkCartPayload(family: string, printed: string[], cart: CartEntry[]): void {
  if (printed.length === cart.length && printed.every((t, i) => t === cart[i]!.printed)) return
  throw new VendorResponseError(
    family,
    `read [${printed.join(', ')}] off a row whose own add-to-cart payload ` +
      `lists [${cart.map((entry) => entry.printed).join(', ')}] — the coating ` +
      `grid has shifted`,
  )
}

/**
 * The unlabelled columns of a page whose cells are all ratio annotations.
 *
 * Decided across the whole page rather than per table, because the tables merge
 * into one CSV and a column cannot be named two things. `EndMill-006` is why: a
 * column is `LONG` on four rows of its first table and empty throughout its
 * second.
 */
export function ratioColumnKeys(
  tables: { keys: string[]; rows: DataRow[]; header: HeaderColumn[] }[],
): Set<string> {
  const unlabelled = new Set<string>()
  const other = new Set<string>()

  for (const table of tables) {
    table.keys.forEach((key, index) => {
      const head = table.header[index]
      if (head === undefined || !/^a\d+$/.test(key) || !isJunkLabel(head.top)) return
      unlabelled.add(key)
      for (const row of table.rows) {
        const text = cellText(row[key]?.d)
        if (text !== '' && parseValue(text).ratio === null) other.add(key)
      }
    })
  }

  for (const key of other) unlabelled.delete(key)
  return unlabelled
}

/** One page's parsed contents, before any rows are built. */
interface Page {
  productCode: string
  productTitle: string
  cad: Map<string, Variant>
  tables: { keys: string[]; rows: DataRow[]; header: HeaderColumn[] }[]
}

function readPage(html: string, what: string): Page {
  const model = readLiteral<ViewModel>(html, 'viewModel')?.simFileViewModel
  const productCode = model?.productCode
  if (!productCode) {
    throw new VendorResponseError(what, 'has no viewModel.simFileViewModel.productCode')
  }

  const cad = new Map<string, Variant>()
  for (const variant of model.variantSimFileViewModel ?? []) {
    if (variant.variantName) cad.set(variant.variantName, variant)
  }

  // Table ids drop the `HT-` the product code carries: `HT-Harvey-EndMill-008`
  // heads a table with `id="Harvey-EndMill-008_1"`.
  const prefix = productCode.replace(/^HT-/, '')
  const tables: Page['tables'] = []

  for (let n = 1; n <= MAX_TABLES; n++) {
    const keys = (readLiteral<{ data?: string }[]>(html, `cols${n}`) ?? [])
      .map((column) => column.data ?? '')
      .filter(Boolean)
    if (keys.length === 0) continue

    const rows = readLiteral<DataRow[]>(html, `tableData${n}`) ?? []
    tables.push({ keys, rows, header: flatHeader(html, `${prefix}_${n}`) })
  }

  if (tables.length === 0) {
    throw new VendorResponseError(what, 'declares no populated table — the page changed shape')
  }

  return { productCode, productTitle: model.productTitle ?? '', cad, tables }
}

/** Options a page scrape accepts. */
export interface ScrapeOptions {
  /** The unit system the family is published in. Decides every `_mm`/`_in`. */
  unit: UnitSystem
  warn?: Warn
}

/**
 * One product page's HTML -> one row per orderable part.
 *
 * Pure, and separate from {@link scrapeProduct} so the whole matrix explosion is
 * testable from a fixture string with no fetcher anywhere near it.
 *
 * A page's tables differ only in published tolerance — which is dropped — so
 * they merge into one CSV. Their column labels are required to agree, because
 * two tables that no longer publish the same columns is a page that has been
 * restructured, and merging them would interleave two different geometries under
 * one header.
 */
export function parseProductPage(
  html: string,
  source: string,
  options: ScrapeOptions,
): ScrapeResult {
  const { unit, warn = consoleWarn } = options
  const page = readPage(html, source)
  const family = page.productCode

  const ratioKeys = ratioColumnKeys(page.tables)
  const plans = page.tables.map((table) =>
    planTable(family, table.keys, table.header, unit, { warn, ratioKeys }),
  )
  const geometry = plans[0]!.geometry.map((column) => column.column)
  for (const plan of plans.slice(1)) {
    const other = plan.geometry.map((column) => column.column)
    if (other.length !== geometry.length || other.some((c, i) => c !== geometry[i])) {
      throw new VendorResponseError(
        family,
        `publishes [${geometry.join(', ')}] on one table and [${other.join(', ')}] ` +
          `on another — the page's tables no longer share a header`,
      )
    }
  }

  const flutes = plans.some((plan) => plan.matrix || plan.flutesKey !== null)
  const header = [
    TOOL_NUMBER_COLUMN,
    DESCRIPTION_COLUMN,
    COATING_COLUMN,
    ...(flutes ? [FLUTES_COLUMN] : []),
    ...geometry,
    PRICE_COLUMN,
    CAD_COLUMN,
    CAD_DXF_COLUMN,
  ]

  const rows: ScrapedRow[] = []

  page.tables.forEach((table, index) => {
    const plan = plans[index]!

    for (const source_ of table.rows) {
      const shared: Record<string, string> = {}
      for (const column of plan.geometry) {
        shared[column.column] = cellText(source_[column.key]?.d)
      }
      const rowFlutes = plan.flutesKey === null ? '' : cellText(source_[plan.flutesKey]?.d)

      // Two lists, and the split is the point. `printed` is every non-empty
      // tool-number cell, in order, and is what the row's own add-to-cart
      // payload is checked against. `parts` is the subset that is a real part.
      const printed: string[] = []
      const parts: { slot: number; coating: string; price: string; flutes: string }[] = []

      for (const group of plan.groups) {
        const price = priceOf(source_[group.priceKey]?.d)

        for (const part of group.parts) {
          const cell = source_[part.key]?.d ?? ''
          const text = cellText(cell)
          if (text === '') continue

          const slot = printed.length
          printed.push(text)
          if (!LINKED.test(cell)) {
            // 26 cells across two families carry the marketing string
            // `25x Diameter!` in a tool-number column, rendered in red, with no
            // link and no CAD model — and Harvey's own cart payload lists them
            // as though they were orderable. The link is the structural
            // difference; a rule that matched the text would miss the next one.
            warn(
              `  WARNING: ${family}: the ${JSON.stringify(group.coating)} column ` +
                `holds ${JSON.stringify(text)} with no product link — not a part`,
            )
            continue
          }

          // The sub-label is per part and the FLUTES column is per row, so the
          // sub-label wins where both exist. They agree on all four tables that
          // publish both; a disagreement is Harvey having changed one of them.
          const stated = part.flutes === null ? null : String(part.flutes)
          if (stated !== null && rowFlutes !== '' && stated !== rowFlutes) {
            warn(
              `  WARNING: ${family}: ${text} sits under a ${stated}-flute header ` +
                `on a row whose FLUTES column says ${rowFlutes}`,
            )
          }

          parts.push({ slot, coating: group.coating, price, flutes: stated ?? rowFlutes })
        }
      }

      const cart = cartEntries(family, source_)
      checkCartPayload(family, printed, cart)

      for (const part of parts) {
        const toolNumber = cart[part.slot]!.number
        const variant = page.cad.get(toolNumber)
        rows.push({
          ...shared,
          [TOOL_NUMBER_COLUMN]: toolNumber,
          [DESCRIPTION_COLUMN]: page.productTitle,
          [COATING_COLUMN]: part.coating,
          ...(flutes ? { [FLUTES_COLUMN]: part.flutes } : {}),
          [PRICE_COLUMN]: part.price,
          [CAD_COLUMN]: variant?.variantStepFileLink ?? '',
          [CAD_DXF_COLUMN]: variant?.variantDxfFileLink ?? '',
        })
      }
    }
  })

  return { header, rows, source, familyCode: page.productCode }
}

/** One product page's URL. */
export function productUrl(path: string): string {
  return BASE + path
}

/**
 * Scrape one product page.
 *
 * The one network call in this module, and the seam every test replaces —
 * everything below it parses a string.
 */
export async function scrapeProduct(
  fetcher: Fetcher,
  path: string,
  options: ScrapeOptions,
): Promise<ScrapeResult> {
  const url = productUrl(path)
  return parseProductPage(await fetcher.text(url), url, options)
}
