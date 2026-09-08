/**
 * MariTool's families — toolholding only, and one CSV per spindle taper.
 *
 * There is no `FAMILIES` table here: MariTool publishes no cutting tools, so
 * this vendor never goes through a column map and binds no record mapper —
 * the REGO-FIX case. What it publishes is ER collet chucks, shrink-fit holders
 * and hydraulic chucks in five tapers.
 *
 * ## The scrape target is a list of leaf categories
 *
 * MariTool's tree is two to four levels deep and **no root carries products
 * itself**, so there is no single page to name. Each family below states the
 * leaf cPaths it is scraped from, in {@link LEAVES}, and that list is config
 * rather than something a scrape re-derives: a walk of the five roots is 199
 * requests to rediscover 41 paths that are already written down. The walk is
 * kept — `vendors/maritool/catalog.ts`, reachable as `maritool --catalog` —
 * because it is how this list was built and how it gets rechecked.
 *
 * **A leaf carries the clamping mode and the style with it.** Each CSV is one
 * taper and mixes all three holder styles, so neither can be a family fact;
 * and MariTool's own name for the leaf is what classifies the part, so the
 * column is vendor-stated rather than a coinage here. `ER Collet Chucks` is
 * `collet` / `er-collet-chuck`, `Shrink Fit Holders` is `shrink` /
 * `shrink-fit`, `Hydraulic Chucks` is `hydraulic` / `hydraulic-chuck`.
 *
 * **Three of the leaves are named `Collet Chucks` rather than `ER Collet
 * Chucks`, and all three are ER** — `c23_24_45` (CAT50 ER32), `c23_24_429_430`
 * (dual-contact CAT50 ER32) and `c23_46_1811_1812` (HSK63F ER20), verified
 * from the part numbers on each page. That is the reason this is a list and
 * not a name filter: a rule matching `ER Collet Chucks` drops all three
 * silently.
 *
 * ## Not a fact between them
 *
 * No family below declares one, and every candidate is a column instead:
 *
 * - **`taper` and `contact`** — MariTool states the interface per part in its
 *   `Taper` cell, in both plain and dual-contact forms, and the HSK family
 *   holds nine sizes in one CSV. A family constant would mask a scrape that
 *   lost the column.
 * - **`clamping` and `style`** — three styles per CSV, from the leaf.
 * - **`unit`** — `Gage Length` is metric on some parts and imperial on others
 *   inside one file *and* inside one category page, so there is no
 *   family-level answer to declare. The scraper promotes an `L1_in`/`L1_mm`
 *   pair with one cell filled instead.
 *
 * ## What is not scraped
 *
 * **The taps are not scraped, and the evidence for when they are is here.**
 * MariTool sells taps under `c78_148`, and its tree already answers the one
 * question a tap record needs that no vendor of ours states in a column —
 * whether the tap cuts its thread or forms it. Only the forming branch carries
 * the word, so the leaf name settles it (JG 2026-09-07):
 *
 * | Leaf                    | cPath              | Method    |
 * | ----------------------- | ------------------ | --------- |
 * | Thread Forming Taps     | `78_148_274`       | `forming` |
 * | — Plug Form Tap         | `78_148_274_275`   | `forming` |
 * | — Bottoming Form Tap    | `78_148_274_276`   | `forming` |
 * | Spiral Flute Taps       | `78_148_149`       | `cutting` |
 * | Spiral Point Taps       | `78_148_224`       | `cutting` |
 * | Taps for Aluminum       | `78_148_271`       | `cutting` |
 * | Taper Pipe Taps         | `78_148_283`       | `cutting` |
 * | DIN Length HPT Taps     | `78_148_284`       | `cutting` |
 *
 * **Checked into a table when it is built, not run as a filter**, for the
 * reason the ER leaves above already give: a rule matching a name drops
 * silently when the vendor renames a category, and three leaves here are
 * already named something other than what they hold. `maritool --catalog` walks
 * the tree, which is how the rule gets re-checked rather than trusted.
 *
 * **What still has to be decided before a tap family lands.** A MariTool tap
 * page publishes `Shank Size`, `Total Length`, `Thread Length` and `Size` —
 * enough for `SFDM`, `OAL`, `LCF` and a designation `thread.ts` can already
 * parse — but a metric tap states `Size: M3` and `Pitch Diameter: 0.5` against
 * a body in inches (`Shank Size: 0.141`, `Total Length: 1 15/16`). No family in
 * this package is mixed that way and `ToolRecord.unit` is one value, so that is
 * a decision on its own merits and not a widening of this table.
 *
 * **BT50 and ISO30 produce no CSV.** MariTool's only BT50 category is end mill
 * holders, which is out of scope; ISO30 has three ER parts and none of them
 * publishes a spec table, so the family would be a receipt of nothing.
 *
 * Mega Grip, SK, TG, end mill and shell mill holders, slitting-saw and hob
 * arbors, threaded-body and DSF/MCS modulars, drill chucks, floating tap
 * holders, boring-head adapters, calibration tooling and coolant tubes are all
 * out of scope as well — 730 further parts under `c23`. Adding one is a
 * decision, not a widening of this table.
 */

import type { ToolholdingDefinition } from '../family.js'

/**
 * One leaf to scrape, and how MariTool classifies what is in it.
 *
 * Declared here rather than imported from `vendors/maritool/scrape.ts`,
 * which declares a structurally identical `LeafTarget`: `families/` is config
 * and must not import an adapter — `tests/vendor-boundary.test.ts` refuses it,
 * and the table is read by every test, none of which should drag a vendor's
 * scraper in behind it.
 */
