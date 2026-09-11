/**
 * The two-row `<thead>`, flattened.
 *
 * The header and the data are joined by position and nothing else, so a
 * flattening that drifts by one column produces a CSV in which every dimension
 * is labelled as its neighbour. The markup below is copied from real product
 * pages, tolerance divs and `&nbsp;` included.
 */

import { describe, expect, it } from 'vitest'

import { VendorResponseError } from '../src/errors.js'
import { flatHeader, isJunkLabel, symbolOf } from '../src/vendors/harvey/header.js'

/** A `<th>` with the tolerance markup Harvey wraps every symbol in. */
function toleranced(symbol: string, sub: string, top: string, bottom: string): string {
  return (
    `<th class="b t" colspan="1"><b>${symbol}</b><sub>${sub}</sub>` +
    `<div class="hpc-inline"><div class="hpc-block">` +
    `<span class="hpc-top">${top}</span><span class="hpc-bottom">${bottom}</span>` +
    `</div></div></th>`
  )
}

const PAGE = `
<table id="Other_1"><thead><tr><th>NOT THIS ONE</th></tr></thead></table>
<table id="Harvey-EndMill-006_1" class="product-table1">
  <thead class="product-table-thead">
    <tr class="product-table-header">
      <th class="l bold b t" colspan="1" rowspan="1">CUTTER <br/>DIAMETER</th>
      <th class="bold b t" colspan="2" rowspan="1">OVERALL REACH</th>
      <th class="white-text r bold b t" colspan="1" rowspan="1">.</th>
      <th class="l bold ha-uncoat b t" colspan="3" rowspan="1">UNCOATED</th>
      <th class="product-table-list-add-th" rowspan="2">Add to Cart</th>
    </tr>
    <tr class="product-table-subheader">
      ${toleranced('D', '1', '+.0005&quot;', '-.0005&quot;')}
      ${toleranced('L', '3', '+.010&quot;', '-.000&quot;')}
      <th class="no-sort b bold t" colspan="1">&nbsp;</th>
      <th class="no-sort b r bold t" colspan="1">&nbsp;&nbsp;</th>
      <th class="b l bold ha-uncoat" colspan="1">2FL</th>
      <th class="b bold ha-uncoat" colspan="1">4FL</th>
      <th class="b bold ha-uncoat product-table-th-price" colspan="1">PRICE</th>
    </tr>
  </thead>
  <tbody><tr><td>data the literal already carries</td></tr></tbody>
</table>`

describe('flattening', () => {
  const columns = flatHeader(PAGE, 'Harvey-EndMill-006_1')

  it('gives one entry per data column, in order', () => {
    // Seven columns from five top `<th>`s: `cols1` is `[a0..a3, s0, s1, p0,
    // atc]` and the two lists are zipped.
    expect(columns.map((c) => [c.top, c.sub])).toEqual([
      ['CUTTER DIAMETER', 'D1'],
      ['OVERALL REACH', 'L3'],
      ['OVERALL REACH', ''],
      ['.', ''],
      ['UNCOATED', '2FL'],
      ['UNCOATED', '4FL'],
      ['UNCOATED', 'PRICE'],
      ['Add to Cart', null],
    ])
  })

  it('reads a <br>-split label as one label with a space in it', () => {
    // `CUTTER <br/>DIAMETER` collapsed without the space is `CUTTERDIAMETER`,
    // a 51st header shape that exists only in the parser.
    expect(columns[0]!.top).toBe('CUTTER DIAMETER')
  })

  it('excludes the published tolerance from the sub-label', () => {
    // Not stripped afterwards: Harvey's tolerance text carries typos
    // (`D1+0005"-.0005"`, `L2.020"-.000"`), and every one of them would be
    // another spelling for a post-hoc stripper to get right.
    expect(columns[0]!.sub).toBe('D1')
    expect(columns[1]!.sub).toBe('L3')
  })

  it('collapses an &nbsp; sub-label to nothing', () => {
    expect(columns[2]!.sub).toBe('')
    expect(isJunkLabel(columns[2]!.sub!)).toBe(true)
  })

  it('gives a rowspan-2 header a column of its own and no sub-label', () => {
    expect(columns.at(-1)).toMatchObject({ top: 'Add to Cart', sub: null, span: 1 })
  })

  it('records the span and slot of a colspan-ed header', () => {
    // What tells a ratio column from the dimension it annotates.
    expect(columns[1]).toMatchObject({ span: 2, slot: 0 })
    expect(columns[2]).toMatchObject({ span: 2, slot: 1 })
  })

  it('marks the hidden column by the class Harvey renders it with', () => {
    expect(columns[3]!.topClass).toContain('white-text')
  })

  it('reads only the table it was asked for', () => {
    expect(columns.some((c) => c.top === 'NOT THIS ONE')).toBe(false)
  })

  it('refuses a table id the page does not carry', () => {
    // A table declared in `cols<N>` and absent from the DOM is a page that
    // changed shape; an empty header would reach the caller looking like a
    // discontinued family.
    expect(() => flatHeader(PAGE, 'Harvey-EndMill-006_2')).toThrow(VendorResponseError)
  })
})

describe('the vendor symbol', () => {
  it('reads the ISO-ish symbol a dimension sub-label leads with', () => {
    expect(symbolOf('D1')).toBe('D1')
    expect(symbolOf('L2')).toBe('L2')
    expect(symbolOf('R')).toBe('R')
    expect(symbolOf('A1')).toBe('A1')
  })

  it('treats a shank tolerance class as not part of the symbol', () => {
    // `D2(h6)` and `D2` are the same column on two different pages.
    expect(symbolOf('D2(h6)')).toBe('D2')
    expect(symbolOf('D2 (h6)')).toBe('D2')
  })

  it('is null where the sub-label carries no symbol', () => {
    expect(symbolOf('')).toBeNull()
    expect(symbolOf('"')).toBeNull()
    expect(symbolOf(null)).toBeNull()
  })
})
