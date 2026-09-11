/**
 * EMUGE-FRANKEN's families.
 *
 * Five, one per catalog category crossed with the unit system the category is
 * published in. That is coarser than the vendor's own marketing, which splits
 * end mills fifteen ways by product line — TOP-Cut, Hard-Cut, Alu-Cut — and it
 * is deliberate: EMUGE states the product line, the cutting material, the
 * coating and the coolant supply **per part**, in columns, and a scraped column
 * beats a family constant. Splitting by product line would turn four counted
 * row totals into thirty and buy nothing a `product line` column does not
 * already carry — and it is carried: `vendors/emuge/records.ts`'s
 * `PRODUCT_LINE_COLUMNS` reads one per part onto `ToolRecord.productLine`, from
 * a column every scrape already writes.
 *
 * So the only fact the two milling families state is `unit`; the drill family
 * adds the two a drill record cannot be built without, and each tap family adds
 * how its taps make a thread — see `MACHINE_TAP` and `COLD_FORMING_TAP`.
 *
 * ## The tapping split, which is not a unit split
 *
 * Tapping is the one category EMUGE publishes as **two**: `FG01`, which it
 * titles `Machine taps`, and `FG02`, `Cold forming tap`. They are the same
 * three calls against the same column labels and differ only in what the tools
 * do — one cuts the thread away, the other displaces material into it — so
 * they are two families and not two adapters, and the category is what each
 * one's `threadMethod` fact cites.
 *
 * `FG02` went unscraped until 2026-09-07, which meant `emuge_taps.csv` was the
 * whole of this package's tapping corpus and every row in it was a cutting tap
 * with nothing recording that it was.
 *
 * ## `rows`
 *
 * The vendor's own result count for exactly the query the family scrapes, read
 * on 2026-09-01. It is the second number `node/receipts.checkRows` exists to
 * compare against, and the point is that nothing computes it from the file it
 * is checking — so when EMUGE adds a size, the scrape and this table disagree
 * and somebody looks.
 *
 * ## The unit split, and where it does not apply
 *
 * Milling is the one category EMUGE publishes in both systems: `AMM_EINHS`
 * indexes every milling variant as inch or metric, and an inch part states its
 * dimensions in fractional inches (`1 1/2 "`) where a metric one states
 * millimetres. Drilling and tapping have no such facet and no such split —
 * every drill and every tap, including a `#4-40 UNC` one, is published in
 * millimetres. That is why `emuge_taps.csv` declares a `unit` where
 * `families/kennametal.ts`'s taps declare none: there is no per-row thread
 * system to read, because the vendor states one system for all of them.
 */

import type { UnitSystem } from '../conventions.js'
import type { FamilyDefinition } from '../family.js'
import type { Fact } from '../provenance.js'
import type { ThreadMethod } from '../records.js'

/**
 * The facet EMUGE indexes milling variants by unit system under.
 *
 * The vendor's own code, verbatim, including the German class name in the
 * middle of it — it is a key in their search index rather than a label, and
 * shortening it would be inventing a query.
 */
const UNIT_FACET = 'feature-HYBCL_PRODUKTMERKMALE-AMM_EINHS'

/**
 * What each family scrapes, keyed by the same CSV names as {@link FAMILIES}.
 *
 * A sibling table rather than more keys on `FamilyDefinition`, which has no
 * word for "a category narrowed by one facet" and should not grow one for a
 * single vendor — the call `families/harvey.ts` makes with `PRODUCT_PAGES` and
 * `families/maritool.ts` with `LEAVES`.
 *
 * `Target` is declared here rather than imported from
 * `vendors/emuge/scrape.ts`, which is structurally identical, because
 * `families/` importing an adapter is what `tests/vendor-boundary.test.ts`
 * refuses: this table is read by every test, and none of them should drag a
 * vendor's scraper in behind it.
 */
export interface Target {
  /** The vendor's category code. */
  readonly category: string
  /** A facet code and value, both the vendor's own. */
  readonly facet?: { readonly code: string; readonly value: string }
}

