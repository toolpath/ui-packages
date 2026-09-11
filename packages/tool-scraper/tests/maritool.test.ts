/**
 * The MariTool half — the leaf listings, the product spec tables, and the row
 * shape a consumer then reads.
 *
 * Network is mocked at the one seam that is network (`Fetcher.text`);
 * everything below runs for real against saved markup, because parsing is what
 * breaks when a vendor changes shape. The fixtures are trimmed from pages
 * fetched on 2026-08-29 and keep the store's own tag soup — the nested tables,
 * the `&nbsp;` after every label, the `&quot;` in a gage cell — because those
 * are the three details a tidied fixture would quietly stop testing.
 *
 * **The tests worth reading twice are the ones about `Gage Length` and about
 * what does *not* become a dimension.** A MariTool CSV holds both unit systems
 * in one column, and the cell that looks most like a clamping capacity —
 * `Collet Grip Range` — is the ER series' range restated and belongs to no
 * holder. Neither would throw if it were wrong.
 */

import { describe, expect, it } from 'vitest'

import { CAD_COLUMN, CAD_DXF_COLUMN, checkIdentityColumns } from '../src/conventions.js'
import { VendorResponseError } from '../src/errors.js'
import { HOLDER_FAMILIES, LEAVES, type Leaf } from '../src/families/maritool.js'
import { REQUEST_DELAY_MS } from '../src/scrape.js'
import { discoverCategories, leavesOf, parseCategory } from '../src/vendors/maritool/catalog.js'
import {
  categoryUrl,
  colletSeries,
  holderRow,
  parseGageLength,
  parseListing,
  parseProduct,
  roster,
  scrapeHolders,
  type ListingRow,
} from '../src/vendors/maritool/scrape.js'
import { asFetcher, recordPauses } from './stubs.js'

const CAT40_ER: Leaf = { cPath: '23_25_42', clamping: 'collet', style: 'er-collet-chuck' }
const CAT40_SHRINK: Leaf = { cPath: '23_25_503', clamping: 'shrink', style: 'shrink-fit' }

/** One part as a listing row renders it, tags and all. */
function listingRow(id: string, part: string, name: string, assets = true): string {
  const link =
    `https://www.maritool.com/Mill-Tool-Holders/c23_25_42/p${id}/` +
    `${part.replaceAll('.', '-')}/product_info.html`
  return `
    <tr class="product-info">
      <td><a href="${link}"><img class="product-image" src="images/${id}.jpg" alt="${name}"/></a></td>
      <td>
        <div><a href="${link}" title="${name}">${name}</a></div>
        <div class="product-info-detail">
          <p>Part#: ${part}</p>
          <p>Brand: MariTool</p>
          ${
            assets
              ? `<p>Available Downloads</p>
          <table class="product-info-assets"><tr>
            <td><div><a target="_blank" href="https://cdn.test/aa_${part}-REV1.dwg" class="asset-code">DWG</a></div></td>
            <td><div><a target="_blank" href="https://cdn.test/bb_${part}-REV1.dxf" class="asset-code">DXF</a></div></td>
            <td><div><a target="_blank" href="https://cdn.test/cc_${part}-REV1.stp" class="asset-code">STP</a></div></td>
          </tr></table>`
              : ''
          }
        </div>
      </td>
      <td>
        <div class="product-info-actions"><form action="https://www.maritool.com/index.php" method="get">
          <input type="hidden" name="products_id" value="${id}"/>
          <h3>$126.95</h3>
          <div class="product-info-stock"><b>In Stock</b></div>
        </form></div>
      </td>
    </tr>`
}

/** A leaf listing page: the vendor's own count, then the rows it rendered. */
function listingPage(total: number, rows: string[], from = 1): string {
  return `<html><body>
    <div class="header">CAT40 ER Collet Chuck Tool Holders</div>
    Displaying <b>${from}</b> to <b>${from + rows.length - 1}</b> (of <b>${total}</b> products)
    <table><tbody>${rows.join('\n')}</tbody></table>
  </body></html>`
}

/** A product page's spec table, in MariTool's own markup. */
function productPage(specs: Record<string, string>, downloadsFor?: string): string {
  const table = Object.entries(specs)
    .map(
      ([label, value]) => `
        <tr>
          <td class="main" valign="top"><b>${label}:&nbsp;</b></td>
          <td class="main" valign="top">${value}</td>
        </tr>`,
    )
    .join('')
  return `<html><body>
    <div class="product-info-box">
      <div class="header">Product Info</div>
      <div class="contentBodySm"><ul><li>Gage length is 3.0 inches</li></ul></div>
    </div>
    ${
      Object.keys(specs).length > 0
        ? `<div class="product-info-box">
      <div class="header">Product Specifications</div>
      <div class="contentBodySm"><table border="0">${table}</table></div>
    </div>`
        : ''
    }
    ${
      downloadsFor === undefined
        ? ''
        : `<div class="product-info-box">
      <div class="header">Available Downloads for ${downloadsFor}</div>
      <div class="contentBodySm"><a href="https://cdn.test/x.pdf">PDF</a></div>
    </div>`
    }
  </body></html>`
}

const ER16_SPECS = {
  'Balance Spec': 'G2.5 @ 20,000 rpms',
  'Collet Grip Range': '.020-.4375 inches',
  'Collet Size': 'ER 16',
  Concentricity: '&lt; .0001 at Collet Face',
  'Coolant Thru': 'Yes',
  Finish: 'Black Oxide',
  'Gage Length': '3.0',
  Material: 'Hardened Alloy Steel',
  'Rear Thread': '5/8-11',
  Taper: 'CAT40',
}

