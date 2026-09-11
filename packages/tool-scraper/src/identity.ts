/**
 * Vendor identity: which brands this package knows, and how records are named.
 *
 * Kept apart from the adapters because every one of them needs it — a scraper
 * resolves a brand to a host and, on the two AEM brands, to a component node;
 * record identity resolves the same brand to a `vendor` string, a product URL
 * and the UUID namespace its records are minted under.
 *
 * **Every record's guid is minted in its own brand's namespace.** That is what
 * makes a guid collision across brands structurally impossible rather than
 * merely unlikely: a material number is a vendor-local integer, and nothing
 * reserves `100003658` to Kennametal. One namespace for every brand is
 * harmless only while two brands share a number space by accident.
 *
 * The preset namespace is deliberately absent. Presets are the conversion
 * half, which stays out of this package (see `docs/TOOL-SCRAPER-PLAN.md`,
 * decision 1), and a constant nothing here reads would be a pinned value with
 * nothing pinning it.
 */

import { uuid5, NAMESPACE_URL } from './uuid5.js'

/** What this package knows about one manufacturer. */
export interface Brand {
  /** The bare hostname, for a transport that builds its own URLs. */
  host: string
  /**
   * The brand's home page, and therefore its guid namespace seed.
   *
   * **Stated rather than derived.** `https://www.{host}` is right for the two
   * AEM brands and wrong for a host carrying its own subdomain — it would mint
   * REGO-FIX under the nonsense URL `https://www.us.rego-fix.com`.
   */
  home: string
  /** What the `vendor` field of a record from this brand says. */
  vendor: string
  /** The vendor's own page for one part, with a `{material}` hole. */
  productLink: string
  /**
   * The AEM component node that serves a family's variant table.
   *
   * **AEM-specific and therefore optional** (2026-08-07). It is a fact about
   * Kennametal's platform and not about vendors in general — REGO-FIX is a
   * Drupal site with an Elasticsearch proxy and has no such node. Read it off
   * a family page's `data-path` attribute when a new brand turns up.
   */
  node?: string
}

/**
 * The brands this package can scrape, by their internal key.
 *
 * WIDIA is Kennametal's sister brand on the same AEM/Hybris platform; only the
 * host, the AEM component node and the vendor string differ. Families default
 * to `kennametal` unless their config names a brand.
 */
export const BRANDS = {
  kennametal: {
    host: 'kennametal.com',
    home: 'https://www.kennametal.com',
    node: 'product_variants',
    vendor: 'Kennametal',
    productLink: 'https://www.kennametal.com/us/en/products/p.{material}.html',
  },
  widia: {
    host: 'widia.com',
    home: 'https://www.widia.com',
    node: 'product_variants_cop',
    vendor: 'WIDIA',
    productLink: 'https://www.widia.com/us/en/products/p.{material}.html',
  },
  // REGO-FIX publishes no per-part page: the Drupal node behind a part
  // redirects to `/products`, and the only place a single part is addressable
  // is the ProductFinder, whose Searchkit `SearchBox` has the default accessor
  // id `q` and queries `field_sku_fulltext` among others (read off
  // `searchkit-starter-app/build/static/js/main.d1ba5577.js`, JG 2026-08-07).
  // So the link is a search for the part number rather than a page about it,
  // which is what the vendor actually offers.
  regofix: {
    host: 'us.rego-fix.com',
    home: 'https://us.rego-fix.com',
    vendor: 'REGO-FIX',
    productLink: 'https://us.rego-fix.com/en/productfinder?q={material}',
  },
  // Destiny Tool is a Next.js SPA with no product data in the HTML at all — it
  // reads live from a Firestore database. Its client-rendered product page is
  // addressable by the vendor's item number in the path.
  destinytool: {
    host: 'destinytool.com',
    home: 'https://destinytool.com',
    vendor: 'Destiny Tool',
    productLink: 'https://destinytool.com/products/{material}',
  },
  // Harvey Tool is the first brand here whose per-part link is a real page the
  // vendor already publishes: every tool number in a product table is rendered
  // as `<a href="/products/tool-details-14916">`, so the template below is the
  // vendor's own URL rather than a search standing in for one. The 26 parts
  // whose table cell carries no link are the exception, and the link is still
  // the right thing to offer for them — see `docs/HARVEY_PRODUCT_TABLE.md` §3.
  harvey: {
    host: 'harveytool.com',
    home: 'https://www.harveytool.com',
    vendor: 'Harvey Tool',
    productLink: 'https://www.harveytool.com/products/tool-details-{material}',
  },
  // MariTool is an osCommerce-family storefront, and its per-part page is
  // addressable three ways: `product_info.php?products_id=100`, the
  // SEO-rewritten `/p100/<slug>/product_info.html`, and a keyword search. The
  // first two are keyed on an internal store id rather than on the part
  // number, and that id is the one thing about a MariTool part that is not
  // stable — a re-created product changes it. So the link is a search for the
  // part number, the same call REGO-FIX and Destiny Tool got, and here it is a
  // search the vendor really answers: `advanced_search_result.php?keywords=`
  // is the storefront's own search endpoint and a part number matches exactly
  // one product (JG 2026-08-29).
  //
  // No `node`: that key is Kennametal's AEM platform and nothing else.
  maritool: {
    host: 'maritool.com',
    home: 'https://www.maritool.com',
    vendor: 'MariTool',
    productLink: 'https://www.maritool.com/advanced_search_result.php?keywords={material}',
  },
  // EMUGE-FRANKEN is a SAP Commerce storefront whose pages carry no product
  // data at all — the Vue front end reads a JSON API, and that API is what the
  // adapter talks to. See `docs/EMUGE_FRANKEN_COMMERCE_API.md`.
  //
  // The per-part link is the vendor's own: every variant record answers with
  // `url: "/us/en/p/<18-digit material number>"`, so this is that page rather
  // than a search standing in for one. `www.emuge-franken-group.com` is the
  // group site serving every region; `/us/en/` is the US storefront the
  // `emugefrankenUSA` base site the scrape reads corresponds to, so the link
  // and the data are the same catalog (JG 2026-09-01).
  emuge: {
    host: 'www.emuge-franken-group.com',
    home: 'https://www.emuge-franken-group.com',
    vendor: 'EMUGE-FRANKEN',
    productLink: 'https://www.emuge-franken-group.com/us/en/p/{material}',
  },
} as const satisfies Record<string, Brand>

