/**
 * A whole SQLite database, in memory, from a schema and its rows.
 *
 * This is the top of the encoder and the only part a caller needs. It exists
 * because `@toolpath/tool-support` depends on nothing — not a SQLite binding,
 * not `node:sqlite`, not a wasm build — so a package that writes `.TOOLDB`
 * files has to put the bytes together itself. What comes back is a
 * `Uint8Array`; where it goes is the caller's, the same split the Fusion
 * exporter keeps between its document and the file.
 *
 * ## Why page 1 is spoken for first
 *
 * `sqlite_master` is a table like any other, with one difference: its root is
 * always page 1, the page whose first hundred bytes are the file header. But
 * its rows name the root pages of every *other* tree, so those have to be built
 * before its records can be written — and building them allocates pages.
 *
 * So page 1 is reserved before anything else, the user trees are built from
 * page 2 upward, and `sqlite_master` is built last onto the number already held
 * for it.
 */

import { buildIndexTree, buildTableTree, geometryFor, type Sink } from './btree.js'
import { encodeRecord } from './record.js'
import { affinityOf, compareKeys, type Affinity, type SqliteValue } from './value.js'

/** Mastercam writes 1 KiB pages, and this encoder has no reason to disagree. */
export const DEFAULT_PAGE_SIZE = 1024

/**
 * The SQLite format revision the file declares in its header.
 *
 * The field names the library version that last wrote the database. Nothing
 * here *is* that library, so what it records is the revision this encoder
 * writes to — the same one Mastercam's own files carry, chosen so a reader that
 * branches on it treats our output the way it treats theirs.
 */
const FORMAT_REVISION = 3046001

interface ColumnSpec {
  readonly name: string
  readonly type: string
}

interface IndexSpec {
  readonly name: string
  readonly columns: readonly string[]
}

export interface TableSpec {
  readonly name: string
  /** The `CREATE TABLE` text, recorded in `sqlite_master` verbatim. */
  readonly sql: string
  readonly columns: readonly ColumnSpec[]
  readonly indexes: readonly IndexSpec[]
}

/** A row as column name to value. A column left out is written as `NULL`. */
export type Row = Readonly<Record<string, SqliteValue>>

export interface EncodeRequest {
  readonly tables: readonly TableSpec[]
  readonly rows: ReadonlyMap<string, readonly Row[]>
  readonly pageSize?: number
}

const SCHEMA_AFFINITIES: readonly Affinity[] = ['TEXT', 'TEXT', 'TEXT', 'INTEGER', 'TEXT']

export const encodeDatabase = (request: EncodeRequest): Uint8Array => {
  const geometry = geometryFor(request.pageSize ?? DEFAULT_PAGE_SIZE)

  // Page 1 is the schema root. Everything else starts at 2.
  let nextPage = 2
  const sink: Sink = {
    pages: new Map<number, Uint8Array>(),
    allocate: () => {
      const page = nextPage
      nextPage += 1
      return page
    },
  }

  const known = new Set(request.tables.map((table) => table.name))
  for (const name of request.rows.keys()) {
    if (!known.has(name)) {
      throw new Error(`Rows were given for ${name}, which the schema does not define`)
    }
  }

  const schemaRows: SqliteValue[][] = []
  for (const table of request.tables) {
    const affinities = table.columns.map((column) => affinityOf(column.type))
    const rows = request.rows.get(table.name) ?? []
    const ordered = rows.map((row, index) => ({
      rowid: index + 1,
      values: table.columns.map((column) => row[column.name] ?? null),
    }))

    const root = buildTableTree(
      ordered.map((row) => ({ rowid: row.rowid, payload: encodeRecord(row.values, affinities) })),
      { geometry, sink },
    )
    schemaRows.push(['table', table.name, table.name, root, table.sql])

    for (const index of table.indexes) {
      const positions = index.columns.map((name) => {
        const at = table.columns.findIndex((column) => column.name === name)
        if (at < 0)
          throw new Error(`Index ${index.name} keys on ${name}, absent from ${table.name}`)
        return at
      })
      const keyAffinities = positions.map((at) => affinities[at] as Affinity)
      // An index entry is its key columns followed by the rowid, and it sorts
      // by exactly that — the rowid included, which is what keeps entries
      // distinct when a non-unique key repeats.
      const entries = ordered
        .map((row) => ({
          key: positions.map((at) => row.values[at] ?? null),
          rowid: row.rowid,
        }))
        .sort((left, right) => {
          const order = compareKeys(left.key, right.key)
          return order !== 0 ? order : left.rowid - right.rowid
        })
      const root = buildIndexTree(
        entries.map((entry) => ({
          payload: encodeRecord([...entry.key, entry.rowid], [...keyAffinities, 'INTEGER']),
        })),
        { geometry, sink },
      )
      schemaRows.push(['index', index.name, table.name, root, null])
    }
  }

  buildTableTree(
    schemaRows.map((values, index) => ({
      rowid: index + 1,
      payload: encodeRecord(values, SCHEMA_AFFINITIES),
    })),
    { geometry, sink, forcedRoot: 1, reserveHeaderEverywhere: true },
  )

  return assemble(sink, nextPage - 1, geometry.pageSize)
}

/** The pages in order behind a completed file header. */
const assemble = (sink: Sink, pageCount: number, pageSize: number): Uint8Array => {
  const file = new Uint8Array(pageCount * pageSize)
  for (let page = 1; page <= pageCount; page += 1) {
    const bytes = sink.pages.get(page)
    if (bytes === undefined) throw new Error(`Page ${page} was allocated but never written`)
    file.set(bytes, (page - 1) * pageSize)
  }

  const view = new DataView(file.buffer)
  file.set(new TextEncoder().encode('SQLite format 3\0'), 0)
  // 65536 does not fit in the field, and the format spells it `1`.
  view.setUint16(16, pageSize === 65536 ? 1 : pageSize, false)
  file[18] = 1 // write version: legacy rollback journal
  file[19] = 1 // read version: legacy
  file[20] = 0 // reserved bytes per page
  file[21] = 64 // maximum embedded payload fraction, fixed by the format
  file[22] = 32 // minimum embedded payload fraction, fixed by the format
  file[23] = 32 // leaf payload fraction, fixed by the format
  view.setUint32(24, 1, false) // file change counter
  view.setUint32(28, pageCount, false)
  view.setUint32(32, 0, false) // first freelist trunk page: there is no freelist
  view.setUint32(36, 0, false) // freelist page count
  view.setUint32(40, 1, false) // schema cookie
  view.setUint32(44, 4, false) // schema format number
  view.setUint32(48, 0, false) // default page cache size
  view.setUint32(52, 0, false) // largest root b-tree page: not auto-vacuum
  view.setUint32(56, 1, false) // text encoding: UTF-8
  view.setUint32(60, 0, false) // user version
  view.setUint32(64, 0, false) // incremental vacuum
  view.setUint32(68, 0, false) // application id
  file.fill(0, 72, 92) // reserved for expansion
  view.setUint32(92, 1, false) // version-valid-for, matching the change counter
  view.setUint32(96, FORMAT_REVISION, false)
  return file
}
