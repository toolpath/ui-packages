/**
 * The collet category walk — the only way to learn a family code without a
 * browser.
 *
 * The fixtures are trimmed from the vendor's own responses on 2026-09-08: the
 * standard-collet category, which returns two subcategory tiles and no
 * families, and one of its leaves, which returns families and no tiles. Both
 * shapes are here because a walk that assumed either one would find half the
 * catalog.
 */

import { describe, expect, it } from 'vitest'

import { REQUEST_DELAY_MS } from '../src/scrape.js'
import {
  COLLET_CATEGORIES,
  colletListingPages,
  describeFamily,
  discoverFamilies,
  listingUrl,
  parseColletListing,
} from '../src/vendors/kennametal/catalog.js'
import { asFetcher, recordPauses } from './stubs.js'

const STANDARD =
  ':relevance:obsoleteFacet:false:allCategoriesKMT:42034262:allCategoriesKMT:42866150:allCategoriesKMT:51114268'
const METRIC = `${STANDARD}:allCategoriesKMT:109337186`
const INCH = `${STANDARD}:allCategoriesKMT:109337187`

/**
 * A category above the leaves: tiles, no families.
 *
 * The `facet-check` anchor is the trap this fixture exists for — the sidebar
 * carries hundreds of them, every one with a `data-query`, and taking them
 * would walk the whole catalog from any starting point.
 */
const CATEGORY = `<div class="product-listing" data-query="${STANDARD}">
  <div class="search-listing-container" data-totalResults="224">
    <a class="facet" data-query="${STANDARD}:gsaApproval:Yes"><span class="facet-count">(113)</span></a>
    <div class="category-tiles">
      <div class="category-tile"><div class="category-tile-wrapper">
        <a class="horizontal-facet" data-query="${METRIC}">
          <span class="count">(117)</span>
          <div class="category-tile-title" data-title="ER Standard Collets &bull; Metric"><h3>x</h3></div>
        </a>
      </div></div>
      <div class="category-tile"><div class="category-tile-wrapper">
        <a class="horizontal-facet" data-query="${INCH}">
          <span class="count">(107)</span>
          <div class="category-tile-title" data-title="ER Standard Collets &bull; Inch"><h3>x</h3></div>
        </a>
      </div></div>
    </div>
  </div>
</div>`

/** A leaf: family links, no tiles. */
const leaf = (total: number, links: readonly string[]) => `<div class="product-listing">
  <div class="search-listing-container" data-totalResults="${total}"></div>
  <div class="product-list">
    ${links
      .map(
        (href) => `<div class="product-item"><a href="${href}?pdpQuery=%3Arelevance">x</a></div>`,
      )
      .join('\n')}
  </div>
</div>`

const METRIC_LEAF = leaf(117, [
  '/us/en/products/fam.er-standard-collet-set-metric.100000428.html',
  '/us/en/products/fam.er-standard-collets-metric.100000478.html',
])
const INCH_LEAF = leaf(107, ['/us/en/products/fam.er-standard-collets-inch.100000479.html'])
const EMPTY = leaf(0, [])

describe('the listing endpoint', () => {
  it('asks the public path, with the facet query encoded and a page index', () => {
    const url = listingUrl(STANDARD, 0)

    // The authoring `/content/kennametal/...` path the markup's own `data-path`
    // shows answers 307; this is the one that serves.
    expect(url).toContain('https://www.kennametal.com/us/en/products/')
    expect(url).toContain('/_jcr_content/root/responsivegrid/product_listing.0.html')
    expect(url).toContain(`query=${encodeURIComponent(STANDARD)}`)
    expect(url).toContain('pageSize=60')
    // A colon in a facet string is not a path separator here — it is data.
    expect(url).not.toContain(':relevance')
  })

  it('follows the brand, so WIDIA is a host and no code at all', () => {
    expect(listingUrl(STANDARD, 1, 'widia')).toContain('https://www.widia.com/')
    expect(listingUrl(STANDARD, 1, 'widia')).toContain('product_listing.1.html')
  })
})

describe('reading one listing response', () => {
  it('takes subcategory tiles by their own class, not by having a query', () => {
    const listing = parseColletListing(CATEGORY)

    expect(listing.total).toBe(224)
    expect(listing.families).toEqual([])
    expect(listing.tiles).toEqual([
      { query: METRIC, name: 'ER Standard Collets • Metric', count: 117 },
      { query: INCH, name: 'ER Standard Collets • Inch', count: 107 },
    ])
  })

  it('takes a family’s code and slug out of its link', () => {
    const listing = parseColletListing(METRIC_LEAF)

    expect(listing.total).toBe(117)
    expect(listing.tiles).toEqual([])
    expect(listing.families).toEqual([
      { code: '100000428', slug: 'er-standard-collet-set-metric' },
      { code: '100000478', slug: 'er-standard-collets-metric' },
    ])
  })

  it('says nothing rather than guessing when the response states no total', () => {
    expect(parseColletListing('<div></div>')).toEqual({ total: 0, tiles: [], families: [] })
  })
})

