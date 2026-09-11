/**
 * What every vendor's CSV agrees on, written down so it can be checked.
 *
 * A scraped CSV keeps **that vendor's own column labels**. Relabelling them
 * into a shared vocabulary on the way into the file would put a lie in the
 * file whose whole job is to record what the vendor published, and the labels
 * really do not line up: Kennametal's `D1_mm` and Destiny Tool's `cutDia_in`
 * are the same measurement under names neither vendor would recognise in the
 * other's table. Nothing reads a vendor's CSV but that vendor's own adapter.
 *
 * So this is not a schema. It is the short list of conventions that hold
 * *across* the CSVs anyway, and the reason to make them explicit is that
 * vendor #3 already drifted from one:
 *
 * | Convention                                         | Held by                   |
 * | -------------------------------------------------- | ------------------------- |
 * | `_mm`/`_in` carries the unit on a dimension        | all five                  |
 * | Multi-value cells are space-separated              | all five                  |
 * | One row per orderable part                         | all five                  |
 * | `CAD_STEP_URL` names a CAD model where one exists  | Kennametal, REGO-FIX      |
 * | `CAD_DXF_URL` names a 2D profile where one exists  | Harvey, MariTool          |
 * | `Description` carries the vendor's own free text   | Harvey, MariTool          |
 * | `contact` says how a holder seats                  | REGO-FIX, MariTool        |
 * | `CST` names the collet series a holder takes       | REGO-FIX, MariTool        |
 * | `Collet Series` names the series a collet is        | Kennametal, REGO-FIX      |
 * | `L1_in`/`L1_mm` carry a holder's gage length       | REGO-FIX, MariTool        |
 * | Unmapped vendor codes keep a `DIN_` prefix         | REGO-FIX; rule is general |
 * | The identity columns                               | **broken** — see below    |
 *
 * Identity and units are the two worth enforcing; the rest are advisory, and
 * are here so that "advisory" is a decision on the page rather than an
 * omission.
 *
 * **A vendor's column label can collide with a real ISO 13399 code and mean
 * something else.** The standard defines `D1` as fixing hole diameter and `L`
 * as cutting edge length; Kennametal's tables use `D1` for the cutting
 * diameter and `L` for the overall length. The two vocabularies overlap on
 * `D1`, `L`, `B`, `H`, `RE`, `SIG` and `TP` among others, so anything that
 * reads a vendor CSV without going through that vendor's adapter can be
 * confidently wrong rather than obviously broken. See `records.GEOMETRY_FIELDS`
 * for the canonical side of that line.
 */

import type { UnitSystem } from '@toolpath/tool-support'

import { ScraperConfigError } from './errors.js'
import type { BrandName } from './identity.js'

/**
 * Which unit system a family's dimensional columns are published in.
 *
 * `@toolpath/tool-support`'s, re-exported under the name this package has
 * always published. The same two strings were declared here and spelled two
 * other ways downstream — `'metric' | 'inch'`, and a display unit `'mm' | 'in'`
 * — with a lookup table between them on ingest, which is where a metric family
 * quietly becomes an inch one. This spelling won because a scrape originates
 * the fact.
 */
export type { UnitSystem } from '@toolpath/tool-support'

/**
 * The suffix a dimensional column carries, per unit system.
 *
 * **This is the whole of the unit rule, in one place, on purpose.** A vendor
 * adapter declares a bare label — `'D1'`, never `'D1_mm'` — and the core
 * appends the suffix from the family's declared unit. Choosing the suffix
 * inside an adapter is exactly the mistake a declared `unit` exists to
 * prevent, and a silent unit assumption is the likeliest way this data shows
 * someone a wrong number: a family tagged metric that publishes both columns
 * converts cleanly and reports 9.525 mm where a machinist ordered 3/8.
 */
export const UNIT_SUFFIX: Record<UnitSystem, string> = {
  millimeters: '_mm',
  inches: '_in',
}

