/**
 * Kennametal's and WIDIA's families.
 *
 * One module because they are one platform: the same AEM/Hybris component on the
 * same URL shape, differing only in host, component node and vendor string —
 * `identity.BRANDS` is where that is recorded, and `vendors/kennametal/` is the
 * one adapter that serves both. Their *receipts* stay separate, because an
 * adapter is a fact about code and a scraped CSV is a fact about who published
 * it.
 *
 * `familyCode` is the vendor's numeric family code, lifted out of the family
 * page URL to scrape the table in the first place. It is config rather than
 * runbook prose because `materials` needs it *after* the scrape, to re-query the
 * same family through the workpiece-material facet — recording it here is what
 * makes the material sweep re-runnable without going back to the browser.
 *
 * **Holder families carry no `familyCode`**, and that is a gap rather than a
 * rule: they were scraped by hand from a code read off the page at the time. A
 * re-scrape needs the code passed on the command line until somebody records it.
 */

import type { UnitSystem } from '../conventions.js'
import type { FamilyDefinition, ToolholdingDefinition } from '../family.js'
import type { Fact } from '../provenance.js'
import type { ThreadMethod } from '../records.js'

/**
 * Facts several families state identically, named once.
 *
 * A `cite` is what a person re-reads to check a vendor claim, so the same
 * claim has to read the same everywhere it is made — and eight copies of one
 * sentence are eight edits when the vendor's page changes, which is how four
 * of them acquired word-joining typos before this was extracted. A fact stays
 * inline where one family states it.
 */
const NO_COOLANT_COLUMN = {
  value: false,
  source: 'assumed',
  note: 'the table publishes no coolant column and the family page shows none',
  checked: '2026-08-05',
  by: 'JG',
} as const satisfies Fact<boolean>

const CARBIDE_GRADE_COLUMN = {
  value: 'carbide',
  source: 'vendor-stated',
  cite: 'the Grade column names a Kennametal carbide grade (KC7325, KCU20)',
} as const satisfies Fact<string>

const TWO_FLUTE_STRAIGHT = {
  value: 2,
  source: 'assumed',
  note: 'no flute-count column; the vendor\'s "Straight Fluted" names the helix, not the count',
  checked: '2026-08-06',
  by: 'JG',
} as const satisfies Fact<number>

const POINT_ANGLE_142 = {
  value: 142,
  source: 'derived',
  note: "no point angle is published on either family, either variant table or a product page. L5 (point length) is, and for a conical point L5 = D1 / (2·tan(SIG/2)). Least squares over all 49 rows gives 142.46° inch and 142.55° metric; at 142° the worst L5 residual is 0.05 mm — the vendor's own rounding — against 0.24 mm at 140°, which is ruled out",
} as const satisfies Fact<number>

const INTERNAL_COOLANT_TITLE = {
  value: true,
  source: 'vendor-stated',
  cite: '"Internal Coolant" is in the vendor\'s own family title',
} as const satisfies Fact<boolean>

const PCD_NON_FERROUS = {
  value: true,
  source: 'vendor-stated',
  cite: 'grade KD1415 is "PCD-tip brazed to carbide for … aluminum …, non-ferrous heavy metals, and plastics"; breadcrumb "PCD Tooling / PCD Drills • Aluminum Machining"; the facet returns N1-N4 and nothing else',
} as const satisfies Fact<boolean>

const PCD_SUBSTRATE = {
  value: 'diamond',
  source: 'vendor-stated',
  cite: 'grade KD1415 is PCD — the cutting material, not the carbide body it is brazed to',
} as const satisfies Fact<string>

const NO_COOLANT_THROUGH_TAP = {
  value: false,
  source: 'assumed',
  note: "HSS taps; no coolant-through variant appears in the family's variant table, and the table publishes no coolant column",
  checked: '2026-08-29',
  by: 'JG',
} as const satisfies Fact<boolean>

/**
 * The tap-type facet, and what it settles.
 *
 * **The variant table does not carry it.** All three tap families publish
 * `D1-TDZ`, `Thread Tolerance Class ANSI`, `Tap Pitch Diameter Limit` and
 * `Type of Thread` — the thread's *class*, never how it is produced. What does
 * carry it is the vendor's own `newTapType` Solr facet, and it narrows the same
 * `.variants.<code>.html` endpoint `vendors/kennametal/scrape.ts` already
 * calls: `scrape.ACTIVE_ONLY` is one facet on that query and this is a second,
 * exactly as `vendors/kennametal/materials.ts` appends one.
 *
 * Its vocabulary, read off the threading category listing on 2026-09-07, is
 * `2-Hand Tap`, `3-Forming Tap`, `8-Spiral Flute Tap`, `10-Pipe Tap`,
 * `11-Spiral Point Tap` and `13-Straight Flute Tap`. Exactly one of the six is
 * a forming tap; the other five cut. So a family that answers any value but
 * `3-Forming Tap` is a cutting family, and each of the three below was probed
 * for its own value **and** for `3-Forming Tap`, which returned the vendor's
 * no-results notice every time.
 *
 * That is why these are `vendor-stated` and not `assumed`: the cite is a query
 * anybody can re-run, and the *negative* half of it is the part that matters.
 * A `cite` naming only the CSV's own filename would be this table reading its
 * own name back to itself.
 */
