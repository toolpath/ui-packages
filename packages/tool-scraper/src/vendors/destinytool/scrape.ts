/**
 * Destiny Tool's Firestore REST API -> End Mill rows.
 *
 * Not a page to parse: destinytool.com is a Next.js SPA built on Firebase
 * Studio with no product data anywhere in its HTML. Every product lives in one
 * Firestore collection, `products`, in project `studio-6030841929-4a1a2`, and
 * the only transport is Firestore's own REST document API — unauthenticated
 * reads against it work today (confirmed 2026-08-19):
 *
 * ```
 * GET https://firestore.googleapis.com/v1/projects/{project}/databases/
 *     (default)/documents/products
 *     ?pageSize=300&pageToken=<token>&mask.fieldPaths=<field>&...
 * ```
 *
 * `documents.list` supports no server-side filter — that needs the separate
 * `:runQuery` structured-query endpoint instead — so this pages through the
 * **whole** collection (4,309 documents as of 2026-08-19) and narrows to
 * `type == 'End Mill'` after decoding. `pageToken` is opaque and
 * random-looking; nothing about pagination here assumes an order, so a page
 * with a token but zero documents still stops the walk rather than looping.
 *
 * ## Column naming, and where it differs from every other vendor here
 *
 * Firestore field names carry no unit suffix — `cutDia`, not `cutDia_in` — so
 * the four dimensional fields (`cutDia`, `loc`, `oal`, `rad`) are written
 * **with** an `_in` suffix appended here, to fit `conventions.UNIT_SUFFIX` —
 * the rule every other family's CSV already follows (`D1_mm`/`D1_in` on a
 * Kennametal table). There is no `_mm` half to publish — Destiny Tool states
 * every dimension in US customary fractional inches, see the `unit` fact on
 * `families/destinytool` — so only the `_in` column exists.
 *
 * **This vendor is also the one that broke the identity convention**, and the
 * break is visible in the header this module writes: `itemNumber` where every
 * other CSV says `Material Number`. It is recorded in
 * `conventions.IDENTITY_DEVIATIONS` rather than corrected, because the CSV is
 * the receipt, and relabelling a vendor's own field in it would put a lie in
 * the file whose job is to record what the vendor published.
 *
 * Every other field here keeps its Firestore name verbatim — no relabelling
 * step, because the field *is* the vendor's own label.
 */

import { VendorResponseError } from '../../errors.js'
import type { Fetcher } from '../../fetch.js'
import { compare } from '../../order.js'
import type { ScrapeResult, ScrapedRow } from '../../scrape.js'

export const PROJECT = 'studio-6030841929-4a1a2'

