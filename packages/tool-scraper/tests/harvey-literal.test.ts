/**
 * The scanner that reads a JavaScript object literal out of a page.
 *
 * Every case here is one the obvious `/([{,])\s*(\w+)\s*:/` regex gets wrong,
 * and each of them is on a real Harvey page: cell values are HTML with quotes
 * and colons in them, and a rewrite inside a string produces a document that
 * still parses and has wrong data in it. That is the failure being tested for —
 * not an exception, a wrong answer.
 */

import { describe, expect, it } from 'vitest'

import { VendorResponseError } from '../src/errors.js'
import { findLiteral, readLiteral, toJson } from '../src/vendors/harvey/literal.js'

describe('finding a literal', () => {
  it('takes the whole balanced value and nothing after it', () => {
    const source = 'var cols1 = [{data:"a0"},{data:"s0"}];\nvar cols2 = [];'
    expect(findLiteral(source, 'cols1')).toBe('[{data:"a0"},{data:"s0"}]')
    expect(findLiteral(source, 'cols2')).toBe('[]')
  })

  it('does not mistake a longer name for the one asked for', () => {
    // Every page declares `tableData1` through `tableData10`. A prefix match
    // would read the tenth table's data as the first table's.
    const source = 'var tableData10 = [{a0:{d:"ten"}}];\nvar tableData1 = [{a0:{d:"one"}}];'
    expect(findLiteral(source, 'tableData1')).toBe('[{a0:{d:"one"}}]')
  })

  it('returns null for a variable the page does not declare', () => {
    // The ordinary answer, not a fault: a page with one table declares
    // `tableData2` as `[]` and a page with none declares no `cols3` at all.
    expect(findLiteral('var cols1 = [];', 'tableData4')).toBeNull()
  })

  it('is not closed early by a bracket inside a cell', () => {
    // The whole reason this is not a depth counter over the raw text.
    const source = 'var tableData1 = [{a0:{d:"<span>}</span>",t:""}},{a0:{d:"]"}}];'
    expect(readLiteral<unknown[]>(source, 'tableData1')).toHaveLength(2)
  })

  it('refuses a literal that never closes', () => {
    // A truncated response, not a page with fewer tables — returning null here
    // would report it as the second.
    expect(() => findLiteral('var tableData1 = [{a0:{d:"x"}}', 'tableData1')).toThrow(
      VendorResponseError,
    )
  })
})

describe('quoting bare keys', () => {
  it('leaves a colon inside a string alone', () => {
    // `t:"color:#70C0FF"` is on every ratio cell in the catalog.
    expect(JSON.parse(toJson('{c:"x",t:"color:#70C0FF"}', 'cell'))).toEqual({
      c: 'x',
      t: 'color:#70C0FF',
    })
  })

  it('leaves an escaped quote and the HTML around it alone', () => {
    const literal = '{d:"<a href=\\"/products/tool-details-24502\\">24502</a>",s:null}'
    expect(JSON.parse(toJson(literal, 'cell'))).toEqual({
      d: '<a href="/products/tool-details-24502">24502</a>',
      s: null,
    })
  })

  it('does not rewrite an object literal that is inside a string', () => {
    // The case that makes the regex approach dangerous rather than merely
    // wrong: the output still parses, so nothing raises and the cell is
    // corrupted quietly.
    const parsed = JSON.parse(toJson('{d:"see {x:1} below",v:"1"}', 'cell')) as {
      d: string
    }
    expect(parsed.d).toBe('see {x:1} below')
  })

  it('quotes a key only where one belongs', () => {
    // An array element is never a key, and neither is anything after a colon.
    expect(JSON.parse(toJson('{a:[1,2],b:{c:true},d:null}', 'cell'))).toEqual({
      a: [1, 2],
      b: { c: true },
      d: null,
    })
  })

  it('refuses a single-quoted string rather than guessing at it', () => {
    // Never seen on a Harvey page. Re-escaping one into a JSON string would be
    // this package deciding what the vendor meant.
    expect(() => toJson("{d:'x'}", 'cell')).toThrow(VendorResponseError)
  })
})

describe('reading a literal', () => {
  it('names the variable when the value cannot be parsed', () => {
    expect(() => readLiteral('var cols1 = [{data:}];', 'cols1')).toThrow(/cols1/)
  })
})