const SPIRAL_POINT_TAP = {
  value: 'cutting',
  source: 'vendor-stated',
  cite: "the vendor's own `newTapType` facet on the variants endpoint: every row of this family answers `:relevance:obsoleteFacet:false:newTapType:11-Spiral Point Tap`, and `3-Forming Tap` — the one forming value of the six — returns the no-results notice (JG 2026-09-07)",
} as const satisfies Fact<ThreadMethod>

const HAND_TAP = {
  value: 'cutting',
  source: 'vendor-stated',
  cite: 'the same `newTapType` facet: every row of this family answers `2-Hand Tap`, and `3-Forming Tap`, `8-Spiral Flute Tap`, `10-Pipe Tap` and `11-Spiral Point Tap` each return the no-results notice (JG 2026-09-07)',
} as const satisfies Fact<ThreadMethod>

const HSS_ASSUMED = {
  value: 'hss',
  source: 'assumed',
  note: 'no substrate column; carried over from the pre-2026-08-08 config, which recorded no source for it. The KHSST line name implies high-speed steel and the Coating column carries the surface treatment instead of a carbide grade, but neither is a vendor statement of substrate',
  checked: '2026-08-08',
  by: 'JG',
} as const satisfies Fact<string>

const INCH_PLAIN_SHANK = {
  value: 'inches',
  source: 'vendor-stated',
  cite: 'the vendor titles the family "…plain shank inch"; both unit columns are published, so this decides which is displayed',
} as const satisfies Fact<UnitSystem>

const BT30_SHANK = {
  value: 'BT30',
  source: 'vendor-stated',
  cite: 'the family page states the shank as JIS B 6339 / MAS 403 size 30',
} as const satisfies Fact<string>

const TAPER_CONTACT = {
  value: 'taper',
  source: 'vendor-stated',
  cite: 'the family page says "Shank - SK BT JIS B 6339" with no face-contact claim',
} as const satisfies Fact<string>

const CST_COLLET_CLAMPING = {
  value: 'collet',
  source: 'vendor-stated',
  cite: 'the holder publishes a CST collet series, so it grips through a collet',
} as const satisfies Fact<string>

const ER_COLLET_CHUCK = {
  value: 'er-collet-chuck',
  source: 'vendor-stated',
  cite: 'breadcrumb ".../ER Collet Chucks/ER(tm) Collet Adapter -BT30"',
} as const satisfies Fact<string>

/**
 * The three ER collet styles, each stated once for the families that share it.
 *
 * `style` is the finer axis beside a holder's `clamping`, and here it is what
 * tells a consumer which kind of collet it is holding. All three are
 * Kennametal's own product lines, read off the collet category tree — see
 * `vendors/kennametal/catalog.ts`, which is what enumerates them.
 */
const ER_STANDARD = {
  value: 'er-standard',
  source: 'vendor-stated',
  cite: "the vendor's category is 'ER Collets / ER Standard Collets'; the family publishes a CCCN-CCCX capacity band and no square",
} as const satisfies Fact<string>

/**
 * Sealed coolant-through collets. `style` separates them from the standard ones
 * because they behave differently in a way the numbers show but a label should
 * not hide: `CCCX == CCCN` on every row, so each clamps one exact size rather
 * than a 1 mm band.
 *
 * No special case is needed anywhere — a zero-width range is still a range —
 * but a user choosing one deserves to be told which kind it is.
 *
 * **The ER40 inch line is designated larger than it clamps**, and that is the
 * vendor's own statement rather than a rounding: `40ERSS1000` is named for one
 * inch and publishes a capacity of 0.9938 in / 25.243 mm against a `D1` of
 * 1.0 in / 25.4 mm — both figures agree across both unit columns. Ten of its
 * twelve rows do this, up to 0.193 mm on `40ERSS0812`. `holding.NOMINAL_SLACK`
 * is the gate that lets a designation sit outside the size it measures, and
 * those rows are where its bound comes from.
 */
const ER_SEALED = {
  value: 'er-sealed',
  source: 'vendor-stated',
  cite: "the vendor's category is 'ER Collets / ER Coolant Through Collets'; CCCX == CCCN == D1 on all 139 rows of the twelve families, and Kennametal specs an H6 shank, so each clamps one exact size",
} as const satisfies Fact<string>

/**
 * Tap collets. The square drive is the fact that matters and it is scraped
 * rather than declared — `holding.ColletRecord.squareSize` — so this is the
 * label and not the discriminant.
 */
const ER_TAP = {
  value: 'er-tap',
  source: 'vendor-stated',
  cite: "the vendor's category is 'ER Collets / ER Tap Collets'; every row publishes an S10 square size and no capacity band",
} as const satisfies Fact<string>

