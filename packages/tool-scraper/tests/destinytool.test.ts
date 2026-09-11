/**
 * Destiny Tool: the Firestore pagination client and the description-parsing
 * adapter derivations.
 *
 * Network is mocked at the one seam that is network — the {@link Fetcher} the
 * scrape takes. Everything below it — value decoding, the fraction parser, and
 * the three free-text derivations (shank diameter, corner radius, neck
 * diameter) — runs against literals, and the real ones were all found or
 * corrected running the Python against the actual Firestore collection
 * 2026-08-19; the evidence for each is in `vendors/destinytool/records.ts`
 * beside the code it justifies.
 */

import { describe, expect, it, vi } from 'vitest'

import { checkIdentityColumns, identityColumns } from '../src/conventions.js'
import { VendorResponseError } from '../src/errors.js'
import type { BoundFamily } from '../src/family.js'
import { checkColumnMap } from '../src/records.js'
import { FAMILIES } from '../src/families/destinytool.js'
import {
  ITEM_NUMBER,
  cornerRadius,
  endmillRecord,
  materialGroups,
  parseFractionInches,
  shankDiameter,
  shoulderDiameter,
} from '../src/vendors/destinytool/records.js'
import {
  DIMENSIONAL_FIELDS,
  FIELDS,
  PAGE_SIZE,
  decodeDocument,
  decodeValue,
  fetchProducts,
  scrapeEndMills,
  type FirestoreValue,
} from '../src/vendors/destinytool/scrape.js'
import { asFetcher } from './stubs.js'

/** A fetcher that answers `documents.list` with one page per call, in order. */
function pages(...answers: unknown[]) {
  const urls: string[] = []
  const queue = [...answers]
  const fetcher = asFetcher({
    json: vi.fn(async (url: string) => {
      urls.push(url)
      return queue.shift()
    }),
  })
  return { fetcher, urls }
}

const doc = (itemNumber: string) => ({
  fields: { itemNumber: { stringValue: itemNumber } },
})

const product = (
  itemNumber: string,
  type = 'End Mill',
  fields: Record<string, FirestoreValue> = {},
): Record<string, FirestoreValue> => ({ itemNumber, type, ...fields })

describe('Firestore value decoding', () => {
  it.each([
    [{ stringValue: 'DR36424R093S' }, 'DR36424R093S'],
    [{ stringValue: '' }, ''],
    [{ integerValue: '3' }, 3],
    [{ doubleValue: 1.5 }, 1.5],
    [{ booleanValue: true }, true],
    [{ nullValue: null }, null],
    [{ arrayValue: {} }, []],
    [{ arrayValue: { values: [{ stringValue: 'N' }] } }, ['N']],
    [{ arrayValue: { values: [{ stringValue: 'P' }, { stringValue: 'M' }] } }, ['P', 'M']],
  ])('decodes %j', (value, expected) => {
    expect(decodeValue(value as Record<string, unknown>)).toEqual(expected)
  })

  it('refuses an unrecognized shape', () => {
    expect(() => decodeValue({ geoPointValue: {} })).toThrow(VendorResponseError)
  })

  it('flattens a document’s fields', () => {
    expect(
      decodeDocument({
        fields: {
          itemNumber: { stringValue: 'X1' },
          flutes: { integerValue: '2' },
        },
      }),
    ).toEqual({ itemNumber: 'X1', flutes: 2 })
  })

  it('reads a document with no fields as empty', () => {
    expect(decodeDocument({})).toEqual({})
  })
})

describe('pagination', () => {
  it('pages until there is no token', async () => {
    const { fetcher, urls } = pages(
      { documents: [doc('A'), doc('B')], nextPageToken: 'tok1' },
      { documents: [doc('C')], nextPageToken: 'tok2' },
      { documents: [] },
    )

    const products = await fetchProducts(fetcher)

    expect(products.map((p) => p['itemNumber'])).toEqual(['A', 'B', 'C'])
    expect(urls).toHaveLength(3)
    expect(urls[1]).toContain('pageToken=tok1')
    expect(urls[2]).toContain('pageToken=tok2')
  })

  it('stops on a token with zero documents', async () => {
    // A page with a token but no documents would loop forever if only the
    // token were checked — this is the guard against that.
    const { fetcher, urls } = pages(
      { documents: [doc('A')], nextPageToken: 'tok1' },
      { documents: [], nextPageToken: 'tok2' },
    )

    const products = await fetchProducts(fetcher)

    expect(products.map((p) => p['itemNumber'])).toEqual(['A'])
    expect(urls).toHaveLength(2)
  })

  it('carries the field mask and the page size', async () => {
    const { fetcher, urls } = pages({ documents: [] })

    await fetchProducts(fetcher)

    for (const field of FIELDS) {
      expect(urls[0]).toContain(`mask.fieldPaths=${field}`)
    }
    expect(urls[0]).toContain(`pageSize=${PAGE_SIZE}`)
  })

  it('stops immediately on a single page of zero documents', async () => {
    const { fetcher, urls } = pages({ documents: [] })

    expect(await fetchProducts(fetcher)).toEqual([])
    expect(urls).toHaveLength(1)
  })
})