export const SCRAPE_TARGETS = {
  'emuge_end_mills_inch.csv': {
    category: 'FF01',
    facet: { code: UNIT_FACET, value: 'AMM_EINHS_Z' },
  },
  'emuge_end_mills_mm.csv': {
    category: 'FF01',
    facet: { code: UNIT_FACET, value: 'AMM_EINHS_M' },
  },
  'emuge_drills.csv': { category: 'FB01' },
  'emuge_taps.csv': { category: 'FG01' },
  'emuge_form_taps.csv': { category: 'FG02' },
} as const satisfies Record<string, Target>

/**
 * Tapping geometry, identical either side of the cutting/forming split.
 *
 * **EMUGE labels a cold-forming tap's lead `length of cutting edge l₂` too**,
 * and it reaches the CSV under that label, because a scraped column keeps the
 * vendor's own name — `conventions.ts` opens on the reason. A former has no
 * cutting edge and the label is wrong about it; renaming it here would swap one
 * vendor's inaccuracy for this package's invention, and the record's `LCF` is
 * the canonical name either way.
 */
const TAP_COLUMNS = {
  DC: 'nominal diameter d₁',
  SFDM: 'Shank diameter d₂',
  OAL: 'Overall length l₁',
  LCF: 'length of cutting edge l₂',
  TP: 'pitch',
} as const

/**
 * Which of EMUGE's two tap categories a family scrapes, and how it is known.
 *
 * The vendor splits its taps into two categories and scraping either one is
 * already the answer — but the *parts* say so as well, independently, which is
 * what makes these `vendor-stated` rather than a claim about a URL. Every
 * grouped product carries a flat `technicalDetails` list, and:
 *
 * - all 414 `FG01` groups state `chamfer form` and none states `lead taper
 *   form`;
 * - all 137 `FG02` groups state `lead taper form` and none states `chamfer
 *   form`.
 *
 * Mutually exclusive, both directions, at full coverage (JG 2026-09-07). A
 * chamfer is ground onto a tap that cuts and a lead taper is rolled onto one
 * that forms, so the vendor is naming the same distinction twice.
 * `tests/emuge-corpus.test.ts` re-checks that agreement against a real scrape,
 * which is what keeps these two constants honest without either family reading
 * a column.
 *
 * **Two things that look like this discriminator and are not**, recorded so
 * nobody reaches for them: `Geometry` — the column `vendors/emuge/records.ts`
 * reads as the product line — takes `AL`, `GAL`, `H`, `MULTI`, `SPEED`,
 * `STEEL`, `VA` and `Z` in *both* categories; and the 189 `FG01` variants whose
 * `flute characteristic` is `without` are six EMUGE *Robust* groups, reinforced
 * cutting taps that still state a `chamfer form`.
 */
/**
 * The unit both tap families are published in.
 *
 * Shared because the vendor's rule is about tapping and not about either
 * category: a `#4-40 UNC` tap states millimetres whichever of the two it sits
 * in, which is the same thing the module note says about there being no unit
 * facet on tapping at all.
 */
const TAP_MILLIMETERS = {
  value: 'millimeters',
  source: 'vendor-stated',
  cite: 'every tap dimension is published in millimetres whatever the thread standard — a `#4-40 UNC` tap states `nominal diameter d₁ [mm]` as `2.845 mm`, `pitch [mm]` as `0.635 mm`, and its shank and lengths in `mm` — with `thread symbol`, `nominal size` and `threads per inch` carrying the inch designation beside them',
} as const satisfies Fact<UnitSystem>

const MACHINE_TAP = {
  value: 'cutting',
  source: 'vendor-stated',
  cite: "the vendor's own category `FG01`, which it titles `Machine taps`; and independently every one of its 414 grouped products states a `chamfer form` and none states a `lead taper form` (JG 2026-09-07)",
} as const satisfies Fact<ThreadMethod>

const COLD_FORMING_TAP = {
  value: 'forming',
  source: 'vendor-stated',
  cite: "the vendor's own category `FG02`, which it titles `Cold forming tap`; and independently every one of its 137 grouped products states a `lead taper form` and none states a `chamfer form` (JG 2026-09-07)",
} as const satisfies Fact<ThreadMethod>

/** Milling geometry, identical either side of the unit split. */
const MILLING_COLUMNS = {
  DC: 'cutting diameter Ød₁',
  SFDM: 'shank diameter Ød₂',
  OAL: 'overall length l₁',
  LCF: 'cutting length l₂',
  RE: 'radius r₁',
  'shoulder-length': 'neck length l₃',
  'shoulder-diameter': 'neck diameter Ød₃',
  NOF: 'number of flutes Z',
} as const