describe('paging one category', () => {
  it('asks for pages until one adds no family it had not seen', () => {
    // `pageSize` counts families rather than parts, and the vendor states no
    // page count anywhere — so what ends the walk is a page with nothing new
    // on it.
    const asked: string[] = []
    const pages = [METRIC_LEAF, INCH_LEAF, EMPTY]
    const fetcher = asFetcher({
      text: (url: string) => {
        asked.push(url)
        return Promise.resolve(pages[asked.length - 1] ?? EMPTY)
      },
    })

    return colletListingPages(fetcher, METRIC, { delayMs: 0 }).then((listing) => {
      expect(asked).toHaveLength(3)
      expect(asked[0]).toContain('product_listing.0.html')
      expect(asked[2]).toContain('product_listing.2.html')
      expect(listing.families.map((f) => f.code)).toEqual(['100000428', '100000478', '100000479'])
      // The total and the tiles are the *first* page's. A category publishes
      // its tiles on every page, and recursing on a duplicate would re-walk
      // the branch.
      expect(listing.total).toBe(117)
    })
  })
})

describe('walking the collet categories', () => {
  const answers = new Map<string, string>([
    [STANDARD, CATEGORY],
    [METRIC, METRIC_LEAF],
    [INCH, INCH_LEAF],
  ])

  const fetcher = (asked: string[] = []) =>
    asFetcher({
      text: (url: string) => {
        asked.push(url)
        // `query=<enc>&`, not a substring: the parent's facet string is a
        // prefix of every child's, so a loose match answers a leaf with its
        // category's page.
        for (const [query, html] of answers) {
          if (url.includes(`query=${encodeURIComponent(query)}&`) && url.includes('_listing.0.')) {
            return Promise.resolve(html)
          }
        }
        return Promise.resolve(EMPTY)
      },
    })

  it('recurses into a category’s tiles and stops at its leaves', async () => {
    const found = await discoverFamilies(fetcher(), [{ name: 'Standard', query: STANDARD }], {
      delayMs: 0,
    })

    expect(found.map((c) => c.name)).toEqual([
      'Standard',
      'ER Standard Collets • Metric',
      'ER Standard Collets • Inch',
    ])
    expect(found[0]?.families).toEqual([])
    expect(found[1]?.families.map((f) => f.code)).toEqual(['100000428', '100000478'])
    expect(found[2]?.families.map((f) => f.code)).toEqual(['100000479'])
  })

  it('refuses a tile that leaves the branch it was asked about', async () => {
    // A listing page renders unrelated facets beside its own subcategories. A
    // walk that took every `horizontal-facet` anchor would leave the collet
    // tree and take the rest of the catalog with it — the same prefix test
    // `vendors/maritool/catalog.ts` applies to a cPath.
    const sideways = CATEGORY.replace(METRIC, ':relevance:allCategoriesKMT:99999999')
    const found = await discoverFamilies(
      asFetcher({
        text: (url: string) =>
          Promise.resolve(
            url.includes(`query=${encodeURIComponent(STANDARD)}&`) ? sideways : EMPTY,
          ),
      }),
      [{ name: 'Standard', query: STANDARD }],
      { delayMs: 0 },
    )

    expect(found.map((c) => c.query)).not.toContain(':relevance:allCategoriesKMT:99999999')
  })

  it('reports a category that holds neither a subcategory nor a family', async () => {
    const said: string[] = []
    await discoverFamilies(
      asFetcher({ text: () => Promise.resolve(EMPTY) }),
      [{ name: 'Sleeves', query: ':relevance:allCategoriesKMT:1' }],
      { delayMs: 0, warn: (m) => said.push(m) },
    )

    expect(said.join('\n')).toContain('Sleeves holds neither a subcategory nor a family')
  })

  it('paces itself between requests', async () => {
    // The delay is left at its default here on purpose: `delayMs: 0` makes
    // `pause` return without touching a timer, so a dropped `await` would be
    // invisible to a test that passed it.
    const { waits, restore } = recordPauses()
    try {
      await discoverFamilies(fetcher(), [{ name: 'Standard', query: STANDARD }])
    } finally {
      restore()
    }

    expect(waits.length).toBeGreaterThan(0)
    expect(new Set(waits)).toEqual(new Set([REQUEST_DELAY_MS]))
  })
})

describe('what the three roots are', () => {
  it('names the standard, coolant-through and tap lines, active parts only', () => {
    expect(COLLET_CATEGORIES.map((c) => c.name)).toEqual([
      'ER Standard Collets',
      'ER Coolant Through Collets',
      'ER Tap Collets',
    ])
    for (const root of COLLET_CATEGORIES) {
      // The same active-only scoping `scrape.ACTIVE_ONLY` applies to a family.
      expect(root.query, root.name).toContain('obsoleteFacet:false')
      // Every root sits under Collets and Sleeves, then ER Collets.
      expect(root.query, root.name).toContain(
        ':allCategoriesKMT:42034262:allCategoriesKMT:42866150',
      )
    }
  })
})

describe('one line per family', () => {
  it('says which configured CSV claims the code, or that none does', () => {
    const category = { name: 'ER Tap Collets', query: STANDARD, total: 96, families: [] }
    const family = { code: '100000434', slug: 'er-standard-tap-collets-inchmetric-ansi' }

    expect(describeFamily(category, family, 'er_tap_collets_ansi.csv')).toBe(
      '100000434\ter-standard-tap-collets-inchmetric-ansi\tER Tap Collets\ter_tap_collets_ansi.csv',
    )
    expect(describeFamily(category, family, null)).toContain('(not configured)')
  })
})
