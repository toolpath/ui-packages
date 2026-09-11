/**
 * The category walk — what Kennametal publishes under a facet, family by family.
 *
 * `scrape.ts` fetches a family once its **code** is known, and until now the
 * only way to learn a code was to open a category page in a browser and read it
 * out of a link. That is why `families/kennametal.ts` carried collet families
 * with no `familyCode` at all: nobody had written the codes down, because there
 * was nothing to write them down from.
 *
 * **Nothing in a scrape uses this.** `families/kennametal.ts` names every family
 * in scope and a scrape fetches exactly those; re-deriving the list at scrape
 * time would put a crawl in front of every run to rediscover something already
 * recorded. It is here for the maintenance question that table cannot answer —
 * *has Kennametal added, split or retired a family?* — and the CLI exposes it as
 * `kennametal --collets`, which reconciles the walk against the recorded codes.
 *
 * ## The endpoint, and how it was found
 *
 * A category page renders its results client-side, so the HTML a browser is
 * served carries facet chrome and no products. The component behind it is a
 * plain AEM GET, read out of the page's own `product-listing.min.js`:
 *
 * ```js
 * url: a + "." + c + ".html?" + h + "query=" + d + "&sort=" + e + "&pageSize=" + f
 * ```
 *
 * where `a` is the component path, `c` is a **page index** and `d` is the same
 * facet string the browser's address bar carries. Three things about it cost
 * time to find and are recorded in `docs/KENNAMETAL_PRODUCT_LISTING.md`:
 *
 * - The public `/us/en/...` path works. The authoring `/content/kennametal/...`
 *   path the markup's own `data-path` shows answers 307.
 * - A non-numeric selector (`.results.`, `.products.`) returns the site's 404
 *   page **with a 404 status**, so a wrong guess fails rather than parsing to
 *   nothing.
 * - `pageSize` counts **families**, not parts. At `pageSize=2` the seven-family
 *   coolant-through leaf pages two at a time, which is why {@link categoryListingPages}
 *   pages at all rather than asking once and trusting it.
 *
 * ## The tree is two shapes, not one
 *
 * A category above the leaves returns **category tiles** — facet links, each
 * extending its parent's query by one `allCategoriesKMT` id — and no families.
 * A leaf returns family links and no tiles. The tap-collet category is a leaf at
 * depth 0 and the standard-collet one is not, so a walk that assumed either
 * shape would find half the catalog.
 *
 * ## The category path in the URL does not scope anything
 *
 * The `query` does, alone. Asked for the BT30 ER-collet-chuck facet, the collet
 * category's path and the holder category's path return the same 12 parts and
 * the same one family (JG 2026-09-09). So {@link COLLET_CATEGORY} and
 * {@link HOLDER_CATEGORY} are not two scopes — they are two spellings of "a real
 * product category page to hang the component off", and a walk is defined by its
 * roots rather than by which one it passes.
 */

import { Parser } from 'htmlparser2'

import type { Fetcher } from '../../fetch.js'
import { BRANDS, type AemBrandName } from '../../identity.js'
import { compare } from '../../order.js'
import { consoleWarn, pause, REQUEST_DELAY_MS, type Warn } from '../../scrape.js'

/**
 * The product-listing component, per category page.
 *
 * A different resource from `scrape.BASE`: that one is the variant table on the
 * shared `products/fam` page, this one hangs off the category's own path. The
 * component node is `product_listing` on both AEM brands.
 */
export const LISTING_BASE =
  'https://www.{host}/us/en/products/{category}/_jcr_content/root/' +
  'responsivegrid/product_listing.{page}.html?query={query}&sort=&pageSize={size}'

/** Where the collet walk starts: the category path, and the three facet queries. */
export const COLLET_CATEGORY = 'metalworking-tools/tool-holders-and-adapters/collets-and-sleeves'

/**
 * The three collet lines this package covers, as the vendor's own facets.
 *
 * Read off the category listing on 2026-09-08. Each is the query string the
 * browser's address bar carries for that line, with `obsoleteFacet:false` — the
 * same active-only scoping `scrape.ACTIVE_ONLY` applies to a family — and the
 * `allCategoriesKMT` chain that names Collets and Sleeves (`42034262`), ER
 * Collets (`42866150`) and then the line.
 *
 * Kennametal's collet catalog is larger: `42034262` also holds sleeves, DA and
 * TG collets and shrink sleeves. These are the three lines asked for, and
 * adding a fourth is a decision rather than a widening of a pattern.
 */
