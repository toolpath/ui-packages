/**
 * Tests for the scraping half — endpoint construction, table parsing, and the
 * row shape a record mapper then reads.
 *
 * The AEM fetch is mocked at the network seam; everything below it runs for
 * real against saved table markup, because the parsing is the part that breaks
 * when a vendor changes a column.
 */

import { describe, expect, it, vi } from 'vitest'

import { checkIdentityColumns } from '../src/conventions.js'
import { VendorResponseError } from '../src/errors.js'
import {
  DESIGNATION_COLUMN,
  PITCH_COLUMN,
  SYSTEM_COLUMN,
  addThreadPitch,
} from '../src/vendors/kennametal/thread-column.js'
import {
  NO_RESULTS,
  TableParser,
  columnNames,
  parseVariantTable,
  scrapeFamily,
  variantsUrl,
  type Tag,
} from '../src/vendors/kennametal/scrape.js'
import { FAMILY_TITLE_COLUMN } from '../src/conventions.js'
import { REQUEST_DELAY_MS } from '../src/scrape.js'
import { familyPageUrl } from '../src/vendors/kennametal/family.js'
import { PRODUCT_LINE_COLUMN } from '../src/vendors/kennametal/records.js'
import { asFetcher, recordPauses } from './stubs.js'

/**
 * Trimmed to the structure that matters: the leading checkbox column, a
 * repeated "D1" label whose identity lives in the th class, a metric/inch unit
 * pair, a unitless column sharing the "D1" label, a CatNo column carrying a
 * unit class that is NOT a dimension, and a trailing sticky CTA.
 */
const TABLE_HTML = `
<table>
  <tr>
    <th class="collab-checkbox-header"></th>
    <th class="">Material Number</th>
    <th class="CatNo metric">ISO Catalog Number</th>
    <th class="DRL_CUT_D1_MIN metric" data-value="[D1] Cutting Diameter">D1</th>
    <th class="DRL_CUT_D1_MIN inch" data-value="[D1] Cutting Diameter">D1</th>
    <th class="DRL_CUT_D1_SIZE" data-value="[D1] Wire Size">D1</th>
    <th class="" data-value="[Z] Number of Flutes">Z</th>
    <th class="sticky-column">Add to cart</th>
  </tr>
  <tr>
    <td></td><td>4151623</td><td>B041A01000CPG</td>
    <td>1</td><td>0.0394</td><td></td><td>2</td><td>Buy</td>
  </tr>
  <tr>
    <td></td><td>4151624</td><td>B041A01100CPG</td>
    <td>1.1</td><td>0.0433</td><td>#57</td><td>2</td><td>Buy</td>
  </tr>
</table>
`

/** The table above with its two data rows removed. */
const EMPTY_TABLE_HTML = `${TABLE_HTML.split('  <tr>\n    <td></td><td>4151623')[0]}</table>`

/** A fetcher answering every request with `html`, recording the URLs. */
function serving(html: string) {
  const urls: string[] = []
  const fetcher = asFetcher({
    text: vi.fn(async (url: string) => {
      urls.push(url)
      return html
    }),
  })
  return { fetcher, urls }
}

const parse = (html: string) => {
  const parser = new TableParser()
  parser.feed(html)
  return parser.rows
}

describe('the endpoint', () => {
  it('is per brand', () => {
    // WIDIA runs the same component under a different node name; the
    // kennametal URL 404s on widia.com, so this is load-bearing.
    const kmt = variantsUrl('100003658', 'kennametal')
    const widia = variantsUrl('103354322', 'widia')

    expect(kmt).toContain('www.kennametal.com')
    expect(kmt).toContain('/product_variants.variants.100003658.html')
    expect(widia).toContain('www.widia.com')
    expect(widia).toContain('/product_variants_cop.variants.103354322.html')
  })

  it('percent-encodes the facet query', () => {
    // The facet string is full of colons; leaving them raw puts them in the
    // query component where the vendor's own page escapes them.
    expect(variantsUrl('1', 'kennametal')).toContain('query=%3Arelevance%3AobsoleteFacet%3Afalse')
  })
})

