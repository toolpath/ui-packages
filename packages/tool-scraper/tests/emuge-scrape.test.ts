/**
 * The EMUGE-FRANKEN scrape, against a stub of its own API.
 *
 * The payloads below are trimmed from live responses on 2026-09-01 and keep the
 * faults: an end mill family holding a necked part and a plain one, a label
 * that carries a unit tag beside one that does not, and the `999` flute count.
 * A parser that only works on tidied-up input fails here rather than on the
 * site.
 */

import { describe, expect, it } from 'vitest'

import { checkIdentityColumns, dimensionalColumn, DESCRIPTION_COLUMN } from '../src/conventions.js'
import { VendorResponseError } from '../src/errors.js'
import type { Fetcher } from '../src/fetch.js'
import { REQUEST_DELAY_MS } from '../src/scrape.js'
import {
  APPLICATION_MATERIALS_COLUMN,
  CATALOG_NUMBER_COLUMN,
  DETAIL_BATCH,
  DIMENSION_FEATURE_COLUMN,
  GROUP_COLUMN,
  MATERIAL_NUMBER_COLUMN,
  detailUrl,
  groupQuery,
  scrapeCategory,
  searchUrl,
  variantQuery,
  variantRow,
  type EmugeTarget,
} from '../src/vendors/emuge/scrape.js'
import { recordPauses, stub } from './stubs.js'

const INCH_END_MILLS: EmugeTarget = {
  category: 'FF01',
  facet: { code: 'feature-HYBCL_PRODUKTMERKMALE-AMM_EINHS', value: 'AMM_EINHS_Z' },
}

interface Property {
  property: string
  value: string
}

interface Group {
  code: string
  productListInfo?: string
  numberOfMaterials?: number
  technicalDetails?: Property[]
}

interface Variant {
  code: string
  articleCode?: string
  name?: string
  dimensionFeatureValue?: string
  klammerProduct?: boolean
  mainDrawing?: { technicalDetails?: Property[] }
}

interface Detail {
  code: string
  technicalDetails?: Property[]
  applicationMaterials?: { code: string }[]
}

const GROUP: Group = {
  code: 'H301025',
  numberOfMaterials: 2,
  productListInfo: 'Solid carbide end mill with corner radius, long, type N.',
  technicalDetails: [
    { property: 'Cutting material', value: 'carbide' },
    { property: 'category', value: 'End Mill' },
    { property: 'version', value: 'Corner Radius' },
    { property: 'coating', value: 'ALCR' },
    { property: 'internal coolant supply', value: 'Without internal cooling' },
    { property: 'product line', value: 'FRANKEN TOP-Cut VAR' },
  ],
}

/** A plain-shank part: no neck columns at all. */
const PLAIN: Variant = {
  code: '000000000010261378',
  articleCode: '2998L.012010',
  // German on the US English storefront, recorded as sent.
  name: 'TOP-Cut VAR HM-Schaftfräser / lang Typ N ALCR',
  dimensionFeatureValue: 'Ø1/8 / R0.010',
  mainDrawing: {
    technicalDetails: [
      { property: 'cutting diameter Ød₁ [inch]', value: '1/8 "' },
      { property: 'shank diameter Ød₂ [inch]', value: '1/8 "' },
      { property: 'cutting length l₂ [inch]', value: '3/8 "' },
      // No unit tag on this label, in the same table as the four that have one.
      { property: 'overall length l₁', value: '1 1/2 "' },
      { property: 'radius r₁ [inch]', value: '0.01 "' },
    ],
  },
}

/** A necked part in the same family: two more dimension columns. */
const NECKED: Variant = {
  code: '000000000010261509',
  articleCode: '2998L.012015',
  name: 'TOP-Cut VAR HM-Schaftfräser / lang Typ N ALCR',
  dimensionFeatureValue: 'Ø1/8 / R0.015',
  mainDrawing: {
    technicalDetails: [
      { property: 'cutting diameter Ød₁ [inch]', value: '1/8 "' },
      { property: 'shank diameter Ød₂ [inch]', value: '1/4 "' },
      { property: 'neck diameter Ød₃', value: '0.118 "' },
      { property: 'cutting length l₂ [inch]', value: '3/8 "' },
      { property: 'neck length l₃ [inch]', value: '0.75 "' },
      { property: 'overall length l₁', value: '2 1/2 "' },
      { property: 'radius r₁ [inch]', value: '0.015 "' },
      { property: 'neck angle α', value: '17 deg' },
    ],
  },
}

