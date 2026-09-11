/**
 * CSV, against what Python's `csv` module actually writes.
 *
 * The three details that are not the obvious JavaScript defaults — CRLF,
 * minimal quoting, doubled quotes — are the whole reason this module exists
 * rather than a dependency, so they are what these pin. Scraped CSVs already
 * sit on the machines that keep a corpus, and a re-scrape that changed line
 * endings would show every row as modified.
 */

import { describe, expect, it } from 'vitest'

import { parseCsv, toCsv } from '../src/node/csv.js'

describe('writing', () => {
  it('ends every line with CRLF, as Python’s writer does', () => {
    // `open(path, 'w', newline='')` is what stops the runtime translating
    // them, not a choice to emit `\n`.
    expect(toCsv(['a', 'b'], [{ a: '1', b: '2' }])).toBe('a,b\r\n1,2\r\n')
  })

  it('quotes only what has to be quoted', () => {
    // QUOTE_MINIMAL, Python's default.
    expect(
      toCsv(
        ['a', 'b', 'c', 'd'],
        [{ a: 'plain', b: 'has,comma', c: 'has"quote', d: 'has\nnewline' }],
      ),
    ).toBe('a,b,c,d\r\nplain,"has,comma","has""quote","has\nnewline"\r\n')
  })

  it('writes an empty cell for a column a row does not carry', () => {
    // A mixed-unit collet family has `D1_mm` on its metric rows and `D1_in` on
    // its inch ones, and both are in the union header.
    expect(
      toCsv(
        ['a', 'D1_mm', 'D1_in'],
        [
          { a: '1', D1_mm: '3' },
          { a: '2', D1_in: '0.125' },
        ],
      ),
    ).toBe('a,D1_mm,D1_in\r\n1,3,\r\n2,,0.125\r\n')
  })

  it('writes a header and nothing else for no rows', () => {
    // A family whose filter matched nothing still produces a well-formed file
    // rather than a truncated one.
    expect(toCsv(['a', 'b'], [])).toBe('a,b\r\n')
  })
})

describe('reading', () => {
  it('round-trips everything the writer can produce', () => {
    const header = ['a', 'b', 'c', 'd']
    const rows = [
      { a: 'plain', b: 'has,comma', c: 'has"quote', d: 'has\nnewline' },
      { a: '', b: '  spaced  ', c: 'Ø10', d: '90°' },
    ]

    expect(parseCsv(toCsv(header, rows))).toEqual({ header, rows })
  })

  it('accepts LF as well as CRLF', () => {
    // A CSV that has been through an editor is still a CSV.
    expect(parseCsv('a,b\n1,2\n')).toEqual({
      header: ['a', 'b'],
      rows: [{ a: '1', b: '2' }],
    })
  })

  it('does not read a trailing newline as an extra row', () => {
    expect(parseCsv('a,b\r\n1,2\r\n').rows).toHaveLength(1)
    expect(parseCsv('a,b\r\n1,2').rows).toHaveLength(1)
  })

  it('reads a header with no rows', () => {
    expect(parseCsv('a,b\r\n')).toEqual({ header: ['a', 'b'], rows: [] })
  })

  it('reads an empty file as nothing', () => {
    expect(parseCsv('')).toEqual({ header: [], rows: [] })
  })

  it('leaves a short row’s missing columns empty', () => {
    // The same shape `DictReader` produces. Neither this nor a long row is an
    // error, because these files are re-read by the annotate steps, which have
    // to be able to say what changed rather than refuse the file.
    expect(parseCsv('a,b,c\r\n1,2\r\n').rows).toEqual([{ a: '1', b: '2', c: '' }])
  })

  it('keeps an embedded newline inside a quoted cell', () => {
    expect(parseCsv('a,b\r\n"one\r\ntwo",3\r\n').rows).toEqual([{ a: 'one\r\ntwo', b: '3' }])
  })

  it('reads a doubled quote as one', () => {
    expect(parseCsv('a\r\n"he said ""hi"""\r\n').rows).toEqual([{ a: 'he said "hi"' }])
  })

  it('distinguishes an empty cell from a quoted empty cell', () => {
    expect(parseCsv('a,b\r\n,""\r\n').rows).toEqual([{ a: '', b: '' }])
  })
})
