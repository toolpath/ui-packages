/**
 * The matrix explosion, and everything that guards it.
 *
 * One HTML row is up to nine orderable parts, and a coating grid read one
 * column to the left produces a CSV that is the right length and wrong
 * throughout. So the interesting assertions here are not "did it produce rows"
 * but the two things that catch that: the row's own add-to-cart payload, and the
 * conventions the header has to satisfy.
 *
 * The fixture is assembled from real markup — the tolerance divs, the `&nbsp;`
 * flute label, the `color:` inline style, the escaped anchor in a cell — so a
 * parser that only works on tidied-up input fails here rather than on the site.
 */

import { describe, expect, it } from 'vitest'

import {
  CAD_COLUMN,
  CAD_DXF_COLUMN,
  checkIdentityColumns,
  dimensionalColumn,
  identityColumns,
} from '../src/conventions.js'
import { ScraperConfigError, VendorResponseError } from '../src/errors.js'
import {
  COATING_COLUMN,
  FLUTES_COLUMN,
  PRICE_COLUMN,
  TOOL_NUMBER_COLUMN,
  cellText,
  parseProductPage,
  priceOf,
  productUrl,
  scrapeProduct,
} from '../src/vendors/harvey/scrape.js'
import { asFetcher } from './stubs.js'

/** A tolerance-wrapped symbol sub-header, exactly as Harvey renders one. */
function sym(symbol: string, index: string): string {
  return (
    `<th class="b t" colspan="1"><b>${symbol}</b><sub>${index}</sub>` +
    `<div class="hpc-inline"><div class="hpc-block">` +
    `<span class="hpc-top">+.0005&quot;</span>` +
    `<span class="hpc-bottom">-.0005&quot;</span></div></div></th>`
  )
}

/** A tool-number cell: a link, unless `linked` says otherwise. */
function toolCell(number: string, linked = true): string {
  const slug = number.toLowerCase()
  const display = linked
    ? `<a href=\\"/products/tool-details-${slug}\\">${number}</a>`
    : `${number}`
  return `{c:"product-table-td-toolnum",d:"${display}",s:"${number}",v:"${number}",t:""}`
}

function cart(...numbers: string[]): string {
  const entries = numbers
    .map((n) => `{\\"T\\":\\"${n.replace(/[*!†]+$/, '')}\\",\\"C\\":\\"${n}\\",\\"Q\\":\\"1\\"}`)
    .join(',')
  return `{c:"product-table-list-add",v:"1",d:"",s:"",j:"[${entries}]"}`
}

const TOP =
  `<tr class="product-table-header">` +
  `<th class="l bold b t" colspan="1" rowspan="1">CUTTER <br/>DIA.</th>` +
  `<th class="bold b t" colspan="2" rowspan="1">LENGTH OF CUT</th>` +
  `<th class="bold b t" colspan="1" rowspan="1">SHANK DIA.</th>` +
  `<th class="bold b t" colspan="1" rowspan="1">OAL</th>` +
  `<th class="l bold b t" colspan="3" rowspan="1">UNCOATED</th>` +
  `<th class="l bold b t" colspan="3" rowspan="1">AlTiN COATED</th>` +
  `<th rowspan="2">Add to Cart</th></tr>`

const SUB = (altinMiddle: string) =>
  `<tr class="product-table-subheader">` +
  sym('D', '1') +
  sym('L', '2') +
  `<th class="no-sort b bold t" colspan="1">&nbsp;</th>` +
  sym('D', '2') +
  sym('L', '1') +
  `<th colspan="1">2 FL</th><th colspan="1">3 FL</th>` +
  `<th class="product-table-th-price" colspan="1">PRICE</th>` +
  `<th colspan="1">2 FL</th><th colspan="1">${altinMiddle}</th>` +
  `<th class="product-table-th-price" colspan="1">PRICE</th></tr>`

const KEYS =
  '[{data:"a0"},{data:"a1"},{data:"a2"},{data:"a3"},{data:"a4"},' +
  '{data:"s0"},{data:"s1"},{data:"p0"},{data:"s2"},{data:"s3"},{data:"p1"},{data:"atc"}]'