function detailFor(code: string, flutes: string): Detail {
  return {
    code,
    technicalDetails: [
      { property: 'number of flutes Z', value: flutes },
      { property: 'Cutting material', value: 'carbide' },
      { property: 'coating', value: 'ALCR' },
      { property: 'internal coolant supply', value: 'Without internal cooling' },
      { property: 'helix angle', value: '35-38 deg' },
      { property: 'radius tolerance', value: '±0,0008 "' },
    ],
    applicationMaterials: [{ code: 'P' }, { code: 'M' }, { code: 'K' }],
  }
}

const DETAILS = [detailFor(PLAIN.code, '4'), detailFor(NECKED.code, '4')]

/**
 * The grouped product, as `VARIANT_SEARCH` really returns it — last in its own
 * variant listing, flagged, with the base article code and no dimension table.
 */
const SELF: Variant = {
  code: GROUP.code,
  articleCode: '2998L',
  klammerProduct: true,
  name: 'TOP-Cut VAR',
}

/** What the stub answers with, per call shape. */
interface Api {
  /** One entry per page of grouped products. */
  groups: Group[][]
  /** One entry per group code, each a list of variant pages. */
  variants: Record<string, Variant[][]>
  details: Detail[]
}

function pageOf(url: string): number {
  return Number(new URL(url).searchParams.get('currentPage') ?? '0')
}

/** A `Fetcher` that answers this vendor's three calls, and records every URL. */
function api(spec: Api): { fetcher: Fetcher; asked: string[] } {
  const asked: string[] = []
  const byCode = new Map(spec.details.map((d) => [d.code, d]))

  const fetcher = stub({
    json: (url: string) => {
      asked.push(url)
      const params = new URL(url).searchParams

      const codes = params.get('productCodes')
      if (codes !== null) {
        return Promise.resolve(
          codes
            .split(',')
            .map((code) => byCode.get(code))
            .filter((d) => d !== undefined),
        )
      }

      const context = params.get('searchQueryContext')
      if (context === 'KLAMMER_GROUPING') {
        return Promise.resolve({
          pagination: { totalPages: spec.groups.length },
          products: spec.groups[pageOf(url)] ?? [],
        })
      }

      const query = params.get('query') ?? ''
      const code = query.slice(query.lastIndexOf(':') + 1)
      const pages = spec.variants[code] ?? [[]]
      return Promise.resolve({
        pagination: { totalPages: pages.length },
        products: pages[pageOf(url)] ?? [],
      })
    },
  })

  return { fetcher, asked }
}

const ONE_GROUP: Api = {
  groups: [[GROUP]],
  variants: { [GROUP.code]: [[PLAIN, NECKED, SELF]] },
  details: DETAILS,
}

const OPTIONS = { unit: 'inches', delayMs: 0, warn: () => {} } as const