const METRIC_CATALOG = {
  value: 'millimeters',
  source: 'vendor-stated',
  cite: 'the family is titled and catalogued in this system; both unit columns are usually published, so this decides which is displayed',
} as const satisfies Fact<UnitSystem>

const BORE_CLAMPING = {
  value: 'bore',
  source: 'vendor-stated',
  cite: 'the holder publishes a D1 bore and no collet series, so it grips the shank directly',
} as const satisfies Fact<string>

const HYDRAULIC_CHUCK = {
  value: 'hydraulic-chuck',
  source: 'vendor-stated',
  cite: 'breadcrumb ".../Hydraulic Chucks - STANDARD /HP Line"',
} as const satisfies Fact<string>

const INCH_CATALOG = {
  value: 'inches',
  source: 'vendor-stated',
  cite: 'the family is titled and catalogued in this system; both unit columns are usually published, so this decides which is displayed',
} as const satisfies Fact<UnitSystem>

const SHRINK_FIT_FC = {
  value: 'shrink-fit-fc',
  source: 'vendor-stated',
  cite: 'breadcrumb ".../Shrink Fit Toolholders"; tagline "Standard Heat Shrink Holders … Face Coolant … BT30 Backend"',
} as const satisfies Fact<string>

const SHRINK_FIT_GP = {
  value: 'shrink-fit-gp',
  source: 'vendor-stated',
  cite: 'same category; tagline "Shrink Fit Toolholders General Purpose (GP)"',
} as const satisfies Fact<string>