const GEOMETRY =
  'a0:{c:"l product-table-datum",d:".1250 (1/8)",s:"",v:"000000.1250",t:""},' +
  'a1:{c:"product-table-datum",d:".375",s:"",v:"000000.3750",t:""},' +
  'a2:{c:"product-table-datum",d:"(3x)",s:"",v:"(3x)",t:"color:#70C0FF"},' +
  'a3:{c:"product-table-datum",d:"1/8",s:"",v:"000000.1250",t:""},' +
  'a4:{c:"product-table-datum",d:"1-1/2",s:"",v:"000001.5000",t:""}'

const PRICE = (amount: string) => `{c:"product-table-td-price",d:"${amount}",s:"",v:"",t:""}`

const EMPTY = '{c:"product-table-datum",d:"",s:null,v:null,t:""}'

/**
 * A page whose one table holds one row and four parts — the shape 40 of the 52
 * real pages have, at one twentieth the size.
 */
function page(
  options: { altinMiddle?: string; second?: boolean; unlinked?: boolean; wrongCart?: boolean } = {},
): string {
  const { altinMiddle = '3 FL', second = false, unlinked = false, wrongCart = false } = options

  const row =
    `{${GEOMETRY},` +
    `s0:${toolCell('50001')},s1:${toolCell('50002*')},p0:${PRICE('$102.30 ')},` +
    `s2:${toolCell('50001-C3')},s3:${unlinked ? toolCell('30x Diameter!', false) : EMPTY},` +
    `p1:${PRICE('$118.40 ')},` +
    `atc:${cart(
      '50001',
      wrongCart ? '59999' : '50002*',
      '50001-C3',
      ...(unlinked ? ['30x Diameter!'] : []),
    )}}`

  const secondRow =
    `{${GEOMETRY},` +
    `s0:${toolCell('60001')},s1:${EMPTY},p0:${PRICE('$99.00 ')},` +
    `s2:${EMPTY},s3:${EMPTY},p1:${PRICE('')},atc:${cart('60001')}}`

  return `<html><body>
<table id="Harvey-Test-001_1" class="product-table1"><thead>${TOP}${SUB(altinMiddle)}</thead>
<tbody><tr><td>x</td></tr></tbody></table>
${
  second
    ? `<table id="Harvey-Test-001_2" class="product-table1"><thead>${TOP}${SUB('3 FL')}</thead>` +
      `<tbody><tr><td>x</td></tr></tbody></table>`
    : ''
}
<script>
var cols1 = ${KEYS};
var cols2 = ${second ? KEYS : '[]'};
var cols3 = [];
var tableData1 = [${row}];
var tableData2 = ${second ? `[${secondRow}]` : '[]'};
var viewModel = {simFileViewModel:{productCode:"HT-Harvey-Test-001",productTitle:"Test Mills - Ball - Stub",variantSimFileViewModel:[
{variantName:"50001",variantDxfFileLink:"https://cdn.example/Harvey_50001.dxf",variantStepFileLink:""},
{variantName:"50002",variantDxfFileLink:"https://cdn.example/Harvey_50002.dxf",variantStepFileLink:"https://cdn.example/Harvey_50002.stp"}]}};
</script></body></html>`
}

const OPTIONS = { unit: 'inches' as const, warn: () => {} }