describe('the walk', () => {
  it('pages both listings until the vendor says there are no more', async () => {
    const second: Group = { ...GROUP, code: 'H301026' }
    const { fetcher, asked } = api({
      groups: [[GROUP], [second]],
      variants: {
        [GROUP.code]: [[PLAIN], [NECKED]],
        [second.code]: [[{ ...PLAIN, code: '000000000010261999' }]],
      },
      details: [...DETAILS, detailFor('000000000010261999', '4')],
    })

    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)

    expect(scrape.rows).toHaveLength(3)
    expect(asked.filter((u) => u.includes('KLAMMER_GROUPING'))).toEqual([
      searchUrl(groupQuery(INCH_END_MILLS), 'KLAMMER_GROUPING', 0),
      searchUrl(groupQuery(INCH_END_MILLS), 'KLAMMER_GROUPING', 1),
    ])
    expect(asked.filter((u) => u.includes(`${GROUP.code}&`) || u.includes(GROUP.code))).toContain(
      searchUrl(variantQuery(GROUP.code), 'VARIANT_SEARCH', 1, 'prod-detail-variant'),
    )
  })

  it('asks for per-part detail in batches rather than one request per part', async () => {
    const many = Array.from({ length: DETAIL_BATCH + 5 }, (_, at) => ({
      ...PLAIN,
      code: `00000000001026${String(at).padStart(4, '0')}`,
      articleCode: `2998L.0120${at}`,
    }))
    const { fetcher, asked } = api({
      groups: [[GROUP]],
      variants: { [GROUP.code]: [many] },
      details: many.map((v) => detailFor(v.code, '4')),
    })

    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)
    const batches = asked.filter((u) => u.includes('productCodes='))

    expect(scrape.rows).toHaveLength(DETAIL_BATCH + 5)
    expect(batches).toHaveLength(2)
    expect(batches[0]).toBe(detailUrl(many.slice(0, DETAIL_BATCH).map((v) => v.code)))
    expect(batches[1]).toBe(detailUrl(many.slice(DETAIL_BATCH).map((v) => v.code)))
  })

  it('paces every request after the first', async () => {
    // `delayMs: 0` makes `pause` return without touching a timer, so a dropped
    // `await pause()` is invisible to it — the delay has to be left at its
    // default for the pacing to be observable at all.
    const { waits, restore } = recordPauses()
    try {
      const { fetcher, asked } = api(ONE_GROUP)
      await scrapeCategory(fetcher, INCH_END_MILLS, { unit: 'inches', warn: () => {} })

      expect(waits).toHaveLength(asked.length - 1)
      expect(new Set(waits)).toEqual(new Set([REQUEST_DELAY_MS]))
    } finally {
      restore()
    }
  })
})

describe('one orderable part as a row', () => {
  it('carries both identity columns, so this brand deviates from neither', async () => {
    const { fetcher } = api(ONE_GROUP)
    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)

    expect(() => checkIdentityColumns('emuge', scrape.header)).not.toThrow()
    expect(scrape.rows[0]?.[MATERIAL_NUMBER_COLUMN]).toBe(PLAIN.code)
    expect(scrape.rows[0]?.[CATALOG_NUMBER_COLUMN]).toBe(PLAIN.articleCode)
  })

  it('merges the group’s properties, the part’s own, and its dimensions', async () => {
    const { fetcher } = api(ONE_GROUP)
    const [row] = (await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)).rows

    expect(row?.['product line']).toBe('FRANKEN TOP-Cut VAR')
    expect(row?.['number of flutes Z']).toBe('4')
    expect(row?.[dimensionalColumn('cutting diameter Ød₁', 'inches')]).toBe('1/8 "')
    expect(row?.[DESCRIPTION_COLUMN]).toBe(GROUP.productListInfo)
    expect(row?.[GROUP_COLUMN]).toBe(GROUP.code)
    expect(row?.[DIMENSION_FEATURE_COLUMN]).toBe(PLAIN.dimensionFeatureValue)
  })

  it('keeps the vendor’s value strings rather than parsed numbers', async () => {
    // The CSV is the receipt: EMUGE's fractional inches and its stated units
    // are part of what it published, and `records.ts` is where a cell becomes
    // a number.
    const { fetcher } = api(ONE_GROUP)
    const [row] = (await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)).rows

    expect(row?.[dimensionalColumn('overall length l₁', 'inches')]).toBe('1 1/2 "')
    expect(row?.['helix angle']).toBe('35-38 deg')
    expect(row?.['radius tolerance']).toBe('±0,0008 "')
  })

  it('writes the vendor’s ISO 513 codes space-separated', async () => {
    const { fetcher } = api(ONE_GROUP)
    const [row] = (await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)).rows

    expect(row?.[APPLICATION_MATERIALS_COLUMN]).toBe('P M K')
  })
})