describe('parsing the variant table', () => {
  it('takes column identity from the class, not the label', () => {
    // Three columns all render the label 'D1'. Keying off the label would
    // collapse them; identity comes from the th class and data-value.
    const header = parse(TABLE_HTML)[0]!

    expect(columnNames(header)).toEqual([
      null, // checkbox column
      'Material Number',
      'ISO Catalog Number', // CatNo carries a unit class but isn't a dimension
      'D1_mm',
      'D1_in',
      'D1_wire_size', // unitless column sharing the D1 label
      'Z',
      null, // sticky CTA column
    ])
  })

  it('refuses a header whose columns collide', () => {
    // `scrapeFamily` writes `out[name]`, so two columns that reduce to one
    // name lose a column's data under a header the CSV still prints twice.
    // Nothing downstream can tell that happened, so it stops here.
    const colliding = `
<table>
  <tr>
    <th class="">Material Number</th>
    <th class="">D1</th>
    <th class="">D1</th>
  </tr>
</table>
`

    expect(() => columnNames(parse(colliding)[0]!)).toThrow(/both named "D1"/)
  })

  it('filters data rows by a numeric material number', () => {
    // Header and filter rows are rejected on cell 2 not being all digits.
    const { header, rows } = parseVariantTable(TABLE_HTML)

    expect(header).not.toBeNull()
    expect(rows.map((r) => r[1]?.[0])).toEqual(['4151623', '4151624'])
  })

  it('decodes entities in cell text', () => {
    // Matching Python's `convert_charrefs=True`. These tables carry `&deg;`
    // and `&Oslash;`, and a raw `&#248;` would reach the CSV as five
    // characters.
    const rows = parse(
      '<table><tr><th>Material Number</th><th>x</th></tr>' +
        '<tr><td>1</td><td>90&deg; &Oslash;6</td></tr></table>',
    )

    expect(rows[1]?.[1]?.[0]).toBe('90° Ø6')
  })

  it('collapses whitespace in cell text', () => {
    const rows = parse('<table><tr><td>  a \n  b  </td></tr></table>')

    expect(rows[0]?.[0]?.[0]).toBe('a b')
  })

  it('reads a matched-nothing response as a state, not a crash', () => {
    // The vendor renders a notice instead of a table when a query matches
    // nothing. `materials` sweeps 32 facet values per family and most of them
    // legitimately match none, so this is the common path there — and it is
    // what tells `scrapeFamily` a family really is empty.
    expect(parseVariantTable('<div class="no-results">nothing here</div>')).toEqual({
      header: null,
      rows: [],
    })
  })

  it('throws on a response with neither table nor notice', () => {
    // The third case, and the reason the second is not just "no header":
    // reporting an unparseable response as zero rows looks exactly like the
    // vendor discontinuing a family, and would empty a CSV without a word.
    expect(() => parseVariantTable('<div>maintenance</div>')).toThrow(/changed shape/)
    expect(() => parseVariantTable('<div>maintenance</div>')).toThrow(VendorResponseError)
  })
})

