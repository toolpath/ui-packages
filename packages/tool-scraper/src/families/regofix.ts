/**
 * REGO-FIX's families — toolholding only.
 *
 * There is no `FAMILIES` table here: REGO-FIX publishes no cutting tools, so this
 * vendor never goes through a column map. What it publishes is powRgrip holders
 * and the PG collets that press into them, and both are scraped from the
 * ProductFinder's Elasticsearch index rather than from a family page — which is
 * why there is no `familyCode` either. The scrape target is a set of index
 * filters, and it lives with the scraper that posts them.
 */

import type { ToolholdingDefinition } from '../family.js'

export const HOLDER_FAMILIES = {
  // ── REGO-FIX powRgrip, BT 30 (JG 2026-08-07) ───────────────────────────
  // The first non-Kennametal toolholding family, and the first one whose
  // `contact` is **not** here. REGO-FIX publishes plain and dual-contact BT30
  // in one product group — `BT 30 / PG 25 x 080 H` and `BT+ 30 / PG 25 x 080
  // H` are two rows of one table — and states which is which in a `form_name`
  // field. So the CSV carries a `contact` column, and the rule is that a
  // scraped fact beats a family constant. There is deliberately no `contact`
  // key below; supplying one would silently mask a scrape that lost the
  // column.
  //
  // `clamping: 'collet'` and `style: 'pg-collet-chuck'`. A powRgrip holder
  // takes a PG collet, which is pressed in with a hydraulic clamping unit
  // rather than closed by a nut — so it grips through a collet exactly as an
  // ER chuck does, and the picker asks it the same question. What differs is
  // that seating one needs a PGU/PGS press on the bench, which is why it is
  // its own `style` and not `er-collet-chuck` with a different series.
  // REGO-FIX's own words for the line are "powRgrip" and "PG toolholders"
  // (`/en/products/system/powrgrip`, `/en/products/components/toolholders/
  // powRgrip`).
  //
  // **`taper: 'BT30'` covers BT+ 30 too**, the same call BTKV30 got and for
  // the same reason: the vendor's own `J1` property is `DINISO7388-2` on
  // every one of these rows, plus-form included, so the cone is identical and
  // the plus is a face that also seats. Recording `BT+30` as a taper would
  // hide ten holders from every BT30 filter.
  //
  // `rows` is 21 against 22 in the vendor's group: `4130.71506` (BT+ 30 / PG
  // 15 x 075 H) has DXF and PDF drawings but no DIN 4000 document, so it has
  // no published gage length and is skipped by the scraper with a message.
  // The three `BT-OM 30` parts are excluded at a different level — see
  // `vendors/regofix/scrape.ts`'s `SCRAPED_TAPERS` — because nothing on the
  // vendor's site says what OM designates.
  'regofix_bt30_pg_holders.csv': {
    catalogName: 'REGO-FIX powRgrip BT30 Toolholders',
    rows: 21,
    brand: 'regofix',
    facts: {
      taper: {
        value: 'BT30',
        source: 'vendor-stated',
        cite: "every row's DIN 4000 J1 property is DINISO7388-2 — the same 7/24 cone whether or not the flange face seats",
      },
      clamping: {
        value: 'collet',
        source: 'vendor-stated',
        cite: 'the holder publishes a CST collet series, so it grips through a collet',
      },
      style: {
        value: 'pg-collet-chuck',
        source: 'vendor-stated',
        cite: "REGO-FIX's own system name, /products/system/powrgrip",
      },
      unit: {
        value: 'millimeters',
        source: 'vendor-stated',
        cite: 'the family is titled and catalogued in this system; both unit columns are usually published, so this decides which is displayed',
      },
    },
  },
} as const satisfies Record<string, ToolholdingDefinition>

