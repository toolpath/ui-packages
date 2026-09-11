/**
 * CSV, to the letter of what Python's `csv` module writes.
 *
 * Node has no CSV in its standard library and this package needs about sixty
 * lines of one, so it is here rather than a dependency — the same call
 * `uuid5.ts` makes, and for the same reason: a dependency whose whole surface
 * is two functions is a supply chain for no gain.
 *
 * **Byte-compatible with the Python this replaces, deliberately.** Scraped
 * CSVs already exist on the machines that keep a corpus, and a re-scrape has
 * to produce the same file or every diff is noise. That means three details
 * that are not the obvious defaults:
 *
 * 1. **`\r\n` line endings.** Python's `csv.writer` uses them regardless of
 *    platform; `open(path, 'w', newline='')` is what stops the runtime
 *    translating them, not a choice to emit `\n`.
 * 2. **Minimal quoting.** A field is quoted only when it contains a comma, a
 *    quote or a newline — `QUOTE_MINIMAL`, Python's default.
 * 3. **Doubled quotes**, not backslash escapes.
 *
 * The reader accepts either line ending, because a CSV that has been through
 * an editor is still a CSV.
 */

import type { ScrapedRow } from '../scrape.js'

const NEEDS_QUOTING = /[",\r\n]/

/** One field, quoted only if it has to be. */
function field(value: string): string {
  return NEEDS_QUOTING.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * Rows to CSV text, in `header` order.
 *
 * A row missing one of the header's columns writes an empty cell rather than
 * failing: a mixed-unit collet family has `D1_mm` on its metric rows and
 * `D1_in` on its inch ones, and both columns are in the union header.
 */
export function toCsv(header: readonly string[], rows: readonly ScrapedRow[]): string {
  const lines = [header.map(field).join(',')]
  for (const row of rows) {
    lines.push(header.map((column) => field(row[column] ?? '')).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}

/** What {@link parseCsv} answers with. */
export interface ParsedCsv {
  header: string[]
  rows: ScrapedRow[]
}

/**
 * CSV text back into a header and rows.
 *
 * A row longer than the header keeps its extra cells under no name, and a
 * shorter one leaves the missing columns empty — the same shape Python's
 * `DictReader` produces, and the reason neither is an error is that these
 * files are re-read by the annotate steps, which have to be able to say what
 * changed rather than refuse the file.
 */
export function parseCsv(text: string): ParsedCsv {
  const records = parseRecords(text)
  const header = records.shift() ?? []
  const rows = records.map((cells) => {
    const row: Record<string, string> = {}
    header.forEach((column, index) => {
      row[column] = cells[index] ?? ''
    })
    return row
  })
  return { header, rows }
}

/** The raw grid, before a header is applied. */
function parseRecords(text: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let quoted = false
  let started = false

  const endCell = () => {
    record.push(cell)
    cell = ''
  }
  const endRecord = () => {
    endCell()
    records.push(record)
    record = []
    started = false
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"' && cell === '') {
      quoted = true
      started = true
    } else if (char === ',') {
      endCell()
      started = true
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      // A blank line between records is not a record. Python's reader skips
      // it, and a trailing newline would otherwise add a row of one empty cell
      // to every file this package writes.
      if (started || cell !== '' || record.length > 0) endRecord()
    } else {
      cell += char
      started = true
    }
  }

  if (started || cell !== '' || record.length > 0) endRecord()
  return records
}
