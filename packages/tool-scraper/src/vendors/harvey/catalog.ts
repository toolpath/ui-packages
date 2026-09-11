/**
 * The category tree -> the product pages under it.
 *
 * Harvey publishes no sitemap and no flat index: `robots.txt`, `sitemap.xml` and
 * `sitemap_index.xml` all 404, and `/products/all-products` lists the seven top
 * categories and no products. Walking the catalog grid is the only way to find
 * out what exists — see `docs/HARVEY_PRODUCT_TABLE.md` §1.1 and §1.6.
 *
 * Nothing in a scrape needs this: `families/harvey.ts` names all 52 product
 * pages, and a family scrape fetches exactly one. It is here for the maintenance
 * question that table cannot answer — *has Harvey added a page?* — and the CLI
 * exposes it as `harvey --catalog` for that purpose.
 *
 * A page carries subcategory links or product links, never both, so the
 * recursion terminates where products appear. Both selectors were verified
 * against all 33 category pages the four roots reach.
 */

import { Parser } from 'htmlparser2'

import { compare } from '../../order.js'
import type { Fetcher } from '../../fetch.js'
import { consoleWarn, pause, REQUEST_DELAY_MS, type Warn } from '../../scrape.js'
import { BASE } from './scrape.js'

/**
 * The four category trees this adapter covers.
 *
 * Harvey's catalog is far larger; these are the trees asked for, and adding one
 * is a decision rather than a widening of a pattern — see the package's rule on
 * not adding vendor scope without being asked.
 */
export const CATEGORY_ROOTS: readonly string[] = [
  '/products/miniature-end-mills/ball',
  '/products/miniature-end-mills/corner-radius',
  '/products/miniature-end-mills/square',
  '/products/specialty-profiles/keyseat-cutters',
]

/** The class marking a link to a subcategory in the catalog grid. */
const SUBCATEGORY_CLASS = 'img-wrapper'

/** The classes marking the wrapper around a link to one product. */
const PRODUCT_CLASSES = ['col-md-4', 'col-12', 'item-wrapper']

/** What one catalog page links to. */
export interface CategoryLinks {
  subcategories: string[]
  products: string[]
}

function classes(attribs: Record<string, string>): string[] {
  return (attribs['class'] ?? '').split(/\s+/).filter(Boolean)
}

/**
 * The subcategory and product links on one catalog page.
 *
 * Product links are identified by their **wrapper** rather than by the anchor,
 * because the anchor carries no class of its own — the grid renders
 * `<div class="col-md-4 col-12 item-wrapper"><a href="/products/...">`. A rule
 * that took every `/products/` anchor on the page would take the breadcrumb and
 * the footer with it.
 */
export function parseCategoryPage(html: string): CategoryLinks {
  const subcategories = new Set<string>()
  const products = new Set<string>()
  // A depth counter rather than a flag, because the wrapper holds nested divs
  // and a flag would clear on the first inner close tag.
  let inProduct = 0

  const parser = new Parser(
    {
      onopentag: (tag, attribs) => {
        if (inProduct > 0) {
          inProduct++
          if (tag === 'a') {
            const href = attribs['href'] ?? ''
            if (href.startsWith('/products/')) products.add(href)
          }
          return
        }
        if (tag === 'div' && PRODUCT_CLASSES.every((c) => classes(attribs).includes(c))) {
          inProduct = 1
          return
        }
        if (tag === 'a' && classes(attribs).includes(SUBCATEGORY_CLASS)) {
          const href = attribs['href'] ?? ''
          if (href.startsWith('/products/')) subcategories.add(href)
        }
      },
      onclosetag: () => {
        if (inProduct > 0) inProduct--
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()

  return {
    subcategories: [...subcategories].sort(compare),
    products: [...products].sort(compare),
  }
}

/**
 * Every product page reachable from `roots`, sorted.
 *
 * Sequential and paced by the package's shared politeness delay. The whole walk
 * is about 33 requests; nothing here needs concurrency, and Cloudflare fronts
 * this site, so raising request volume is the only real risk.
 */
export async function discoverProducts(
  fetcher: Fetcher,
  roots: readonly string[] = CATEGORY_ROOTS,
  options: { warn?: Warn; delayMs?: number } = {},
): Promise<string[]> {
  const { warn = consoleWarn, delayMs = REQUEST_DELAY_MS } = options
  const products = new Set<string>()
  const seen = new Set<string>()
  const queue = [...roots]

  while (queue.length > 0) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)

    const { subcategories, products: found } = parseCategoryPage(await fetcher.text(BASE + path))
    if (subcategories.length === 0 && found.length === 0) {
      warn(`  WARNING: ${path} links to neither a subcategory nor a product`)
    }
    for (const product of found) products.add(product)
    for (const child of subcategories) {
      if (child !== path) queue.push(child)
    }
    await pause(delayMs)
  }

  return [...products].sort(compare)
}