/**
 * The brands this package knows, as a type.
 *
 * Derived from {@link BRANDS} rather than listed, so the two cannot disagree,
 * a new brand needs no second edit, and a typo is a compile error rather than
 * a missing key at run time.
 */
export type BrandName = keyof typeof BRANDS

/**
 * The two brands on Kennametal's AEM platform.
 *
 * A named type because it is a real constraint rather than a convenience: the
 * Kennametal transport reads {@link Brand.node}, and a brand without one
 * simply cannot be passed to it — the scraper's signature says so, and
 * REGO-FIX cannot reach it.
 *
 * The value exists alongside the type because the CLI has to check a *string*
 * off argv against this set — a type cannot do that, and checking against
 * {@link BRANDS} instead let `--brand regofix` through to a URL with
 * `undefined` in its path.
 */
export const AEM_BRANDS = ['kennametal', 'widia'] as const satisfies readonly BrandName[]

export type AemBrandName = (typeof AEM_BRANDS)[number]

/**
 * The UUID namespace records of `brand` are minted under.
 *
 * Seeded from the brand's own home page, so a new brand gets a distinct
 * namespace for free. Deterministic across machines and runs, which is the
 * whole point: tool guids are the join key for every downstream consumer of a
 * scrape.
 *
 * Kennametal's value is unchanged from the single namespace this package used
 * before 2026-08-07 — the migration therefore churned WIDIA's six tools and
 * nothing else.
 */
export function vendorNamespace(brand: BrandName): string {
  return uuid5(NAMESPACE_URL, BRANDS[brand].home)
}

/**
 * The vendor's own page for one orderable part.
 *
 * Per-brand rather than one template, because the shape is not shared: the two
 * AEM brands serve a product page per material number, REGO-FIX serves none at
 * all and is linked into its ProductFinder instead. A single format string
 * with a `{host}` hole encoded the AEM path as though it were universal.
 */
export function productLink(brand: BrandName, material: string): string {
  return BRANDS[brand].productLink.replace('{material}', material)
}

/**
 * The stable guid for one orderable part, from its vendor material number.
 *
 * One function because tools and toolholding must mint identically: a holder
 * and a tool are different kinds of record but they share a guid space, and a
 * consumer that builds a catalog from both refuses a collision between them.
 */
export function recordGuid(brand: BrandName, material: string): string {
  return uuid5(vendorNamespace(brand), material)
}