/** The listing row for the part `ER16_SPECS` describes. */
const ER16_LISTING: ListingRow = {
  productsId: '100',
  partNumber: 'CAT40-ER16-3.0',
  name: 'CAT40 ER16 3.0 COLLET CHUCK TOOL HOLDER',
  productUrl: 'https://www.maritool.com/x/p100/y/product_info.html',
  assets: {
    DWG: 'https://cdn.test/aa.dwg',
    DXF: 'https://cdn.test/bb.dxf',
    STP: 'https://cdn.test/cc.stp',
  },
}

/** A fetcher answering every URL from a map, recording what was asked for. */
function vendor(pages: Record<string, string>) {
  const asked: string[] = []
  const fetcher = asFetcher({
    text: async (url: string) => {
      asked.push(url)
      const page = pages[url]
      if (page === undefined) throw new Error(`no fixture for ${url}`)
      return page
    },
  })
  return { fetcher, asked }
}

describe('a leaf listing page', () => {
  it('reads every row, and the vendor’s own count of the whole leaf', () => {
    // The count is the second opinion. Every other number a scrape could check
    // itself against is computed from the rows it just collected, so a roster
    // that stopped a page early agrees with itself.
    const page = listingPage(51, [
      listingRow('341', 'CAT40-ER11-2.5', 'CAT40 ER11 2.5 COLLET CHUCK TOOL HOLDER'),
      listingRow('100', 'CAT40-ER16-3.0', 'CAT40 ER16 3.0 COLLET CHUCK TOOL HOLDER'),
    ])

    const listing = parseListing(page)

    expect(listing.total).toBe(51)
    expect(listing.rows).toHaveLength(2)
    expect(listing.rows[0]).toEqual({
      productsId: '341',
      partNumber: 'CAT40-ER11-2.5',
      name: 'CAT40 ER11 2.5 COLLET CHUCK TOOL HOLDER',
      productUrl:
        'https://www.maritool.com/Mill-Tool-Holders/c23_25_42/p341/' +
        'CAT40-ER11-2-5/product_info.html',
      assets: {
        DWG: 'https://cdn.test/aa_CAT40-ER11-2.5-REV1.dwg',
        DXF: 'https://cdn.test/bb_CAT40-ER11-2.5-REV1.dxf',
        STP: 'https://cdn.test/cc_CAT40-ER11-2.5-REV1.stp',
      },
    })
  })

  it('takes the part number from the Part# line, not from a position', () => {
    // The row states `Part#:`, `Brand:` and `Available Downloads` in three
    // identical `<p>` elements. Taking the first would work until MariTool
    // reorders them, and taking the second would already be wrong.
    const listing = parseListing(
      listingPage(1, [listingRow('9', 'CAT40-SF.500-4.5T', 'CAT40 SHRINK FIT')]),
    )

    expect(listing.rows[0]?.partNumber).toBe('CAT40-SF.500-4.5T')
  })

  it('reads a product link whose slug holds a slash', () => {
    // MariTool builds the slug out of the product name and does not escape it,
    // so `CAT50 3/4 TAPERED NOSE …` becomes two path segments. A pattern
    // requiring one segment matches neither of the two CAT50 shrink-fit
    // holders, and their rows reach the network as a request for nothing.
    const html = `<html><body>Displaying <b>1</b> to <b>1</b> (of <b>1</b> products)
      <table><tbody><tr class="product-info">
        <td><a href="https://www.maritool.com/Mill-CAT50-SF/c23_24_1978/p29006/CAT50-3/4-TAPERED-NOSE-SHRINK-FIT-TOOL-HOLDER-.750-5.0/product_info.html"><img/></a></td>
        <td><div><a href="https://www.maritool.com/Mill-CAT50-SF/c23_24_1978/p29006/CAT50-3/4-TAPERED-NOSE-SHRINK-FIT-TOOL-HOLDER-.750-5.0/product_info.html" title="x">CAT50 3/4 TAPERED NOSE SHRINK FIT TOOL HOLDER .750-5.0</a></div>
          <div class="product-info-detail"><p>Part#: CAT50-SF.750-5.0T</p></div></td>
      </tr></tbody></table></body></html>`

    const listing = parseListing(html)

    expect(listing.rows[0]?.productsId).toBe('29006')
    expect(listing.rows[0]?.productUrl).toContain('CAT50-3/4-TAPERED-NOSE')
  })

  it('refuses a row it cannot read rather than fetching an empty URL', () => {
    // A row with no part number has no identity and one with no link has no
    // geometry; passing either on as `''` reaches the network as a request for
    // nothing, which is what a changed listing used to look like.
    const html = `<html><body>Displaying <b>1</b> to <b>1</b> (of <b>1</b> products)
      <table><tbody><tr class="product-info"><td><div>nothing</div></td></tr></tbody></table></body></html>`

    expect(() => parseListing(html)).toThrow(/the listing changed shape/)
    expect(() => parseListing(html)).toThrow(VendorResponseError)
  })

  it('leaves a row with no downloads with no assets, rather than failing', () => {
    const listing = parseListing(listingPage(1, [listingRow('9', 'CAT50-ER32-4.0', 'X', false)]))

    expect(listing.rows[0]?.assets).toEqual({})
  })

  it('refuses a page that states no count rather than reading it as empty', () => {
    // Reporting a changed format as no data looks exactly like a discontinued
    // category — the rule `regofix.parseDin4000` holds.
    expect(() => parseListing('<html><body>nothing here</body></html>')).toThrow(
      /states no "\(of N products\)" count/,
    )
  })
})