export const COLLET_CATEGORIES: readonly { readonly name: string; readonly query: string }[] = [
  {
    name: 'ER Standard Collets',
    query:
      ':relevance:obsoleteFacet:false:allCategoriesKMT:42034262' +
      ':allCategoriesKMT:42866150:allCategoriesKMT:51114268',
  },
  {
    name: 'ER Coolant Through Collets',
    query:
      ':relevance:obsoleteFacet:false:allCategoriesKMT:42034262' +
      ':allCategoriesKMT:42866150:allCategoriesKMT:109337175',
  },
  {
    name: 'ER Tap Collets',
    query:
      ':relevance:obsoleteFacet:false:allCategoriesKMT:42034262' +
      ':allCategoriesKMT:42866150:allCategoriesKMT:109337171',
  },
]

/** Where the holder walk starts. See the note above: this scopes nothing. */
export const HOLDER_CATEGORY = 'metalworking-tools/tool-holders-and-adapters'

/** Active parts under Tool Holders & Adapters — what every holder root extends. */
const HOLDER_ROOT = ':relevance:obsoleteFacet:false:allCategoriesKMT:2664259'

/**
 * The six spindle interfaces this package covers, as the vendor's own facets.
 *
 * Read off the Tool Holders & Adapters listing on 2026-09-09, and the same
 * shape {@link COLLET_CATEGORIES} has: `obsoleteFacet:false`, then the
 * `allCategoriesKMT` chain that names Tool Holders & Adapters (`2664259`) and
 * then the interface.
 *
 * **These are six of fifteen tiles, and the omissions are deliberate.** The
 * same listing publishes KM™, KM4X™, DV, Collets and Sleeves, Accessories,
 * Turret Adapted Clamping Units, Straight Shank System, Straight Shank with
 * DUO-LOCK™ and VDI Toolholders. A seventh interface is a decision rather than
 * a widening of a pattern — `AGENTS.md` holds this package to not raising
 * request volume or adding scope on its own.
 *
 * `BTKV` and `CVKV` are the vendor's *face-contact* lines on the same two
 * cones, which is why they are separate roots rather than rows: Kennametal
 * numbers, prices and categorises them apart, and `HolderRecord.contact` is the
 * axis that carries the difference. `families/kennametal.ts` records the same
 * thing about the one BTKV30 family that predates this walk.
 */
export const HOLDER_CATEGORIES: readonly { readonly name: string; readonly query: string }[] = [
  { name: 'BT', query: `${HOLDER_ROOT}:allCategoriesKMT:42025681` },
  { name: 'BTKV', query: `${HOLDER_ROOT}:allCategoriesKMT:41357960` },
  { name: 'CV', query: `${HOLDER_ROOT}:allCategoriesKMT:42025689` },
  { name: 'CVKV', query: `${HOLDER_ROOT}:allCategoriesKMT:42025499` },
  { name: 'HSK', query: `${HOLDER_ROOT}:allCategoriesKMT:41339510` },
  { name: 'PSC', query: `${HOLDER_ROOT}:allCategoriesKMT:100025012` },
]

/**
 * How many families a listing page returns.
 *
 * Sixty because that is the largest the vendor's own control offers and every
 * line in scope fits one page at it — so the walk is one request per node in
 * practice, and still correct if a line outgrows it.
 */
export const LISTING_PAGE_SIZE = 60

/** `/us/en/products/fam.er-standard-collets-metric.100000478.html` */
const FAMILY_HREF = /\/products\/fam\.([A-Za-z0-9-]+)\.(\d+)\.html/

/** `data-totalResults="224"` — htmlparser2 lower-cases attribute names. */
const TOTAL = /data-totalresults="(\d+)"/i

/** One family a leaf category links to. */
export interface FamilyLink {
  /** The vendor's numeric family code — what `scrapeFamily` takes. */
  readonly code: string
  /** The slug in the same link, which is the vendor's own name for the family. */
  readonly slug: string
}

/** One subcategory a listing page offers, as a facet rather than a path. */
export interface CategoryTile {
  /** The parent's query with one more `allCategoriesKMT` id on the end. */
  readonly query: string
  /** The vendor's own name for it, off the tile's `data-title`. */
  readonly name: string
  /** What the tile's `(117)` said. */
  readonly count: number
}

/** What one listing response holds. */
export interface CategoryListing {
  /** `data-totalResults`, or 0 where the response states none. */
  readonly total: number
  readonly tiles: readonly CategoryTile[]
  readonly families: readonly FamilyLink[]
}