/**
 * The CSV column holding a part's downloadable STEP model, for every vendor.
 *
 * Named for what it holds rather than for how one vendor names the format. It
 * was `CAD_STP_LWM` until 2026-08-08: `LWM` is CDS Visual's key for
 * Kennametal's lightweight model, and REGO-FIX publishes no such thing, so the
 * moment a second vendor wrote into this column the name became a claim about
 * the data that was false. That fact is still recorded in the Kennametal CAD
 * module, where it is true.
 *
 * It sits here rather than with either vendor because two of them write it and
 * neither owns it — the leak the vendor-boundary test exists to catch.
 */
export const CAD_COLUMN = 'CAD_STEP_URL'

/**
 * The CSV column holding a part's downloadable 2D DXF profile.
 *
 * A second column rather than a second thing written into {@link CAD_COLUMN},
 * because a DXF is not a STEP model: one is a flat profile a machinist prints
 * or traces, the other is the solid a CAM system imports. Harvey Tool publishes
 * a DXF for 12,773 of its 12,799 parts and a STEP for none of them, so writing
 * its link into `CAD_STEP_URL` would repeat exactly the mistake the
 * `CAD_STP_LWM` -> `CAD_STEP_URL` rename fixed on 2026-08-08 — a column name
 * that is a claim about the data, and false.
 *
 * Vendor-neutral and beside `CAD_COLUMN` for the same reason that one is: a
 * format is not one manufacturer's fact, and the second vendor to publish a DXF
 * must write it into this column rather than inventing another.
 */
export const CAD_DXF_COLUMN = 'CAD_DXF_URL'

/**
 * The CSV column holding the vendor's own free text about one part.
 *
 * Harvey Tool writes a product title here and MariTool a product name; both are
 * the vendor's own prose rather than a designation this package composed. It is
 * here and not in either adapter for the reason {@link CAD_COLUMN} is: two of
 * them write it and neither owns it.
 *
 * **Not every vendor publishes one, and `''` is the answer where none does** —
 * a description that restates the catalog number is not a description. See
 * `records.ToolRecord.description`, which states the same rule for the record.
 */
export const DESCRIPTION_COLUMN = 'Description'

/**
 * The CSV column holding the vendor's own full name for the family a part is
 * in — `KenCut™ FF • HPFT • Square End • 6 Flutes • Plain Shank • Inch`.
 *
 * Constant down a family's whole table, and that is what makes it a *family*
 * title rather than a {@link DESCRIPTION_COLUMN}: it names the group, not the
 * part. Kennametal and WIDIA publish one as the `h1` of a family page and it
 * reaches the CSV whole, while `records.ToolRecord.productLine` keeps only its
 * leading segment — the rest is the vendor's own wording for the shape, the
 * flute count, the shank and the unit, and a receipt that dropped it would be
 * throwing away published text to save a column.
 *
 * Vendor-neutral and here rather than in the Kennametal adapter for the reason
 * {@link CAD_COLUMN} is: a second vendor that publishes a family title writes
 * this column rather than inventing another. Nothing forces one to — a vendor
 * whose parts carry no family title simply has no such column.
 */
export const FAMILY_TITLE_COLUMN = 'Family Title'

/**
 * The CSV column saying how a holder seats in the spindle: `taper` or `face`.
 *
 * `face` is dual contact — the flange face seats at the same time as the cone.
 * REGO-FIX resolves it from its own `form_name` and MariTool from its `Taper`
 * cell, which is the right shape: **how** a vendor states it is that vendor's
 * business, and what the column is called is not.
 */
export const CONTACT_COLUMN = 'contact'

/**
 * The CSV column naming the collet series a holder accepts — `ER16`, `PG25`.
 *
 * The join key between a holder family and a collet family, which is exactly
 * why it cannot be spelled twice: `families/kennametal.ts` states the join
 * against this column, and two spellings of it join to nothing. Both vendors
 * that publish it close the vendor's own spacing before writing it here, for
 * the same reason.
 */
