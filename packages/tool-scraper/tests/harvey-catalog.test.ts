/**
 * The catalog walk — the only way to find out what Harvey publishes.
 *
 * There is no sitemap and no flat index (`docs/HARVEY_PRODUCT_TABLE.md` §1.6),
 * so a page that has stopped linking to anything has to be visible rather than
 * silently reducing the catalog. Nothing in a scrape uses this; it is how a
 * 53rd product page gets noticed.
 */

import { describe, expect, it } from 'vitest'

import {
  CATEGORY_ROOTS,
  discoverProducts,
  parseCategoryPage,
} from '../src/vendors/harvey/catalog.js'
import { REQUEST_DELAY_MS } from '../src/scrape.js'
import { BASE } from '../src/vendors/harvey/scrape.js'
import { asFetcher, recordPauses } from './stubs.js'

const CATEGORY = `<html><body>
  <nav><a href="/products/all-products">All products</a></nav>
  <div class="catalog-grid-component">
    <div><a class="img-wrapper" href="/products/miniature-end-mills/ball/stub"><img/></a></div>
    <div><a class="img-wrapper" href="/products/miniature-end-mills/ball/long"><img/></a></div>
  </div>
  <footer><a href="/products/contact">Contact</a></footer>
</body></html>`

const PRODUCTS = `<html><body>
  <nav><a href="/products/all-products">All products</a></nav>
  <div class="product-grid-component">
    <div class="col-md-4 col-12 item-wrapper">
      <a href="/products/miniature-end-mills---ball---stub--standard"><div><img/></div></a>
    </div>
    <div class="col-md-4 col-12 item-wrapper">
      <a href="/products/miniature-end-mills---ball---long-flute"><span>Long</span></a>
    </div>
  </div>
</body></html>`

describe('reading one catalog page', () => {
  it('takes subcategory links by their own class', () => {
    expect(parseCategoryPage(CATEGORY)).toEqual({
      subcategories: [
        '/products/miniature-end-mills/ball/long',
        '/products/miniature-end-mills/ball/stub',
      ],
      products: [],
    })
  })

  it('takes product links by their wrapper, not by the anchor', () => {
    // The product anchor carries no class of its own. A rule that took every
    // `/products/` anchor would take the nav and the footer with it — both are
    // in these fixtures for that reason.
    expect(parseCategoryPage(PRODUCTS)).toEqual({
      subcategories: [],
      products: [
        '/products/miniature-end-mills---ball---long-flute',
        '/products/miniature-end-mills---ball---stub--standard',
      ],
    })
  })
})

describe('walking the tree', () => {
  it('recurses until a page yields products, and sorts what it found', async () => {
    const asked: string[] = []
    const pages: Record<string, string> = {
      [`${BASE}/root`]: CATEGORY,
      [`${BASE}/products/miniature-end-mills/ball/stub`]: PRODUCTS,
      [`${BASE}/products/miniature-end-mills/ball/long`]: PRODUCTS,
    }
    const fetcher = asFetcher({
      text: (url: string) => {
        asked.push(url)
        return Promise.resolve(pages[url] ?? '<html></html>')
      },
    })

    const found = await discoverProducts(fetcher, ['/root'], { warn: () => {}, delayMs: 0 })

    expect(asked).toHaveLength(3)
    // Both subcategories link to the same two products; a product found twice
    // is one product.
    expect(found).toEqual([
      '/products/miniature-end-mills---ball---long-flute',
      '/products/miniature-end-mills---ball---stub--standard',
    ])
  })

  it('warns about a page that links to neither, rather than dropping it quietly', async () => {
    const warnings: string[] = []
    const fetcher = asFetcher({ text: () => Promise.resolve('<html><body></body></html>') })

    const found = await discoverProducts(fetcher, ['/root'], {
      warn: (m) => warnings.push(m),
      delayMs: 0,
    })

    expect(found).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('/root')
  })

  it('covers the four category trees this adapter was asked for', () => {
    // Harvey's catalog is far larger. Adding a fifth is a decision, not a
    // widening of a pattern.
    expect(CATEGORY_ROOTS).toEqual([
      '/products/miniature-end-mills/ball',
      '/products/miniature-end-mills/corner-radius',
      '/products/miniature-end-mills/square',
      '/products/specialty-profiles/keyseat-cutters',
    ])
  })
})

describe('the politeness delay', () => {
  it('waits after every page the walk reads', async () => {
    // The one test here that leaves `delayMs` at its default. The walk is about
    // 33 requests and Cloudflare fronts this site, so raising request volume is
    // the risk the pacing exists against — and `delayMs: 0` skips the timer
    // entirely, which is why no other test in this file can see it.
    const pages: Record<string, string> = {
      [`${BASE}/root`]: CATEGORY,
      [`${BASE}/products/miniature-end-mills/ball/stub`]: PRODUCTS,
      [`${BASE}/products/miniature-end-mills/ball/long`]: PRODUCTS,
    }
    const fetcher = asFetcher({
      text: (url: string) => Promise.resolve(pages[url] ?? '<html></html>'),
    })
    const { waits, restore } = recordPauses()

    try {
      await discoverProducts(fetcher, ['/root'], { warn: () => {} })
    } finally {
      restore()
    }

    expect(waits).toEqual([REQUEST_DELAY_MS, REQUEST_DELAY_MS, REQUEST_DELAY_MS])
  })
})