describe('scraping a family', () => {
  it('refuses a matched-nothing response as fatal', async () => {
    // `parseVariantTable` returns the no-results case rather than throwing, so
    // the decision that it is fatal *here* lives here. Returning rows anyway
    // would replace a scraped family with an empty one on any day the vendor's
    // facet string changes.
    const { fetcher } = serving('<div class="no-results"></div>')

    await expect(scrapeFamily(fetcher, '100003658')).rejects.toThrow(/no variants/)
  })

  it.each([
    [[], [], []],
    [[['Thread System', 'metric']], ['Thread System'], ['metric']],
    [
      [
        ['Thread System', 'inch'],
        ['Source', 'kmt'],
      ],
      ['Thread System', 'Source'],
      ['inch', 'kmt'],
    ],
  ] as [Tag[], string[], string[]][])(
    'appends %i constant tag columns',
    async (tags, headerTail, rowTail) => {
      // Tag columns carry facts the vendor table never states — the tap
      // families depend on this for Thread System.
      const { fetcher } = serving(TABLE_HTML)

      const result = await scrapeFamily(fetcher, '100003658', 'kennametal', tags)

      expect(result.rows).toHaveLength(2)
      expect(result.header).toEqual([
        'Material Number',
        'ISO Catalog Number',
        'D1_mm',
        'D1_in',
        'D1_wire_size',
        'Z',
        ...headerTail,
      ])
      expect(result.header.map((c) => result.rows[0]?.[c])).toEqual([
        '4151623',
        'B041A01000CPG',
        '1',
        '0.0394',
        '',
        '2',
        ...rowTail,
      ])
      expect(result.header.map((c) => result.rows[1]?.[c])).toEqual([
        '4151624',
        'B041A01100CPG',
        '1.1',
        '0.0433',
        '#57',
        '2',
        ...rowTail,
      ])
    },
  )

  it('passes the brand through', async () => {
    const { fetcher, urls } = serving(TABLE_HTML)

    await scrapeFamily(fetcher, '103354322', 'widia')

    expect(urls[0]).toContain('widia.com')
    expect(urls[0]).toContain('103354322')
  })

  it('yields a header and no rows for an empty table', async () => {
    // Size-0 case: a family whose filter matched nothing still produces a
    // well-formed result rather than a truncated one.
    const { fetcher } = serving(EMPTY_TABLE_HTML)

    const result = await scrapeFamily(fetcher, '1', 'kennametal', [['Thread System', 'inch']])

    expect(result.rows).toEqual([])
    expect(result.header[0]).toBe('Material Number')
    expect(result.header.at(-1)).toBe('Thread System')
  })

  it('carries the provenance a receipt needs', async () => {
    const { fetcher } = serving(TABLE_HTML)

    const result = await scrapeFamily(fetcher, '100003658')

    expect(result.familyCode).toBe('100003658')
    expect(result.source).toContain('variants.100003658.html')
  })
})

describe('the conventions, against the header this adapter writes', () => {
  it('carries the identity columns every other vendor copied', async () => {
    // Kennametal came first, so `conventions.IDENTITY_COLUMNS` is its header
    // text. A rename here is not one vendor's problem: it is the convention
    // two other adapters were written against.
    const { fetcher } = serving(TABLE_HTML)

    const { header } = await scrapeFamily(fetcher, '1')

    expect(() => checkIdentityColumns('kennametal', header)).not.toThrow()
  })

  it('suffixes a unit pair and nothing else', async () => {
    // Column identity here comes from the `<th>` class, and the class is what
    // says a column is a metric/inch pair. A `CatNo` column carries a unit
    // class and is not a dimension — suffixing it would invent a pair the
    // vendor never published.
    const { fetcher } = serving(TABLE_HTML)

    const { header } = await scrapeFamily(fetcher, '1')

    expect(header).toContain('ISO Catalog Number')
    expect(header).not.toContain('ISO Catalog Number_mm')
    expect(header.filter((c) => c.endsWith('_mm') || c.endsWith('_in'))).toEqual(['D1_mm', 'D1_in'])
  })
})

describe('the derived thread-pitch column', () => {
  /** A minimal tap scrape: a designation column and a tagged system column. */
  const taps = {
    header: ['Material Number', DESIGNATION_COLUMN, 'Z', SYSTEM_COLUMN],
    rows: [
      {
        'Material Number': '1',
        [DESIGNATION_COLUMN]: 'M6X1',
        Z: '3',
        [SYSTEM_COLUMN]: 'metric',
      },
      {
        'Material Number': '2',
        [DESIGNATION_COLUMN]: '#4-40',
        Z: '2',
        [SYSTEM_COLUMN]: 'inch',
      },
    ],
    source: 'https://example.test',
    familyCode: '1',
  }

  it('derives a pitch in each row’s own system', () => {
    const result = addThreadPitch(taps)

    expect(result.rows.map((r) => r[PITCH_COLUMN])).toEqual(['1', '0.025'])
  })

  it('inserts the column directly after the designation', () => {
    expect(addThreadPitch(taps).header).toEqual([
      'Material Number',
      DESIGNATION_COLUMN,
      PITCH_COLUMN,
      'Z',
      SYSTEM_COLUMN,
    ])
  })

  it('is safe to re-run', () => {
    // An existing column is dropped and rebuilt rather than appended twice, so
    // re-running is a no-op instead of a widening CSV.
    const once = addThreadPitch(taps)
    const twice = addThreadPitch(once)

    expect(twice.header).toEqual(once.header)
    expect(twice.rows).toEqual(once.rows)
  })

  it('refuses a scrape with no designation column', () => {
    expect(() => addThreadPitch({ ...taps, header: ['Material Number'], rows: [] })).toThrow(
      /no D1-TDZ column/,
    )
  })
})