describe('paging a leaf', () => {
  it('pages until the vendor’s count is met', async () => {
    const { fetcher, asked } = vendor({
      [categoryUrl('23_25_42')]: listingPage(3, [
        listingRow('1', 'A', 'A'),
        listingRow('2', 'B', 'B'),
      ]),
      [categoryUrl('23_25_42', 2)]: listingPage(3, [listingRow('3', 'C', 'C')], 3),
    })

    const rows = await roster(fetcher, '23_25_42', { delayMs: 0 })

    expect(rows.map((row) => row.partNumber)).toEqual(['A', 'B', 'C'])
    expect(asked).toEqual([categoryUrl('23_25_42'), categoryUrl('23_25_42', 2)])
  })

  it('refuses a leaf whose rows do not reach its stated count', async () => {
    // The failure a row count computed from the rows cannot see.
    const { fetcher } = vendor({
      [categoryUrl('23_25_42')]: listingPage(51, [listingRow('1', 'A', 'A')]),
      [categoryUrl('23_25_42', 2)]: listingPage(51, [], 2),
    })

    await expect(roster(fetcher, '23_25_42', { delayMs: 0 })).rejects.toThrow(
      /says 51 products and paging collected 1/,
    )
    await expect(roster(fetcher, '23_25_42', { delayMs: 0 })).rejects.toThrow(VendorResponseError)
  })

  it('stops rather than looping when paging stops advancing', async () => {
    // A `page` parameter the store has stopped honouring answers with page 1
    // forever, and the count would never be met.
    const { fetcher } = vendor({
      [categoryUrl('23_25_42')]: listingPage(9, [listingRow('1', 'A', 'A')]),
      [categoryUrl('23_25_42', 2)]: listingPage(9, [listingRow('1', 'A', 'A')]),
    })

    await expect(roster(fetcher, '23_25_42', { delayMs: 0 })).rejects.toThrow(/collected 1/)
  })
})

describe('a product page', () => {
  it('reads the spec table under its own header, with entities decoded', () => {
    const { specs } = parseProduct(productPage(ER16_SPECS, 'CAT40-ER16-3.0'))

    expect(specs['Balance Spec']).toBe('G2.5 @ 20,000 rpms')
    // `&nbsp;` follows every label and `\s` matches it — a `trim()` alone
    // would leave it, and every label in the header would end in one.
    expect(Object.keys(specs)).not.toContain('Balance Spec ')
    expect(specs['Concentricity']).toBe('< .0001 at Collet Face')
    expect(specs['Taper']).toBe('CAT40')
  })

  it('reads only the specification table, not the prose bullets beside it', () => {
    // The `Product Info` block states a gage length in English —
    // "Gage length is 3.0 inches" — and a parser that took every block would
    // read it as data.
    const { specs } = parseProduct(productPage(ER16_SPECS))

    expect(Object.keys(specs).sort()).toEqual(Object.keys(ER16_SPECS).sort())
  })

  it('reports a page with no spec table as no specs, not as a failure', () => {
    // Two parts in scope publish none. That is a real state the caller acts
    // on, not a broken response.
    const { specs, statedPartNumber } = parseProduct(productPage({}, 'CAT50-ER32-3.0'))

    expect(specs).toEqual({})
    expect(statedPartNumber).toBe('CAT50-ER32-3.0')
  })

  it('reads the downloads header, and treats its absence as no header', () => {
    // Roughly one part in four publishes no assets and so carries no header —
    // absent is not a disagreement.
    expect(parseProduct(productPage(ER16_SPECS)).statedPartNumber).toBeNull()
    expect(parseProduct(productPage(ER16_SPECS, 'CAT40-ER16-3.0')).statedPartNumber).toBe(
      'CAT40-ER16-3.0',
    )
  })
})

describe('a gage length cell', () => {
  it.each([
    ['3.0', 3, 'inches'],
    ['1.75', 1.75, 'inches'],
    ['40mm', 40, 'millimeters'],
    ['4.5 Tapered', 4.5, 'inches'],
    ['120mm Tapered', 120, 'millimeters'],
    // Four shapes beyond the ones the plan measured, all in the live catalog.
    ['3.5"', 3.5, 'inches'],
    ['1.9" ', 1.9, 'inches'],
    ['7.8 Inches', 7.8, 'inches'],
    ['2.5 Slim Nose', 2.5, 'inches'],
    ['3.0 Slim Tapered', 3, 'inches'],
  ])('reads %s', (cell, value, unit) => {
    expect(parseGageLength(cell)).toEqual({ value, unit })
  })

  it('treats a bare number as inches, because that is what the vendor marks', () => {
    // MariTool marks every metric cell `mm` and marks nothing on an imperial
    // one. The part number says nothing either way: `HSK40E-ER11-40` is
    // millimetres and `HSK40E-ER16-3.0M` is inches, where the `M` is a mini nut.
    expect(parseGageLength('40mm').unit).toBe('millimeters')
    expect(parseGageLength('3.0').unit).toBe('inches')
  })

  it('is refused rather than returned as NaN', () => {
    // Same rule `regofix.parseSize` holds: an unreadable cell used to fall
    // through to arithmetic on NaN and reach a row as one.
    expect(() => parseGageLength('')).toThrow(RangeError)
    expect(() => parseGageLength('see drawing')).toThrow(RangeError)
  })
})

