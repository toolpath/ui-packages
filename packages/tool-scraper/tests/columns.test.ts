/**
 * The three column readers both display-string mappers share.
 *
 * `vendors/harvey/records.ts` and `vendors/emuge/records.ts` each held a copy
 * until 2026-09-01, down to the wording of the refusal. What is pinned here is
 * the part that is not a vendor's: which cell a canonical field reads, what an
 * unmapped column answers, and which of the two kinds of missing value refuses
 * a row. The grammar itself is `measure.test.ts`'s and each vendor's own.
 */

import { describe, expect, it } from 'vitest'

import { columnReaders } from '../src/columns.js'
import { VendorResponseError } from '../src/errors.js'
import { checkColumnMap } from '../src/records.js'
import type { ScrapedRow } from '../src/scrape.js'

/**
 * A stand-in for a vendor's reader: every cell is a plain number, and `-` is a
 * cell with no reading — the shape Harvey's `-` and EMUGE's tolerance text both
 * arrive in.
 */
const read = (display: string): number | null => {
  const value = Number(display)
  return display.trim() === '' || Number.isNaN(value) ? null : value
}

const { cell, required, optional } = columnReaders(read)

/**
 * A tap's map, because `TP` is the one canonical field
 * `records.DIMENSIONAL_COLUMNS` excludes from unit pairing — so this covers a
 * column read by its bare label beside four read with a suffix.
 */
const COLUMNS = checkColumnMap('test.csv', 'tap', {
  DC: 'CUTTER DIA.',
  TP: 'PITCH',
  SFDM: 'SHANK',
  OAL: 'OAL',
  LCF: 'LOC',
})

const ROW: ScrapedRow = { 'CUTTER DIA._in': '0.25', OAL_in: '-', PITCH: '0.05' }

describe('a cell', () => {
  it('is read from the column the family maps that field to', () => {
    expect(cell(ROW, COLUMNS, 'DC', 'inches')).toBe('0.25')
  })

  it('is read by its bare label where the field takes no unit suffix', () => {
    expect(cell(ROW, COLUMNS, 'TP', 'inches')).toBe('0.05')
  })

  it('is undefined where the family maps the field to no column', () => {
    // Not an error: a family with no neck column is a plain tool, and what that
    // falls back to is the mapper's call rather than this module's.
    expect(cell(ROW, COLUMNS, 'SIG', 'inches')).toBeUndefined()
  })

  it('is undefined where the map names a column the row does not carry', () => {
    expect(cell(ROW, COLUMNS, 'DC', 'millimeters')).toBeUndefined()
  })
})

describe('a required dimension', () => {
  it('is the number the vendor’s reader got out of the cell', () => {
    expect(required(ROW, COLUMNS, 'DC', 'inches', 'W1', {})).toBe(0.25)
  })

  it('refuses the row where the cell has no reading, quoting it', () => {
    // A tool with no cutting diameter is not a part, and the refusal names both
    // the canonical field and what the cell really said.
    expect(() => required(ROW, COLUMNS, 'OAL', 'inches', 'W1', {})).toThrow(VendorResponseError)
    expect(() => required(ROW, COLUMNS, 'OAL', 'inches', 'W1', {})).toThrow(/OAL.*"-"/)
  })

  it('refuses the row where the family maps the field to no column', () => {
    expect(() => required(ROW, COLUMNS, 'SIG', 'inches', 'W1', {})).toThrow(/SIG.*""/)
  })
})

describe('an optional dimension', () => {
  it('is the number where there is one', () => {
    expect(optional(ROW, COLUMNS, 'DC', 'inches', 'W1', {})).toBe(0.25)
  })

  it('is null for an unmapped column and for an unreadable cell alike', () => {
    // Both mean "no number here", and 0 is not a substitute for one. Which of
    // the two a blank is — not published, or does not apply — is a difference
    // to a reader of the catalog and not to anything building a record.
    expect(optional(ROW, COLUMNS, 'SIG', 'inches', 'W1', {})).toBeNull()
    expect(optional(ROW, COLUMNS, 'OAL', 'inches', 'W1', {})).toBeNull()
  })
})

describe('the warn a mapper passes', () => {
  it('reaches the vendor’s reader', () => {
    // The reader is where a converted unit and a refused angle are warned
    // about, so a mapper's `warn` has to arrive there rather than stop here.
    const said: string[] = []
    const readers = columnReaders((display, _unit, what, warn) => {
      warn?.(`saw ${display} for ${what}`)
      return 1
    })

    readers.optional(ROW, COLUMNS, 'DC', 'inches', 'W1', { warn: (m) => said.push(m) })

    expect(said).toEqual(['saw 0.25 for W1'])
  })
})