/** One page of one category's listing. */
export function listingUrl(
  query: string,
  page: number,
  brand: AemBrandName = 'kennametal',
  category: string = COLLET_CATEGORY,
  size: number = LISTING_PAGE_SIZE,
): string {
  return LISTING_BASE.replace('{host}', BRANDS[brand].host)
    .replace('{category}', category)
    .replace('{page}', String(page))
    .replace('{query}', encodeURIComponent(query))
    .replace('{size}', String(size))
}

/**
 * One listing response: its tiles, its family links and its stated total.
 *
 * The tile's three facts arrive in three places — the query on the anchor, the
 * count in a `<span class="count">` inside it, the name in a `data-title` on a
 * `<div>` inside it — so this tracks the open anchor rather than matching a
 * shape. A page's facet sidebar carries hundreds of other `data-query` anchors;
 * `horizontal-facet` is the class the tiles alone wear, and it is what
 * separates a subcategory from a filter checkbox.
 */
export function parseCategoryListing(html: string): CategoryListing {
  const tiles: CategoryTile[] = []
  const families = new Map<string, FamilyLink>()

  let open: { query: string; name: string; count: number } | null = null
  let counting = false

  const parser = new Parser(
    {
      onopentag: (tag, attribs) => {
        if (tag === 'a') {
          const href = attribs['href'] ?? ''
          const found = FAMILY_HREF.exec(href)
          if (found !== null) {
            families.set(found[2]!, { code: found[2]!, slug: found[1]! })
            return
          }
          const cls = attribs['class'] ?? ''
          const query = attribs['data-query']
          if (cls.includes('horizontal-facet') && query !== undefined) {
            open = { query, name: '', count: 0 }
          }
          return
        }
        if (open === null) return
        if (tag === 'span' && (attribs['class'] ?? '').includes('count')) counting = true
        const title = attribs['data-title']
        if (title !== undefined) open.name = title
      },
      ontext: (text) => {
        if (!counting) return
        const digits = /(\d+)/.exec(text)
        if (digits !== null) open!.count = Number(digits[1])
      },
      onclosetag: (tag) => {
        if (tag === 'span') counting = false
        if (tag === 'a' && open !== null) {
          tiles.push(open)
          open = null
        }
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()

  return {
    total: Number(TOTAL.exec(html)?.[1] ?? 0),
    tiles,
    families: [...families.values()].sort((a, b) => compare(a.code, b.code)),
  }
}

/**
 * How many times one listing page is asked for before the walk gives up on it.
 *
 * **Four, because the holder tree made a single attempt unusable.** The collet
 * walk is seven requests and a transient failure there is a re-run; the six
 * holder interfaces are 336 nodes and about 635 requests, and Kennametal fails
 * one often enough — three of 320 family scrapes on 2026-09-09, near 1 % — that
 * *some* request in a walk that long fails almost every time. Without this, ten
 * minutes of crawling ends in an exception with nothing printed, and re-running
 * only buys another draw of the same lottery.
 *
 * A retry and not a wider timeout: what the vendor does is fail a request, not
 * answer slowly.
 */
export const LISTING_ATTEMPTS = 4

/**
 * How long to wait before re-asking, and how fast that grows.
 *
 * **The backoff is the part that matters, and it was learned the hard way.**
 * Three attempts spaced by the walk's 400 ms politeness delay recovered two
 * failures on the 2026-09-09 walk and then lost it anyway: the vendor stopped
 * accepting connections for a stretch, all three attempts landed inside that
 * same stretch, and the walk died 300 nodes in. Attempts spread over about 40
 * seconds ride that out; attempts spread over one second cannot, however many
 * of them there are.
 *
 * Quadrupling rather than doubling, so four attempts cover 2 s, 8 s and 32 s
 * without needing a longer list. The wait is only ever paid when something is
 * already wrong.
 */
export const RETRY_BASE_MS = 2_000
export const RETRY_FACTOR = 4

/**
 * One listing page, re-asked through a transient vendor failure.
 *
 * Exhausting every attempt still **throws**. A branch quietly missing from a
 * reconciliation listing is worse than no listing at all: it reads as
 * "Kennametal retired these families", which is exactly the question this
 * command exists to answer.
 */
async function fetchListing(fetcher: Fetcher, url: string, warn: Warn): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetcher.text(url)
    } catch (error) {
      if (attempt >= LISTING_ATTEMPTS) throw error
      const wait = RETRY_BASE_MS * RETRY_FACTOR ** (attempt - 1)
      warn(`  WARNING: ${url} failed (${String(error)}); retrying in ${wait} ms`)
      await pause(wait)
    }
  }
}