export const COLLET_SERIES_COLUMN = 'CST'

/**
 * The CSV column naming the series a collet **is** — `ER16`, `PG25`, `PGST15`.
 *
 * The other half of {@link COLLET_SERIES_COLUMN}, and deliberately a second
 * column rather than the same one: `CST` is the series a *holder takes* and
 * this is the series a *collet belongs to*, so the join between a holder family
 * and a collet family is a comparison of the two. One column carrying both
 * would make that join a row's comparison with itself.
 *
 * Vendor-neutral and here rather than in either adapter for the reason
 * {@link CAD_COLUMN} is: Kennametal's ER collet tables and REGO-FIX's PG collet
 * index both write it, and neither owns it. Both close the vendor's own spacing
 * before writing, exactly as they do for `CST` — two spellings join to nothing.
 */
export const COLLET_DESIGNATION_COLUMN = 'Collet Series'

/**
 * The CSV columns carrying a holder's gage length, one per unit system.
 *
 * A **pair** with exactly one cell filled, rather than one column and a unit
 * tag, because a single catalog page can publish both: MariTool gages
 * `HSK40E-ER11-40` in millimetres and `HSK40E-ER16-3.0M` in inches on one
 * listing. Nothing is converted between them — the vendor's own imperial
 * conversion is unusable and computing one here would put a number in the file
 * the vendor never published.
 *
 * REGO-FIX fills only the millimetre cell, because its DIN 4000 documents are
 * metric throughout; the pair is still the shape, so the two vendors' holder
 * CSVs answer the same question with the same columns.
 */
export const GAGE_COLUMNS: Record<UnitSystem, string> = {
  inches: 'L1_in',
  millimeters: 'L1_mm',
}

/**
 * The prefix an unmapped vendor code keeps, so it cannot read as a dimension.
 *
 * REGO-FIX's per-part DIN 4000 XML publishes codes — `A2`, `B1`, `B2` — whose
 * meaning is not stated anywhere this package has been able to check. The
 * standing rule is to leave such a code unlabelled rather than guess at what
 * it measures, and a bare `A2` beside `L1_mm` reads as a labelled dimension.
 * `DIN_A2` reads as what it is: a vendor code, pending a source.
 */
export const DIN_PREFIX = 'DIN_'

/**
 * The columns that name one orderable part: its vendor-local number, and the
 * catalog designation a human orders by.
 *
 * `Material Number` is the guid seed — see `identity.recordGuid` — so this is
 * the one convention whose erosion is not cosmetic.
 */
export const IDENTITY_COLUMNS = ['Material Number', 'ISO Catalog Number'] as const

/**
 * Where a vendor's CSV does not use {@link IDENTITY_COLUMNS}, and what it uses
 * instead.
 *
 * **Three entries, and they are a record of drift rather than a licence.**
 * REGO-FIX adopted Kennametal's identity labels; Destiny Tool passes
 * Firestore's own `itemNumber` straight through and publishes no catalog
 * designation at all — the convention was real but informal, and it eroded the
 * first time a vendor did not resemble the first two. Writing the deviation
 * down is what makes the next vendor's drift a decision somebody made rather
 * than a thing that happened.
 *
 * Harvey Tool and MariTool are the honest kind, and they are now the majority:
 * both genuinely publish one identifier per part, so their entries record a
 * fact about the vendor rather than a shortcut taken here. Two of the two
 * vendors added since the convention was written have needed one, which says
 * the two-column shape is Kennametal's rather than the industry's.
 */
