/**
 * The REGO-FIX half — the ProductFinder index, the DIN 4000 documents, and the
 * row shape a consumer then reads.
 *
 * Network is mocked at the two seams that are network (the search proxy and
 * the per-part XML); everything below runs for real against saved payloads,
 * because parsing is what breaks when a vendor changes shape. The cases that
 * run over a real scrape arrive with the corpus harness.
 *
 * **The tests worth reading twice are the ones about the three pinned DIN
 * codes and about where a collet's size comes from.** Both are places where a
 * plausible reading of the vendor's data is wrong, and neither would throw.
 */

import { describe, expect, it, vi } from 'vitest'

import { CAD_COLUMN, checkIdentityColumns } from '../src/conventions.js'
import { VendorResponseError } from '../src/errors.js'
import { HttpError } from '../src/fetch.js'
import {
  BT30_GAUGE_TO_FLANGE,
  colletRow,
  fetchDin4000,
  holderRow,
  one,
  parseDin4000,
  parseSize,
  scrapeHolders,
  search,
  type Source,
} from '../src/vendors/regofix/scrape.js'
import { asFetcher } from './stubs.js'

/**
 * The BT 30 / PG 25 x 075 document, trimmed to the properties this package
 * reads plus two it deliberately does not. Values are verbatim from
 * `XML_DIN4000/XML/213072530.xml` (fetched JG 2026-08-07).
 */
const DIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tool-Data><Tool><Properties>
  <Property-Data>
    <PropertyName source="din_mk">J21</PropertyName><Value>2130.72530</Value>
  </Property-Data>
  <Property-Data>
    <PropertyName source="din_mk">J1</PropertyName><Value>DINISO7388-2</Value>
  </Property-Data>
  <Property-Data>
    <PropertyName source="din_mk">A1</PropertyName><Value>40</Value>
  </Property-Data>
  <Property-Data>
    <PropertyName source="din_mk">A4</PropertyName><Value>46</Value>
  </Property-Data>
  <Property-Data>
    <PropertyName source="din_mk">A6</PropertyName><Value></Value>
  </Property-Data>
  <Property-Data>
    <PropertyName source="din_mk">B3</PropertyName><Value>75</Value>
  </Property-Data>
  <Property-Data>
    <PropertyName source="din_mk">B4</PropertyName><Value>123.4</Value>
  </Property-Data>
  <Property-Data>
    <PropertyName source="din_mk">A2</PropertyName><Value>42</Value>
  </Property-Data>
  <Property-Data>
    <PropertyName source="din_mk">B3_WOA</PropertyName><Value>69</Value>
  </Property-Data>
