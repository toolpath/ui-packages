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

/**
 * The two shank-gripping modes, each from the vendor's own category.
 *
 * These were one `BORE_CLAMPING` fact until 2026-09-10, cited as "the holder
 * publishes a D1 bore and no collet series". That is a derivation from which
 * columns a variant table happens to fill, and it is the wrong way round: no
 * variant table in this catalog publishes a clamping column at all, so a
 * column's presence is corroboration and the vendor's category is the source.
 * It is the shape `families/emuge.ts` uses for the same class of fact — `FG01`
 * names a machine tap and the `chamfer form` column independently agrees — and
 * the shape `families/maritool.ts` already uses for *this* fact, where the leaf
 * category is what `shrink()` and `hydraulic()` read.
 *
 * The breadcrumb these cite is the one the `style` facts below already cite,
 * scraped and verified in the same pass. Declaring a bore beside it was this
 * package deciding a vendor had not said something it had said.
 *
 * **What the old cite cost.** MariTool minted `shrink` and `hydraulic` for
 * holders Kennametal minted `bore` for, so `clamping` — the axis a picker
 * branches on — meant different things per vendor in one crib, and a
 * `hydraulic` filter hid 339 hydraulic chucks and 650 shrink fits.
 *
 * **No Kennametal family declares a plain bore now, and that is correct.**
 * Every family this package configures is one of these two or a collet chuck.
 * A shell-mill arbor or a side-lock family would be the vendor stating a plain
 * bore and would declare it then — see the note above `HOLDER_FAMILIES` on the
 * 380 families the walk lists as `(not configured)`.
 *
 * Both are still {@link holding.BORE_CLAMPINGS}, so the fit rule is unchanged:
 * all three grip a shank directly and are held to one "is this bore the shank's
 * size?" question. What differs is what a buyer needs on the bench, which is
 * why the modes are apart at all.
 */
const HYDRAULIC_CLAMPING = {
  value: 'hydraulic',
  source: 'vendor-stated',
  cite: "the family's breadcrumb names the vendor's own `Hydraulic Chucks` category, as the `style` fact beside it cites; and independently every row publishes a D1 bore and no collet series, so it grips the shank directly",
} as const satisfies Fact<string>

