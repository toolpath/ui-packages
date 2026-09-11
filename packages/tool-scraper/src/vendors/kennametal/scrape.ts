/**
 * Family page -> rows, for every brand on Kennametal's AEM platform.
 *
 * Family pages render their variant table client-side, but the table comes
 * from a plain AEM GET that returns ALL variants as one HTML table — no
 * pagination, no JS, no bot-blocking. The package runbook records how the
 * endpoint was found and how to read a new brand's component node off a family
 * page.
 *
 * Column identity comes from the `<th>` class attribute (e.g.
 * `"DRL_CUT_D1_MIN metric"`), NOT the visible label — labels like `D1` repeat
 * across unit pairs and non-dimensional columns like wire size.
 *
 * ## The one dependency in this package, and why it is here
 *
 * Node ships no HTML parser, so this module declares `htmlparser2` — and
 * declares it rather than putting it in the core, on the rule that *a
 * transport that needs a parser declares it; nothing shared may pretend to
 * know how a vendor serves a table.* This module is the only importer:
 * REGO-FIX's XML is read by regex and Destiny Tool's Firestore is JSON.
 *
 * `decodeEntities` is on — these tables carry `&deg;` and `&Oslash;` in cell
 * text, and a raw `&#248;` in a description would reach the CSV as five
 * characters.
 */

import { Parser } from 'htmlparser2'

import { FAMILY_TITLE_COLUMN } from '../../conventions.js'
import { VendorResponseError } from '../../errors.js'
import type { Fetcher } from '../../fetch.js'
import { BRANDS, type AemBrandName } from '../../identity.js'
import { pause, REQUEST_DELAY_MS, type ScrapeResult, type ScrapedRow } from '../../scrape.js'
import { fetchFamily } from './family.js'
import { PRODUCT_LINE_COLUMN } from './records.js'

export const BASE =
  'https://www.{host}/us/en/products/fam/_jcr_content/root/' +
  'responsivegrid/{node}.variants.{code}.html' +
  '?query={query}&uom=metric'

/**
 * The Hybris/Solr facet string that scopes a request to a family's active
 * variants. The family code in the URL path already scopes to the family, so
 * this only drops the discontinued ones. `materials` appends a second facet to
 * it; nothing else should need to.
 */
export const ACTIVE_ONLY = ':relevance:obsoleteFacet:false'

/**
 * The class the vendor renders instead of a table when a query matches
 * nothing. Distinguishing that from a response we failed to parse is the whole
 * reason {@link parseVariantTable} looks for it.
 */
export const NO_RESULTS = 'class="no-results"'

const SKIP_CLASSES = ['collab-checkbox-header', 'sticky-column', 'marketingFirstChoice'] as const

/**
 * One parsed cell: its collapsed text, and the tag's attributes. Column
 * identity lives in those attributes, never in the text — see the note above.
 */
export type Cell = readonly [text: string, attrs: Record<string, string>]

export type Row = Cell[]

/** A constant column appended to every row — `['Thread System', 'metric']`. */
export type Tag = readonly [name: string, value: string]

/** Collects rows of `[cellText, attributes]` pairs. */
export class TableParser {
  readonly rows: Row[] = []
  private row: Row | null = null
  private cell: string | null = null
  private attrs: Record<string, string> = {}

  /** Feed a whole document. */
  feed(html: string): void {
    const parser = new Parser(
      {
        onopentag: (tag, attribs) => {
          if (tag === 'tr') {
            this.row = []
          } else if ((tag === 'td' || tag === 'th') && this.row !== null) {
            this.cell = ''
            this.attrs = { ...attribs }
          }
        },
        ontext: (text) => {
          if (this.cell !== null) this.cell += text
        },
        onclosetag: (tag) => {
          if (tag === 'tr' && this.row !== null) {
            this.rows.push(this.row)
            this.row = null
          } else if ((tag === 'td' || tag === 'th') && this.cell !== null) {
            this.row?.push([collapse(this.cell), this.attrs])
            this.cell = null
          }
        },
      },
      { decodeEntities: true },
    )
    parser.write(html)
    parser.end()
  }
}