describe('a collet size cell', () => {
  it('closes the vendor’s inconsistent spacing, and nothing else', () => {
    // MariTool publishes both spellings within one style, and `CST` is a join
    // key: two spellings of one series join to nothing.
    expect(colletSeries('ER 11')).toBe('ER11')
    expect(colletSeries('ER11')).toBe('ER11')
    expect(colletSeries('ER 32')).toBe('ER32')
  })

  it('resolves a nut designation to the collet series the holder takes', () => {
    // `ER25M` is a collet *nut* designation in a `Collet Size` cell, on two
    // parts. `M` is the mini nut, and the collet a mini nut closes is a plain
    // ER25 (JG 2026-09-02) — so `CST` names the collet, and the two parts join
    // to the ER25 collets they fit instead of to nothing.
    expect(colletSeries('ER25M')).toBe('ER25')
    expect(colletSeries('ER 25 M')).toBe('ER25')
  })

  it('writes a suffix nobody has an answer for through as designated', () => {
    // The reason the pattern is anchored rather than a trailing-letter strip:
    // a designation that turns out to mean something else has to reach the
    // warning rather than be shortened into a series that fits nothing.
    expect(colletSeries('ER25X')).toBe('ER25X')
    expect(colletSeries('TG100')).toBe('TG100')
  })
})