// ── Cutting tools ──────────────────────────────────────────────────────────
export const FAMILIES = {
  // `unit` is required on a drill family as of 2026-08-06 and was hardcoded
  // to millimetres before it. Every drill table publishes both unit columns,
  // so it is config and never inferred: it decides which column is read.
  //
  // `nonFerrous` is required too, and deliberately has no default: it drops
  // the steel and stainless presets, and a family that silently defaulted to
  // False would ship them.
  'godrill_3xd_metric.csv': {
    id: 'godrill-3xd-metric',
    rows: 259,
    familyCode: '100003658',
    kind: 'drill',
    columns: { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'L3' },
    facts: {
      unit: {
        value: 'millimeters',
        source: 'vendor-stated',
        cite: 'the vendor titles the family "…3xD straight shank metric"; both unit columns are published, so this decides which is displayed',
      },
      flutes: {
        value: 2,
        source: 'assumed',
        note: 'no flute-count column; every GOdrill in this family is a two-flute twist drill',
        checked: '2026-07-24',
        by: 'JG',
      },
      pointAngle: {
        value: 140,
        source: 'assumed',
        note: 'no point angle is published anywhere on this family; 140° is the common GOdrill grind. Contrast the KenDrill TXD families, where L5 lets it be derived',
        checked: '2026-07-24',
        by: 'JG',
      },
      coolantThrough: NO_COOLANT_COLUMN,
      nonFerrous: {
        value: false,
        source: 'vendor-stated',
        cite: 'the workpiece-material facet returns P M K N S H — ferrous groups included',
      },
      bmc: CARBIDE_GRADE_COLUMN,
    },
  },
  'kenna_universal_3xd_metric.csv': {
    id: 'kenna-universal-3xd-metric',
    rows: 177,
    familyCode: '100004307',
    kind: 'drill',
    columns: { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'L3' },
    facts: {
      unit: {
        value: 'millimeters',
        source: 'vendor-stated',
        cite: 'the vendor titles the family "…3xD IC straight shank metric"; both unit columns are published',
      },
      flutes: {
        value: 2,
        source: 'assumed',
        note: 'no flute-count column; a two-flute twist drill',
        checked: '2026-07-24',
        by: 'JG',
      },
      pointAngle: {
        value: 140,
        source: 'assumed',
        note: 'no point angle published on this family; the same grind assumed as GOdrill',
        checked: '2026-07-24',
        by: 'JG',
      },
      coolantThrough: NO_COOLANT_COLUMN,
      nonFerrous: {
        value: false,
        source: 'vendor-stated',
        cite: 'the workpiece-material facet returns P M K N S (no H) — ferrous groups included',
      },
      bmc: CARBIDE_GRADE_COLUMN,
    },
  },
  // ── KenDrill TXD 5xD, PCD-tipped, internal coolant, straight shank ──
  // Scraped JG 2026-08-06. Two vendor codes for one product line, the same
  // split as the BT hydraulic chucks: `100165153` inch (20 rows) and
  // `100164033` metric (29). Both are wholly active — the obsolete query
  // returns the same counts — and their headers are byte-identical to
  // `godrill_3xd_metric.csv`.
  //
  // The unit split is the vendor's own, and its catalog numbers corroborate
  // `unit` rather than leaving it on the family title: the inch parts are
  // `K467A…` and encode the size in ten-thousandths of an inch
  // (`K467A02344SP` is 15/64), the metric ones `B467A…` in hundredths of a
  // millimetre (`B467A06000SP` is 6.00 mm). On each side the native column
  // carries the exact value and the other is rounded to four places.
  //
  // **`pointAngle` is 142, not the 140 the two families above assume**, and
  // it is derived rather than published: no point angle appears on either
  // family page, in either variant table, or on a product page (checked
  // 2026-08-06). What *is* published is `L5`, the drill point length, and for
  // a conical point `L5 = D1 / (2·tan(SIG/2))`. Least squares over all 49
  // rows gives an apex of 142.46° inch / 142.55° metric; at 142° the worst
  // residual in `L5` is 0.05 mm, which is the vendor's own rounding of a
  // four-decimal cell, and at 140° it is 0.24 mm — five times larger and
  // ruled out. 142.5° fits equally well and 142 was chosen (JG 2026-08-06).
  // This is arithmetic over vendor inputs rather than a vendor statement,
  // which is what makes it `derived` and not `assumed` — and what makes it
  // re-checkable: `L5` is in the CSV, so a re-scrape that moved it can be
  // caught by re-deriving the angle.
  //
  // **`coolantThrough` is True — the first True in this table.** Unlike the
  // 140° above it is not an assumption: "Internal Coolant" is in the vendor's
  // own family title on both codes.
  //
  // **`bmc` is 'diamond' and `nonFerrous` is True, and they are the same
  // fact.** Grade KD1415 is, in Kennametal's words, "PCD-tip brazed to
  // carbide for general machining of aluminum with a low silicon content,
  // non-ferrous heavy metals, and plastics"; the breadcrumb is `PCD Tooling /
  // PCD Drills • Aluminum Machining`, the product page states workpiece
  // material "Non-Ferrous", and the Application Data table publishes ISO
  // group N alone. 'diamond' names the cutting material rather than the body
  // it is brazed to (JG 2026-08-06) — nothing in BetterToolLib's schema
  // validates `BMC` and the web app does not display it, so the audience is
  // Fusion's material field.
  //
  // `flutes` is 2, which the table does not state either. It is the same
  // assumption as the two families above rather than a new one, and the
  // vendor's "Straight Fluted" describes the helix, not the count.
  'kendrill_txd_5xd_inch.csv': {
    id: 'kendrill-txd-5xd-inch',
    rows: 20,
    familyCode: '100165153',
    kind: 'drill',
    columns: { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'L3' },
    facts: {
      unit: {
        value: 'inches',
        source: 'vendor-stated',
        cite: 'catalog numbers are K467A… encoding the size in ten-thousandths of an inch (K467A02344SP is 15/64), and the inch column carries the exact value while the metric one is rounded',
      },
      flutes: TWO_FLUTE_STRAIGHT,
      pointAngle: POINT_ANGLE_142,
      coolantThrough: INTERNAL_COOLANT_TITLE,
      nonFerrous: PCD_NON_FERROUS,
      bmc: PCD_SUBSTRATE,
    },
  },
  'kendrill_txd_5xd_metric.csv': {
    id: 'kendrill-txd-5xd-metric',
    rows: 29,
    familyCode: '100164033',
    kind: 'drill',
    columns: { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'L3' },
    facts: {
      unit: {
        value: 'millimeters',
        source: 'vendor-stated',
        cite: 'catalog numbers are B467A… encoding the size in hundredths of a millimetre (B467A06000SP is 6.00 mm), and the metric column carries the exact value while the inch one is rounded',
      },
      flutes: TWO_FLUTE_STRAIGHT,
      pointAngle: POINT_ANGLE_142,
      coolantThrough: INTERNAL_COOLANT_TITLE,
      nonFerrous: PCD_NON_FERROUS,
      bmc: PCD_SUBSTRATE,
    },
  },
  'khsst_spiral_point_plug_inch.csv': {
    id: 'khsst-spiral-point-plug-inch',
    rows: 95,
    familyCode: '100004132',
    kind: 'tap',
    columns: { SFDM: 'D', OAL: 'L', LCF: 'L3', TP: 'Thread Pitch' },
    facts: {
      bmc: HSS_ASSUMED,
      coolantThrough: NO_COOLANT_THROUGH_TAP,
      threadMethod: SPIRAL_POINT_TAP,
    },
  },
  'khsst_hand_metric_plug.csv': {
    id: 'khsst-hand-metric-plug',
    rows: 14,
    familyCode: '100004161',
    kind: 'tap',
    columns: { SFDM: 'D', OAL: 'L', LCF: 'L3', TP: 'Thread Pitch' },
    facts: {
      bmc: HSS_ASSUMED,
      coolantThrough: NO_COOLANT_THROUGH_TAP,
      threadMethod: HAND_TAP,
    },
  },
  'spiral_point_metric_plug.csv': {
    id: 'spiral-point-metric-plug',
    rows: 20,
    familyCode: '100004191',
    kind: 'tap',
    columns: { SFDM: 'D', OAL: 'L', LCF: 'L3', TP: 'Thread Pitch' },
    facts: {
      bmc: HSS_ASSUMED,
      coolantThrough: NO_COOLANT_THROUGH_TAP,
      threadMethod: SPIRAL_POINT_TAP,
    },
  },
  'gomill_pro_radiused_4fl_necked_metric.csv': {
    id: 'gomill-pro-radiused-4fl-necked-metric',
    rows: 60,
    familyCode: '109353075',
    kind: 'endmill',
    columns: {
      DC: 'D1',
      SFDM: 'D',
      OAL: 'L',
      LCF: 'AP1MAX',
      RE: 'Re',
      'shoulder-length': 'L3',
      'shoulder-diameter': 'D3',
    },
    facts: {
      unit: {
        value: 'millimeters',
        source: 'vendor-stated',
        cite: 'the vendor titles the family "…necked plain shank metric"; both unit columns are published, so this decides which is displayed',
      },
      coolantThrough: NO_COOLANT_COLUMN,
      bmc: CARBIDE_GRADE_COLUMN,
    },
  },
  'gomill_pro_square_4fl_plain_inch.csv': {
    id: 'gomill-pro-square-4fl-plain-inch',
    rows: 93,
    familyCode: '109426909',
    kind: 'endmill',
    columns: { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'AP1MAX', 'shoulder-length': 'L3' },
    facts: {
      unit: INCH_PLAIN_SHANK,
      coolantThrough: NO_COOLANT_COLUMN,
      bmc: CARBIDE_GRADE_COLUMN,
    },
  },
  'varimill_chip_splitter_radiused_5fl_3xd_plain_metric.csv': {
    id: 'varimill-chip-splitter-radiused-5fl-3xd-plain-metric',
    rows: 3,
    familyCode: '103354322',
    kind: 'endmill',
    columns: { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'AP1MAX', RE: 'Re' },
    brand: 'widia',
    facts: {
      unit: {
        value: 'millimeters',
        source: 'vendor-stated',
        cite: 'the vendor titles the family "…3xD plain shank metric"; both unit columns are published, so this decides which is displayed',
      },
      coolantThrough: NO_COOLANT_COLUMN,
      bmc: CARBIDE_GRADE_COLUMN,
    },
  },
  'varimill_chip_splitter_570t_radiused_5fl_cyl_inch.csv': {
    id: 'varimill-chip-splitter-570t-radiused-5fl-cyl-inch',
    rows: 3,
    familyCode: '100680824',
    kind: 'endmill',
    columns: { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'AP1MAX', RE: 'Re' },
    brand: 'widia',
    facts: {
      unit: {
        value: 'inches',
        source: 'vendor-stated',
        cite: 'the vendor titles the family "…cylindrical shank inch"; both unit columns are published, so this decides which is displayed',
      },
      coolantThrough: NO_COOLANT_COLUMN,
      bmc: CARBIDE_GRADE_COLUMN,
    },
  },
  // The first sub-4-flute endmill line here, and the first one treated
  // downstream as a non-ferrous cutter. "Plain Shank" in the vendor's title is the
  // shank form, not the profile: D3 < D1 on every row, so these are necked
  // and L3 is published. `coolantThrough` False like every other family —
  // the table states no coolant column and the page shows none (JG,
  // 2026-08-05, unverified against a datasheet).
  'maximet_square_3fl_wiper_necked_plain_inch.csv': {
    id: 'maximet-square-3fl-wiper-necked-plain-inch',
    rows: 14,
    familyCode: '101273936',
    kind: 'endmill',
    columns: {
      DC: 'D1',
      SFDM: 'D',
      OAL: 'L',
      LCF: 'AP1MAX',
      'shoulder-length': 'L3',
      'shoulder-diameter': 'D3',
    },
    facts: {
      unit: {
        value: 'inches',
        source: 'vendor-stated',
        cite: 'the vendor titles the family "…necked plain shank inch"; both unit columns are published, so this decides which is displayed',
      },
      coolantThrough: NO_COOLANT_COLUMN,
      bmc: CARBIDE_GRADE_COLUMN,
    },
  },
  'kencut_ff_hpft_square_6fl_plain_inch.csv': {
    id: 'kencut-ff-hpft-square-6fl-plain-inch',
    rows: 12,
    familyCode: '100003783',
    kind: 'endmill',
    columns: { DC: 'D1', SFDM: 'D', OAL: 'L', LCF: 'AP1MAX' },
    facts: {
      unit: INCH_PLAIN_SHANK,
      coolantThrough: NO_COOLANT_COLUMN,
      bmc: CARBIDE_GRADE_COLUMN,
    },
  },
} as const satisfies Record<string, FamilyDefinition>