describe('the header the adapter really writes', () => {
  it('suffixes every dimension with the unit the family declares', async () => {
    const { fetcher } = api(ONE_GROUP)
    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)

    for (const label of [
      'cutting diameter Ød₁',
      'shank diameter Ød₂',
      'cutting length l₂',
      'overall length l₁',
      'radius r₁',
      'neck length l₃',
      'neck diameter Ød₃',
    ]) {
      expect(scrape.header).toContain(dimensionalColumn(label, 'inches'))
      expect(scrape.header).not.toContain(label)
    }
  })

  it('leaves a property that is not a dimension unsuffixed', async () => {
    // `pitch` is the one that has to be: `records.DIMENSIONAL_COLUMNS` excludes
    // `TP` from unit pairing, so the core reads that column by its bare label.
    const { fetcher } = api(ONE_GROUP)
    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)

    for (const label of ['number of flutes Z', 'coating', 'Cutting material', 'product line']) {
      expect(scrape.header).toContain(label)
      expect(scrape.header).not.toContain(dimensionalColumn(label, 'inches'))
    }
  })

  it('takes the union of the rows, so a necked part keeps its columns', async () => {
    // Keying the header off row one would drop `neck length l₃` and
    // `neck diameter Ød₃`, which only the necked part in this family publishes.
    const { fetcher } = api(ONE_GROUP)
    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)

    expect(scrape.header).toContain(dimensionalColumn('neck length l₃', 'inches'))
    expect(Object.keys(scrape.rows[0]!)).not.toContain(
      dimensionalColumn('neck length l₃', 'inches'),
    )
    expect(Object.keys(scrape.rows[1]!)).toContain(dimensionalColumn('neck length l₃', 'inches'))
  })

  it('has no repeated column and covers every cell any row publishes', async () => {
    const { fetcher } = api(ONE_GROUP)
    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)

    expect(new Set(scrape.header).size).toBe(scrape.header.length)
    for (const row of scrape.rows) {
      for (const key of Object.keys(row)) expect(scrape.header).toContain(key)
    }
  })
})

describe('provenance', () => {
  it('names the request to re-issue and the vendor’s own category code', async () => {
    const { fetcher } = api(ONE_GROUP)
    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)

    expect(scrape.source).toBe(searchUrl(groupQuery(INCH_END_MILLS), 'KLAMMER_GROUPING', 0))
    expect(scrape.familyCode).toBe('FF01')
  })

  it('narrows the query by the family’s facet, and leaves it off without one', () => {
    expect(groupQuery(INCH_END_MILLS)).toBe(
      ':relevance:allCategories:FF01:klammerProduct:false' +
        ':feature-HYBCL_PRODUKTMERKMALE-AMM_EINHS:AMM_EINHS_Z',
    )
    expect(groupQuery({ category: 'FB01' })).toBe(
      ':relevance:allCategories:FB01:klammerProduct:false',
    )
  })
})