export interface Leaf {
  /** MariTool's own category path, e.g. `23_25_42`. */
  readonly cPath: string
  /** How a holder in this leaf grips: `collet`, `shrink`, `hydraulic`. */
  readonly clamping: string
  /** The product style, as MariTool names the leaf. */
  readonly style: string
}

const collet = (cPath: string): Leaf => ({ cPath, clamping: 'collet', style: 'er-collet-chuck' })
const shrink = (cPath: string): Leaf => ({ cPath, clamping: 'shrink', style: 'shrink-fit' })
const hydraulic = (cPath: string): Leaf => ({
  cPath,
  clamping: 'hydraulic',
  style: 'hydraulic-chuck',
})

/**
 * Which leaf categories each family is scraped from, by CSV name.
 *
 * Keyed the same as {@link HOLDER_FAMILIES}, which
 * `tests/maritool.test.ts` holds the two tables to — a family with no leaves
 * would scrape nothing and report it as an empty catalog.
 *
 * The plain and dual-contact leaves of one style sit next to each other on
 * purpose: they share no `products_id` at all, so a dual-contact holder is a
 * distinct part rather than a re-listing, and both belong in the taper's CSV.
 */
export const LEAVES = {
  'maritool_cat40_holders.csv': [
    collet('23_25_42'),
    collet('23_25_432_433'),
    shrink('23_25_503'),
    shrink('23_25_432_524'),
    hydraulic('23_25_929'),
    hydraulic('23_25_432_930'),
  ],
  'maritool_cat50_holders.csv': [
    collet('23_24_45'),
    collet('23_24_429_430'),
    shrink('23_24_1978'),
    shrink('23_24_429_1979'),
    hydraulic('23_24_957'),
    hydraulic('23_24_429_1512'),
  ],
  'maritool_bt30_holders.csv': [
    collet('23_33_35'),
    collet('23_33_444_445'),
    collet('23_33_269_270'),
    shrink('23_33_515'),
    shrink('23_33_444_559'),
    shrink('23_33_269_1575'),
    hydraulic('23_33_911'),
    hydraulic('23_33_444_912'),
  ],
  'maritool_bt40_holders.csv': [
    collet('23_26_36'),
    collet('23_26_480_481'),
    shrink('23_26_1640'),
    shrink('23_26_480_1641'),
    hydraulic('23_26_1199'),
    hydraulic('23_26_480_1409'),
  ],
  // Fifteen leaves for seventy parts, because HSK is nine sizes rather than
  // one taper and MariTool files each size's styles under it separately. The
  // sizes in scope are HSK25E, HSK40E, HSK50A, HSK50E, HSK63A, HSK63F, HSK80F
  // and HSK100A; the `Taper` column is what tells them apart in the file.
  'maritool_hsk_holders.csv': [
    collet('23_46_943_1494'), // HSK63A
    collet('23_46_1523_1543'), // HSK50A
    collet('23_46_1552_1558'), // HSK40E
    collet('23_46_1591_1592'), // HSK25E
    collet('23_46_972_1605'), // HSK50E
    collet('23_46_1811_1812'), // HSK63F — the leaf named "Collet Chuck Holders"
    shrink('23_46_943_947'), // HSK63A
    shrink('23_46_972_1495'), // HSK50E
    shrink('23_46_1523_1542'), // HSK50A
    shrink('23_46_1552_1553'), // HSK40E
    shrink('23_46_1513_1903'), // HSK100A
    shrink('23_46_1841_1844'), // HSK80F
    hydraulic('23_46_943_946'), // HSK63A
    hydraulic('23_46_1513_1534'), // HSK100A
    hydraulic('23_46_972_973'), // HSK50E
  ],
} as const satisfies Record<string, readonly Leaf[]>

export const HOLDER_FAMILIES = {
  // ── MariTool toolholding (JG 2026-08-29) ───────────────────────────────
  // Five families, 529 parts across 41 leaves, and **no facts on any of
  // them**. Every per-family constant the other toolholding vendors declare is
  // a column here, for the reasons in this module's docstring; a fact stating
  // one would be a constant the vendor's own table contradicts row by row.
  //
  // `rows` is the sum of what each leaf's own `(of N products)` line says,
  // which is the independent restatement `receipts.checkRows` needs: every
  // other count is computed from the same file it is checking, so a scrape
  // that silently lost rows agrees with itself.
  'maritool_cat40_holders.csv': {
    catalogName: 'MariTool CAT40 Toolholders',
    rows: 217,
    brand: 'maritool',
  },
  // 11 parts in the vendor's six leaves and 9 rows here: `CAT50-ER32-3.0` and
  // `CAT50-ER32-4.0` publish no `Product Specifications` table at all — they
  // state their geometry as prose in a `Product Info` bullet list — so they
  // have no gage length and are skipped by the scraper with a message. They
  // are the only two such parts in scope.
  'maritool_cat50_holders.csv': {
    catalogName: 'MariTool CAT50 Toolholders',
    rows: 9,
    brand: 'maritool',
  },
  'maritool_bt30_holders.csv': {
    catalogName: 'MariTool BT30 Toolholders',
    rows: 164,
    brand: 'maritool',
  },
  'maritool_bt40_holders.csv': {
    catalogName: 'MariTool BT40 Toolholders',
    rows: 67,
    brand: 'maritool',
  },
  'maritool_hsk_holders.csv': {
    catalogName: 'MariTool HSK Toolholders',
    rows: 70,
    brand: 'maritool',
  },
} as const satisfies Record<string, ToolholdingDefinition>