// ── Toolholding ────────────────────────────────────────────────────────────
// Holder tables state neither the spindle taper nor how the holder grips —
// both are in the family's title and its catalog numbers, never in a column —
// so both are config here, per the rule about facts the table never states
// (JG 2026-08-04, from the family page titles and the BT30* catalog number
// prefixes).
//
// `clamping` is the discriminant a picker branches on and is deliberately not
// the same field as `style`: 'bore' means the holder takes one shank size
// directly, 'collet' means it needs a collet in between. A shrink-fit or
// side-lock family added later is a new `style` but an existing `clamping`, so
// the fit rules do not grow a case.
//
// `contact` is the second such discriminant and arrived with BTKV30
// (JG 2026-08-05). 'taper' is a plain 7/24 cone; 'face' is a dual-contact
// shank that seats on the spindle face as well — the vendor's own words, from
// the product page's "Shank - SK BT Taper Face Contact". It is a *separate*
// axis from `taper` on purpose: BTKV30 is the same JIS B 6339 cone as BT30, so
// collapsing the distinction into the taper string would hide these holders
// from a BT30 filter, and folding it into `style` would conflate how a holder
// meets the spindle with how it grips the tool. **It has no default.** A family
// added without it fails loudly rather than being recorded as plain-taper on no
// evidence.
//
// The collet *series* is NOT here — holders publish it as `CST` and collets as
// `Collet Series`, so the join between them is a scraped vendor fact.
//
// **Where the `style` values come from.** They are config, like `taper` and
// `clamping` — the variant table states none of them. But they are not coined
// here: every one is Kennametal's own category for the family, read off the
// family page's breadcrumb and tagline and verified JG 2026-08-05. A consumer
// turns them into the words on a holder row, so a wrong one is a wrong label in
// front of a machinist rather than a wrong number, and the citation is what
// keeps it checkable. The breadcrumb is server-rendered, so re-checking one is
// a single `curl` of `fam.x.<CODE>.html` — no scraper change and no browser.
export const HOLDER_FAMILIES = {
  'bt30_er_collet_adapters_metric.csv': {
    catalogName: 'Kennametal BT30 ER Collet Adapters Metric',
    rows: 12,
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'bt30_hydraulic_chucks_form_ad_metric.csv': {
    catalogName: 'Kennametal BT30 Hydraulic Chucks Form AD Metric',
    rows: 8,
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: BORE_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  // The inch half of the same Form AD line (family 100127657, "HC IN-BT",
  // scraped JG 2026-08-05) — same BT30 cone, same actuation screw, three
  // fractional bores (1/4, 3/8, 1/2 in) instead of eight metric ones. It is
  // a *sibling* family and not more rows on the one above: Kennametal
  // numbers and codes the two separately, and the bores do not overlap.
  //
  // `unit` is 'inches' because the family is inch-native, which is the only
  // thing that decides which column a holder's record mapper displays. Both unit
  // columns are published here for every dimension — the HSK63A missing-pair
  // case does not apply — so this family would have converted either way and
  // silently shown 6.35 mm where a machinist ordered 1/4 in.
  'bt30_hydraulic_chucks_form_ad_inch.csv': {
    catalogName: 'Kennametal BT30 Hydraulic Chucks Form AD Inch',
    rows: 3,
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: BORE_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  // Dual-contact BT30. Same cone, same M16 drawbar, same ER collets as the
  // family above — what differs is that the flange face seats on the spindle
  // face too, and the vendor prices and numbers it as its own line (BTKV*).
  //
  // This family publishes **two** gage lengths: `L1` (100 mm on all five) and
  // `L1FC`, "Gage Length Face Contact" (99.002 mm on all five). Which one is
  // real is a property of the spindle, not of the holder. `gaugeLength` is
  // `L1` because this shop's BT30 spindle is not face-contact (JG
  // 2026-08-05), so `L1FC` is scraped into the CSV — the record of what the
  // vendor said — and deliberately not carried onto the record, per
  // a holder's record mapper's rule about published columns nothing displays. Promote
  // it the day a dual-contact spindle exists to read it, and change
  // `gaugeLength` with it rather than showing both.
  'btkv30_er_collet_chucks_metric.csv': {
    catalogName: 'Kennametal BTKV30 ER Collet Chucks Metric',
    rows: 5,
    facts: {
      taper: BT30_SHANK,
      contact: {
        value: 'face',
        source: 'vendor-stated',
        cite: 'the product page names the shank "SK BT Taper Face Contact"',
      },
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  // Shrink-fit chucks, scraped JG 2026-08-05 from the BT category page. Four
  // entries, two vendor families — see the split note below.
  //
  // `clamping: 'bore'` and not a new mode: a shrink fit grips the shank
  // directly, exactly as a hydraulic chuck does, and the picker's fit rule is
  // the same question ("is this bore the shank's size?"). What differs is
  // thermal rather than geometric, and nothing in this catalog reads it.
  //
  // The `style` split is the vendor's own product line, not a coinage.
  // Kennametal sells two shrink-fit lines on the same BT30 cone: the **FC
  // Line** ("Standard Heat Shrink Holders | Carbide and HSS Compatible | Face
  // Coolant | Through Coolant", Balanced-by-Design, 3 µm or less) and the
  // older **General Purpose (GP)** TT HPV line, which is *balanceable* with
  // optional M6 set screws rather than balanced as shipped. They overlap in
  // size but are not interchangeable at speed, so they are told apart the way
  // `er-standard` and `er-sealed` are. `FC` is the vendor's token and is left
  // unexpanded — nothing on the page says what it abbreviates.
  //
  // **`HLD_D1_MIN` is metric-only on both FC families, including the inch
  // one.** That is the HSK63A case from the runbook, and this is the first
  // family where it bites a family the catalog actually ships: without
  // `_dim`'s cross-unit fallback every one of these six inch chucks would
  // carry no bore, match no tool, and raise nothing.
  'bt30_shrink_fit_fc_form_ad_metric.csv': {
    catalogName: 'Kennametal BT30 Shrink Fit FC Line Form AD Metric',
    rows: 6,
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: BORE_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'bt30_shrink_fit_fc_form_ad_inch.csv': {
    catalogName: 'Kennametal BT30 Shrink Fit FC Line Form AD Inch',
    rows: 6,
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: BORE_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  // **These two are one vendor family (100017036, "TT HPV-BT Form AD") split
  // in half, and it is the only place in this package that happens.** Every
  // other family is wholly metric or wholly inch; this one publishes seven
  // metric bores (6-20 mm) and six fractional ones (1/4-3/4 in) as thirteen
  // rows under one code, so a single `unit` would have displayed 0.4724 in
  // for a 12 mm bore or 11.113 mm for a 7/16 in one.
  //
  // The partition is the vendor's own catalog-number suffix — `...M` is a
  // metric bore — and it is corroborated by which column carries the exact
  // value: the `M` rows give D1 as integers in millimetres and rounded
  // decimals in inches (12 / 0.4724), the others exactly the other way round
  // (0.4375 / 11.113). the toolholding tests pin both halves of that, so a
  // re-scrape that lost or moved a row fails rather than converting quietly.
  //
  // If a third mixed family ever turns up, stop splitting CSVs and make
  // `unit` a per-record fact instead — that is the honest model, and it is
  // not worth the churn for one family.
  'bt30_shrink_fit_hpv_form_ad_metric.csv': {
    catalogName: 'Kennametal BT30 Shrink Fit HPV GP Form AD Metric',
    rows: 7,
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: BORE_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'bt30_shrink_fit_hpv_form_ad_inch.csv': {
    catalogName: 'Kennametal BT30 Shrink Fit HPV GP Form AD Inch',
    rows: 6,
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: BORE_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: INCH_CATALOG,
    },
  },
} as const satisfies Record<string, ToolholdingDefinition>

/**
 * ER collets, one entry per vendor family.
 *
 * **One entry per vendor family and not one per style.** Kennametal codes the
 * coolant-through line as twelve families — one per series per unit — and their
 * column shapes genuinely differ: the inch half publishes `LF` and `L`, the
 * metric half publishes `L9` instead, and only `109321468` publishes both.
 * Merging them into two CSVs would also destroy `ToolholdingDefinition.rows`,
 * which is a per-family restatement and the only independent check that a
 * re-scrape did not lose parts.
 *
 * Every `familyCode` here came out of `kennametal --collets`, which is what
 * `vendors/kennametal/catalog.ts` exists for. The row counts are that walk's
 * own per-family totals, and each category's parts sum to them exactly —
 * 117 + 107 = 224 standard, 75 + 74 = 149 coolant-through, 47 + 49 = 96 tap.
 *
 * ## The four kit families are deliberately absent
 *
 * `100000428`, `100000425`, `109433662` and `109433658` — 26 parts — publish
 * `Kit Series`, `Number-Kit Items`, `Dimension Range-Kit Items` and
 * `Incremental Division-Kit Items`, and no `D1`, no capacity and no length. A
 * kit is a purchasing unit whose contents are already the per-part families
 * below, and minting one into a `holding.ColletRecord` would mean deriving a
 * capacity band from a range string — authoring tool data, which this package
 * does not do. `kennametal --collets` lists them every run, so they stay
 * visible rather than forgotten.
 *
 * ## ER8 fits nothing in this catalog
 *
 * Nine of the 110 standard metric collets are ER8, and no BT30 ER8 adapter is
 * configured. They are scraped anyway: `holding.HolderRecord.colletSeries`
 * states the direction — a collet nothing takes costs an option, and a collet
 * offered for a holder it does not fit costs a machinist a purchase.
 */
export const COLLET_FAMILIES = {
  // ── ER standard collets (JG 2026-09-08) ──────────────────────────────────
  'er_standard_collets_metric.csv': {
    catalogName: 'Kennametal ER Standard Collets Metric',
    rows: 110,
    familyCode: '100000478',
    facts: { style: ER_STANDARD, unit: METRIC_CATALOG },
  },
  'er_standard_collets_inch.csv': {
    catalogName: 'Kennametal ER Standard Collets Inch',
    rows: 98,
    familyCode: '100000479',
    facts: { style: ER_STANDARD, unit: INCH_CATALOG },
  },

  // ── ER coolant-through collets (JG 2026-09-08) ───────────────────────────
  // Twelve families, one per series per unit. `ER8` has no coolant-through
  // line; `ER11` upward do.
  'er11_collets_coolant_through_metric.csv': {
    catalogName: 'Kennametal ER11 Collets Coolant-Through Metric',
    rows: 5,
    familyCode: '109333979',
    facts: { style: ER_SEALED, unit: METRIC_CATALOG },
  },
  'er16_collets_coolant_through_metric.csv': {
    catalogName: 'Kennametal ER16 Collets Coolant-Through Metric',
    rows: 8,
    familyCode: '109333976',
    facts: { style: ER_SEALED, unit: METRIC_CATALOG },
  },
  'er20_collets_coolant_through_metric.csv': {
    catalogName: 'Kennametal ER20 Collets Coolant-Through Metric',
    rows: 11,
    familyCode: '109333973',
    facts: { style: ER_SEALED, unit: METRIC_CATALOG },
  },
  'er25_collets_coolant_through_metric.csv': {
    catalogName: 'Kennametal ER25 Collets Coolant-Through Metric',
    rows: 11,
    familyCode: '109333627',
    facts: { style: ER_SEALED, unit: METRIC_CATALOG },
  },
  'er32_collets_coolant_through_metric.csv': {
    catalogName: 'Kennametal ER32 Collets Coolant-Through Metric',
    rows: 15,
    familyCode: '109333626',
    facts: { style: ER_SEALED, unit: METRIC_CATALOG },
  },
  'er40_collets_coolant_through_metric.csv': {
    catalogName: 'Kennametal ER40 Collets Coolant-Through Metric',
    rows: 19,
    familyCode: '109321468',
    facts: { style: ER_SEALED, unit: METRIC_CATALOG },
  },
  'er11_collets_coolant_through_inch.csv': {
    catalogName: 'Kennametal ER11 Collets Coolant-Through Inch',
    rows: 4,
    familyCode: '109333978',
    facts: { style: ER_SEALED, unit: INCH_CATALOG },
  },
  'er16_collets_coolant_through_inch.csv': {
    catalogName: 'Kennametal ER16 Collets Coolant-Through Inch',
    rows: 10,
    familyCode: '109333975',
    facts: { style: ER_SEALED, unit: INCH_CATALOG },
  },
  'er20_collets_coolant_through_inch.csv': {
    catalogName: 'Kennametal ER20 Collets Coolant-Through Inch',
    rows: 13,
    familyCode: '109333974',
    facts: { style: ER_SEALED, unit: INCH_CATALOG },
  },
  'er25_collets_coolant_through_inch.csv': {
    catalogName: 'Kennametal ER25 Collets Coolant-Through Inch',
    rows: 14,
    familyCode: '109333628',
    facts: { style: ER_SEALED, unit: INCH_CATALOG },
  },
  'er32_collets_coolant_through_inch.csv': {
    catalogName: 'Kennametal ER32 Collets Coolant-Through Inch',
    rows: 17,
    familyCode: '109333625',
    facts: { style: ER_SEALED, unit: INCH_CATALOG },
  },
  'er40_collets_coolant_through_inch.csv': {
    catalogName: 'Kennametal ER40 Collets Coolant-Through Inch',
    rows: 12,
    familyCode: '109321469',
    facts: { style: ER_SEALED, unit: INCH_CATALOG },
  },

  // ── ER tap collets (JG 2026-09-08) ───────────────────────────────────────
  // Two families, split by thread system rather than by series: each holds
  // ER16 through ER40. Neither publishes `CCCN`/`CCCX` at all — see
  // `vendors/kennametal/holding.ts`'s `colletCapacity` for why that is a
  // zero-width band at `D1` rather than an incomplete row.
  //
  // **`unit` is decided by which column carries the exact value**, the same
  // test the TT HPV split above uses. `100000434` publishes `16ERTC10`'s `D1`
  // as 0.194 in and 4.928 mm — 0.194 in is the ANSI shank of a #10 tap, and
  // 4.928 is it rounded — while `100000435` publishes `16ERTC045034M`'s as
  // 4.5 mm and 0.1772 in. So the ANSI family is inch-native and the DIN/ISO
  // one metric-native, which also decides which of the two `Tap Range` columns
  // a record carries: `#14 & 1/4` on one, `M6 & M6.3` on the other.
  'er_tap_collets_ansi.csv': {
    catalogName: 'Kennametal ER Standard Tap Collets ANSI',
    rows: 47,
    familyCode: '100000434',
    facts: { style: ER_TAP, unit: INCH_CATALOG },
  },
  'er_tap_collets_din_iso.csv': {
    catalogName: 'Kennametal ER Standard Tap Collets DIN and ISO',
    rows: 49,
    familyCode: '100000435',
    facts: { style: ER_TAP, unit: METRIC_CATALOG },
  },
} as const satisfies Record<string, ToolholdingDefinition>