describe('scraping end mills', () => {
  /** A fetcher answering one page holding `products`, already decoded-shaped. */
  function collection(products: Record<string, FirestoreValue>[]) {
    const documents = products.map((p) => ({
      fields: Object.fromEntries(
        Object.entries(p).map(([k, v]) => [
          k,
          Array.isArray(v)
            ? { arrayValue: { values: v.map((x) => ({ stringValue: x })) } }
            : { stringValue: String(v) },
        ]),
      ),
    }))
    return pages({ documents }).fetcher
  }

  it('filters to End Mill and sorts by item number', async () => {
    const result = await scrapeEndMills(
      collection([product('Z1'), product('A9', 'Drill'), product('A1')]),
    )

    expect(result.rows).toHaveLength(2)
    expect(result.rows.map((r) => r[ITEM_NUMBER])).toEqual(['A1', 'Z1'])
  })

  it('refuses a collection with none', async () => {
    await expect(scrapeEndMills(collection([product('A1', 'Drill')]))).rejects.toThrow(
      /no End Mill rows/,
    )
  })

  it('suffixes the dimensional columns with _in and nothing else', async () => {
    const result = await scrapeEndMills(collection([product('A1', 'End Mill', { cutDia: '1/4' })]))

    for (const field of DIMENSIONAL_FIELDS) {
      expect(result.header).toContain(`${field}_in`)
      expect(result.header).not.toContain(field)
    }
    expect(result.rows[0]?.['cutDia_in']).toBe('1/4')
  })

  it('writes an array field space-separated', async () => {
    // The multi-value convention every vendor's CSV follows.
    const result = await scrapeEndMills(
      collection([product('A1', 'End Mill', { isoMaterialGroups: ['N', 'P'] })]),
    )

    expect(result.rows[0]?.['isoMaterialGroups']).toBe('N P')
  })

  it('carries the provenance a receipt needs', async () => {
    const result = await scrapeEndMills(collection([product('A1')]))

    expect(result.source).toContain('firestore.googleapis.com')
    // No family code: the scrape target is a collection, not a family page.
    expect(result.familyCode).toBeNull()
  })
})

describe('parsing a dimension', () => {
  it('refuses an empty string', () => {
    expect(() => parseFractionInches('')).toThrow(RangeError)
  })

  it.each([
    ['.093', 0.093],
    ['1"', 1.0],
    ['3/4', 0.75],
    ['1-1/2', 1.5],
    ['1-1/2"', 1.5],
    ['1', 1.0],
    ['.0225', 0.0225],
    ['5/64', 5 / 64],
  ])('reads %s', (text, expected) => {
    expect(parseFractionInches(text)).toBeCloseTo(expected, 10)
  })

  it('refuses a string that is not a dimension', () => {
    // `Number('')` is 0 and `Number('abc')` is NaN — the second would sail
    // through as a geometry value without the finite check.
    expect(() => parseFractionInches('abc')).toThrow(RangeError)
  })
})

describe('shank diameter, from the description’s SHK annotation', () => {
  it('defaults to the cut diameter when not stated', () => {
    expect(shankDiameter('PYTHON 5/8, 5 FLT, 3/4 LOC, 3-1/2 OAL, S/E', 0.625)).toBe(0.625)
  })

  it('reads a simple fraction', () => {
    expect(
      shankDiameter('COBRA MINI .078 DIA, 2 FLT, .234 LOC, 1/8 SHK, 1-1/2 OAL', 0.078),
    ).toBeCloseTo(0.125, 10)
  })

  it('reads a quoted shank', () => {
    expect(shankDiameter('DBACK 1, 3 FLT, 1-1/2 LOC, 1/4" SHK, 4 OAL', 1.0)).toBeCloseTo(0.25, 10)
  })

  it('ignores an unrelated number before SHK', () => {
    expect(
      shankDiameter('VIPER MINI 5/64 DIA, 2 FLT, .117 LOC, 1/8 SHK, 3 OAL, .375 LBS', 5 / 64),
    ).toBeCloseTo(0.125, 10)
  })
})