</Properties></Tool></Tool-Data>
`

/**
 * One `_source`, as the proxy returns it — every value a list, even the ones
 * that are always single.
 */
const HIT: Source = {
  title: ['BT 30 / PG 25 x 075'],
  field_sku_fulltext: ['2130.72530'],
  form_name: ['Standard'],
  norm_size: ['25'],
  field_technical_drawings_url: [
    '//static.rego-fix.com/x/DXF/213072530.dxf',
    '//static.rego-fix.com/x/STP/213072530.stp',
  ],
}

function properties(overrides: Record<string, string> = {}) {
  return { ...parseDin4000(DIN_XML), ...overrides }
}

/** A fetcher answering the proxy with `payload`, recording the request body. */
function proxy(payload: unknown) {
  const sent: { url?: string; body?: unknown } = {}
  const fetcher = asFetcher({
    postJson: vi.fn(async (url: string, body: unknown) => {
      sent.url = url
      sent.body = body
      return payload
    }),
  })
  return { fetcher, sent }
}

const hits = (sources: Source[]) => ({
  hits: { total: sources.length, hits: sources.map((s) => ({ _source: s })) },
})

describe('the search proxy', () => {
  it('sends an AND of term filters', async () => {
    const { fetcher, sent } = proxy(hits([HIT]))

    const sources = await search(fetcher, { type: 'toolholders', a: 'b' })

    expect(sent.url).toContain('/elastic/post')
    expect(sent.body).toEqual({
      size: 500,
      query: {
        bool: {
          filter: [{ term: { type: 'toolholders' } }, { term: { a: 'b' } }],
        },
      },
    })
    expect(sources).toEqual([HIT])
  })

  it('refuses a roster larger than the request rather than truncating', async () => {
    // A silently truncated roster is the failure this whole package is built
    // to notice.
    const { fetcher } = proxy({ hits: { total: 900, hits: [] } })

    await expect(search(fetcher, { a: 'b' })).rejects.toThrow(/900 products but only 500 requested/)
  })

  it('reports a response without hits as a changed endpoint', async () => {
    const { fetcher } = proxy({ took: 3 })

    await expect(search(fetcher, { a: 'b' })).rejects.toThrow(/carries no "hits"/)
  })
})

describe('reading a source field', () => {
  it('reads a single-valued field and treats absent as null', () => {
    // Elasticsearch stores every value as a list even when there is exactly
    // one, and `o_inch` is absent on a metric collet — the vendor saying it is
    // metric rather than a gap.
    expect(one({ a: ['x'] }, 'a')).toBe('x')
    expect(one({ a: [1, 2] }, 'a')).toBe(1)
    expect(one({ a: [] }, 'a')).toBeNull()
    expect(one({}, 'a')).toBeNull()
  })
})

describe('the DIN 4000 document', () => {
  it('parses properties and drops the blank ones', () => {
    // The document repeats a pair per property and states most of them empty,
    // so dropping blanks is what makes "the vendor published this" and "the
    // vendor published a hole" different states.
    const parsed = parseDin4000(DIN_XML)

    expect(parsed['A1']).toBe('40')
    expect(parsed['B4']).toBe('123.4')
    expect(parsed).not.toHaveProperty('A6')
  })

  it('throws on a document with no properties rather than reading it as empty', () => {
    expect(() => parseDin4000('<Tool-Data></Tool-Data>')).toThrow(/format changed shape/)
  })

  it('reads a 404 as "the vendor publishes none", not as a failure', async () => {
    // Two of the BT+ 30 holders have DXF and PDF but no XML.
    const fetcher = asFetcher({
      text: vi.fn(async () => {
        throw new HttpError('https://static.rego-fix.test/x.xml', 404)
      }),
    })

    expect(await fetchDin4000(fetcher, '4130.71506')).toBeNull()
  })

  it('lets any other status through as a failure', async () => {
    const fetcher = asFetcher({
      text: vi.fn(async () => {
        throw new HttpError('https://static.rego-fix.test/x.xml', 503)
      }),
    })

    await expect(fetchDin4000(fetcher, '1')).rejects.toThrow(/answered 503/)
  })

  it('strips the dot from the part number to build the filename', async () => {
    const urls: string[] = []
    const fetcher = asFetcher({
      text: vi.fn(async (url: string) => {
        urls.push(url)
        return DIN_XML
      }),
    })

    await fetchDin4000(fetcher, '2130.72530')

    expect(urls[0]).toContain('/213072530.xml')
  })
})

describe('the three pinned DIN codes', () => {
  it('takes the gage length from B4, because B4 - B3 is the taper offset', () => {
    // Nothing in the vendor's XML says B4 is a gage length. What says it is
    // that `B4 - B3` is 48.4 mm on every row, and 48.4 is BT 30's
    // gauge-line-to-flange distance in REGO-FIX's own interface table. Break
    // that and the mapping is unfounded, so it is refused rather than
    // converted.
    const row = holderRow(HIT, properties())

    expect(row['L1_mm']).toBe('123.4')
    expect(row['B3_mm']).toBe('75')
    // `123.4 - 75` is 48.400000000000006 in binary floating point, which is
    // why `holderRow` compares to a tolerance rather than for equality.
    expect(Number(row['L1_mm']) - Number(row['B3_mm'])).toBeCloseTo(BT30_GAUGE_TO_FLANGE, 9)

    expect(() => holderRow(HIT, properties({ B4: '120' }))).toThrow(
      /B4 is not the gage length here/,
    )
  })

  it('refuses a flange that is not a BT 30 flange', () => {
    // `A4` is 46 on every BT 30 holder — the taper's flange diameter, not the
    // part's. It is checked rather than stored: a document where it differs is
    // not the interface this family claims.
    expect(() => holderRow(HIT, properties({ A4: '63' }))).toThrow(/not the 46 mm flange/)
  })

  it.each(['A1', 'B3', 'B4'])('refuses a missing %s rather than defaulting', (code) => {
    expect(() => holderRow(HIT, properties({ [code]: '' }))).toThrow(
      new RegExp(`publishes no ${code}`),
    )
  })

  it('carries the unpinned codes verbatim and never promotes them', () => {
    // `A2`, `B1`, `B2` and `B3_WOA` have no meaning this repo can cite, so
    // they keep their raw DIN code behind a `DIN_` prefix. A column named
    // `A2_mm` would sit beside `L1_mm` looking exactly as mapped as it is not.
    const row = holderRow(HIT, properties())

    expect(row['DIN_A2']).toBe('42')
    expect(row['DIN_B3_WOA']).toBe('69')
    expect(row['DIN_B1']).toBe('')
    expect(row['DIN_B2']).toBe('')
    for (const key of Object.keys(row)) {
      expect(['A2', 'B1', 'B2', 'B3_WOA'].some((code) => key.startsWith(code))).toBe(false)
    }
  })
})

describe('a holder row', () => {
  it('maps to a collet-clamping row, hand-checked', () => {
    expect(holderRow(HIT, properties())).toEqual({
      'Material Number': '2130.72530',
      'ISO Catalog Number': 'BT 30 / PG 25 x 075',
      CST: 'PG25',
      contact: 'taper',
      L1_mm: '123.4',
      D2_mm: '40',
      B3_mm: '75',
      [CAD_COLUMN]: 'https://static.rego-fix.com/x/STP/213072530.stp',
      DIN_A2: '42',
      DIN_B1: '',
      DIN_B2: '',
      DIN_B3_WOA: '69',
    })
  })

  it('carries no D1 anywhere', () => {
    // A powRgrip holder clamps through a collet, and a collet-clamping holder
    // that also carried a bore would be claiming two ways of gripping one tool.
    const row = holderRow(HIT, properties())

    expect(Object.keys(row).some((key) => key.startsWith('D1'))).toBe(false)
  })

  it('reads the plus form as face contact, and refuses an unknown one', () => {
    // REGO-FIX publishes both forms as rows of one product group, so a family
    // constant could not tell them apart. `BT-OM 30` is the third form in that
    // same group and nothing published says what OM designates — so it fails
    // loudly rather than being recorded as a plain taper on no evidence.
    const plus = {
      ...HIT,
      form_name: ['Plus +'],
      title: ['BT+ 30 / PG 25 x 080'],
    }
    expect(holderRow(plus, properties())['contact']).toBe('face')

    expect(() => holderRow({ ...HIT, form_name: ['Whatever'] }, properties())).toThrow(
      /not a contact mode this package knows/,
    )
  })

  it('warns about a part number the document disagrees with', () => {
    // One real REGO-FIX document states the wrong part number for itself
    // (`4130.70646` calls itself `4130.71646`). The index's number is used and
    // the disagreement is reported — never corrected.
    const warnings: string[] = []
    const row = holderRow(HIT, properties({ J21: '9999.99999' }), (m) => warnings.push(m))

    expect(row['Material Number']).toBe('2130.72530')
    expect(warnings.join('\n')).toContain('calls itself 9999.99999')
  })

  it('gives a holder with no STEP model an empty CAD column', () => {
    expect(holderRow({ ...HIT, field_technical_drawings_url: [] }, properties())[CAD_COLUMN]).toBe(
      '',
    )
  })

  it('refuses a title it cannot read a taper off', () => {
    expect(() => holderRow({ ...HIT, title: ['Cleaning paper set'] }, properties())).toThrow(
      /cannot read a taper and series off/,
    )
  })

  it('carries the identity columns', () => {
    expect(() =>
      checkIdentityColumns('regofix', Object.keys(holderRow(HIT, properties()))),
    ).not.toThrow()
  })

  it('gives every dimension its unit', () => {
    const row = holderRow(HIT, properties())
    const dimensions = Object.keys(row).filter((k) => !k.startsWith('DIN_') && /^[A-Z]\d/.test(k))

    for (const key of dimensions) {
      expect(key, key).toMatch(/_(mm|in)$/)
    }
  })
})

describe('a collet row', () => {
  it.each([
    ['PG 25 Ø 3.5 mm', 'millimeters', '3.5', '3.5'],
    ['PG 25 Ø 10.0 mm', 'millimeters', '10', '10'],
    ['PG 25 Ø 3/8"', 'inches', '0.375', '9.525'],
    ['PG 15-CF Ø 1/16"', 'inches', '0.0625', '1.5875'],
    ['PGST 25 Ø 16.0 mm', 'millimeters', '16', '16'],
    // A tapping collet marks *every* number when it is inch and only the last
    // when it is metric. Both shapes, because a pattern that reads one reads
    // the other as unparseable.
    ['PG 15-TAP Ø 0.141" x 0.110"', 'inches', '0.141', '3.5814'],
    ['PG 15-TAP Ø 3.5 x 2.7 mm', 'millimeters', '3.5', '3.5'],
  ])('reads %s off the vendor’s own designation', (title, unit, native, mm) => {
    const row = colletRow({
      title: [title],
      field_sku_fulltext: ['1725.00000'],
      norm_size: ['25'],
    })

    expect(row['unit']).toBe(unit)
    const suffix = unit === 'inches' ? 'in' : 'mm'
    expect(row[`D1_${suffix}`]).toBe(native)
    expect(row['D1_mm']).toBe(mm)
    // A PG collet clamps one size, so its capacity is its nominal at both ends.
    expect(row[`CCCN_${suffix}`]).toBe(native)
    expect(row[`CCCX_${suffix}`]).toBe(native)
  })

  it('is exact where the index is rounded', () => {
    // The reason the size is parsed rather than read. `o_mm` is stated to two
    // decimals, so a 3/8 in collet is 9.53 there against a true 9.525 — five
    // microns, where a fit test sizes its equality to two. Every inch collet
    // would have failed to match a shank of its own size: no error, no empty
    // state, just a stocked part a picker never offers.
    const row = colletRow({
      title: ['PG 25 Ø 3/8"'],
      field_sku_fulltext: ['1725.09531'],
      o_mm: [9.53],
      norm_size: ['25'],
    })

    // 9.525 exactly, not the 9.525000000000002 that `0.375 * 25.4` evaluates
    // to — the row rounds to six places, which removes float error rather than
    // adding precision.
    expect(row['D1_mm']).toBe('9.525')
    expect(0.375 * 25.4).not.toBe(9.525)
    expect(Number(row['D1_mm'])).toBeCloseTo(0.375 * 25.4, 12)
    expect(row['o_mm']).toBe('9.53')
  })

  it('warns where the index size contradicts the designation', () => {
    // Two REGO-FIX tapping collets carry the *previous row's* `o_mm`. The
    // tolerance is half a unit in the last decimal the vendor printed —
    // 0.005 mm — not a number picked by feel.
    const quiet: string[] = []
    const within = colletRow(
      {
        title: ['PG 25 Ø 3/8"'],
        field_sku_fulltext: ['1725.09531'],
        o_mm: [9.53],
      },
      (m) => quiet.push(m),
    )
    expect(quiet).toEqual([])
    expect(Number(within['D1_mm'])).toBe(9.525)

    const loud: string[] = []
    colletRow(
      {
        title: ['PG 25 Ø 0.323"'],
        field_sku_fulltext: ['1725.08215'],
        o_mm: [9.68],
      },
      (m) => loud.push(m),
    )
    expect(loud.join('\n')).toContain('o_mm = 9.68 where the designation is 8.2042 mm')
  })

  it('refuses a designation that states no unit system', () => {
    // This catalog does not guess a unit system, and a bare number is exactly
    // the case where guessing looks harmless.
    expect(() =>
      colletRow({
        title: ['PG 25 Ø 3.5'],
        field_sku_fulltext: ['1725.03500'],
      }),
    ).toThrow(/states none/)
  })

  it('refuses an unreadable designation rather than skipping it', () => {
    expect(() =>
      colletRow({
        title: ['Cleaning paper set CPS'],
        field_sku_fulltext: ['9999.00000'],
      }),
    ).toThrow(/cannot read a size off/)
  })

  it('keeps the short-tail series distinct from the PG one', () => {
    // `PGST 15` is not `PG 15`. REGO-FIX sells dedicated short-tail
    // toolholders, and nothing published says a PGST collet also seats in a
    // plain PG holder — so the series is written as designated and matches no
    // PG holder. Widening the string would offer an assembly that may not
    // exist, which costs a machinist a purchase; leaving it costs an option.
    const pgst = colletRow({
      title: ['PGST 15 Ø 10.0 mm'],
      field_sku_fulltext: ['1815.10000'],
    })
    const pg = colletRow({
      title: ['PG 15 Ø 10.0 mm'],
      field_sku_fulltext: ['1715.10000'],
    })

    expect(pgst['Collet Series']).toBe('PGST15')
    expect(pg['Collet Series']).toBe('PG15')
  })

  it('carries a tapping collet’s drive square in its own unit, and in mm', () => {
    const inch = colletRow({
      title: ['PG 15-TAP Ø 0.141" x 0.110"'],
      field_sku_fulltext: ['1715.00001'],
    })
    const metric = colletRow({
      title: ['PG 15-TAP Ø 3.5 x 2.7 mm'],
      field_sku_fulltext: ['1715.00002'],
    })

    expect(inch['Square_in']).toBe('0.11')
    // Projected like `D1`: the millimetre cell is what fit arithmetic
    // compares, so an inch square that lived only in `Square_in` was invisible
    // to it.
    expect(inch['Square_mm']).toBe('2.794')
    expect(metric['Square_mm']).toBe('2.7')
    expect(metric['Square_in']).toBe('')
  })
})

describe('a size designation', () => {
  it('is refused rather than returned as NaN', () => {
    // Same rule `thread.threadMajorDiameter` holds: an unreadable designation
    // used to fall through to arithmetic on NaN and reach a row as one.
    expect(() => parseSize('3/')).toThrow(RangeError)
    expect(() => parseSize('')).toThrow(RangeError)
    expect(parseSize('1/4')).toBe(0.25)
  })
})

describe('scraping holders', () => {
  /** A fetcher serving one roster and per-part XML from a map. */
  function vendor(sources: Source[], xml: Record<string, string>) {
    return asFetcher({
      postJson: vi.fn(async () => hits(sources)),
      text: vi.fn(async (url: string) => {
        const sku = url.split('/').at(-1)?.replace('.xml', '') ?? ''
        const found = xml[sku]
        if (found === undefined) throw new HttpError(url, 404)
        return found
      }),
    })
  }

  it('skips a part with no dimension document, and says so', async () => {
    // A holder without a gage length cannot be converted, so it is dropped
    // with a message rather than written with holes.
    const other: Source = {
      ...HIT,
      title: ['BT 30 / PG 15 x 075'],
      field_sku_fulltext: ['2130.71575'],
    }
    const warnings: string[] = []

    const result = await scrapeHolders(
      vendor([HIT, other], { '213072530': DIN_XML }),
      'BT/PG',
      'BT',
      { warn: (m) => warnings.push(m) },
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.['Material Number']).toBe('2130.72530')
    expect(warnings.join('\n')).toContain('SKIPPED 2130.71575')
  })

  it('takes only the tapers this package can name', async () => {
    // `BT-OM 30` is published in the same product group and nothing says what
    // OM designates, so recording a spindle interface for it would be a guess
    // about which machine a holder fits.
    const om: Source = {
      ...HIT,
      title: ['BT-OM 30 / PG 25 x 075'],
      field_sku_fulltext: ['2130.99999'],
    }

    const result = await scrapeHolders(
      vendor([HIT, om], { '213072530': DIN_XML, '213099999': DIN_XML }),
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.['ISO Catalog Number']).toBe('BT 30 / PG 25 x 075')
  })

  it('refuses a scrape that produced no rows', async () => {
    await expect(scrapeHolders(vendor([], {}))).rejects.toThrow(VendorResponseError)
  })
})