describe('the matrix explosion', () => {
  const scrape = parseProductPage(page(), 'https://example/x', OPTIONS)

  it('makes one row per non-empty tool-number cell', () => {
    // Three parts out of one HTML row: two uncoated flute counts and one
    // coated. The fourth cell of the grid is empty — that coating is not
    // offered at that flute count — and produces no row rather than a blank one.
    expect(scrape.rows).toHaveLength(3)
    expect(scrape.rows.map((r) => r[TOOL_NUMBER_COLUMN])).toEqual(['50001', '50002', '50001-C3'])
  })

  it('gives every part of one HTML row the geometry that row states', () => {
    const dc = dimensionalColumn('CUTTER DIA.', 'inches')
    expect(new Set(scrape.rows.map((r) => r[dc]))).toEqual(new Set(['.1250 (1/8)']))
  })

  it('synthesises the coating and the flute count from column position', () => {
    // Neither is in a cell: the coating is which header a number sits under and
    // the flute count is which sub-header. Nothing in the row says either.
    expect(scrape.rows.map((r) => [r[COATING_COLUMN], r[FLUTES_COLUMN]])).toEqual([
      ['UNCOATED', '2'],
      ['UNCOATED', '3'],
      ['AlTiN COATED', '2'],
    ])
  })

  it('gives every part of a coating group the price that group states', () => {
    // One price cell per group, shared by its flute counts. That is Harvey's
    // own table shape, not a join error.
    expect(scrape.rows.map((r) => r[PRICE_COLUMN])).toEqual(['102.30', '102.30', '118.40'])
  })

  it('records the clean part number and drops the footnote marker', () => {
    // `50002*` in the cell, `T: "50002"` in the payload. The clean form is the
    // vendor's own statement rather than this package's regex.
    expect(scrape.rows[1]![TOOL_NUMBER_COLUMN]).toBe('50002')
  })

  it('joins the CAD links on the tool number', () => {
    expect(scrape.rows[1]![CAD_DXF_COLUMN]).toBe('https://cdn.example/Harvey_50002.dxf')
    expect(scrape.rows[1]![CAD_COLUMN]).toBe('https://cdn.example/Harvey_50002.stp')
    // A part with no entry gets empty columns, not a guessed URL.
    expect(scrape.rows[2]![CAD_DXF_COLUMN]).toBe('')
  })

  it('reports the family code the vendor publishes', () => {
    expect(scrape.familyCode).toBe('HT-Harvey-Test-001')
  })
})

describe('the header the adapter really writes', () => {
  const scrape = parseProductPage(page(), 'https://example/x', OPTIONS)

  it('carries the identity column this brand deviates to', () => {
    // Against `conventions`, not against a quoted literal — a copy of the
    // header here would be updated at the same time as the adapter and would
    // check nothing.
    expect(() => checkIdentityColumns('harvey', scrape.header)).not.toThrow()
    expect(scrape.header).toContain(identityColumns('harvey')[0])
  })

  it('suffixes every dimension with the unit the family declares', () => {
    for (const label of ['CUTTER DIA.', 'LENGTH OF CUT', 'SHANK DIA.', 'OAL']) {
      expect(scrape.header).toContain(dimensionalColumn(label, 'inches'))
      expect(scrape.header).not.toContain(label)
    }
  })

  it('names both CAD columns from the shared conventions', () => {
    expect(scrape.header).toContain(CAD_COLUMN)
    expect(scrape.header).toContain(CAD_DXF_COLUMN)
  })

  it('names the ratio column for the column it annotates, unsuffixed', () => {
    // Harvey gives it no header at all. Naming it for what it annotates is the
    // only honest option; giving it a unit would make it read as a dimension.
    expect(scrape.header).toContain('LENGTH OF CUT RATIO')
    expect(scrape.header).not.toContain(dimensionalColumn('LENGTH OF CUT RATIO', 'inches'))
  })

  it('has no repeated column', () => {
    expect(new Set(scrape.header).size).toBe(scrape.header.length)
  })

  it('gives every row a cell for every column', () => {
    for (const row of scrape.rows) {
      expect(Object.keys(row).sort()).toEqual([...scrape.header].sort())
    }
  })
})

describe('what the vendor gets wrong', () => {
  it('fills a blank flute label from a sibling group of the same shape', () => {
    // Two real tables render a flute sub-label as `&nbsp;&nbsp;` where the
    // neighbouring coating group labels the same slot correctly.
    const warnings: string[] = []
    const scrape = parseProductPage(page({ altinMiddle: '&nbsp;&nbsp;' }), 'x', {
      unit: 'inches',
      warn: (m) => warnings.push(m),
    })

    expect(scrape.rows.map((r) => r[FLUTES_COLUMN])).toEqual(['2', '3', '2'])
    expect(warnings.some((w) => w.includes('blank'))).toBe(true)
  })

  it('drops a tool-number cell with no product link, and warns', () => {
    // 26 cells carry the marketing string `30x Diameter!` in a tool-number
    // column, and Harvey's own cart payload lists them as orderable. The link
    // is the structural difference; matching the text would miss the next one.
    const warnings: string[] = []
    const scrape = parseProductPage(page({ unlinked: true }), 'x', {
      unit: 'inches',
      warn: (m) => warnings.push(m),
    })

    expect(scrape.rows.map((r) => r[TOOL_NUMBER_COLUMN])).toEqual(['50001', '50002', '50001-C3'])
    expect(warnings.some((w) => w.includes('no product link'))).toBe(true)
  })
})