/**
 * Every page of one category, until a page adds no family it had not seen.
 *
 * The vendor states no page count anywhere, and `data-totalResults` counts
 * *parts* while `pageSize` counts *families*, so the two cannot be divided into
 * a page budget. What ends the walk is the page itself: an index past the last
 * one returns the facet chrome with no families in it.
 *
 * Tiles come from the first page only. A category with subcategories publishes
 * them on every page and recursing on a duplicate would re-walk the branch.
 */
export async function categoryListingPages(
  fetcher: Fetcher,
  query: string,
  options: { brand?: AemBrandName; category?: string; delayMs?: number; warn?: Warn } = {},
): Promise<CategoryListing> {
  const {
    brand = 'kennametal',
    category = COLLET_CATEGORY,
    delayMs = REQUEST_DELAY_MS,
    warn = consoleWarn,
  } = options
  const families = new Map<string, FamilyLink>()
  let first: CategoryListing | null = null

  for (let page = 0; ; page += 1) {
    if (page > 0) await pause(delayMs)
    const listing = parseCategoryListing(
      await fetchListing(fetcher, listingUrl(query, page, brand, category), warn),
    )
    first ??= listing

    const before = families.size
    for (const family of listing.families) families.set(family.code, family)
    if (families.size === before) break
  }

  return {
    total: first?.total ?? 0,
    tiles: first?.tiles ?? [],
    families: [...families.values()].sort((a, b) => compare(a.code, b.code)),
  }
}

/** One node of the walk: the facet that was asked, and what came back. */
export interface DiscoveredCategory {
  readonly name: string
  /**
   * Every name from the root down to and including this node.
   *
   * The holder tree is what this is for. `ER Collet Chucks` is a leaf under all
   * six spindle interfaces and `Shrink Fit Toolholders` under all six as well,
   * so a leaf's own name identifies neither the family nor the taper it is for
   * — `BT / BT 40 Shank Tools / ER Collet Chucks` does. It is also where a
   * holder family's `taper` fact comes from: the vendor states the interface as
   * a category and never as a column.
   */
  readonly path: readonly string[]
  readonly query: string
  /** `data-totalResults` — how many parts the vendor counts under this facet. */
  readonly total: number
  readonly families: readonly FamilyLink[]
}

/**
 * Every family reachable from `roots`, depth first and paced.
 *
 * A tile's query has to **extend** its parent's, which is the same prefix test
 * `vendors/maritool/catalog.ts` applies to a cPath and for the same reason: a
 * listing page renders unrelated facets beside its own subcategories, so taking
 * every `horizontal-facet` anchor would walk out of the branch that was asked
 * for and into the whole catalog.
 *
 * Sequential and paced by the package's shared politeness delay. The three
 * collet lines reach seven nodes; the six holder interfaces reach 336 and about
 * 635 requests, which is minutes rather than seconds and still a command a
 * maintainer runs by hand rather than something a scrape does.
 *
 * **`roots` has no default.** It did — `COLLET_CATEGORIES` — back when there was
 * one tree to walk. With two, a default is a walk nobody asked for served to a
 * caller who forgot an argument, and the pair that has to agree is `roots` and
 * `options.category`.
 */
export async function discoverFamilies(
  fetcher: Fetcher,
  roots: readonly { name: string; query: string }[],
  options: { warn?: Warn; brand?: AemBrandName; category?: string; delayMs?: number } = {},
): Promise<DiscoveredCategory[]> {
  const { warn = consoleWarn, delayMs = REQUEST_DELAY_MS, ...where } = options
  const found: DiscoveredCategory[] = []
  const seen = new Set<string>()

  const walk = async (path: readonly string[], query: string): Promise<void> => {
    if (seen.has(query)) return
    seen.add(query)
    const name = path[path.length - 1] ?? ''

    const listing = await categoryListingPages(fetcher, query, { ...where, delayMs, warn })
    found.push({ name, path, query, total: listing.total, families: listing.families })

    const children = listing.tiles.filter((tile) => tile.query.startsWith(`${query}:`))
    if (children.length === 0 && listing.families.length === 0) {
      warn(`  WARNING: ${path.join(' / ')} holds neither a subcategory nor a family`)
    }
    for (const tile of children) {
      await pause(delayMs)
      await walk([...path, tile.name], tile.query)
    }
  }

  for (const root of roots) await walk([root.name], root.query)
  return found
}

/** One line per family, for a human reading a `--collets` or `--holders` run. */
export function describeFamily(
  category: DiscoveredCategory,
  family: FamilyLink,
  configured: string | null,
): string {
  const where = configured ?? '(not configured)'
  return `${family.code}\t${family.slug}\t${category.path.join(' / ')}\t${where}`
}