describe('a holder row', () => {
  it('maps to a holder row, hand-checked', () => {
    expect(holderRow(CAT40_ER, ER16_LISTING, parseProduct(productPage(ER16_SPECS)).specs)).toEqual({
      'Material Number': 'CAT40-ER16-3.0',
      products_id: '100',
      Description: 'CAT40 ER16 3.0 COLLET CHUCK TOOL HOLDER',
      taper: 'CAT40',
      contact: 'taper',
      clamping: 'collet',
      style: 'er-collet-chuck',
      CST: 'ER16',
      L1_in: '3',
      L1_mm: '',
      'Balance Spec': 'G2.5 @ 20,000 rpms',
      'Collet Grip Range': '.020-.4375 inches',
      'Collet Size': 'ER 16',
      Concentricity: '< .0001 at Collet Face',
      'Coolant Thru': 'Yes',
      Finish: 'Black Oxide',
      'Gage Length': '3.0',
      Material: 'Hardened Alloy Steel',
      'Rear Thread': '5/8-11',
      Taper: 'CAT40',
      [CAD_COLUMN]: 'https://cdn.test/cc.stp',
      [CAD_DXF_COLUMN]: 'https://cdn.test/bb.dxf',
    })
  })

  it('carries the identity columns MariTool actually publishes', () => {
    expect(() =>
      checkIdentityColumns(
        'maritool',
        Object.keys(holderRow(CAT40_ER, ER16_LISTING, parseProduct(productPage(ER16_SPECS)).specs)),
      ),
    ).not.toThrow()
  })

  it.each([
    ['CAT40', 'CAT40', 'taper'],
    ['CAT40 DUAL CONTACT', 'CAT40', 'face'],
    // The same designation in the other casing MariTool publishes it in.
    ['CAT50 Dual Contact', 'CAT50', 'face'],
    ['BT30', 'BT30', 'taper'],
    ['BT30 DUAL CONTACT', 'BT30', 'face'],
    // An HSK shank seats on its flange face as well as its cone by definition,
    // so there is no `DUAL CONTACT` to mark and nothing single-contact to
    // distinguish it from.
    ['HSK63A', 'HSK63A', 'face'],
    ['HSK40E', 'HSK40E', 'face'],
  ])('reads Taper %s as taper %s, contact %s', (cell, taper, contact) => {
    const row = holderRow(CAT40_ER, ER16_LISTING, { ...ER16_SPECS, Taper: cell })

    expect(row['taper']).toBe(taper)
    expect(row['contact']).toBe(contact)
  })

  it('refuses a Taper it cannot name rather than recording a guess', () => {
    // Recording a spindle interface this package cannot name would be a guess
    // about which machine a holder fits — the call `regofix` made on `BT-OM 30`.
    expect(() =>
      holderRow(CAT40_ER, ER16_LISTING, { ...ER16_SPECS, Taper: 'BT35 CUSTOM' }),
    ).toThrow(/not a spindle interface this package knows/)
  })

  it('keeps a row whose spec table states no Taper, and warns', () => {
    // `BT40-ER32-60` is the one part in scope with no `Taper` row. The hole is
    // what the vendor published; a taper read off the part number would be
    // this package authoring the column it exists to read.
    const warnings: string[] = []
    const { Taper: _taper, ...withoutTaper } = ER16_SPECS
    const row = holderRow(CAT40_ER, ER16_LISTING, withoutTaper, (m) => warnings.push(m))

    expect(row['taper']).toBe('')
    expect(row['contact']).toBe('')
    expect(row['Material Number']).toBe('CAT40-ER16-3.0')
    expect(warnings.join('\n')).toContain('states no Taper')
  })

  it('joins a mini-nut holder to the collet it takes, keeping the vendor’s cell', () => {
    // Both halves of the call. `CST` is a derived join key and names the ER25
    // collet the holder really takes; `Collet Size` is one of the vendor's own
    // labels, so the receipt still says `ER25M` and still says which part has
    // the mini nut. Nothing warns, because nothing here is unresolved.
    const warnings: string[] = []
    const row = holderRow(CAT40_ER, ER16_LISTING, { ...ER16_SPECS, 'Collet Size': 'ER25M' }, (m) =>
      warnings.push(m),
    )

    expect(row['CST']).toBe('ER25')
    expect(row['Collet Size']).toBe('ER25M')
    expect(warnings).toEqual([])
  })

  it('warns where Collet Size is a designation nobody has an answer for', () => {
    // The sensor that survives the ER25M answer: the next surprise in this cell
    // still reaches a person rather than being shortened into a series.
    const warnings: string[] = []
    const row = holderRow(CAT40_ER, ER16_LISTING, { ...ER16_SPECS, 'Collet Size': 'TG 100' }, (m) =>
      warnings.push(m),
    )

    expect(row['CST']).toBe('TG100')
    expect(row['Collet Size']).toBe('TG 100')
    expect(warnings.join('\n')).toContain('is not a collet series')
  })

  it('puts the gage length in exactly one of the two unit columns', () => {
    // Both columns are always written so the header is the same whichever unit
    // a family's first row happens to be in — the shape `regofix.colletRow`
    // gives `Square_in`/`Square_mm`.
    const metric = holderRow(CAT40_ER, ER16_LISTING, { ...ER16_SPECS, 'Gage Length': '40mm' })
    const imperial = holderRow(CAT40_ER, ER16_LISTING, ER16_SPECS)

    expect([metric['L1_mm'], metric['L1_in']]).toEqual(['40', ''])
    expect([imperial['L1_mm'], imperial['L1_in']]).toEqual(['', '3'])
  })

  it('converts nothing, and keeps the vendor’s own cell beside the pair', () => {
    // MariTool's own imperial conversion calls 40 mm "1.6 inches" where the
    // figure is 1.5748. Computing one here would put a number in the file the
    // vendor never published; reading theirs would put a wrong one.
    const row = holderRow(CAT40_ER, ER16_LISTING, { ...ER16_SPECS, 'Gage Length': '40mm' })

    expect(row['L1_in']).toBe('')
    expect(row['Gage Length']).toBe('40mm')
  })

  it('drops the nose form from the number and gives it no column of its own', () => {
    // `Tapered` is not a data type. It is not lost either: the vendor states it
    // in the product name, and the row carries that name in `Description`.
    const row = holderRow(
      CAT40_SHRINK,
      { ...ER16_LISTING, name: 'BT40 ER11 120mm Tapered Nose Collet Chuck Tool Holder' },
      { ...ER16_SPECS, 'Gage Length': '120mm Tapered' },
    )

    expect(row['L1_mm']).toBe('120')
    expect(row['Description']).toContain('Tapered Nose')
    expect(row['Gage Length']).toBe('120mm Tapered')
    // No `Nose Form`, no `Tapered`, no `Slim` — the qualifier gets no column.
    // `taper` and `Taper` are the spindle interface and are a different thing.
    for (const key of Object.keys(row)) {
      expect(key.toLowerCase(), key).not.toMatch(/tapered|nose|slim|qualifier/)
    }
  })

  it('warns rather than letting a vendor label overwrite a built column', () => {
    // A `Description` spec row would replace the product name and the row
    // would still look complete. None of MariTool's fifteen labels collides
    // today; this is what says so if one starts to.
    const warnings: string[] = []
    const row = holderRow(
      CAT40_ER,
      ER16_LISTING,
      { ...ER16_SPECS, Description: 'something else' },
      (m) => warnings.push(m),
    )

    expect(row['Description']).toBe('CAT40 ER16 3.0 COLLET CHUCK TOOL HOLDER')
    expect(warnings.join('\n')).toContain('already a column this scraper builds')
  })

  it('never promotes Collet Grip Range to a clamping capacity', () => {
    // It is the ER series' range restated on the holder's page — a pure
    // function of `Collet Size` — and promoting it to `CCCN`/`CCCX` would make
    // the holder claim a capacity of its own, which is exactly what
    // `regofix.holderRow`'s absent `D1` prevents. It stays as the vendor's own
    // cell so nothing published is dropped.
    const row = holderRow(CAT40_ER, ER16_LISTING, parseProduct(productPage(ER16_SPECS)).specs)

    expect(row['Collet Grip Range']).toBe('.020-.4375 inches')
    for (const key of Object.keys(row)) {
      expect(key, key).not.toMatch(/^(D1|CCCN|CCCX)/)
    }
  })

  it('gives every promoted dimension a unit and leaves the vendor’s cells bare', () => {
    // The two halves of the unit rule. A column this adapter promotes carries
    // `_in`/`_mm`; a cell it carries verbatim under MariTool's own label —
    // `Shank Size`, `Nose Diameter` — carries no suffix, because these families
    // declare no `unit` for one to be taken from.
    const row = holderRow(CAT40_SHRINK, ER16_LISTING, {
      ...ER16_SPECS,
      'Shank Size': '.125',
      'Nose Diameter': '.75',
    })

    expect(
      Object.keys(row)
        .filter((key) => /^L1/.test(key))
        .sort(),
    ).toEqual(['L1_in', 'L1_mm'])
    expect(row['Shank Size']).toBe('.125')
    expect(Object.keys(row)).not.toContain('Shank Size_in')
  })
})