describe('corner radius, and its four-way priority', () => {
  it('prefers the structured cell', () => {
    expect(cornerRadius('irrelevant .999 RAD', 'Corner Radius', 'W1', 1.0, 0.093)).toBe(0.093)
  })

  it('is half the diameter on a ball end mill', () => {
    expect(
      cornerRadius('BALL VIPER 3/16, 2 FLT, 3/8 LOC, 2 OAL', 'Ball', 'W1', 0.1875, null),
    ).toBeCloseTo(0.09375, 10)
  })

  it('recovers a single value from the description', () => {
    expect(
      cornerRadius(
        'VIPER 3/16, 3 FLT, 3/4 LOC, .015 RAD, 2-1/2 OAL',
        'Corner Radius',
        'W1',
        0.1875,
        null,
      ),
    ).toBeCloseTo(0.015, 10)
  })

  it('does not drop the leading dot of a decimal', () => {
    // The regression the missing word-boundary anchor exists to prevent:
    // `\b[\d.]+` on `.090 RAD` starts at the `0` and yields 90, not 0.09.
    expect(
      cornerRadius('DVH 1, 4 FLT, 1 LOC, .090 RAD, 3 OAL', 'Corner Radius', 'W1', 1.0, null),
    ).toBeCloseTo(0.09, 10)
  })

  it('recovers the upper bound of a description range', () => {
    // Corroborated over the real scrape: across the 370 rows that state a
    // range and also publish a populated structured cell, the cell equals the
    // upper bound 352 times and the lower bound 18 times.
    expect(
      cornerRadius(
        'DVH ROUGHER 1, 4 FLT, 1-1/2 LOC, .035-.040 RAD, 7 OAL',
        'Corner Radius',
        'W1',
        1.0,
        null,
      ),
    ).toBeCloseTo(0.04, 10)
  })

  it('falls back to flat when nothing states one', () => {
    expect(
      cornerRadius(
        'DVH 3/4, 7 FLT, 1 1/4 LOC, 4 OAL, Xtreme Plus',
        'Corner Radius',
        'W1',
        0.75,
        null,
      ),
    ).toBe(0)
  })

  it('refuses a description value past half the diameter, and says so', () => {
    // `V33220R093` states "0.93 RAD" in its description where its two siblings
    // and its own item number's `093` suffix all agree the true value is .093
    // — a vendor typo missing a leading zero. A recovered value that would
    // make the tool geometrically impossible is not used.
    const warnings: string[] = []
    const result = cornerRadius(
      'VIPER 1/2, 3 FLT, 1-1/4 LOC, 0.93 RAD, 3 OAL',
      'Corner Radius',
      'V33220R093',
      0.5,
      null,
      (message) => warnings.push(message),
    )

    expect(result).toBe(0)
    expect(warnings.join('\n')).toContain('V33220R093')
  })

  it('reports through the caller’s warn rather than printing', () => {
    // The Python printed. A library must not: a backend wants these in its own
    // log and a CLI wants them on stderr.
    const warn = vi.fn()
    cornerRadius('x 0.93 RAD', 'Corner Radius', 'W1', 0.5, null, warn)

    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('neck diameter, from the description’s NECK annotation', () => {
  it('defaults to the cut diameter when not stated', () => {
    expect(
      shoulderDiameter('COBRA MINI .078 DIA, 2 FLT, .234 LOC, 1/8 SHK, 1-1/2 OAL', 0.078),
    ).toBe(0.078)
  })

  it('reads the annotation', () => {
    expect(
      shoulderDiameter(
        'VIPER MINI 5/64 DIA, 2 FLT, .117 LOC, 1/8 SHK, 3 OAL, .375 LBS, ' +
          '.074 NECK, STEALTH COATING',
        5 / 64,
      ),
    ).toBeCloseTo(0.074, 10)
  })
})

describe('material groups', () => {
  it('uses the vendor cell when populated, and says the vendor stated it', () => {
    expect(materialGroups({ isoMaterialGroups: 'P M S' }, 5)).toEqual({
      materialGroups: ['P', 'M', 'S'],
      materialGroupsSource: 'vendor-stated',
    })
  })

  it('reorders the vendor cell onto the ISO sequence', () => {
    // Destiny Tool's own array order is not the ISO 513 sequence every other
    // list in the catalog agrees on — real values seen include
    // `['M', 'P', 'S']` — so a populated cell is reordered, not passed through.
    expect(materialGroups({ isoMaterialGroups: 'M P S K H' }, 5).materialGroups).toEqual([
      'P',
      'M',
      'K',
      'S',
      'H',
    ])
  })

  it('falls back to non-ferrous at or below three flutes, labelled derived', () => {
    // The label is what lets a consumer that will not route a cut off this
    // package's arithmetic filter the fallback out. It was indistinguishable
    // from a vendor statement until the record carried a source.
    expect(materialGroups({ isoMaterialGroups: '' }, 2)).toEqual({
      materialGroups: ['N'],
      materialGroupsSource: 'derived',
    })
    expect(materialGroups({ isoMaterialGroups: '' }, 3).materialGroups).toEqual(['N'])
  })

  it('falls back to ferrous above three flutes', () => {
    expect(materialGroups({ isoMaterialGroups: '' }, 4)).toEqual({
      materialGroups: ['P', 'M', 'K', 'S', 'H'],
      materialGroupsSource: 'derived',
    })
  })

  it('treats a missing cell as blank, and is never without an answer', () => {
    // Unlike Kennametal and Harvey, this vendor always states something: the
    // fallback covers every blank cell, so `null` cannot occur here.
    expect(materialGroups({}, 2)).toEqual({
      materialGroups: ['N'],
      materialGroupsSource: 'derived',
    })
  })
})

describe('the conventions, against the header this adapter writes', () => {
  /** The header a real scrape produces, not one quoted here. */
  async function header(): Promise<readonly string[]> {
    const { fetcher } = pages({
      documents: [
        {
          fields: {
            itemNumber: { stringValue: 'A1' },
            type: { stringValue: 'End Mill' },
          },
        },
      ],
    })
    return (await scrapeEndMills(fetcher)).header
  }

  it('carries the identity this vendor is recorded as using', async () => {
    // The half a quoted header could never check: a deviation naming a column
    // the adapter stopped writing would keep passing, because the check
    // compares the header against the deviation and both would be wrong
    // together.
    const columns = await header()

    expect(() => checkIdentityColumns('destinytool', columns)).not.toThrow()
    for (const column of identityColumns('destinytool')) {
      expect(columns).toContain(column)
    }
  })

  it('carries a unit on every dimension and on nothing else', async () => {
    // Destiny Tool's own field names carry no suffix — the adapter appends
    // one, because `_in` is what makes `cutDia` readable as a length rather
    // than a code.
    const columns = await header()

    const suffixed = columns.filter((c) => c.endsWith('_mm') || c.endsWith('_in'))
    expect(new Set(suffixed)).toEqual(new Set([...DIMENSIONAL_FIELDS].map((f) => `${f}_in`)))
    // Every dimension is inches: the vendor publishes no metric row at all.
    expect(columns.filter((c) => c.endsWith('_mm'))).toEqual([])
  })
})

describe('a record', () => {
  const definition = FAMILIES['destinytool_end_mills_inch.csv']
  const cfg: BoundFamily = {
    id: definition.id,
    rows: definition.rows,
    kind: 'endmill',
    brand: definition.brand,
    columns: checkColumnMap('destinytool_end_mills_inch.csv', 'endmill', definition.columns),
    records: () => {
      throw new Error('unused')
    },
    unit: 'inches',
    bmc: 'carbide',
    coolantThrough: false,
  }

  const row = {
    [ITEM_NUMBER]: '10014',
    description: '1/4 x 3/4 x 2-1/2 4FL',
    cutDia_in: '1/4',
    loc_in: '3/4',
    oal_in: '2-1/2',
    flutes: '4',
  }

  // `series` has been scraped since the adapter was written and read by
  // nothing until now. The description cannot stand in for it: Raptor calls
  // itself `DVH` there and DiamondBack calls itself `DBACK RGHR`, so parsing
  // the prose would not recover the line.
  it('takes the product line from the vendor’s own series column', () => {
    expect(endmillRecord({ ...row, series: 'Viper' }, cfg, cfg.columns).productLine).toBe('Viper')
  })

  // The vendor really does ship these two in lower case beside `Viper` and
  // `Raptor`. Case-folding here would be this package authoring its catalog.
  it('keeps the vendor’s own casing', () => {
    expect(endmillRecord({ ...row, series: 'viper-mini' }, cfg, cfg.columns).productLine).toBe(
      'viper-mini',
    )
  })

  it('is null where the column is absent or empty, never an empty name', () => {
    expect(endmillRecord(row, cfg, cfg.columns).productLine).toBeNull()
    expect(endmillRecord({ ...row, series: '  ' }, cfg, cfg.columns).productLine).toBeNull()
  })

  it('names the vendor as the catalog does, not by the brand key', () => {
    // `record.vendor` is what a consumer groups a merged catalog by, so it
    // carries the name `identity.ts` publishes — 'Kennametal', 'WIDIA',
    // 'Destiny Tool' — rather than the internal key the family is filed under.
    expect(endmillRecord(row, cfg, cfg.columns).vendor).toBe('Destiny Tool')
  })
})