/** `" a  b \n"` -> `"a b"`, as Python's `' '.join(s.split())` does. */
function collapse(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ')
}

/** One family's variants URL. */
export function variantsUrl(
  code: string,
  brand: AemBrandName = 'kennametal',
  query: string = ACTIVE_ONLY,
): string {
  const { host, node } = BRANDS[brand]
  return BASE.replace('{host}', host)
    .replace('{node}', node)
    .replace('{code}', code)
    .replace('{query}', encodeURIComponent(query))
}

/**
 * One family's variants response, as HTML.
 *
 * The one network call in this module, and the seam every test replaces —
 * everything below it parses a string.
 */
export async function fetchVariants(
  fetcher: Fetcher,
  code: string,
  brand: AemBrandName = 'kennametal',
  query: string = ACTIVE_ONLY,
): Promise<string> {
  return fetcher.text(variantsUrl(code, brand, query))
}

/** What {@link parseVariantTable} answers with. */
export interface VariantTable {
  /** Null when the vendor's own no-results notice came back instead. */
  header: Row | null
  rows: Row[]
}

/**
 * The header row and the data rows of a variants response.
 *
 * Both callers need the same two subtleties and neither is obvious, which is
 * why this is one function rather than two copies: the header is found by its
 * "Material Number" cell rather than by position (the response opens with
 * filter rows that are also `<tr>`s), and a data row is one exactly as long as
 * the header whose second cell is all digits. Header, filter and footer rows
 * all fail one of those two tests.
 *
 * A **matched-nothing** response has no table in it at all, only the vendor's
 * own no-results notice, and comes back with a null header. That is the
 * ordinary answer to a facet query for a group a family isn't rated for
 * (`materials`), and a hard error for a family scrape — so it is returned as a
 * state rather than thrown, and {@link scrapeFamily} is what decides it's fatal.
 *
 * A response with neither the notice nor a header is a *third* thing: the
 * endpoint changed shape. That throws, because silently reporting zero rows
 * would look exactly like the vendor discontinuing a family.
 */
export function parseVariantTable(html: string): VariantTable {
  const parser = new TableParser()
  parser.feed(html)

  const header = parser.rows.find((row) => row.some(([text]) => text === 'Material Number')) ?? null

  if (header === null) {
    if (html.includes(NO_RESULTS)) return { header: null, rows: [] }
    throw new VendorResponseError(
      'variants response',
      `has neither a Material Number header nor the vendor's ` +
        `${JSON.stringify(NO_RESULTS)} marker — the endpoint changed shape`,
    )
  }

  const rows = parser.rows.filter(
    (row) => row.length === header.length && /^\d+$/.test(row[1]?.[0] ?? ''),
  )
  return { header, rows }
}

/**
 * Build unique column names from header label + `th` class unit hints.
 *
 * A `null` entry is a column the CSV drops — the checkbox, the sticky CTA, and
 * the marketing flag. The list stays positional so it can be zipped against a
 * data row.
 */