describe('scraping a family', () => {
  /** A leaf's listing plus a product page per part, as the vendor serves them. */
  function catalog(
    leaf: string,
    parts: { id: string; part: string; name: string; specs: Record<string, string> | null }[],
  ): Record<string, string> {
    const pages: Record<string, string> = {
      [categoryUrl(leaf)]: listingPage(
        parts.length,
        parts.map((p) => listingRow(p.id, p.part, p.name)),
      ),
    }
    for (const p of parts) {
      const url =
        `https://www.maritool.com/Mill-Tool-Holders/c23_25_42/p${p.id}/` +
        `${p.part.replaceAll('.', '-')}/product_info.html`
      pages[url] = productPage(p.specs ?? {}, p.part)
    }
    return pages
  }

  it('writes one row per part, sorted by part number', async () => {
    const { fetcher } = vendor(
      catalog('23_25_42', [
        { id: '2', part: 'CAT40-ER16-3.0', name: 'B', specs: ER16_SPECS },
        { id: '1', part: 'CAT40-ER11-2.5', name: 'A', specs: ER16_SPECS },
      ]),
    )

    const scrape = await scrapeHolders(fetcher, [CAT40_ER], { delayMs: 0 })

    // `order.compare` and never `localeCompare`: collation is a machine's
    // locale setting rather than a property of the data, and a CSV has to be
    // byte-stable for a diff to read it.
    expect(scrape.rows.map((row) => row['Material Number'])).toEqual([
      'CAT40-ER11-2.5',
      'CAT40-ER16-3.0',
    ])
    expect(scrape.familyCode).toBe('23_25_42')
  })

  it('skips a part with no spec table, and says which', async () => {
    // A holder with no gage length cannot be converted, so it is dropped with
    // a message rather than written with holes — and the family's declared
    // `rows` is what proves how many were dropped.
    const warnings: string[] = []
    const { fetcher } = vendor(
      catalog('23_25_42', [
        { id: '1', part: 'CAT50-ER32-3.0', name: 'A', specs: null },
        { id: '2', part: 'CAT40-ER16-3.0', name: 'B', specs: ER16_SPECS },
      ]),
    )

    const scrape = await scrapeHolders(fetcher, [CAT40_ER], {
      delayMs: 0,
      warn: (m) => warnings.push(m),
    })

    expect(scrape.rows).toHaveLength(1)
    expect(warnings.join('\n')).toContain('SKIPPED CAT50-ER32-3.0')
    expect(warnings.join('\n')).toContain('no Product Specifications table')
  })

  it('warns where the downloads header disagrees, and does not correct it', async () => {
    // Two disagreeing vendor cells cannot say which one is wrong. The listing's
    // `Part#` is universal and the header covers about three parts in four, so
    // the listing is what is used — the same call `regofix` made on `J21`.
    const warnings: string[] = []
    const pages = catalog('23_25_42', [
      { id: '1', part: 'CAT40-ER16-3.0', name: 'A', specs: ER16_SPECS },
    ])
    const url = Object.keys(pages).find((k) => k.includes('/p1/'))!
    pages[url] = productPage(ER16_SPECS, 'CAT40-ER16-9.9')

    const scrape = await scrapeHolders(fetcher(pages), [CAT40_ER], {
      delayMs: 0,
      warn: (m) => warnings.push(m),
    })

    expect(scrape.rows[0]?.['Material Number']).toBe('CAT40-ER16-3.0')
    expect(warnings.join('\n')).toContain('calls it CAT40-ER16-9.9')
  })

  it('holds two parts of one leaf in different unit systems', async () => {
    // `c23_46_1552_1558` really is this: `HSK40E-ER11-40` gages 40 mm and
    // `HSK40E-ER16-3.0M` gages 3.0 inches, on one category page. It is the
    // case no per-family `unit` survives.
    const { fetcher } = vendor(
      catalog('23_25_42', [
        {
          id: '1',
          part: 'HSK40E-ER11-40',
          name: 'HSK40E ER11 40mm',
          specs: { ...ER16_SPECS, Taper: 'HSK40E', 'Gage Length': '40mm' },
        },
        {
          id: '2',
          part: 'HSK40E-ER16-3.0M',
          name: 'HSK40E ER16 3.0 Mini Nut',
          specs: { ...ER16_SPECS, Taper: 'HSK40E', 'Gage Length': '3.0' },
        },
      ]),
    )

    const scrape = await scrapeHolders(fetcher, [CAT40_ER], { delayMs: 0 })

    expect(scrape.rows.map((row) => [row['L1_mm'], row['L1_in']])).toEqual([
      ['40', ''],
      ['', '3'],
    ])
    // Both columns are in the header regardless of which row came first.
    expect(scrape.header).toContain('L1_mm')
    expect(scrape.header).toContain('L1_in')
  })

  it('dedupes by products_id across two leaves', async () => {
    // MariTool files a handful of parts under two leaves. A part is one row
    // however many places the store puts it, and the first leaf wins so the
    // output does not depend on which duplicate was reached.
    const warnings: string[] = []
    const pages = {
      ...catalog('23_25_42', [{ id: '1', part: 'CAT40-ER16-3.0', name: 'A', specs: ER16_SPECS }]),
      [categoryUrl('23_25_503')]: listingPage(1, [listingRow('1', 'CAT40-ER16-3.0', 'A')]),
    }

    const scrape = await scrapeHolders(fetcher(pages), [CAT40_ER, CAT40_SHRINK], {
      delayMs: 0,
      warn: (m) => warnings.push(m),
    })

    expect(scrape.rows).toHaveLength(1)
    expect(scrape.rows[0]?.['clamping']).toBe('collet')
    expect(warnings.join('\n')).toContain('DUPLICATE CAT40-ER16-3.0')
  })

  it('refuses a scrape that produced no rows', async () => {
    const { fetcher } = vendor(catalog('23_25_42', []))

    await expect(scrapeHolders(fetcher, [CAT40_ER], { delayMs: 0 })).rejects.toThrow(
      VendorResponseError,
    )
  })

  /** `vendor()`'s fetcher alone, for the cases that do not inspect the URLs. */
  function fetcher(pages: Record<string, string>) {
    return vendor(pages).fetcher
  }
})

