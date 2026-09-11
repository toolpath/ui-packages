/**
 * Reading one canonical field out of a scraped row, for every vendor whose CSV
 * holds display strings rather than numbers.
 *
 * Two vendors publish a receipt of the vendor's own text — Harvey Tool and
 * EMUGE-FRANKEN — and a mapper for either one needs the same three steps
 * between a `GeometryName` and a number: ask the family's `ColumnMap` which
 * column that field is in, read the cell, and decide what an unreadable one
 * costs. Those three were a verbatim copy in both mappers, down to the wording
 * of the refusal, which is the same argument `measure.ts` makes one level down:
 * two copies of four lines is cheap and two copies of the **decision** is not.
 *
 * ## What is shared and what is not
 *
 * The vendor supplies the grammar, as a {@link LengthReader} — Harvey's
 * `dimension` reads `.250 (1/4)` and a `-` that means "does not apply", EMUGE's
 * `measureIn` reads `1 1/2 "` and refuses a range. What this module owns is
 * everything either side of that call:
 *
 * - a column the family maps to nothing is `undefined`, not an error — a family
 *   with no neck column is a plain tool, and that is the mapper's fallback to
 *   make;
 * - a **required** field with no reading refuses the row with an
 *   `errors.IncompletePartError`, naming the canonical field and quoting the
 *   cell, because a tool with no cutting diameter is not a part — and that is
 *   the one refusal `registry.toRecords` skips past rather than failing the
 *   whole family on;
 * - an **optional** one answers null and lets the mapper decide.
 *
 * `vendors/destinytool/records.ts` keeps its own `required` and is not wired
 * through here: it reads a dimension out of free text rather than out of a
 * cell, throws `RangeError` from its own parser rather than answering null, and
 * has no `optional` at all. Forcing it into this shape would change how it
 * refuses, which is the one thing `measure.ts` says is a vendor's own call.
 */

import type { UnitSystem } from './conventions.js'
import { IncompletePartError } from './errors.js'
import type { ColumnMap, GeometryName } from './records.js'
import type { MapperOptions, ScrapedRow, Warn } from './scrape.js'

/**
 * How one vendor turns its own display cell into a length in `unit`.
 *
 * The signature `vendors/harvey/value.ts`'s `dimension` and
 * `vendors/emuge/value.ts`'s `measureIn` already have.
 */
export type LengthReader = (
  display: string,
  unit: UnitSystem,
  what: string,
  warn?: Warn,
) => number | null

/** The three readers a display-string mapper needs, bound to one grammar. */
export interface ColumnReaders {
  /** One canonical field's cell, or undefined where the family maps none. */
  cell(
    row: ScrapedRow,
    columns: ColumnMap,
    canonical: GeometryName,
    unit: UnitSystem,
  ): string | undefined

  /** A dimension the kind requires, refusing a row the vendor left blank. */
  required(
    row: ScrapedRow,
    columns: ColumnMap,
    canonical: GeometryName,
    unit: UnitSystem,
    what: string,
    options: MapperOptions,
  ): number

  /** A dimension the contract does not require. Null where there is none. */
  optional(
    row: ScrapedRow,
    columns: ColumnMap,
    canonical: GeometryName,
    unit: UnitSystem,
    what: string,
    options: MapperOptions,
  ): number | null
}

/**
 * The three readers, over one vendor's `read`.
 *
 * `columns` is the caller's map and not `family.columns`. They are the same
 * object through `registry.toRecords` — but `RecordMapper` passes one as an
 * argument, `registry` validates *that* one with `checkColumnsExist`, and a
 * mapper reading a different reference is validating one map and reading
 * another.
 */
export function columnReaders(read: LengthReader): ColumnReaders {
  const cell: ColumnReaders['cell'] = (row, columns, canonical, unit) => {
    const column = columns.column(canonical, unit)
    return column === null ? undefined : row[column]
  }

  const optional: ColumnReaders['optional'] = (row, columns, canonical, unit, what, options) => {
    const raw = cell(row, columns, canonical, unit)
    return raw === undefined ? null : read(raw, unit, what, options.warn)
  }

  const required: ColumnReaders['required'] = (row, columns, canonical, unit, what, options) => {
    const raw = cell(row, columns, canonical, unit)
    const value = raw === undefined ? null : read(raw, unit, what, options.warn)
    if (value === null) {
      // `IncompletePartError` and not the general vendor fault: this is the
      // one refusal `registry.toRecords` skips past, because a single part the
      // vendor left a cell blank on must not end a family's conversion. See
      // that type for why the others still must not be skipped.
      throw new IncompletePartError(
        what,
        `publishes no ${canonical} — its cell is ${JSON.stringify(raw ?? '')}`,
      )
    }
    return value
  }

  return { cell, required, optional }
}