describe('the family title option', () => {
  const PAGE = `
    <h1>KenCut&trade; FF &bull; HPFT &bull; Square End &bull; Inch</h1>
    <div class="product-info" data-product-code="100003658"></div>
  `

  /** Serves the variants table first and the family page second. */
  function servingBoth() {
    const urls: string[] = []
    const fetcher = asFetcher({
      text: vi.fn(async (url: string) => {
        urls.push(url)
        return url.includes('.variants.') ? TABLE_HTML : PAGE
      }),
    })
    return { fetcher, urls }
  }

  // Off by default: the title is a second request, and a caller that wants
  // dimensions should not pay for one. Every caller written before the option
  // existed keeps the transport it had.
  it('makes one request and writes no title columns unless asked', async () => {
    const { fetcher, urls } = serving(TABLE_HTML)

    const result = await scrapeFamily(fetcher, '100003658')

    expect(urls).toHaveLength(1)
    expect(result.header).not.toContain(FAMILY_TITLE_COLUMN)
    expect(result.header).not.toContain(PRODUCT_LINE_COLUMN)
  })

  it('adds the vendor’s whole title and its leading segment as tag columns', async () => {
    const { fetcher, urls } = servingBoth()

    const result = await scrapeFamily(fetcher, '100003658', 'kennametal', [], {
      familyTitle: true,
      delayMs: 0,
    })

    expect(urls).toHaveLength(2)
    expect(urls[1]).toBe(familyPageUrl('100003658'))
    expect(result.header.slice(-2)).toEqual([FAMILY_TITLE_COLUMN, PRODUCT_LINE_COLUMN])
    // Constant down the whole table, which is what makes them family facts
    // rather than columns — the same shape as `Thread System`.
    for (const row of result.rows) {
      expect(row[FAMILY_TITLE_COLUMN]).toBe('KenCut™ FF • HPFT • Square End • Inch')
      expect(row[PRODUCT_LINE_COLUMN]).toBe('KenCut™ FF')
    }
  })

  it('keeps the caller’s own tags beside them', async () => {
    const { fetcher } = servingBoth()

    const result = await scrapeFamily(
      fetcher,
      '100003658',
      'kennametal',
      [['Thread System', 'inch']],
      { familyTitle: true, delayMs: 0 },
    )

    expect(result.header.slice(-3)).toEqual([
      'Thread System',
      FAMILY_TITLE_COLUMN,
      PRODUCT_LINE_COLUMN,
    ])
    expect(result.rows[0]?.['Thread System']).toBe('inch')
  })

  // A family the vendor publishes with no heading is still a table of real
  // parts. A column of empty strings would read as a vendor stating an empty
  // name, which `toolRecord` refuses outright.
  it('writes neither column for a page with no heading', async () => {
    const fetcher = asFetcher({
      text: vi.fn(async (url: string) =>
        url.includes('.variants.') ? TABLE_HTML : '<div data-product-code="100003658"></div>',
      ),
    })

    const result = await scrapeFamily(fetcher, '100003658', 'kennametal', [], {
      familyTitle: true,
      delayMs: 0,
    })

    expect(result.rows).toHaveLength(2)
    expect(result.header).not.toContain(FAMILY_TITLE_COLUMN)
    expect(result.header).not.toContain(PRODUCT_LINE_COLUMN)
  })

  // The table first, so a family the vendor no longer publishes fails on the
  // rows it does not have rather than on a title nobody would have read.
  it('reads the table before the title', async () => {
    const fetcher = asFetcher({
      text: vi.fn(async (url: string) =>
        url.includes('.variants.') ? `<div ${NO_RESULTS}></div>` : PAGE,
      ),
    })

    await expect(
      scrapeFamily(fetcher, '100003658', 'kennametal', [], { familyTitle: true, delayMs: 0 }),
    ).rejects.toThrow(/no variants/)
  })

  it('paces itself between the two requests', async () => {
    const { waits, restore } = recordPauses()
    try {
      const { fetcher } = servingBoth()
      await scrapeFamily(fetcher, '100003658', 'kennametal', [], { familyTitle: true })
      expect(waits).toEqual([REQUEST_DELAY_MS])
    } finally {
      restore()
    }
  })
})