describe('the category walk', () => {
  it('takes a child and leaves a sibling of an ancestor', () => {
    // The sidebar renders the whole open branch, so taking every `cPath` link
    // would walk the catalog from any starting point — and take the twenty
    // out-of-scope roots under `c23` with it.
    const html = `<html><head><title>Tool Holders, Collets and Machine Accessories CAT40 - MariTool</title></head>
      <body>
        <a href="https://www.maritool.com/Mill-CAT40-ER/c23_25_42/index.html">ER</a>
        <a href="https://www.maritool.com/Mill-CAT40-Dual/c23_25_432/index.html">Dual</a>
        <a href="https://www.maritool.com/Mill-CAT40-Dual-ER/c23_25_432_433/index.html">grandchild</a>
        <a href="https://www.maritool.com/Mill-BT30/c23_33/index.html">BT30</a>
        <a href="https://www.maritool.com/Mill/c23/index.html">up</a>
      </body></html>`

    const category = parseCategory(html, '23_25')

    expect(category.children).toEqual(['23_25_42', '23_25_432'])
    expect(category.name).toBe('CAT40')
    expect(category.products).toBe(0)
  })

  it('reads a leaf’s own product count', () => {
    const category = parseCategory(
      `<html><head><title>Tool Holders, Collets and Machine Accessories ER Collet Chucks - MariTool</title></head>
       <body>Displaying <b>1</b> to <b>30</b> (of <b>51</b> products)</body></html>`,
      '23_25_42',
    )

    expect(category.children).toEqual([])
    expect(category.products).toBe(51)
    expect(category.name).toBe('ER Collet Chucks')
  })
})

describe('the family table', () => {
  it('gives every family a leaf list, and every leaf list a family', () => {
    // A family with no leaves scrapes nothing and reports it as an empty
    // catalog; a leaf list with no family is a scrape target nothing runs.
    expect(Object.keys(LEAVES).sort()).toEqual(Object.keys(HOLDER_FAMILIES).sort())
  })

  it('states a clamping mode and a style on every leaf', () => {
    // Both are columns rather than family facts, and they come from the leaf —
    // so a leaf missing one would write an empty column for every part in it.
    for (const [name, leaves] of Object.entries(LEAVES)) {
      expect(leaves.length, name).toBeGreaterThan(0)
      for (const leaf of leaves) {
        expect(leaf.cPath, name).toMatch(/^23(_\d+)+$/)
        expect(['collet', 'shrink', 'hydraulic'], `${name} ${leaf.cPath}`).toContain(leaf.clamping)
        expect(leaf.style, `${name} ${leaf.cPath}`).not.toBe('')
      }
    }
  })

  it('claims no leaf twice, across every family', () => {
    // Two families sharing a leaf would write the same parts into two CSVs
    // under two tapers, and the cross-leaf dedupe is per family — it would not
    // see it.
    const all = Object.values(LEAVES).flatMap((leaves) => leaves.map((leaf) => leaf.cPath))

    expect(new Set(all).size).toBe(all.length)
  })

  it('declares no facts, because every candidate is a column', () => {
    // `taper` and `contact` are stated per part; `clamping` and `style` come
    // from the leaf; and `Gage Length` is metric on some parts and imperial on
    // others inside one file, so there is no `unit` to declare. A fact here
    // would be a constant the vendor's own table contradicts row by row.
    for (const [name, cfg] of Object.entries(HOLDER_FAMILIES)) {
      expect(cfg, name).not.toHaveProperty('facts')
      expect(cfg.brand, name).toBe('maritool')
      expect(cfg.rows, name).toBeGreaterThan(0)
    }
  })
})