describe('what it refuses and what it survives', () => {
  it('refuses a target that yields no rows', async () => {
    // A facet value the vendor retired answers exactly like a category that was
    // discontinued, and only one of those is a scrape worth a receipt.
    const { fetcher } = api({ groups: [[]], variants: {}, details: [] })

    await expect(scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)).rejects.toThrow(
      VendorResponseError,
    )
  })

  it('keeps a part whose detail record is missing, and says which', async () => {
    const said: string[] = []
    const { fetcher } = api({ ...ONE_GROUP, details: [DETAILS[0]!] })
    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, {
      ...OPTIONS,
      warn: (m) => said.push(m),
    })

    expect(scrape.rows).toHaveLength(2)
    expect(said.join('\n')).toContain(NECKED.code)
    // The key is absent rather than empty, which is what keeps "we have no
    // evidence" apart from "the vendor rates it for nothing".
    expect(Object.keys(scrape.rows[1]!)).not.toContain(APPLICATION_MATERIALS_COLUMN)
    expect(scrape.rows[0]?.[APPLICATION_MATERIALS_COLUMN]).toBe('P M K')
  })

  it('drops the grouped product from its own variant listing', async () => {
    // It is returned there, flagged `klammerProduct`, and it is not a part: no
    // dimension table, and the base article code with no size suffix. Left in,
    // it is one bogus row per group — the first live drill run wrote 2,687 rows
    // against a family declaring 2,670, and `receipts.checkRows` caught it.
    const { fetcher, asked } = api(ONE_GROUP)
    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, OPTIONS)

    expect(scrape.rows).toHaveLength(2)
    expect(scrape.rows.map((row) => row[MATERIAL_NUMBER_COLUMN])).toEqual([PLAIN.code, NECKED.code])
    // And it is not asked about either: a detail request for a group would
    // spend a slot in the batch on a record no row reads.
    expect(asked.filter((u) => u.includes(`productCodes=${GROUP.code}`))).toEqual([])
  })

  it('says so when a group keeps a different number of parts than the vendor states', async () => {
    // The per-group form of what `family.rows` does for a whole CSV, and a
    // second number nothing in the walk computed. It is the tripwire the
    // grouped-product-in-its-own-listing fault tripped: seventeen groups, each
    // one over, visible per group instead of as one count at the end of a
    // scrape that had already run.
    const said: string[] = []
    const { fetcher } = api({
      ...ONE_GROUP,
      groups: [[{ ...GROUP, numberOfMaterials: 5 }]],
    })

    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, {
      ...OPTIONS,
      warn: (m) => said.push(m),
    })

    expect(scrape.rows).toHaveLength(2)
    expect(said.join('\n')).toContain(GROUP.code)
    expect(said.join('\n')).toContain('states 5')
  })

  it('says nothing when the two counts agree', async () => {
    const said: string[] = []
    const { fetcher } = api(ONE_GROUP)

    await scrapeCategory(fetcher, INCH_END_MILLS, { ...OPTIONS, warn: (m) => said.push(m) })

    expect(said).toEqual([])
  })

  it('skips a grouped product publishing no variants, and says which', async () => {
    const empty: Group = { ...GROUP, code: 'H309999' }
    const said: string[] = []
    const { fetcher } = api({
      groups: [[GROUP, empty]],
      variants: { [GROUP.code]: [[PLAIN]], [empty.code]: [[]] },
      details: DETAILS,
    })

    const scrape = await scrapeCategory(fetcher, INCH_END_MILLS, {
      ...OPTIONS,
      warn: (m) => said.push(m),
    })

    expect(scrape.rows).toHaveLength(1)
    expect(said.join('\n')).toContain(empty.code)
  })
})

describe('two properties landing on one column', () => {
  /** A part carrying whatever `technicalDetails` a case needs on its detail. */
  function rowOf(detail: Property[], warn: (m: string) => void) {
    return variantRow(GROUP, PLAIN, { code: PLAIN.code, technicalDetails: detail }, 'inches', warn)
  }

  it('keeps the group’s value where the part states an empty one', () => {
    // The three sources overlap and the part's is the more specific — but an
    // absent value is not a more specific statement than a present one. The
    // group states this coating and the part does not restate it.
    const said: string[] = []
    const row = rowOf([{ property: 'coating', value: '' }], (m) => said.push(m))

    expect(row['coating']).toBe('ALCR')
    expect(said).toEqual([])
  })

  it('takes the part’s value over the group’s where it states one', () => {
    const said: string[] = []
    const row = rowOf([{ property: 'coating', value: 'TIALN-T63' }], (m) => said.push(m))

    expect(row['coating']).toBe('TIALN-T63')
  })

  it('warns when two different values collide, and keeps the later one', () => {
    // `bareLabel` strips the unit tag, so the two tags EMUGE publishes the same
    // measurement under are one column name. The receipt is short a number the
    // vendor published, and nothing else would say so.
    const said: string[] = []
    const row = rowOf(
      [
        { property: 'nominal diameter d₁ [mm]', value: '3 mm' },
        { property: 'nominal diameter d₁ [in]', value: '0.1181 "' },
      ],
      (m) => said.push(m),
    )

    expect(row['nominal diameter d₁']).toBe('0.1181 "')
    expect(said.join('\n')).toContain(PLAIN.code)
    expect(said.join('\n')).toContain('nominal diameter d₁ [in]')
    expect(said.join('\n')).toContain('3 mm')
  })

  it('says nothing where the same property repeats the same value', () => {
    const said: string[] = []
    rowOf([{ property: 'Cutting material', value: 'carbide' }], (m) => said.push(m))

    expect(said).toEqual([])
  })
})