export function columnNames(header: readonly Cell[]): (string | null)[] {
  const labelCounts = new Map<string, number>()
  for (const [text] of header) {
    labelCounts.set(text, (labelCounts.get(text) ?? 0) + 1)
  }

  const names = header.map(([text, attrs]) => {
    const cls = attrs['class'] ?? ''
    if (!text || SKIP_CLASSES.some((skip) => cls.includes(skip))) return null

    if (cls.includes('CatNo')) {
      // Catalog number columns carry unit classes but are not dimensions.
      return text
    }
    if (cls.includes('metric')) return `${text}_mm`
    if (cls.includes('inch')) return `${text}_in`

    if ((labelCounts.get(text) ?? 0) > 1) {
      // A unitless column sharing a label with a unit pair, e.g. a third `D1`
      // with data-value `[D1] Wire Size` -> `D1_wire_size`.
      const title = (attrs['data-value'] ?? '').replace(/^\[[^\]]*\]\s*/, '').trim()
      if (title && title.toLowerCase() !== text.toLowerCase()) {
        const slug = title
          .replace(/[^A-Za-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .toLowerCase()
        return `${text}_${slug}`
      }
    }
    return text
  })

  // Refused rather than allowed to collide: `scrapeFamily` writes `out[name]`,
  // so a repeated name kept the last column's data under a header the CSV
  // still printed twice — the loss the class-based identity above exists to
  // prevent.
  const seen = new Set<string>()
  for (const name of names) {
    if (name === null) continue
    if (seen.has(name)) {
      throw new VendorResponseError(
        'variants response',
        `two columns are both named ${JSON.stringify(name)} — neither a unit ` +
          `class nor a data-value title tells them apart`,
      )
    }
    seen.add(name)
  }
  return names
}

/** What {@link scrapeFamily} accepts beyond its tags. */
export interface FamilyOptions {
  /**
   * Also read the family page's own title, and tag every row with it.
   *
   * **Opt-in, and a second request.** The variants table states no product
   * line — the vendor puts it in the `h1` above the table, which is a
   * different AEM resource — so this is the one thing here that costs a
   * request the table did not. A caller that only wants dimensions should not
   * pay for it, and every existing caller keeps the transport it had.
   *
   * See `family.ts` for what the title is and which part of it becomes
   * `records.ToolRecord.productLine`.
   */
  readonly familyTitle?: boolean
  /** Milliseconds between the two requests. Zero in tests. */
  readonly delayMs?: number
}

/**
 * Scrape one family into rows.
 *
 * `tags` is a sequence of `[name, value]` pairs appended to every row as
 * constant columns — used to tag facts the table doesn't state, e.g. the
 * thread system on a tap family.
 *
 * `options.familyTitle` adds two more of exactly that kind. They are tags
 * rather than parsed columns because that is what they are: one string per
 * family, constant down its whole table, which is the case the `tags` seam was
 * built for.
 */
export async function scrapeFamily(
  fetcher: Fetcher,
  code: string,
  brand: AemBrandName = 'kennametal',
  tags: readonly Tag[] = [],
  options: FamilyOptions = {},
): Promise<ScrapeResult> {
  const url = variantsUrl(code, brand)
  const { header, rows: dataRows } = parseVariantTable(await fetcher.text(url))

  if (header === null) {
    throw new VendorResponseError(`family ${code}`, 'the vendor returned no variants')
  }

  // After the table, so a family the vendor no longer publishes fails on the
  // table it has no rows for rather than on a title nobody would have read.
  const titled: Tag[] = []
  if (options.familyTitle === true) {
    await pause(options.delayMs ?? REQUEST_DELAY_MS)
    const { title, productLine } = await fetchFamily(fetcher, code, brand)
    // A page with no heading writes no columns, rather than a column of empty
    // strings that reads as a vendor stating an empty name. `unionHeader` is
    // not in play here — this header is positional — so an absent tag is
    // simply a narrower CSV.
    if (title !== '') titled.push([FAMILY_TITLE_COLUMN, title])
    if (productLine !== null) titled.push([PRODUCT_LINE_COLUMN, productLine])
  }

  const names = columnNames(header)
  const kept = names.filter((name): name is string => name !== null)
  const allTags = [...tags, ...titled]
  const csvHeader = [...kept, ...allTags.map(([name]) => name)]

  const rows: ScrapedRow[] = dataRows.map((row) => {
    // `dataRows` is filtered to rows exactly as long as the header, and
    // `names` has one entry per header cell, so a length mismatch here means
    // the table changed shape mid-parse. Truncating silently would shift every
    // column after the gap by one.
    if (row.length !== names.length) {
      throw new VendorResponseError(
        `family ${code}`,
        `a data row has ${row.length} cells where the header has ` +
          `${names.length} — the table changed shape mid-parse`,
      )
    }

    const out: Record<string, string> = {}
    names.forEach((name, index) => {
      if (name !== null) out[name] = row[index]?.[0] ?? ''
    })
    for (const [name, value] of allTags) out[name] = value
    return out
  })

  return { header: csvHeader, rows, source: url, familyCode: code }
}