describe('the politeness delay', () => {
  // These are the only tests in this file that leave `delayMs` at its default.
  // Every other one passes `delayMs: 0`, which is right when the subject is the
  // parsing and is also why none of them can see this: `pause` returns without
  // touching a timer at zero, so a dropped `await pause()` fails nothing.
  //
  // MariTool is the vendor with the most to answer for here — a full run is one
  // request per listing page and then one per part, 529 of them — and the
  // package's rule is that a scrape does not raise request volume. The delay is
  // the whole of what enforces it.

  /** The leaf's listing and a page for each part, keyed the way the store serves them. */
  function pages(parts: string[]): Record<string, string> {
    const rows = parts.map((part, index) => listingRow(String(index + 1), part, part))
    const served: Record<string, string> = {
      [categoryUrl('23_25_42')]: listingPage(parts.length, rows),
    }
    parts.forEach((part, index) => {
      served[
        `https://www.maritool.com/Mill-Tool-Holders/c23_25_42/p${index + 1}/` +
          `${part.replaceAll('.', '-')}/product_info.html`
      ] = productPage(ER16_SPECS, part)
    })
    return served
  }

  it('waits before every product page, and once at the end of a leaf', async () => {
    const { fetcher } = vendor(pages(['CAT40-ER16-3.0', 'CAT40-ER11-2.5']))
    const { waits, restore } = recordPauses()

    try {
      await scrapeHolders(fetcher, [CAT40_ER])
    } finally {
      restore()
    }

    // One per part plus one closing the leaf. The listing page itself is the
    // first request of the run and has nothing to wait behind.
    expect(waits).toEqual([REQUEST_DELAY_MS, REQUEST_DELAY_MS, REQUEST_DELAY_MS])
  })

  it('waits once per leaf beyond the first, not once per family', async () => {
    // Two leaves of one part each: two product pages, two leaf closings.
    const served = pages(['CAT40-ER16-3.0'])
    served[categoryUrl('23_25_503')] = listingPage(1, [listingRow('9', 'CAT40-SF-500-3', 'S')])
    served[
      'https://www.maritool.com/Mill-Tool-Holders/c23_25_42/p9/CAT40-SF-500-3/product_info.html'
    ] = productPage(ER16_SPECS, 'CAT40-SF-500-3')
    const { fetcher } = vendor(served)
    const { waits, restore } = recordPauses()

    try {
      await scrapeHolders(fetcher, [CAT40_ER, CAT40_SHRINK])
    } finally {
      restore()
    }

    expect(waits).toHaveLength(4)
    expect(new Set(waits)).toEqual(new Set([REQUEST_DELAY_MS]))
  })

  it('waits between listing pages, and not before the first', async () => {
    const { fetcher } = vendor({
      [categoryUrl('23_25_42')]: listingPage(2, [listingRow('1', 'A', 'A')]),
      [categoryUrl('23_25_42', 2)]: listingPage(2, [listingRow('2', 'B', 'B')], 2),
    })
    const { waits, restore } = recordPauses()

    try {
      await roster(fetcher, '23_25_42')
    } finally {
      restore()
    }

    expect(waits).toEqual([REQUEST_DELAY_MS])
  })

  it('waits after every category the walk reads', async () => {
    const { fetcher } = vendor({
      [categoryUrl('23_25')]:
        '<html><head><title>CAT40 - MariTool</title></head><body>' +
        '<a href="https://www.maritool.com/s/c23_25_42/index.html">ER</a></body></html>',
      [categoryUrl('23_25_42')]:
        '<html><head><title>ER Collet Chucks - MariTool</title></head>' +
        '<body>Displaying <b>1</b> to <b>1</b> (of <b>7</b> products)</body></html>',
    })
    const { waits, restore } = recordPauses()

    try {
      await discoverCategories(fetcher, ['23_25'], { warn: () => {} })
    } finally {
      restore()
    }

    // A 199-page walk paced by nothing is the one request-volume risk this
    // adapter carries that a scrape does not, because a scrape reads 41 leaves
    // and the walk reads every node above them.
    expect(waits).toEqual([REQUEST_DELAY_MS, REQUEST_DELAY_MS])
  })
})

describe('walking the category tree', () => {
  /** A category page: its own title, and a link per child cPath. */
  const page = (name: string, children: string[], products = 0) =>
    `<html><head><title>Tool Holders, Collets and Machine Accessories ${name} - MariTool</title></head>
     <body>${products > 0 ? `Displaying <b>1</b> to <b>1</b> (of <b>${products}</b> products)` : ''}
     ${children.map((c) => `<a href="https://www.maritool.com/s/c${c}/index.html">x</a>`).join('')}
     </body></html>`

  it('reads a category once, however many parents link to it', async () => {
    // The sidebar renders the whole open branch, so a node is linked from more
    // than one page it is a child of. Without the visited set the walk re-reads
    // it — and a tree whose pages link back up would not terminate at all.
    const { fetcher, asked } = vendor({
      [categoryUrl('23_25')]: page('CAT40', ['23_25_42', '23_25_43']),
      [categoryUrl('23_25_42')]: page('ER Collet Chucks', ['23_25_42_9'], 7),
      [categoryUrl('23_25_43')]: page('Shrink Fit', ['23_25_42_9'], 3),
      [categoryUrl('23_25_42_9')]: page('Metric', [], 4),
    })

    const found = await discoverCategories(fetcher, ['23_25', '23_25'], {
      warn: () => {},
      delayMs: 0,
    })

    expect(asked).toHaveLength(4)
    expect(found.map((c) => c.cPath)).toEqual(['23_25', '23_25_42', '23_25_42_9', '23_25_43'])
  })

  it('warns about a category holding neither a child nor a product', async () => {
    // The symptom of a branch the store has emptied, and of a page whose shape
    // changed enough that neither the child links nor the count parsed. Both
    // are worth a line; neither is worth stopping a walk that is run by hand.
    const warnings: string[] = []
    const { fetcher } = vendor({
      [categoryUrl('23_25')]: page('CAT40', ['23_25_42']),
      [categoryUrl('23_25_42')]: page('ER Collet Chucks', []),
    })

    const found = await discoverCategories(fetcher, ['23_25'], {
      warn: (m) => warnings.push(m),
      delayMs: 0,
    })

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('c23_25_42')
    expect(warnings[0]).toContain('ER Collet Chucks')
    // Warned about, and still reported: the walk's output is what a person
    // reads to decide, and a category dropped from it reads as one that is gone.
    expect(found).toHaveLength(2)
  })

  it('calls a category with no children a leaf, whatever its depth', async () => {
    const { fetcher } = vendor({
      [categoryUrl('23_46')]: page('HSK', ['23_46_63']),
      [categoryUrl('23_46_63')]: page('HSK63A', ['23_46_63_1']),
      [categoryUrl('23_46_63_1')]: page('ER Collet Chucks', [], 12),
    })

    const found = await discoverCategories(fetcher, ['23_46'], { warn: () => {}, delayMs: 0 })

    // Three levels, and only the deepest carries parts. A walk that stopped at
    // depth 2 would report the nine HSK sizes as empty.
    expect(leavesOf(found).map((c) => c.cPath)).toEqual(['23_46_63_1'])
    expect(leavesOf(found)[0]!.products).toBe(12)
  })
})
