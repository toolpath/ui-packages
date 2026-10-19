/**
 * Somewhere to put rows while a library is being built.
 *
 * A `.TOOLDB` spreads one tool over eight tables and one holder over three, so
 * an exporter that returned a shape per module would spend most of its lines
 * merging them. This is the shared accumulator instead: modules add rows under
 * a table name and `library.ts` hands the whole thing to the encoder.
 */

import type { Row } from './sqlite/index.js'

export interface RowSet {
  add(table: string, row: Row): void
  /**
   * Add a row the first time this key is seen, and ignore it after.
   *
   * For the rows several tools share. A vendor is the one that matters: ten
   * tools from one brand name one `TlManufacturer` row between them, and
   * writing it ten times would put ten identical rows under ten different
   * keys — which the primary key permits and Mastercam would show as ten
   * brands with the same name.
   */
  addOnce(table: string, key: string, row: Row): void
  /** The rows, in the order they were added, as the encoder wants them. */
  readonly tables: ReadonlyMap<string, readonly Row[]>
}

export const rowSet = (): RowSet => {
  const tables = new Map<string, Row[]>()
  const seen = new Set<string>()
  const set: RowSet = {
    add(table, row) {
      const rows = tables.get(table)
      if (rows === undefined) tables.set(table, [row])
      else rows.push(row)
    },
    addOnce(table, key, row) {
      const at = `${table}\u0000${key}`
      if (seen.has(at)) return
      seen.add(at)
      set.add(table, row)
    },
    tables,
  }
  return set
}