export const FAMILIES = {
  'emuge_end_mills_inch.csv': {
    id: 'end-mills-inch',
    brand: 'emuge',
    kind: 'endmill',
    familyCode: 'FF01',
    rows: 1832,
    columns: MILLING_COLUMNS,
    facts: {
      unit: {
        value: 'inches',
        source: 'vendor-stated',
        cite: 'the vendor\'s own `AMM_EINHS` facet, whose two values are `AMM_EINHS_Z` (inch, 1,832 variants) and `AMM_EINHS_M` (metric, 5,189); this family scrapes the first, and every dimensional value in it states `"` rather than `mm`',
      },
    },
  },
  'emuge_end_mills_mm.csv': {
    id: 'end-mills-mm',
    brand: 'emuge',
    kind: 'endmill',
    familyCode: 'FF01',
    rows: 5189,
    columns: MILLING_COLUMNS,
    facts: {
      unit: {
        value: 'millimeters',
        source: 'vendor-stated',
        cite: 'the same `AMM_EINHS` facet, `AMM_EINHS_M`; every dimensional value in this family states `mm`',
      },
    },
  },
  'emuge_drills.csv': {
    id: 'drills',
    brand: 'emuge',
    kind: 'drill',
    familyCode: 'FB01',
    // `SIG` is a mapped column and not a fact, which no other drill family in
    // this package manages: EMUGE states a point angle on the detail record of
    // 2,669 of these 2,670 parts, and leaves the cell empty on the last, so the
    // record may carry no `SIG` — see `vendors/emuge/records.ts`'s `angle`.
    // Kennametal's two drill lines assume theirs or derive them from a point
    // length, and both say so at length in `families/kennametal.ts`.
    columns: {
      DC: 'nominal diameter d₁',
      SFDM: 'Shank diameter d₂',
      OAL: 'Overall length l₁',
      LCF: 'Flute length l₂',
      SIG: 'point angle',
    },
    rows: 2670,
    facts: {
      unit: {
        value: 'millimeters',
        source: 'vendor-stated',
        cite: 'every dimensional value on every drill variant states `mm`; the inch column the detail record also publishes (`nominal diameter d₁ [in]`) is a second index on the same part rather than a second family',
      },
      flutes: {
        value: 2,
        source: 'assumed',
        note: 'EMUGE publishes no flute count for a drill anywhere a scrape can reach. All 17 grouped products in FB01 state `Specification: Twist drill`, which is a two-flute geometry, and the vendor publishes `Number of margins` (2 or 4) as a separate column — so the 4 that appears there is a margin count and not a flute count, and that column is in the CSV as the evidence',
        checked: '2026-09-01',
        by: 'JG',
      },
      nonFerrous: {
        value: false,
        source: 'vendor-stated',
        cite: "the vendor's own `applicationMaterials` index rates these drills for P, M, K, N, S and H — the ferrous groups included — on every part sampled across all 17 grouped products",
      },
    },
  },
  'emuge_taps.csv': {
    id: 'taps',
    brand: 'emuge',
    kind: 'tap',
    familyCode: 'FG01',
    // `TP` reads a column with no unit suffix, which is what
    // `records.DIMENSIONAL_COLUMNS` excluding it means: the vendor publishes
    // `pitch [mm]` and this family is millimetres, so the column is already in
    // the record's native unit.
    columns: TAP_COLUMNS,
    rows: 11566,
    facts: {
      unit: TAP_MILLIMETERS,
      threadMethod: MACHINE_TAP,
    },
  },
  // The second half of the vendor's own tapping catalog, and the only forming
  // taps this package reaches. It scrapes the same three calls as `FG01`
  // against the same column labels — see `TAP_COLUMNS` — so it is a family
  // rather than an adapter: what differs is the category, and what the
  // category settles.
  'emuge_form_taps.csv': {
    id: 'form-taps',
    brand: 'emuge',
    kind: 'tap',
    familyCode: 'FG02',
    columns: TAP_COLUMNS,
    rows: 1432,
    facts: {
      unit: TAP_MILLIMETERS,
      threadMethod: COLD_FORMING_TAP,
    },
  },
} as const satisfies Record<string, FamilyDefinition>
