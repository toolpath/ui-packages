/**
 * The category tree -> the leaves under it.
 *
 * MariTool publishes no sitemap: `/sitemap.xml` answers with a meta-refresh
 * shell rather than a document, and there is no flat index anywhere on the
 * site. Walking the category tree is the only way to find out what exists —
 * see `docs/MARITOOL_CATALOG.md` §2.
 *
 * **Nothing in a scrape needs this.** `families/maritool.ts` names all 41 leaf
 * cPaths in scope, and a scrape fetches exactly those; re-deriving them at
 * scrape time would put a 199-page crawl in front of every run to rediscover
 * a list that is already written down. It is here for the maintenance question
 * that table cannot answer — *has MariTool added or moved a leaf?* — and the
 * CLI exposes it as `maritool --catalog` for that purpose. It is how the table
 * was built and how it gets rechecked.
 *
 * ## The tree is deeper than it looks
 *
 * Two to four levels, and **no root carries products itself**. `Dual Contact
 * CAT40` (`c23_25_432`) and each of the nine HSK sizes are intermediate nodes
 * with children, so a walk that stopped at depth 2 would find zero HSK holders
 * and zero dual-contact parts — 187 of the 529 in scope. That is why this
 * recurses on the child links rather than reading one level of the sidebar.
 *
 * A category page carries its children as links whose cPath extends its own by
 * exactly one segment, and the sidebar renders unrelated branches beside them,
 * so the prefix test is what separates a child from a sibling of an ancestor.
 */

import { Parser } from 'htmlparser2'

import type { Fetcher } from '../../fetch.js'
import { compare } from '../../order.js'
import { consoleWarn, pause, REQUEST_DELAY_MS, type Warn } from '../../scrape.js'
import { BASE, categoryUrl } from './scrape.js'

/**
 * The five taper trees this adapter covers.
 *
 * MariTool's catalog is larger — `c23` holds twenty more roots, and the store
 * sells cutting tools besides. These are the trees asked for, and adding one
 * is a decision rather than a widening of a pattern; see the package's rule on
 * not adding vendor scope without being asked.
 *
 * **There is no CAT30.** MariTool's 30-taper is BT30 and ISO30, confirmed
 * against the full sidebar rather than against a landing page. ISO30 (`c23_54`)
 * is absent for a different reason: its three ER parts publish no spec table,
 * so the family would be a receipt of nothing.
 */
export const CATEGORY_ROOTS: readonly string[] = [
  '23_25', // CAT40
  '23_24', // CAT50
  '23_33', // BT30
  '23_26', // BT40
  '23_46', // HSK
]

/** `.../c23_25_42/index.html` and `index.php?cPath=23_25_42` both give `23_25_42`. */
const CATEGORY_HREF = /(?:\/c|[?&]cPath=)(\d+(?:_\d+)*)(?:\/index\.html)?(?:[&#]|$)/

/** One node of the tree, as the walk found it. */
export interface Category {
  /** MariTool's own category path, e.g. `23_25_42`. */
  readonly cPath: string
  /** The vendor's own name for it, off the page title. */
  readonly name: string
  /** Child cPaths, sorted. Empty on a leaf. */
  readonly children: readonly string[]
  /** What `(of N products)` said, or 0 where the page states no count. */
  readonly products: number
}

/** `<title>… Accessories ER Collet Chucks - MariTool</title>` -> the middle. */
const TITLE = /<title>([^<]*)<\/title>/i

/** The vendor's own boilerplate around every category name. */
const TITLE_NOISE = [/^Tool Holders, Collets and Machine Accessories\s*/i, /\s*-\s*MariTool$/i]

/** `(of 51 products)`, or 0 — an empty category renders no count at all. */
const PRODUCT_COUNT = /\(of\s*<b>\s*(\d+)\s*<\/b>\s*products\)/i

/** The category name a page states, stripped of the store's boilerplate. */
export function categoryName(html: string): string {
  let name = TITLE.exec(html)?.[1] ?? ''
  for (const noise of TITLE_NOISE) name = name.replace(noise, '')
  return name.replace(/\s+/g, ' ').trim()
}

/**
 * One category page: its children, its name and its own product count.
 *
 * A child is a link whose cPath extends this one by exactly one segment. The
 * page also links every sibling of every ancestor — the sidebar renders the
 * whole open branch — so taking every `cPath` link would walk the catalog from
 * any starting point and take the twenty out-of-scope roots with it.
 */
export function parseCategory(html: string, cPath: string): Category {
  const children = new Set<string>()

  const parser = new Parser(
    {
      onopentag: (tag, attribs) => {
        if (tag !== 'a') return
        const found = CATEGORY_HREF.exec(attribs['href'] ?? '')?.[1]
        if (found === undefined) return
        if (
          found.startsWith(`${cPath}_`) &&
          found.split('_').length === cPath.split('_').length + 1
        )
          children.add(found)
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()

  return {
    cPath,
    name: categoryName(html),
    children: [...children].sort(compare),
    products: Number(PRODUCT_COUNT.exec(html)?.[1] ?? 0),
  }
}

/**
 * Every category reachable from `roots`, breadth first and paced.
 *
 * Sequential and paced by the package's shared politeness delay. The five
 * roots in scope reach 199 categories, which is a three-minute walk and is run
 * by hand rather than by a scrape.
 */
export async function discoverCategories(
  fetcher: Fetcher,
  roots: readonly string[] = CATEGORY_ROOTS,
  options: { warn?: Warn; delayMs?: number } = {},
): Promise<Category[]> {
  const { warn = consoleWarn, delayMs = REQUEST_DELAY_MS } = options
  const found = new Map<string, Category>()
  const queue = [...roots]

  while (queue.length > 0) {
    const cPath = queue.shift()!
    if (found.has(cPath)) continue

    const category = parseCategory(await fetcher.text(categoryUrl(cPath)), cPath)
    found.set(cPath, category)
    if (category.children.length === 0 && category.products === 0) {
      warn(`  WARNING: c${cPath} (${category.name}) holds neither a subcategory nor a product`)
    }
    queue.push(...category.children)
    await pause(delayMs)
  }

  return [...found.values()].sort((a, b) => compare(a.cPath, b.cPath))
}

/** The leaves of a walk: the categories that carry products themselves. */
export function leavesOf(categories: readonly Category[]): Category[] {
  return categories.filter((category) => category.children.length === 0)
}

/** One line per category, for a human reading a `--catalog` run. */
export function describe(category: Category): string {
  const shape = category.children.length > 0 ? `${category.children.length} subcategories` : 'leaf'
  return `${BASE}/index.php?cPath=${category.cPath}\t${category.products}\t${shape}\t${category.name}`
}