describe('the checks that stop a shifted grid', () => {
  it('refuses a row its own add-to-cart payload disagrees with', () => {
    // The strongest sensor in the adapter, and it is free: the payload lists
    // every part on the row independently of the grid the parts were read from.
    expect(() => parseProductPage(page({ wrongCart: true }), 'x', OPTIONS)).toThrow(
      /add-to-cart payload/,
    )
  })

  it('refuses a header that no longer lines up with the data keys', () => {
    const short = page().replace('{data:"a4"},', '')
    expect(() => parseProductPage(short, 'x', OPTIONS)).toThrow(/no longer line up/)
  })

  it('refuses a tool-number group headed by something that is not a coating', () => {
    // The coating is synthesised from the header, so a header that stopped
    // being a coating is the grid having shifted.
    const renamed = page().replace('>UNCOATED<', '>SPECIAL OFFER<')
    expect(() => parseProductPage(renamed, 'x', OPTIONS)).toThrow(ScraperConfigError)
  })

  it('refuses a geometry label the lexicon does not know', () => {
    const renamed = page().replace('>OAL<', '>TOTAL LENGTH<')
    expect(() => parseProductPage(renamed, 'x', OPTIONS)).toThrow(/TOTAL LENGTH/)
  })

  it('refuses a coating group whose last column is not a price', () => {
    // Every group on all 80 tables ends in exactly one price column. One that
    // does not is a grid where every part is reading a neighbour's cell.
    const renamed = page().replace(
      '<th class="product-table-th-price" colspan="1">PRICE</th>',
      '<th class="product-table-th-price" colspan="1">COST</th>',
    )
    expect(() => parseProductPage(renamed, 'x', OPTIONS)).toThrow(/COST/)
  })

  it('refuses a page with no product code', () => {
    const anonymous = page().replace('productCode:"HT-Harvey-Test-001"', 'productCode:""')
    expect(() => parseProductPage(anonymous, 'x', OPTIONS)).toThrow(VendorResponseError)
  })
})

describe('two tables, one CSV', () => {
  const scrape = parseProductPage(page({ second: true }), 'x', OPTIONS)

  it('merges them, because only the dropped tolerance told them apart', () => {
    expect(scrape.rows).toHaveLength(4)
    expect(scrape.rows.at(-1)![TOOL_NUMBER_COLUMN]).toBe('60001')
  })

  it('refuses two tables that no longer publish the same columns', () => {
    const drifted = page({ second: true }).replace(
      /(Harvey-Test-001_2[\s\S]*?)>OAL</,
      '$1>OVERALL LENGTH<',
    )
    expect(() => parseProductPage(drifted, 'x', OPTIONS)).toThrow(/no longer share a header/)
  })
})

describe('cell text', () => {
  it('takes the link text and nothing else', () => {
    expect(cellText('<a href="/products/tool-details-14916">14916</a>')).toBe('14916')
  })

  it('drops the currency the column name already carries', () => {
    expect(priceOf('$148.40 ')).toBe('148.40')
    expect(priceOf('')).toBe('')
  })
})

describe('the one network call', () => {
  it('reads the page through the fetcher it was given', async () => {
    const asked: string[] = []
    const fetcher = asFetcher({
      text: (url: string) => {
        asked.push(url)
        return Promise.resolve(page())
      },
    })

    const scrape = await scrapeProduct(fetcher, '/products/test-mills', OPTIONS)

    expect(asked).toEqual([productUrl('/products/test-mills')])
    expect(scrape.source).toBe(productUrl('/products/test-mills'))
    expect(scrape.rows).toHaveLength(3)
  })
})