export const DOCUMENTS_URL =
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/` +
  `(default)/documents/products`

/**
 * Fields pulled from the `products` collection — everything `records.ts`
 * reads, plus `series` and `angle` for the record (unused today, but the CSV
 * is the receipt of what the vendor published, same as REGO-FIX's unmapped
 * `DIN_*` columns).
 */
export const FIELDS = [
  'itemNumber',
  'type',
  'description',
  'series',
  'cutDia',
  'loc',
  'oal',
  'rad',
  'flutes',
  'endStyle',
  'angle',
  'material',
  'isoMaterialGroups',
  'coatingId',
] as const

/**
 * The dimensional subset of {@link FIELDS} — see the module docstring for why
 * these get an `_in` suffix and the rest do not.
 */
export const DIMENSIONAL_FIELDS: ReadonlySet<string> = new Set(['cutDia', 'loc', 'oal', 'rad'])

export const PAGE_SIZE = 300

/** The tool type this scrape narrows to. */
const END_MILL = 'End Mill'

/** A decoded Firestore field value. */
export type FirestoreValue = string | number | boolean | null | FirestoreValue[]

/** The shape `documents.list` answers with. */
interface DocumentsPage {
  documents?: { fields?: Record<string, Record<string, unknown>> }[]
  nextPageToken?: string
}

/** The CSV column a Firestore field is written under. */
export function columnFor(field: string): string {
  return DIMENSIONAL_FIELDS.has(field) ? `${field}_in` : field
}

/** The CSV header this scrape writes, positional. */
export const HEADER: readonly string[] = FIELDS.map(columnFor)

/** The `documents.list` URL for one page. */
export function pageUrl(token: string | null): string {
  const params = new URLSearchParams()
  params.set('pageSize', String(PAGE_SIZE))
  for (const field of FIELDS) params.append('mask.fieldPaths', field)
  if (token) params.append('pageToken', token)
  return `${DOCUMENTS_URL}?${params.toString()}`
}

/**
 * One Firestore `Value` -> a plain value.
 *
 * The REST API wraps every field in a type tag (`{"stringValue": "..."}`,
 * `{"arrayValue": {"values": [...]}}`) so that a document can be typed without
 * a schema; nothing downstream of this function should have to know that shape.
 */
export function decodeValue(value: Record<string, unknown>): FirestoreValue {
  if ('stringValue' in value) return value['stringValue'] as string
  if ('integerValue' in value) {
    return Number.parseInt(value['integerValue'] as string, 10)
  }
  if ('doubleValue' in value) return value['doubleValue'] as number
  if ('booleanValue' in value) return value['booleanValue'] as boolean
  if ('nullValue' in value) return null
  if ('arrayValue' in value) {
    const array = value['arrayValue'] as {
      values?: Record<string, unknown>[]
    }
    return (array.values ?? []).map(decodeValue)
  }
  throw new VendorResponseError(
    DOCUMENTS_URL,
    `unrecognized Firestore value shape: ${Object.keys(value).sort().join(', ')}`,
  )
}

/** One `documents.list` entry -> its fields, decoded and flattened. */
export function decodeDocument(document: {
  fields?: Record<string, Record<string, unknown>>
}): Record<string, FirestoreValue> {
  const decoded: Record<string, FirestoreValue> = {}
  for (const [key, value] of Object.entries(document.fields ?? {})) {
    decoded[key] = decodeValue(value)
  }
  return decoded
}

/**
 * Every document in the `products` collection, decoded, unfiltered.
 *
 * One request per {@link PAGE_SIZE} documents. `documents.list` returns rows in
 * document-ID order, and Firestore auto-IDs are random, so nothing about
 * pagination here can be an artifact of insertion order.
 */
export async function fetchProducts(fetcher: Fetcher): Promise<Record<string, FirestoreValue>[]> {
  const documents: Record<string, FirestoreValue>[] = []
  let token: string | null = null

  for (;;) {
    const page: DocumentsPage = await fetcher.json<DocumentsPage>(pageUrl(token))
    const docs = page.documents ?? []
    documents.push(...docs.map(decodeDocument))
    token = page.nextPageToken ?? null
    if (!token || docs.length === 0) break
  }

  return documents
}

/**
 * A decoded Firestore value as a CSV cell.
 *
 * `isoMaterialGroups` is the one array field here; it is written
 * space-separated, which is the multi-value convention every vendor's CSV
 * follows (`Material Groups` on a Kennametal table) — `records.ts` reads it
 * back by splitting on whitespace.
 */
export function csvCell(value: FirestoreValue | undefined): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map((v) => String(v)).join(' ')
  return String(value)
}

/** One decoded product as a row under this scrape's own column labels. */
export function toRow(product: Record<string, FirestoreValue>): ScrapedRow {
  const row: Record<string, string> = {}
  for (const field of FIELDS) row[columnFor(field)] = csvCell(product[field])
  return row
}

/**
 * Every `End Mill` row, sorted by item number.
 *
 * Filtering to `type == 'End Mill'` happens here rather than server-side —
 * `documents.list` has no filter parameter — so the whole collection is
 * fetched and narrowed after decoding. A collection with zero matching rows is
 * refused rather than returned empty: it is the difference between "the vendor
 * published nothing" and "this broke."
 */
export async function scrapeEndMills(fetcher: Fetcher): Promise<ScrapeResult> {
  const products = await fetchProducts(fetcher)
  const matching = products.filter((p) => p['type'] === END_MILL)

  if (matching.length === 0) {
    throw new VendorResponseError(
      DOCUMENTS_URL,
      `no End Mill rows among ${products.length} products — the schema or ` +
        `the type label changed`,
    )
  }

  matching.sort((a, b) => compare(String(a['itemNumber']), String(b['itemNumber'])))

  return {
    header: HEADER,
    rows: matching.map(toRow),
    source: DOCUMENTS_URL,
    familyCode: null,
  }
}