const SHRINK_CLAMPING = {
  value: 'shrink',
  source: 'vendor-stated',
  cite: "the family's breadcrumb names the vendor's own `Shrink Fit Toolholders` category, as the `style` fact beside it cites; and independently every row publishes a D1 bore and no collet series, so it grips the shank directly",
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

/**
 * The eighteen spindle interfaces the holder walk reaches, one fact each.
 *
 * **The taper is a category and never a column.** No holder variant table in
 * this catalog publishes it — 33 distinct columns across the 159 families and
 * not one names the interface — so every one of these cites the branch
 * `kennametal --holders` puts the family in, which is a listing anybody can
 * re-run, plus the standard that branch names.
 *
 * `BTKV` and `CVKV` families declare the **plain** taper of the same size.
 * A BTKV40 is the same JIS B 6339 cone as a BT40 and differs by seating on the
 * flange face as well, which is `HolderRecord.contact` — the axis that carries
 * it. `profiles.TAPER_PREFIXES` records the same split from the other side.
 */
const BT40_SHANK = {
  value: 'BT40',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'BT 40 Shank Tools' or 'BTKV 40 Shank Tools', which are one cone: JIS B 6339 / MAS 403 size 40",
} as const satisfies Fact<string>

const BT50_SHANK = {
  value: 'BT50',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'BT 50 Shank Tools' or 'BTKV 50 Shank Tools', which are one cone: JIS B 6339 / MAS 403 size 50",
} as const satisfies Fact<string>

const CV40_SHANK = {
  value: 'CV40',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'CV 40 Shank Tools' or 'CVKV 40 Shank Tools', which are one cone: ANSI B5.50 V-flange size 40, the interface MariTool designates CAT40",
} as const satisfies Fact<string>

const CV50_SHANK = {
  value: 'CV50',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'CV 50 Shank Tools' or 'CVKV 50 Shank Tools', which are one cone: ANSI B5.50 V-flange size 50, the interface MariTool designates CAT50",
} as const satisfies Fact<string>

const HSK100A_SHANK = {
  value: 'HSK100A',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK100A'; DIN 69893 / ISO 12164 form A, size 100",
} as const satisfies Fact<string>

const HSK125A_SHANK = {
  value: 'HSK125A',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK125A'; DIN 69893 / ISO 12164 form A, size 125",
} as const satisfies Fact<string>

const HSK32C_SHANK = {
  value: 'HSK32C',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK32C'; DIN 69893 / ISO 12164 form C, size 32",
} as const satisfies Fact<string>

const HSK40A_SHANK = {
  value: 'HSK40A',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK40A'; DIN 69893 / ISO 12164 form A, size 40",
} as const satisfies Fact<string>

const HSK40C_SHANK = {
  value: 'HSK40C',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK40C'; DIN 69893 / ISO 12164 form C, size 40",
} as const satisfies Fact<string>

const HSK50A_SHANK = {
  value: 'HSK50A',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK50A'; DIN 69893 / ISO 12164 form A, size 50",
} as const satisfies Fact<string>

const HSK50C_SHANK = {
  value: 'HSK50C',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK50C'; DIN 69893 / ISO 12164 form C, size 50",
} as const satisfies Fact<string>

const HSK63A_SHANK = {
  value: 'HSK63A',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK63A'; DIN 69893 / ISO 12164 form A, size 63",
} as const satisfies Fact<string>

const HSK63C_SHANK = {
  value: 'HSK63C',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK63C'; DIN 69893 / ISO 12164 form C, size 63",
} as const satisfies Fact<string>

const HSK80A_SHANK = {
  value: 'HSK80A',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK80A'; DIN 69893 / ISO 12164 form A, size 80",
} as const satisfies Fact<string>

const HSK80F_SHANK = {
  value: 'HSK80F',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'HSK80F (Pin)'; DIN 69893 / ISO 12164 form F, size 80",
} as const satisfies Fact<string>

const PSC50_SHANK = {
  value: 'PSC50',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'PSC 50'; ISO 26623 polygonal taper size 50",
} as const satisfies Fact<string>

const PSC63_SHANK = {
  value: 'PSC63',
  source: 'vendor-stated',
  cite: "the walk puts the family under 'PSC 63'; ISO 26623 polygonal taper size 63",
} as const satisfies Fact<string>

/**
 * How a holder meets the spindle, for the five interfaces beyond BT.
 *
 * `contact` has no default and never has: a family added without it fails
 * loudly rather than being recorded as plain-taper on no evidence. What the
 * holder walk adds is that for three of these the answer is a property of the
 * *interface* rather than of the product line, so it is stated once here rather
 * than per family.
 */
const CV_TAPER_CONTACT = {
  value: 'taper',
  source: 'vendor-stated',
  cite: 'the 7:24 V-flange seats on the cone alone; the vendor sells the face-contact version of the same cone as a separate line, which is why `kennametal --holders` walks CV and CVKV as two trees',
} as const satisfies Fact<string>

const KV_FACE_CONTACT = {
  value: 'face',
  source: 'vendor-stated',
  cite: "the vendor names the category itself 'BTKV • Taper Face Contact' / 'CVKV • Taper Face Contact' — the KV lines are the same cones seating on the flange face as well, and they carry their own family codes and prices",
} as const satisfies Fact<string>

const HSK_FACE_CONTACT = {
  value: 'face',
  source: 'vendor-stated',
  cite: 'a hollow taper seats on the flange face and the cone at once by design (DIN 69893 / ISO 12164); the vendor publishes no taper-only HSK line, in any form or size, for the walk to contrast it with',
} as const satisfies Fact<string>

const PSC_FACE_CONTACT = {
  value: 'face',
  source: 'vendor-stated',
  cite: 'ISO 26623 couples on the polygon and the face together; as with HSK the vendor offers no face-less variant',
} as const satisfies Fact<string>

/**
 * The eight holder styles beyond the four that predate the holder walk.
 *
 * Every one is Kennametal's own product line, taken from the category leaf the
 * walk ends at or from the family's own title, and never coined here. They are
 * split the way `shrink-fit-fc` and `shrink-fit-gp` already were, and for the
 * reason recorded there: two lines that overlap in size are not interchangeable
 * at speed, and a consumer turns this string into the words on a holder row.
 */
const HYDRAULIC_CHUCK_HYDROFORCE = {
  value: 'hydraulic-chuck-hydroforce',
  source: 'vendor-stated',
  cite: "the category leaf is 'Hydraulic Chucks • HydroForce™ • HT' ('• HydroForce™' on the two PSC families); the vendor's own line name, and its titles read 'HydroForce High Torque'",
} as const satisfies Fact<string>

const HYDRAULIC_CHUCK_SLIM = {
  value: 'hydraulic-chuck-slim',
  source: 'vendor-stated',
  cite: "the category leaf is 'Hydraulic Chucks • Slim Line'; a slimmer nose for the same bores, which is a reach fact rather than a fit one",
} as const satisfies Fact<string>

const HYDRAULIC_CHUCK_TREND = {
  value: 'hydraulic-chuck-trend',
  source: 'vendor-stated',
  cite: "the category leaf is 'Hydraulic Chucks • TREND Line'",
} as const satisfies Fact<string>

const HYDRAULIC_CHUCK_MQL = {
  value: 'hydraulic-chuck-mql',
  source: 'vendor-stated',
  cite: "the category leaf is 'Hydraulic Chuck • MQL' — minimum-quantity lubrication, a coolant path rather than a clamping difference",
} as const satisfies Fact<string>

const SHRINK_FIT_SF = {
  value: 'shrink-fit-sf',
  source: 'vendor-stated',
  cite: "the family titles read 'Safe-Lock' and the product lines 'TT SF HPV'; a form-locking shank interface, so it takes only a Safe-Lock shank",
} as const satisfies Fact<string>

const SHRINK_FIT_HT = {
  value: 'shrink-fit-ht',
  source: 'vendor-stated',
  cite: "the family titles read 'High Torque (HT)' and the product lines 'TT HT HPV'",
} as const satisfies Fact<string>

const SHRINK_FIT_TTGL = {
  value: 'shrink-fit-ttgl',
  source: 'vendor-stated',
  cite: "the family titles read 'TTGL Line' or 'TTGL' — the vendor's gauge-length-controlled shrink line",
} as const satisfies Fact<string>

/**
 * The unit a **mixed** family is catalogued in, where its rows are not all one.
 *
 * 21 of the 159 holder families publish metric and inch bores from one table,
 * and `vendors/kennametal/holding.ts` reads each row's own catalog number for
 * the unit that reaches the record. So this fact decides nothing about a part;
 * what it says is which system the family is *mostly* sold in, for somebody
 * reading the config, and it is the fallback for a row with no catalog number
 * at all. `derived` and not `vendor-stated`, because the vendor states it per
 * row and this is a count of those rows.
 */
const MIXED_METRIC_MAJORITY = {
  value: 'millimeters',
  source: 'derived',
  note: 'the family publishes both systems in one table and more of its rows are metric; each row carries its own designation in its catalog number (JG 2026-09-09)',
} as const satisfies Fact<UnitSystem>

const MIXED_INCH_MAJORITY = {
  value: 'inches',
  source: 'derived',
  note: 'the family publishes both systems in one table and more of its rows are inch; each row carries its own designation in its catalog number (JG 2026-09-09)',
} as const satisfies Fact<UnitSystem>

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
// the same field as `style`: 'collet' means the holder needs a collet in
// between, and 'bore', 'shrink' and 'hydraulic' each mean it takes one shank
// size directly. The three shank modes answer one fit question and
// `holding.BORE_CLAMPINGS` is where that is stated once, so a side-lock family
// added later is a new `style` and an existing `clamping` and the fit rules do
// not grow a case. They are separate *values* because what a buyer has to own
// to use one differs — an induction heater, an actuation screw, or neither.
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
//
// ## What the holder walk added (JG 2026-09-09)
//
// This table held nine families on one BT30 spindle until `kennametal --holders`
// enumerated the six interfaces Kennametal sells: **158 families and 1,192 parts**
// across BT, BTKV, CV, CVKV, HSK and PSC. `familyCode` came out of that walk on
// every one of them, including the nine that had none, so a re-scrape now reads
// the code out of config rather than out of a browser.
//
// **These are the families whose clamping this package already models.** The six
// trees hold 538 families and 2,862 parts; the other 380 are shell-mill arbors,
// KM and DUO-LOCK modular adapters, PSC cutting units, bar blanks and BTF46
// adapters, and none of them grips a shank or a collet. `ClampingMode` has four
// values and a shell-mill arbor is not one of them, so those stay out until
// somebody decides what a fifth would mean. `--holders` lists them every run as
// `(not configured)`, which is how they stay visible rather than forgotten.
//
// **`unit` moved to the row.** 21 of these 158 families sell metric and inch
// bores from one table, and `vendors/kennametal/holding.ts` now reads the unit
// out of each part's own catalog number. The fact below still says which system
// a family is *catalogued* in, and is what a row with no catalog number falls
// back to — it no longer decides what a machinist is shown.
//
// **A CSV name is `<vendor line><size>_<style>`**, with the family's unit or a
// distinguishing word from its title where two families would otherwise collide,
// and the family code where even that is not enough (five of the 158 — the
// vendor ships two families under one title). The nine names that predate the
// walk are kept as they were, because they name files a maintainer already has
// on disk.
//
// **These families declared `bore` until 2026-09-10, and that was a bug.** The
// argument for it was that a shrink fit grips the shank exactly as a hydraulic
// chuck does and a picker's fit rule asks one question of both — true, and
// `holding.BORE_CLAMPINGS` is what carries it. What the argument missed is that
// `clamping` is also a filter axis, that MariTool was already minting `shrink`
// and `hydraulic` off its leaf categories, and that Kennametal states the same
// thing in the breadcrumb these families' `style` facts already cite. So one
// crib held two meanings of `hydraulic` and the filter hid 339 chucks. See
// `HYDRAULIC_CLAMPING` and `SHRINK_CLAMPING` above.
export const HOLDER_FAMILIES = {
  // ── BT ────────────────────────────────────────────────────────────────
  // BT 30 Shank Tools
  'bt30_er_collet_adapters_metric.csv': {
    catalogName: 'Kennametal ER™ Collet Adapter • BT30',
    rows: 12,
    familyCode: '100149552',
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'bt30_hydraulic_chuck_trend.csv': {
    catalogName: 'Kennametal HC-T - TREND - BT form AD',
    rows: 2,
    familyCode: '100018419',
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_TREND,
      unit: INCH_CATALOG,
    },
  },
  'bt30_hydraulic_chucks_form_ad_inch.csv': {
    catalogName: 'Kennametal HC IN-BT Form AD',
    rows: 3,
    familyCode: '100127657',
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'bt30_hydraulic_chucks_form_ad_metric.csv': {
    catalogName: 'Kennametal HC MM-BT Form AD',
    rows: 8,
    familyCode: '100127643',
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  // **`HLD_D1_MIN` is metric-only on both FC families, including this inch one.**
  // That is the HSK63A missing-pair case from the runbook, and it is why
  // `holding.dim`'s cross-unit fallback is load-bearing rather than defensive:
  // without it every one of these six inch chucks would carry no bore, match no
  // tool, and raise nothing. 330 of the 1,210 holder rows publish `D1` in
  // millimetres only, so this is the common case rather than the odd one.
  'bt30_shrink_fit_fc_form_ad_inch.csv': {
    catalogName:
      'Kennametal BT30 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Inch',
    rows: 6,
    familyCode: '109480412',
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  'bt30_shrink_fit_fc_form_ad_metric.csv': {
    catalogName:
      'Kennametal BT30 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Metric',
    rows: 6,
    familyCode: '109480407',
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  // **The family that moved `unit` onto the row.** 100017036 publishes seven
  // metric bores (6-20 mm) and six fractional ones (1/4-3/4 in) as thirteen rows
  // under one code, and until 2026-09-09 it was the only one known to, so it was
  // split by hand into two CSVs with a note saying a third such family should end
  // the splitting. The holder walk found twenty more. It is one entry again, and
  // `vendors/kennametal/holding.ts` reads the `M` in each part's catalog number.
  'bt30_shrink_fit_hpv_form_ad.csv': {
    catalogName: 'Kennametal TT HPV-BT Form AD',
    rows: 13,
    familyCode: '100017036',
    // Both systems in one table: 7 metric rows and 6 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: BT30_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  // BT 40 Shank Tools
  'bt40_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ Collet Adapter • BT40',
    rows: 19,
    familyCode: '100149593',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'bt40_hydraulic_chuck_hydroforce_inch.csv': {
    catalogName: 'Kennametal BT40 Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 2,
    familyCode: '109438988',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'bt40_hydraulic_chuck_hydroforce_metric.csv': {
    catalogName:
      'Kennametal BT40 Hydraulic Chucks • HydroForce High Torque • Through Coolant Form AD • Metric',
    rows: 2,
    familyCode: '109438987',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'bt40_hydraulic_chuck_inch.csv': {
    catalogName: 'Kennametal HC-BT form B/AD',
    rows: 7,
    familyCode: '100131871',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'bt40_hydraulic_chuck_metric.csv': {
    catalogName: 'Kennametal HC-BT form B/AD',
    rows: 10,
    familyCode: '100018431',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'bt40_hydraulic_chuck_slim_metric.csv': {
    catalogName: 'Kennametal HC Slim MM-BT Form B/AD',
    rows: 5,
    familyCode: '100018466',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: METRIC_CATALOG,
    },
  },
  'bt40_hydraulic_chuck_slim_metric_t.csv': {
    catalogName: 'Kennametal HC Slim-T MM-BT Form B/AD',
    rows: 3,
    familyCode: '100018458',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: METRIC_CATALOG,
    },
  },
  'bt40_shrink_fit_fc.csv': {
    catalogName:
      'Kennametal BT40 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Metric',
    rows: 7,
    familyCode: '109480408',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'bt40_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT HPV-BT Form B/AD',
    rows: 21,
    familyCode: '100126956',
    // Both systems in one table: 17 metric rows and 4 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'bt40_shrink_fit_sf.csv': {
    catalogName: 'Kennametal TT SF HPV BT40 Form B/AD • Safe-Lock',
    rows: 4,
    familyCode: '100003514',
    // Both systems in one table: 3 metric rows and 1 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'bt40_shrink_fit_ttgl_inch.csv': {
    catalogName: 'Kennametal TTGL • BT40 • Inch',
    rows: 5,
    familyCode: '100102400',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: INCH_CATALOG,
    },
  },
  'bt40_shrink_fit_ttgl_metric.csv': {
    catalogName: 'Kennametal TTGL • Metric',
    rows: 9,
    familyCode: '100102349',
    facts: {
      taper: BT40_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: METRIC_CATALOG,
    },
  },
  // BT 50 Shank Tools
  'bt50_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ Collet Adapter • BT50',
    rows: 16,
    familyCode: '100149594',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'bt50_hydraulic_chuck_hydroforce_inch.csv': {
    catalogName: 'Kennametal BT50 Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 1,
    familyCode: '100008369',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'bt50_hydraulic_chuck_hydroforce_metric.csv': {
    catalogName:
      'Kennametal BT50 Hydraulic Chucks • HydroForce High Torque • Through Coolant Form AD • Metric',
    rows: 2,
    familyCode: '100008410',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'bt50_hydraulic_chuck_inch.csv': {
    catalogName: 'Kennametal HC-BT form B/AD',
    rows: 7,
    familyCode: '100131872',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'bt50_hydraulic_chuck_metric.csv': {
    catalogName: 'Kennametal BT50 Hydraulic Chucks • HP Line • Through Coolant Form B/AD • Metric',
    rows: 10,
    familyCode: '100002350',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'bt50_hydraulic_chuck_slim_metric.csv': {
    catalogName: 'Kennametal HC Slim MM-BT Form B/AD',
    rows: 5,
    familyCode: '100004692',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: METRIC_CATALOG,
    },
  },
  'bt50_hydraulic_chuck_slim_metric_t.csv': {
    catalogName: 'Kennametal HC Slim-T MM-BT Form B/AD',
    rows: 3,
    familyCode: '100002349',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: METRIC_CATALOG,
    },
  },
  'bt50_shrink_fit_fc.csv': {
    catalogName:
      'Kennametal BT50 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Metric',
    rows: 7,
    familyCode: '109480410',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'bt50_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT HPV-BT Form B/AD',
    rows: 19,
    familyCode: '100002352',
    // Both systems in one table: 9 metric rows and 10 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_INCH_MAJORITY,
    },
  },
  'bt50_shrink_fit_gp_metric.csv': {
    catalogName: 'Kennametal BT50 Shrink Fit Toolholders • GL Line • Metric',
    rows: 7,
    familyCode: '100091458',
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'bt50_shrink_fit_sf.csv': {
    catalogName: 'Kennametal TT SF HPV BT50 Form B/AD • Safe-Lock',
    rows: 4,
    familyCode: '100018389',
    // Both systems in one table: 3 metric rows and 1 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: BT50_SHANK,
      contact: TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: MIXED_METRIC_MAJORITY,
    },
  },

  // ── BTKV ──────────────────────────────────────────────────────────────
  // BTKV 30 Shank Tools
  // This family publishes **two** gage lengths: `L1` (100 mm on all five) and
  // `L1FC`, "Gage Length Face Contact" (99.002 mm on all five). Which one is
  // real is a property of the spindle, not of the holder. `gaugeLength` is `L1`
  // because this shop's BT30 spindle is not face-contact (JG 2026-08-05), so
  // `L1FC` is scraped into the CSV — the record of what the vendor said — and
  // deliberately not carried onto the record, per the holder mapper's rule about
  // published columns nothing displays. Twenty-two of the 158 families publish
  // it — eight BTKV and fourteen CVKV, and no HSK or PSC family, which is the
  // shape to expect: a KV line is a *taper* cone the vendor also seats on the
  // face, so it has two gage lengths to state, where an HSK has one and it is
  // already the face-contact one. Promote it the day a dual-contact spindle
  // exists to read it, and change `gaugeLength` with it rather than showing both.
  'btkv30_er_collet_chucks_metric.csv': {
    catalogName: 'Kennametal BTKV30 ER Collet Chucks • Metric',
    rows: 5,
    familyCode: '109321122',
    facts: {
      taper: BT30_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'btkv30_hydraulic_chuck.csv': {
    catalogName: 'Kennametal BTKV30 Hydraulic Chucks • HP Line • Through Coolant Form AD • Metric',
    rows: 2,
    familyCode: '107798941',
    facts: {
      taper: BT30_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'btkv30_shrink_fit_gp.csv': {
    catalogName:
      'Kennametal BTKV30 Shank Tools • Shrink Fit Toolholders General Purpose (GP) • Metric',
    rows: 6,
    familyCode: '109321207',
    facts: {
      taper: BT30_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  // BTKV 40 Shank Tools
  'btkv40_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • BTKV40 Form B/AD',
    rows: 15,
    familyCode: '100149614',
    facts: {
      taper: BT40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'btkv40_hydraulic_chuck_hydroforce_inch.csv': {
    catalogName: 'Kennametal HCTHT • Inch • BTKV',
    rows: 1,
    familyCode: '100053325',
    facts: {
      taper: BT40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'btkv40_hydraulic_chuck_hydroforce_metric.csv': {
    catalogName:
      'Kennametal BTKV40 Hydraulic Chucks • HydroForce™ High Torque • Through Coolant Form AD • Metric',
    rows: 2,
    familyCode: '100016405',
    facts: {
      taper: BT40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'btkv40_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT GP HPV MM-BTKV Form B/AD',
    rows: 12,
    familyCode: '100001701',
    // Both systems in one table: 7 metric rows and 5 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: BT40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  // BTKV 50 Shank Tools
  'btkv50_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • BTKV50 Form B/AD',
    rows: 12,
    familyCode: '100149615',
    facts: {
      taper: BT50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'btkv50_hydraulic_chuck_hydroforce.csv': {
    catalogName: 'Kennametal HC HT BTKV Metric • BTKV50',
    rows: 2,
    familyCode: '100008368',
    facts: {
      taper: BT50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'btkv50_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT GP HPV-BTKV Form B/AD',
    rows: 6,
    familyCode: '100018260',
    // Both systems in one table: 3 metric rows and 3 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: BT50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_INCH_MAJORITY,
    },
  },

  // ── CV ────────────────────────────────────────────────────────────────
  // CV 40 Shank Tools
  'cv40_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • CV40 Form AD',
    rows: 16,
    familyCode: '100149651',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'cv40_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HC-CV40 Form AD',
    rows: 30,
    familyCode: '100018501',
    // Both systems in one table: 18 metric rows and 12 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cv40_hydraulic_chuck_hydroforce.csv': {
    catalogName: 'Kennametal CV40 Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 2,
    familyCode: '100008364',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'cv40_hydraulic_chuck_slim_cv40.csv': {
    catalogName: 'Kennametal HC Slim CV40 Form AD',
    rows: 8,
    familyCode: '100018499',
    // Both systems in one table: 5 metric rows and 3 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cv40_hydraulic_chuck_slim_t.csv': {
    catalogName: 'Kennametal HC Slim T CV Form B/AD',
    rows: 5,
    familyCode: '100018496',
    // Both systems in one table: 3 metric rows and 2 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cv40_hydraulic_chuck_trend.csv': {
    catalogName: 'Kennametal HC TREND-CV form B/AD',
    rows: 1,
    familyCode: '100018506',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_TREND,
      unit: INCH_CATALOG,
    },
  },
  'cv40_shrink_fit_fc_inch.csv': {
    catalogName:
      'Kennametal CV40 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Inch',
    rows: 7,
    familyCode: '109480404',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  'cv40_shrink_fit_fc_metric.csv': {
    catalogName:
      'Kennametal CV40 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Metric',
    rows: 7,
    familyCode: '109480405',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'cv40_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT GP HPV CV Form B/AD',
    rows: 20,
    familyCode: '100018409',
    // Both systems in one table: 10 metric rows and 10 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_INCH_MAJORITY,
    },
  },
  'cv40_shrink_fit_ht_inch.csv': {
    catalogName: 'Kennametal TT HT HPV CV Form B/AD',
    rows: 4,
    familyCode: '100018413',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_HT,
      unit: INCH_CATALOG,
    },
  },
  'cv40_shrink_fit_ht_inch_in.csv': {
    catalogName: 'Kennametal TT HT HPV IN-CV Z Form AD',
    rows: 2,
    familyCode: '100001014',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_HT,
      unit: INCH_CATALOG,
    },
  },
  'cv40_shrink_fit_sf.csv': {
    catalogName: 'Kennametal TT SF HPV CV Z Form B/AD • Safe-Lock',
    rows: 8,
    familyCode: '100003528',
    // Both systems in one table: 4 metric rows and 4 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: MIXED_INCH_MAJORITY,
    },
  },
  'cv40_shrink_fit_ttgl_inch.csv': {
    catalogName: 'Kennametal TTGL • CV40 • Inch',
    rows: 8,
    familyCode: '100102392',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: INCH_CATALOG,
    },
  },
  'cv40_shrink_fit_ttgl_metric.csv': {
    catalogName: 'Kennametal TTGL • CV40 • Metric',
    rows: 8,
    familyCode: '100091095',
    facts: {
      taper: CV40_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: METRIC_CATALOG,
    },
  },
  // CV 50 Shank Tools
  'cv50_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • CV50 Form AD',
    rows: 16,
    familyCode: '100149652',
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'cv50_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HC-CV50 Form AD',
    rows: 30,
    familyCode: '100002546',
    // Both systems in one table: 18 metric rows and 12 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cv50_hydraulic_chuck_hydroforce.csv': {
    catalogName: 'Kennametal CV50 Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 3,
    familyCode: '109438989',
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'cv50_hydraulic_chuck_slim_cv50.csv': {
    catalogName: 'Kennametal HC Slim CV50 Form AD',
    rows: 8,
    familyCode: '100001318',
    // Both systems in one table: 5 metric rows and 3 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cv50_hydraulic_chuck_slim_t.csv': {
    catalogName: 'Kennametal HC Slim T CV Form B/AD',
    rows: 5,
    familyCode: '100003934',
    // Both systems in one table: 3 metric rows and 2 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cv50_shrink_fit_fc_inch.csv': {
    catalogName:
      'Kennametal CV50 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Inch',
    rows: 7,
    familyCode: '109480411',
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  'cv50_shrink_fit_fc_metric.csv': {
    catalogName:
      'Kennametal CV50 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Metric',
    rows: 7,
    familyCode: '109480413',
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'cv50_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT HPV-CV Form B/AD',
    rows: 19,
    familyCode: '100003938',
    // Both systems in one table: 10 metric rows and 9 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cv50_shrink_fit_ht.csv': {
    catalogName: 'Kennametal TT HPV HT-CV Form B/AD',
    rows: 3,
    familyCode: '100003937',
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_HT,
      unit: INCH_CATALOG,
    },
  },
  'cv50_shrink_fit_sf.csv': {
    catalogName: 'Kennametal TT SF HPV MM-CV Z FORM B/AD • Safe-Lock',
    rows: 7,
    familyCode: '100018453',
    // Both systems in one table: 3 metric rows and 4 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: MIXED_INCH_MAJORITY,
    },
  },
  'cv50_shrink_fit_sf_hd.csv': {
    catalogName: 'Kennametal TT SF HD HPV MM-CV Z FORM B/AD • Safe-Lock',
    rows: 6,
    familyCode: '100018460',
    // Both systems in one table: 4 metric rows and 2 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cv50_shrink_fit_ttgl_inch.csv': {
    catalogName: 'Kennametal TTGL • CV50 • Inch',
    rows: 9,
    familyCode: '100102394',
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: INCH_CATALOG,
    },
  },
  'cv50_shrink_fit_ttgl_metric.csv': {
    catalogName: 'Kennametal TTGL • CV50 • Metric',
    rows: 8,
    familyCode: '100091119',
    facts: {
      taper: CV50_SHANK,
      contact: CV_TAPER_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: METRIC_CATALOG,
    },
  },

  // ── CVKV ──────────────────────────────────────────────────────────────
  // CVKV 40 Shank Tools
  'cvkv40_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • CVKV40 Form AD',
    rows: 16,
    familyCode: '100149654',
    facts: {
      taper: CV40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'cvkv40_hydraulic_chuck_hydroforce.csv': {
    catalogName: 'Kennametal CVKV40 Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 2,
    familyCode: '100008366',
    facts: {
      taper: CV40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'cvkv40_shrink_fit_fc_inch.csv': {
    catalogName:
      'Kennametal CVKV40 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Inch',
    rows: 7,
    familyCode: '109480776',
    facts: {
      taper: CV40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  'cvkv40_shrink_fit_fc_metric.csv': {
    catalogName:
      'Kennametal CVKV40 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Metric',
    rows: 7,
    familyCode: '109480777',
    facts: {
      taper: CV40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'cvkv40_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT GP HPV-CVKV Form B/AD',
    rows: 15,
    familyCode: '100018275',
    // Both systems in one table: 8 metric rows and 7 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cvkv40_shrink_fit_gp_inch.csv': {
    catalogName: 'Kennametal CVKV40 Shrink Fit adapters • GP Line • Coolant Form AD • Inch',
    rows: 7,
    familyCode: '109372320',
    facts: {
      taper: CV40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: INCH_CATALOG,
    },
  },
  'cvkv40_shrink_fit_gp_metric.csv': {
    catalogName: 'Kennametal CVKV40 Shrink Fit adapters • GP Line • Coolant Form AD • Metric',
    rows: 6,
    familyCode: '109453835',
    facts: {
      taper: CV40_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  // CVKV 50 Shank Tools
  'cvkv50_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • CVKV50 Form AD',
    rows: 15,
    familyCode: '100149655',
    facts: {
      taper: CV50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'cvkv50_hydraulic_chuck_hydroforce.csv': {
    catalogName: 'Kennametal CVKV50 Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 3,
    familyCode: '109438990',
    facts: {
      taper: CV50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'cvkv50_shrink_fit_fc_inch.csv': {
    catalogName:
      'Kennametal CVKV50 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Inch',
    rows: 7,
    familyCode: '109480774',
    facts: {
      taper: CV50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  'cvkv50_shrink_fit_fc_metric.csv': {
    catalogName:
      'Kennametal CVKV50 Shrink Fit Toolholders • FC Line • Through Coolant Form AD • Metric',
    rows: 7,
    familyCode: '109480775',
    facts: {
      taper: CV50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'cvkv50_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT GP HPV-CVKV form B/AD - 50',
    rows: 14,
    familyCode: '100002018',
    // Both systems in one table: 8 metric rows and 6 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: CV50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'cvkv50_shrink_fit_gp_inch.csv': {
    catalogName: 'Kennametal CVKV50 Shrink Fit adapters • GP Line • Coolant Form AD • Inch',
    rows: 6,
    familyCode: '109453834',
    facts: {
      taper: CV50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: INCH_CATALOG,
    },
  },
  'cvkv50_shrink_fit_gp_metric.csv': {
    catalogName: 'Kennametal CVKV50 Shrink Fit adapters • GP Line • Coolant Form AD • Metric',
    rows: 8,
    familyCode: '109453836',
    facts: {
      taper: CV50_SHANK,
      contact: KV_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },

  // ── HSK ───────────────────────────────────────────────────────────────
  // HSK100A
  'hsk100a_er_collet_chuck.csv': {
    catalogName: 'Kennametal HSK100A ER Collet Chucks • Metric',
    rows: 9,
    familyCode: '100149700',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HSK100A Hydraulic Chucks • HP Line • Through Coolant Form AD • Metric',
    rows: 26,
    familyCode: '100018043',
    // Both systems in one table: 20 metric rows and 6 inch ones. Each row's own
    // catalog number decides which it is — see `vendors/kennametal/holding.ts`.
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: MIXED_METRIC_MAJORITY,
    },
  },
  'hsk100a_hydraulic_chuck_hydroforce_inch.csv': {
    catalogName: 'Kennametal HSK100A Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 3,
    familyCode: '109438982',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'hsk100a_hydraulic_chuck_hydroforce_metric.csv': {
    catalogName:
      'Kennametal HSK100A Hydraulic Chucks • HydroForce High Torque • Through Coolant Form AD • Metric',
    rows: 3,
    familyCode: '109438985',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_hydraulic_chuck_slim_metric.csv': {
    catalogName: 'Kennametal HC Slim MM-HSK Form A',
    rows: 5,
    familyCode: '100004662',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_hydraulic_chuck_slim_metric_t.csv': {
    catalogName: 'Kennametal HC Slim-T MM-HSK Form A',
    rows: 3,
    familyCode: '100003155',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_shrink_fit_fc_inch.csv': {
    catalogName: 'Kennametal HSK100A Shrink Fit Toolholders • FC Line • Inch',
    rows: 7,
    familyCode: '109479999',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  'hsk100a_shrink_fit_fc_metric.csv': {
    catalogName: 'Kennametal HSK100A Shrink Fit Toolholders • FC Line • Metric',
    rows: 7,
    familyCode: '109480004',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_shrink_fit_gp_inch_in.csv': {
    catalogName: 'Kennametal TT GP HPV IN-HSK100A • General Purpose (GP)',
    rows: 9,
    familyCode: '109546532',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: INCH_CATALOG,
    },
  },
  'hsk100a_shrink_fit_gp_metric_channel.csv': {
    catalogName: 'Kennametal Shrink Fit HSK100A • MQL 1 Channel • Metric',
    rows: 20,
    familyCode: '109427168',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_shrink_fit_gp_metric_channels.csv': {
    catalogName: 'Kennametal Shrink Fit HSK100A • MQL 2 Channels • Metric',
    rows: 20,
    familyCode: '109427170',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_shrink_fit_gp_metric_mm.csv': {
    catalogName: 'Kennametal TT GP HPV MM-HSK100A • General Purpose (GP)',
    rows: 12,
    familyCode: '109546530',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_shrink_fit_ht.csv': {
    catalogName: 'Kennametal TT HT HPV IN-HSK100A • High Torque (HT)',
    rows: 2,
    familyCode: '109546539',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_HT,
      unit: INCH_CATALOG,
    },
  },
  'hsk100a_shrink_fit_sf_inch.csv': {
    catalogName: 'Kennametal TT SF HPV HSK100A • Safe-Lock • Inch',
    rows: 4,
    familyCode: '109546666',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: INCH_CATALOG,
    },
  },
  'hsk100a_shrink_fit_sf_inch_100002960.csv': {
    catalogName: 'Kennametal TT SF HPV HSK100A Heavy Duty • Safe-Lock • Inch',
    rows: 2,
    familyCode: '100002960',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: INCH_CATALOG,
    },
  },
  'hsk100a_shrink_fit_sf_metric.csv': {
    catalogName: 'Kennametal TT SF HPV HSK100A • Safe-Lock • Metric',
    rows: 4,
    familyCode: '109546667',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_shrink_fit_sf_metric_100002961.csv': {
    catalogName: 'Kennametal TT SF HPV HSK100A Heavy Duty • Safe-Lock • Metric',
    rows: 2,
    familyCode: '100002961',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: METRIC_CATALOG,
    },
  },
  'hsk100a_shrink_fit_ttgl_inch.csv': {
    catalogName: 'Kennametal HSK100A Shrink Fit Toolholders • TTGL Line • Inch',
    rows: 7,
    familyCode: '100102398',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: INCH_CATALOG,
    },
  },
  'hsk100a_shrink_fit_ttgl_metric.csv': {
    catalogName: 'Kennametal HSK100A Shrink Fit Toolholders • TTGL Line • Metric',
    rows: 9,
    familyCode: '100093707',
    facts: {
      taper: HSK100A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: METRIC_CATALOG,
    },
  },
  // HSK125A
  'hsk125a_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • HSK125A Form A',
    rows: 1,
    familyCode: '100149701',
    facts: {
      taper: HSK125A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk125a_hydraulic_chuck_hydroforce_inch.csv': {
    catalogName: 'Kennametal HSK125A Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 2,
    familyCode: '100042858',
    facts: {
      taper: HSK125A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'hsk125a_hydraulic_chuck_hydroforce_metric.csv': {
    catalogName:
      'Kennametal HSK125A Hydraulic Chucks • HydroForce High Torque • Through Coolant Form AD • Metric',
    rows: 3,
    familyCode: '100008408',
    facts: {
      taper: HSK125A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'hsk125a_shrink_fit_ht_inch.csv': {
    catalogName: 'Kennametal TT HT HPV IN-HSK125A • High Torque (HT)',
    rows: 3,
    familyCode: '109546540',
    facts: {
      taper: HSK125A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_HT,
      unit: INCH_CATALOG,
    },
  },
  'hsk125a_shrink_fit_ht_metric.csv': {
    catalogName: 'Kennametal TT HT HPV MM-HSK125A • High Torque (HT)',
    rows: 1,
    familyCode: '109546562',
    facts: {
      taper: HSK125A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_HT,
      unit: METRIC_CATALOG,
    },
  },
  // HSK32C
  'hsk32c_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • HSK32C Form C',
    rows: 1,
    familyCode: '100149702',
    facts: {
      taper: HSK32C_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk32c_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HC-HSK Form C',
    rows: 4,
    familyCode: '100018062',
    facts: {
      taper: HSK32C_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  // HSK40A
  'hsk40a_er_collet_chuck.csv': {
    catalogName: 'Kennametal HSK40A • ER Collet Chucks • Metric',
    rows: 3,
    familyCode: '100149696',
    facts: {
      taper: HSK40A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk40a_hydraulic_chuck_inch.csv': {
    catalogName: 'Kennametal HSK40A • Hydraulic Chuck • HP Line • Inch',
    rows: 5,
    familyCode: '109542574',
    facts: {
      taper: HSK40A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'hsk40a_hydraulic_chuck_metric.csv': {
    catalogName: 'Kennametal HSK40A • Hydraulic Chuck • HP Line • Metric',
    rows: 8,
    familyCode: '109542575',
    facts: {
      taper: HSK40A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk40a_hydraulic_chuck_slim.csv': {
    catalogName: 'Kennametal HSK40A • Hydraulic Chuck • Slim Line Trend • Metric',
    rows: 5,
    familyCode: '109542563',
    facts: {
      taper: HSK40A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: METRIC_CATALOG,
    },
  },
  'hsk40a_shrink_fit_gp_inch.csv': {
    catalogName: 'Kennametal HSK40A • Shrink Fit Toolholders • GP Line • Inch',
    rows: 3,
    familyCode: '109542558',
    facts: {
      taper: HSK40A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: INCH_CATALOG,
    },
  },
  'hsk40a_shrink_fit_gp_metric.csv': {
    catalogName: 'Kennametal HSK40A • Shrink Fit Toolholders • GP Line • Metric',
    rows: 10,
    familyCode: '109542557',
    facts: {
      taper: HSK40A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  // HSK40C
  'hsk40c_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • HSK40C Form C',
    rows: 3,
    familyCode: '100149715',
    facts: {
      taper: HSK40C_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk40c_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HC-HSK Form C',
    rows: 4,
    familyCode: '100005116',
    facts: {
      taper: HSK40C_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  // HSK50A
  'hsk50a_er_collet_chuck.csv': {
    catalogName: 'Kennametal HSK50A • ER Collet Chucks • Metric',
    rows: 5,
    familyCode: '100149697',
    facts: {
      taper: HSK50A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk50a_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HSK50A • Hydraulic Chuck • Standard HP Line • Metric',
    rows: 6,
    familyCode: '109365742',
    facts: {
      taper: HSK50A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk50a_hydraulic_chuck_hydroforce.csv': {
    catalogName: 'Kennametal HSK50A • Hydraulic Chuck • Hydroforce • Metric',
    rows: 2,
    familyCode: '109365729',
    facts: {
      taper: HSK50A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'hsk50a_shrink_fit_fc_inch.csv': {
    catalogName: 'Kennametal HSK50A • Shrink Fit Toolholders • FC Line • Inch',
    rows: 6,
    familyCode: '109480001',
    facts: {
      taper: HSK50A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  'hsk50a_shrink_fit_fc_metric.csv': {
    catalogName: 'Kennametal HSK50A • Shrink Fit Toolholders • FC Line • Metric',
    rows: 6,
    familyCode: '109480003',
    facts: {
      taper: HSK50A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'hsk50a_shrink_fit_gp_inch.csv': {
    catalogName: 'Kennametal HSK50A • Shrink Fit Toolholders • GP Line • Inch',
    rows: 1,
    familyCode: '109520390',
    facts: {
      taper: HSK50A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: INCH_CATALOG,
    },
  },
  'hsk50a_shrink_fit_gp_metric.csv': {
    catalogName: 'Kennametal HSK50A • Shrink Fit Toolholders • GP Line • Metric',
    rows: 17,
    familyCode: '109520387',
    facts: {
      taper: HSK50A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  // HSK50C
  'hsk50c_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • HSK50C Form C',
    rows: 2,
    familyCode: '100149718',
    facts: {
      taper: HSK50C_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk50c_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HC-HSK Form C - Metric',
    rows: 8,
    familyCode: '100005099',
    facts: {
      taper: HSK50C_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  // HSK63A
  'hsk63a_er_collet_chuck.csv': {
    catalogName: 'Kennametal HSK63A ER Collet Chucks • Metric',
    rows: 14,
    familyCode: '100149698',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_hydraulic_chuck_hydroforce_inch.csv': {
    catalogName: 'Kennametal HSK63A Hydraulic Chuck • HydroForce High Torque • Inch',
    rows: 2,
    familyCode: '109438980',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'hsk63a_hydraulic_chuck_hydroforce_metric.csv': {
    catalogName:
      'Kennametal HSK63A Hydraulic Chucks • HydroForce High Torque • Through Coolant Form AD • Metric',
    rows: 2,
    familyCode: '109438984',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_hydraulic_chuck_inch.csv': {
    catalogName: 'Kennametal HSK63A Hydraulic Chucks • HP Line • Through Coolant Form AD • Inch',
    rows: 6,
    familyCode: '109542551',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: INCH_CATALOG,
    },
  },
  'hsk63a_hydraulic_chuck_metric.csv': {
    catalogName: 'Kennametal HSK63A Hydraulic Chucks • HP Line • Through Coolant Form AD • Metric',
    rows: 18,
    familyCode: '109542552',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_hydraulic_chuck_mql_metric.csv': {
    catalogName: 'Kennametal Hydraulic Chuck HSK63A • MQL 2-Channel • Metric',
    rows: 10,
    familyCode: '109427174',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_MQL,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_hydraulic_chuck_mql_metric_109427171.csv': {
    catalogName: 'Kennametal Hydraulic Chuck HSK63A • MQL 1-Channel • Metric',
    rows: 10,
    familyCode: '109427171',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_MQL,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_hydraulic_chuck_slim_inch.csv': {
    catalogName: 'Kennametal HSK63A • Hydraulic Chuck • Slim Line Trend • Inch',
    rows: 2,
    familyCode: '100003550',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: INCH_CATALOG,
    },
  },
  'hsk63a_hydraulic_chuck_slim_metric.csv': {
    catalogName: 'Kennametal HSK63A • Hydraulic Chuck • Slim Line Trend • Metric',
    rows: 8,
    familyCode: '109552626',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_SLIM,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_shrink_fit_fc_inch.csv': {
    catalogName: 'Kennametal HSK63A Shrink Fit Toolholders • FC Line • Inch',
    rows: 7,
    familyCode: '109480000',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: INCH_CATALOG,
    },
  },
  'hsk63a_shrink_fit_fc_metric.csv': {
    catalogName: 'Kennametal HSK63A Shrink Fit Toolholders • FC Line • Metric',
    rows: 7,
    familyCode: '109480002',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_FC,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_shrink_fit_gp_inch.csv': {
    catalogName: 'Kennametal TT GP HPV HSK63A • General Purpose (GP) • Inch',
    rows: 16,
    familyCode: '100002075',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: INCH_CATALOG,
    },
  },
  'hsk63a_shrink_fit_gp_metric.csv': {
    catalogName: 'Kennametal Shrink Fit HSK63A • MQL 1 Channel • Metric',
    rows: 20,
    familyCode: '109427167',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_shrink_fit_gp_metric_100001389.csv': {
    catalogName: 'Kennametal TT GP HPV HSK63A • General Purpose (GP) • Metric',
    rows: 20,
    familyCode: '100001389',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_shrink_fit_gp_metric_100004610.csv': {
    catalogName: 'Kennametal TT GP HPV HSK63A • General Purpose (GP) • MQL 1 Channel • Metric',
    rows: 1,
    familyCode: '100004610',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_shrink_fit_gp_metric_channels.csv': {
    catalogName: 'Kennametal Shrink Fit HSK63A • MQL 2 Channels • Metric',
    rows: 20,
    familyCode: '109427169',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_shrink_fit_ht.csv': {
    catalogName: 'Kennametal TT HT HPV HSK63A • High Torque (HT) • Metric',
    rows: 3,
    familyCode: '100001376',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_HT,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_shrink_fit_sf_inch.csv': {
    catalogName: 'Kennametal TT SF HPV HSK63A • Safe-Lock • Inch',
    rows: 4,
    familyCode: '100001173',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: INCH_CATALOG,
    },
  },
  'hsk63a_shrink_fit_sf_metric.csv': {
    catalogName: 'Kennametal TT SF HPV HSK63A • Safe-Lock • Metric',
    rows: 5,
    familyCode: '100001172',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_SF,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63a_shrink_fit_ttgl_inch.csv': {
    catalogName: 'Kennametal HSK63A Shrink Fit Toolholders • TTGL Line • Inch',
    rows: 7,
    familyCode: '100102396',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: INCH_CATALOG,
    },
  },
  'hsk63a_shrink_fit_ttgl_metric.csv': {
    catalogName: 'Kennametal HSK63A Shrink Fit Toolholders • TTGL Line • Metric',
    rows: 11,
    familyCode: '100091151',
    facts: {
      taper: HSK63A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: METRIC_CATALOG,
    },
  },
  // HSK63C
  'hsk63c_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • HSK63C Form C',
    rows: 3,
    familyCode: '100149721',
    facts: {
      taper: HSK63C_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk63c_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HC-HSK Form C',
    rows: 8,
    familyCode: '100005150',
    facts: {
      taper: HSK63C_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  // HSK80A
  'hsk80a_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • HSK80A Form A',
    rows: 5,
    familyCode: '100149699',
    facts: {
      taper: HSK80A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk80a_hydraulic_chuck.csv': {
    catalogName: 'Kennametal HC-HSK Form A • Standard HP Line',
    rows: 8,
    familyCode: '100003541',
    facts: {
      taper: HSK80A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk80a_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT GP HPV MM-HSK80A • General Purpose (GP)',
    rows: 10,
    familyCode: '109546529',
    facts: {
      taper: HSK80A_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: METRIC_CATALOG,
    },
  },
  // HSK80F (Pin)
  'hsk80f_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER™ • HSK80F Form F (Pin)',
    rows: 1,
    familyCode: '100149725',
    facts: {
      taper: HSK80F_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'hsk80f_shrink_fit_gp.csv': {
    catalogName: 'Kennametal TT-HSK Form F (Pin)',
    rows: 5,
    familyCode: '100005072',
    facts: {
      taper: HSK80F_SHANK,
      contact: HSK_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_GP,
      unit: INCH_CATALOG,
    },
  },

  // ── PSC ───────────────────────────────────────────────────────────────
  // PSC 50
  'psc50_er_collet_chuck.csv': {
    catalogName: 'Kennametal ER • PSC50',
    rows: 8,
    familyCode: '100149749',
    facts: {
      taper: PSC50_SHANK,
      contact: PSC_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  // **`100105369` ("HC • Metric", 18 parts) is deliberately absent.** It is the
  // one family in the six trees that sells two spindle sizes from one table:
  // eight `PSC50HC…` parts and ten `PSC63HC…`, and the walk links it under both
  // `PSC / PSC 50` and `PSC / PSC 63`. A `taper` fact is per family, so either
  // value it could take is wrong for the other ten or eight rows — and a wrong
  // taper is a holder offered for a spindle it does not fit, which costs a
  // machinist a purchase rather than an option. Splitting it by hand would mean
  // deciding which parts are which from their catalog numbers, which is
  // authoring tool data. `--holders` lists it every run, so it stays visible.
  // `tests/holding-corpus.test.ts` holds every other family to agreeing with its
  // own catalog numbers, so a second one cannot arrive quietly.
  // PSC 63
  'psc63_er_collet_chuck.csv': {
    catalogName: 'Kennametal PSC63 ER Collet Chucks • Metric',
    rows: 6,
    familyCode: '100149750',
    facts: {
      taper: PSC63_SHANK,
      contact: PSC_FACE_CONTACT,
      clamping: CST_COLLET_CLAMPING,
      style: ER_COLLET_CHUCK,
      unit: METRIC_CATALOG,
    },
  },
  'psc63_hydraulic_chuck_hydroforce_inch.csv': {
    catalogName: 'Kennametal HCTHT • Inch',
    rows: 2,
    familyCode: '100095073',
    facts: {
      taper: PSC63_SHANK,
      contact: PSC_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: INCH_CATALOG,
    },
  },
  'psc63_hydraulic_chuck_hydroforce_metric.csv': {
    catalogName: 'Kennametal HCTHT • Metric',
    rows: 2,
    familyCode: '100095068',
    facts: {
      taper: PSC63_SHANK,
      contact: PSC_FACE_CONTACT,
      clamping: HYDRAULIC_CLAMPING,
      style: HYDRAULIC_CHUCK_HYDROFORCE,
      unit: METRIC_CATALOG,
    },
  },
  'psc63_shrink_fit_ttgl_inch.csv': {
    catalogName: 'Kennametal TTGL • Inch',
    rows: 6,
    familyCode: '100093389',
    facts: {
      taper: PSC63_SHANK,
      contact: PSC_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: INCH_CATALOG,
    },
  },
  'psc63_shrink_fit_ttgl_metric.csv': {
    catalogName: 'Kennametal TTGL • Metric',
    rows: 10,
    familyCode: '100093174',
    facts: {
      taper: PSC63_SHANK,
      contact: PSC_FACE_CONTACT,
      clamping: SHRINK_CLAMPING,
      style: SHRINK_FIT_TTGL,
      unit: METRIC_CATALOG,
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