export const COLLET_FAMILIES = {
  // ── REGO-FIX powRgrip PG collets (JG 2026-08-07) ───────────────────────
  // Twelve product groups, restricted to the PG series a BT30 holder takes
  // (6, 10, 15, 25). PG 32 and PG 48 collets exist and no BT30 holder in this
  // catalog accepts one.
  //
  // **None of these declares a `unit`, and that is the change this package
  // promised itself.** Every group holds metric and fractional-inch collets
  // side by side — `PG 25 Ø 6.0 mm` and `PG 25 Ø 1/4"` are two rows of one
  // group — so there is no family-level answer to declare. The unit is a
  // column. Kennametal's TT HPV family is the one place a mixed family was
  // handled by splitting the CSV, and the note there says a second one means
  // making the unit per-record instead of splitting twice. This is that
  // second one, twelve times over.
  //
  // **`style` is the vendor's own product group**, not a coinage: each value
  // below is a slug of `product_group_name` in the ProductFinder index, and
  // a consumer's label for it comes from the matching
  // `product_category_name`. Both are re-checkable with one POST to the
  // endpoint in `REGOFIX_PRODUCTFINDER_API.md` — no browser, no scraper
  // change. They are config rather than a scraped column for the same reason
  // Kennametal's are: constant per family, and this table is where per-family
  // constants live.
  //
  // **PGST is a separate series, not a PG collet.** Its parts are designated
  // `PGST 15`, REGO-FIX sells dedicated `.../PGST Short Tail` toolholders for
  // them, and nothing published says whether a PGST collet also seats in a
  // plain PG holder. `collet_row` therefore writes the series exactly as the
  // vendor designates it, so a PGST collet matches no PG holder. That is the
  // conservative direction on purpose: hiding a collet that would have fitted
  // costs an option, while offering one that does not fit costs a machinist a
  // purchase. Resolve it by asking REGO-FIX, not by widening the string.
  // Today no BT30 short-tail holder exists either way, so all 28 sit in the
  // catalog fitting nothing.
  'regofix_pg_collets_standard.csv': {
    catalogName: 'REGO-FIX powRgrip PG Standard Collets',
    rows: 71,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-standard',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'Standard'",
      },
    },
  },
  'regofix_pg_collets_coolant_flush.csv': {
    catalogName: 'REGO-FIX powRgrip PG Coolant Flush Collets',
    rows: 51,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-coolant-flush',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'Coolant flush'",
      },
    },
  },
  'regofix_pg_collets_short.csv': {
    catalogName: 'REGO-FIX powRgrip PG Short Collets',
    rows: 34,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-short',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'Short'",
      },
    },
  },
  'regofix_pg_collets_cool_bore.csv': {
    catalogName: 'REGO-FIX powRgrip PG Cool Bore Collets',
    rows: 30,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-cool-bore',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'Cool bore'",
      },
    },
  },
  'regofix_pgst_collets.csv': {
    catalogName: 'REGO-FIX powRgrip PGST Short Tail Collets',
    rows: 28,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pgst-short-tail',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'PGST'",
      },
    },
  },
  'regofix_pg_collets_tap.csv': {
    catalogName: 'REGO-FIX powRgrip PG Tapping Collets',
    rows: 26,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-tap',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'Tapping collet TAP'",
      },
    },
  },
  'regofix_pg_collets_long.csv': {
    catalogName: 'REGO-FIX powRgrip PG Long Collets',
    rows: 21,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-long',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'Long'",
      },
    },
  },
  'regofix_pg_collets_microbore.csv': {
    catalogName: 'REGO-FIX powRgrip PG Microbore Collets',
    rows: 16,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-microbore',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'Microbore'",
      },
    },
  },
  'regofix_pg_collets_turning.csv': {
    catalogName: 'REGO-FIX powRgrip PG Turning Collets',
    rows: 16,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-turning',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'PG-T'",
      },
    },
  },
  'regofix_pg_collets_mql.csv': {
    catalogName: 'REGO-FIX powRgrip PG MQL Collets',
    rows: 11,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-mql',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'PG-MQL'",
      },
    },
  },
  'regofix_pg_collets_securgrip.csv': {
    catalogName: 'REGO-FIX powRgrip PG secuRgrip Collets',
    rows: 10,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-securgrip',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'secuRgrip'",
      },
    },
  },
  'regofix_pg_collets_sealed_cap.csv': {
    catalogName: 'REGO-FIX powRgrip PG Sealed Cap Collets',
    rows: 7,
    brand: 'regofix',
    facts: {
      style: {
        value: 'pg-sealed-cap',
        source: 'vendor-stated',
        cite: "the ProductFinder index groups these under product_group_name 'PG-SC'",
      },
    },
  },
} as const satisfies Record<string, ToolholdingDefinition>