export const IDENTITY_DEVIATIONS: Partial<Record<BrandName, readonly string[]>> = {
  destinytool: ['itemNumber'],
  // Harvey Tool publishes exactly one number per part — the `Tool #` its own
  // table column is headed with, which is also the segment of its per-part URL
  // — and no second catalog designation anywhere on a product page or a part
  // page. Inventing an `ISO Catalog Number` to satisfy the convention would put
  // a column in the CSV that the vendor does not publish, which is the one
  // thing a receipt must not do.
  harvey: ['Tool #'],
  // MariTool publishes one number per part — the `Part#` line its own listing
  // rows are headed with, which is also what its `Available Downloads for …`
  // header restates and what its search endpoint matches on — and no second
  // catalog designation anywhere on a category page or a product page. The
  // store's `products_id` is not that second number: it is an internal id a
  // re-created product would change, and every guid minted off it with it.
  // Same call as Harvey's, and the honest kind: the entry records a fact about
  // the vendor rather than a shortcut taken here.
  maritool: ['Material Number'],
}

/**
 * A vendor's bare column label, suffixed for `unit`.
 *
 * Throws rather than defaulting on an unknown unit system: the two callers
 * that could pass one are a family config and a CLI flag, and a typo that
 * silently picked millimetres would produce a clean conversion with the wrong
 * numbers in it. `unit` is typed as a plain string for the CLI's sake — the
 * flag arrives as one, and the check is the only thing between it and a
 * mis-suffixed column.
 */
export function dimensionalColumn(label: string, unit: string): string {
  if (!Object.hasOwn(UNIT_SUFFIX, unit)) {
    throw new ScraperConfigError(
      label,
      `unknown unit system ${JSON.stringify(unit)} ` +
        `(known: ${Object.keys(UNIT_SUFFIX).sort().join(', ')})`,
    )
  }
  return label + UNIT_SUFFIX[unit as UnitSystem]
}

/**
 * The columns that identify a part in `brand`'s CSV.
 *
 * {@link IDENTITY_COLUMNS} unless the brand is listed as a deviation, which is
 * a lookup rather than a guess: a caller cannot resolve this by inspecting a
 * header, because a header that is missing `Material Number` is
 * indistinguishable from a scrape that lost it.
 */
export function identityColumns(brand: BrandName): readonly string[] {
  return IDENTITY_DEVIATIONS[brand] ?? IDENTITY_COLUMNS
}

/**
 * The identity column a human reads one part by.
 *
 * The catalog designation where the vendor publishes one, and the sole
 * identifier where it does not — the **last** of {@link identityColumns},
 * because that is the order the pair is written in and a deviation lists the
 * one column its vendor has.
 *
 * A lookup rather than a read of the row, for the reason {@link identityColumns}
 * gives: a header that is missing `ISO Catalog Number` is indistinguishable
 * from a scrape that lost it, so a caller that fell back column by column would
 * name half a family's files after part numbers and never say why.
 *
 * It exists because `node/cad-mirror.ts` names a mirrored file after the part
 * it holds, and hardcoded `'ISO Catalog Number'` to do it. That is Kennametal's
 * pair; MariTool publishes one number per part under `Material Number` and no
 * catalog designation at all, so every one of its 357 STEP models was skipped
 * with a warning that the row had no catalog number to name it.
 */
export function catalogColumn(brand: BrandName): string {
  const columns = identityColumns(brand)
  // Non-null: `IDENTITY_COLUMNS` has two entries and every deviation has at
  // least one, which `tests/conventions.test.ts` holds the table to.
  return columns[columns.length - 1]!
}

/**
 * Every identity column `brand` claims is really in the CSV header.
 *
 * The failure this prevents: a re-scrape whose part-number column moved or was
 * renamed produces a CSV that still parses, still has the right number of
 * rows, and mints every guid off an empty string.
 */
export function checkIdentityColumns(brand: BrandName, header: Iterable<string>): void {
  const present = new Set(header)
  const missing = identityColumns(brand)
    .filter((column) => !present.has(column))
    .sort()

  if (missing.length > 0) {
    throw new ScraperConfigError(
      brand,
      `identity column(s) absent from the CSV: ${missing.join(', ')}`,
    )
  }
}
