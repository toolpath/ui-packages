/**
 * What a holder and a collet become, and the two gates that refuse one.
 *
 * `records.ts` is the cutting-tool half of this package's output. This is the
 * toolholding half, and it is a separate module rather than a third `ToolKind`
 * because the three vocabularies genuinely do not overlap: a tool answers `DC`,
 * a flute count and a workpiece material group; a holder answers a taper, a
 * clamping mode and a gage length; a collet answers a series and a capacity
 * band. `families/index.ts` states the same rule for the config tables —
 *
 * > Separate tables rather than a `kind` on one, because a holder and a collet
 * > are not variants of a thing.
 *
 * — and the records follow it. What they *do* share is identity, the unit rule
 * and the guid space, which is why both live here and not in two more files:
 * `identity.recordGuid` mints a holder and a tool into one namespace per brand,
 * so a consumer building a catalog from both can refuse a collision between
 * them.
 *
 * ## Two copies of a dimension, and only where something compares them
 *
 * A fit-bearing dimension is kept twice — once in the family's native unit for
 * display, once in canonical millimetres for arithmetic. The reason is that fit
 * and filtering are different questions: a 3/8 in shank is 9.525 mm and
 * genuinely seats in a metric 9-10 mm collet, so a fit comparison must convert,
 * while a range *filter* must still refuse to, because "between 9 and 10 mm" is
 * not a question an inch tool answers.
 *
 * Only {@link HolderRecord.bore}, {@link HolderRecord.gaugeLength},
 * {@link ColletRecord.clampMin} and {@link ColletRecord.clampMax} get a twin.
 * Everything else — usable length, body diameter, adjustment range — is
 * displayed and never compared, and a second copy of a number nothing reads is
 * a field to keep in sync for free.
 *
 * **The twin is derived here rather than read from the other unit column**, and
 * that is a deliberate departure from the reference implementation, which read
 * `D1_mm` directly whatever the family's unit was. Vendors publish pairs that
 * disagree — see {@link checkUnitAgreement} — and a record whose `bore` and
 * `boreMm` came from two contradicting cells is one record stating two sizes.
 * Deriving makes `boreMm` exactly `bore` in millimetres by construction, so the
 * pair cannot drift and a test can pin one to the other.
 *
 * ## Which refusal a vendor's row earns
 *
 * The split is **blank versus wrong**, and it decides whether one bad part ends
 * a family:
 *
 * - A cell the vendor left **blank** that a part cannot exist without — no gage
 *   length, no bore on a bore-clamping holder, no capacity on a collet — is an
 *   `errors.IncompletePartError`. `registry.toHolding` warns and drops the row,
 *   the same call `registry.toRecords` makes for a cutting tool, and for the
 *   same reason: MariTool leaves `Shank Size` blank on four HSK holders out of
 *   527, and losing five families over four rows is not a trade worth making.
 * - A value that is **present and unreadable**, or two present values that
 *   **contradict** — a clamping mode this package has no word for, a holder
 *   that names both a bore and a collet series, a collet whose nominal size
 *   falls outside its own published capacity — is an `errors.VendorResponseError`
 *   and stops the family. Those say the vendor's vocabulary or this package's
 *   reading of it has moved, and skipping past one quietly is how a scraper
 *   starts publishing a catalog nobody checked.
 */

import { CAD_COLUMN, dimensionalColumn, UNIT_SUFFIX, type UnitSystem } from './conventions.js'
import { IncompletePartError, ScraperConfigError, VendorResponseError } from './errors.js'
import type { BoundToolholding } from './family.js'
import { BRANDS, productLink, recordGuid, type BrandName } from './identity.js'
import { convertLength, fractionValue } from './measure.js'
import type { FactSource } from './provenance.js'
import { UNSPECIFIED } from './records.js'
import { consoleWarn, type ScrapedRow, type Warn } from './scrape.js'

/**
 * How a holder grips the thing it holds.
 *
 * Four values where the reference implementation had two. `bore` and `collet`
 * are its own; `shrink` and `hydraulic` are here because the distinction is a
 * real one a buyer makes — a shrink-fit holder needs an induction heater on the
 * bench and a hydraulic chuck needs an actuation screw, where both are
 * otherwise the same answer to "what fits in it".
 *
 * They are the same *fit* question, which is what {@link BORE_CLAMPINGS} says:
 * all three grip a shank directly and are held to one rule.
 *
 * **Every vendor reads this off the vendor's own category, and none of them
 * infers it from a column.** MariTool takes it from the leaf a part was
 * scraped under; Kennametal takes it from the family breadcrumb. Until
 * 2026-09-10 this docstring claimed Kennametal "states the mode as a bore" and
 * that declaring `bore` on its 135 shrink-fit and hydraulic families was
 * therefore not re-classifying a vendor's words. That was wrong on the facts —
 * no Kennametal variant table publishes a clamping column at all, so `bore` was
 * this package's own inference from a `D1` being present, while the vendor's
 * `Hydraulic Chucks` and `Shrink Fit Toolholders` categories were already
 * scraped and cited on the same families' `style`. The cost was that `clamping`
 * meant different things per vendor in one crib and a `hydraulic` filter hid
 * 339 hydraulic chucks.
 *
 * `style` is still the finer axis and still carries `shrink-fit-gp`,
 * `hydraulic-chuck-hydroforce` and the rest — the vendor's product line, where
 * this is the mode.
 */
export type ClampingMode = 'bore' | 'collet' | 'shrink' | 'hydraulic'

/** Every {@link ClampingMode}, for a message that can list what it knows. */
export const CLAMPING_MODES: readonly ClampingMode[] = ['bore', 'collet', 'shrink', 'hydraulic']

/**
 * The clamping modes that grip a shank directly, and therefore publish a bore.
 *
 * One rule over three values rather than three rules: the gate in
 * {@link checkHolder} asks whether a holder takes a shank or a collet, and
 * every mode but `collet` takes a shank.
 */
export const BORE_CLAMPINGS: readonly ClampingMode[] = ['bore', 'shrink', 'hydraulic']

/**
 * Whether the flange face seats on the spindle face as well as the cone.
 *
 * Never defaulted. `taper` is the common case, and defaulting to it would
 * record a dual-contact family as a plain cone on no evidence — the same
 * silent-wrong-answer shape as a bore-clamping holder with no bore.
 */
export type ContactMode = 'taper' | 'face'

/** Every {@link ContactMode}, for the same reason {@link CLAMPING_MODES} is a list. */
export const CONTACT_MODES: readonly ContactMode[] = ['taper', 'face']

/**
 * How a part's downloadable STEP model was arrived at.
 *
 * **`records.MaterialGroupsSource`'s shape, for the same reason it has one**:
 * a `null` link carried two incompatible claims at once. `'vendor-stated'` is
 * bound to `provenance.FactSource` rather than spelled again, because two
 * declarations of one vocabulary is the drift `records.ts` already refuses.
 */
export type CadSource = Extract<FactSource, 'vendor-stated'> | typeof UNSPECIFIED

/**
 * A part's STEP model and whether anything has looked for one — the reader
 * every holder mapper uses, so the three states are decided once.
 *
 * **`conventions.CAD_COLUMN` is filled by two different kinds of step**, and
 * the difference used to reach the record as one `null`. REGO-FIX, MariTool and
 * Harvey write the column during the scrape itself, so their rows are always
 * answered. Kennametal and WIDIA publish no CAD link on a family page at all —
 * the models are CDS Visual's — so the column arrives only when the separate
 * `toolpath-scrape cad` pass has run, and until it does *every* row of a family
 * is blank for a reason that has nothing to do with the vendor.
 *
 * `node/csv.parseCsv` fills `''` only for cells under a column that is in the
 * header, so the CSV already tells the two apart and this is what stops the
 * record collapsing them:
 *
 * - **`unspecified`**, `cadModelUrl` `null` — nothing has looked. Says nothing
 *   about whether a model exists, and is not a claim that none does.
 * - **`vendor-stated`**, `cadModelUrl` `null` — the lookup ran and the vendor
 *   publishes no model for this part. That is `vendors/kennametal/cad.ts`'s
 *   documented `cadAvailable: false` case reaching the record intact.
 * - **`vendor-stated`**, `cadModelUrl` set — the vendor publishes this one.
 */
export function cadModel(row: ScrapedRow): {
  cadModelUrl: string | null
  cadModelSource: CadSource
} {
  const cell = row[CAD_COLUMN]
  if (cell === undefined) return { cadModelUrl: null, cadModelSource: UNSPECIFIED }
  return { cadModelUrl: cell || null, cadModelSource: 'vendor-stated' }
}

/** What every toolholding record shares with every `records.ToolRecord`. */
export interface HoldingIdentity {
  /** `holder` or `collet` — which of the two record types this is. */
  readonly kind: ToolholdingKind
  /**
   * The brand key the record was minted under — `identity.BRANDS`'s own key.
   *
   * Here for the reason `records.ToolRecord.brand` is: {@link HoldingIdentity.guid}
   * is minted in this brand's namespace, so without the key the guid is
   * underivable from the record.
   */
  readonly brand: BrandName
  /** What this brand's records call the vendor — `identity.BRANDS[brand].vendor`. */
  readonly vendor: string
  /** `identity.recordGuid(brand, materialNumber)`, minted by the factories below. */
  readonly guid: string
  readonly materialNumber: string
  readonly catalogNumber: string
  /**
   * The vendor's own free text about this part, verbatim — `''` where the
   * vendor publishes none.
   *
   * **Never a copy of another field**, the rule `records.ToolRecord.description`
   * already states. The reference implementation set it to the catalog number
   * on every holder and collet, which put one string in two fields and told a
   * consumer nothing it did not already have. Kennametal and REGO-FIX publish
   * no description column for toolholding, so `''` is the honest answer for
   * both; MariTool publishes a product name and that is what its records carry.
   */
  readonly description: string
  readonly productLink: string
  /**
   * Which unit system this record's native dimensions are in.
   *
   * **Per record, not per family.** REGO-FIX publishes `PG 25 Ø 6.0 mm` and
   * `PG 25 Ø 1/4"` as two rows of one product group, and MariTool gages two
   * parts on one listing page in different systems. A family-level constant
   * would be contradicted row by row, which is why `families/maritool.ts`
   * declares no `unit` fact and the scraper promotes an `L1_in`/`L1_mm` pair
   * with one cell filled instead.
   */
  readonly unit: UnitSystem
}

/** One holder — a spindle interface, a way of gripping, and a gage length. */
export interface HolderRecord extends HoldingIdentity {
  readonly kind: 'holder'
  /** The spindle interface, as the vendor designates it — `BT30`, `HSK63A`. */
  readonly taper: string
  readonly contact: ContactMode
  readonly clamping: ClampingMode
  /** The vendor's own product style — `er-collet-chuck`, `shrink-fit-gp`. */
  readonly style: string
  /**
   * The collet series this holder takes, on a collet-clamping holder only.
   *
   * Joins to {@link ColletRecord.series}. Written exactly as the vendor
   * designates it, so a `PGST15` collet matches no `PG25` holder — the
   * conservative direction on purpose, because hiding a collet that would have
   * fitted costs an option while offering one that does not fit costs a
   * machinist a purchase.
   */
  readonly colletSeries: string | null
  /** `D1` — the bore a shank seats in, on a bore-clamping holder only. */
  readonly bore: number | null
  readonly boreMm: number | null
  /** `L1` — gage line to nose. Required: without it there is no stickout. */
  readonly gaugeLength: number
  readonly gaugeLengthMm: number
  /** `L2` — usable length. */
  readonly usableLength: number | null
  /** `L9` — clamping length. */
  readonly clampingLength: number | null
  /** `V` — the adjustment range. */
  readonly adjustmentRange: number | null
  /** `D2` — body diameter. */
  readonly bodyDiameter: number | null
  /** `D11` — lock-nut diameter. */
  readonly lockNutDiameter: number | null
  /**
   * `conventions.CAD_COLUMN` — the downloadable STEP model.
   *
   * `null` on its own does **not** mean the vendor publishes none; read it with
   * {@link HolderRecord.cadModelSource}, which is what says which null this is.
   */
  readonly cadModelUrl: string | null
  /** Whether anything has looked for {@link HolderRecord.cadModelUrl}. See {@link cadModel}. */
  readonly cadModelSource: CadSource
  /** `conventions.CAD_DXF_COLUMN`, or null where the vendor publishes no profile. */
  readonly cadDxfUrl: string | null
  /**
   * The nullable fields this part's vendor publishes **no column for**, stated
   * by the adapter and checked against what it supplied.
   *
   * Every null above has two possible causes — the vendor published nothing, or
   * this package reads nothing — and a consumer building one catalog out of
   * several vendors cannot tell them apart from the record. That is not a
   * detail: a picker that hides a holder whose `usableLength` is null is right
   * to hide it when REGO-FIX's table has no L2 column, and wrong when the
   * adapter simply never mapped one.
   *
   * So a mapper states it rather than reaching it by omission, and
   * {@link holderRecord} refuses the two ways the statement can be false — a
   * field left out and not declared, or declared and then supplied. It is the
   * sensor for the rule this module's own factory used to state only in prose:
   * *writing `usableLength: null` five times in an adapter is how a null
   * becomes a default nobody notices.*
   *
   * A field **absent** from this list and null is a fact about the part —
   * MariTool's four blank `Shank Size` cells, a collet-clamping holder's bore.
   * A field **present** is a fact about the vendor's table, constant down it.
   */
  readonly unpublished: readonly OptionalHolderField[]
}

/** One collet — a series, a capacity band, and the sizes in between. */
export interface ColletRecord extends HoldingIdentity {
  readonly kind: 'collet'
  /** `ER16`, `PG25`, `PGST15` — joins to {@link HolderRecord.colletSeries}. */
  readonly series: string
  /** The vendor's own product style — `er-standard`, `pg-coolant-flush`. */
  readonly style: string
  /** `D1` — the nominal size the vendor designates the collet by. */
  readonly nominal: number | null
  /**
   * `CCCN`/`CCCX` — the vendor's published clamping capacity, never derived.
   *
   * DIN 6499 is usually summarised as a 1 mm band, which is wrong at the small
   * end of every series (`16ER010M` clamps 1.0 down to 0.5) and wrong by a
   * whole millimetre on a sealed coolant-through collet, where the two are
   * equal and the collet takes one exact size.
   */
  readonly clampMin: number
  readonly clampMax: number
  readonly clampMinMm: number
  readonly clampMaxMm: number
  /** `BDX` — body diameter. */
  readonly bodyDiameter: number | null
  /** `LF` — functional length. */
  readonly functionalLength: number | null
  /** `L` — overall length. */
  readonly overallLength: number | null
  /**
   * `L9` — how deep the clamping bore is, and therefore how much shank the
   * collet actually holds.
   *
   * Twinned in millimetres because it is **compared and not only displayed**:
   * it is `@toolpath/tool-support`'s `Collet.clampLength`, the one input to
   * `maxStickout`, which answers `null` for every collet without it. That is
   * the rule this module states for `bore`, `gaugeLength` and the capacity
   * pair, and this is the fourth dimension to earn it.
   *
   * Not a second overall length. Kennametal's `109321468` publishes both: `L`
   * is 46 mm down all nineteen ER40 rows while `L9` runs 22 / 28 / 46 by size.
   */
  readonly clampingLength: number | null
  readonly clampingLengthMm: number | null
  /**
   * The vendor's own designation of the taps this collet is for, verbatim —
   * `"M6 & M6.3"`, `"#14 & 1/4"`.
   *
   * **Text, and deliberately not parsed.** It names two thread designations in
   * the vendor's own words and this package does not author tool data; what a
   * fit rule compares is {@link ColletRecord.clampMin}/{@link ColletRecord.clampMax},
   * which are numbers. `null` on every collet whose vendor publishes none.
   */
  readonly tapRange: string | null
  /**
   * `S10` — the square drive the bore carries, across flats.
   *
   * The fact that makes a tap collet a tap collet: its bore is not round, so
   * the part it takes is a tap and nothing else. A shank test alone would say
   * yes to an end mill of the same diameter, held by nothing —
   * `@toolpath/tool-support`'s `holderTakesTool` reads this to refuse that.
   * `null` where the vendor publishes no square, which is every round collet.
   */
  readonly squareSize: number | null
  /**
   * The nullable fields this collet's vendor publishes no column for.
   *
   * {@link HolderRecord.unpublished}'s rule, on the collet half. The prose it
   * replaces was already drifting: the factory below called these "the seven
   * REGO-FIX publishes none of" while that adapter has mapped `nominal` from
   * `D1` since it was written, so the count was six and nothing could notice.
   */
  readonly unpublished: readonly OptionalColletField[]
}

/** Either toolholding record. Narrow on {@link HoldingIdentity.kind}. */
export type HoldingRecord = HolderRecord | ColletRecord

/**
 * Which of the two toolholding tables a family came from.
 *
 * Not a key on `family.ToolholdingDefinition`: which table declares a family
 * *is* the fact, and a `kind` beside it would be a second copy to disagree with
 * it. `registry.boundToolholding` projects it onto the bound config, which is
 * where the registry already knows the answer.
 */
export type ToolholdingKind = 'holder' | 'collet'

/** One toolholding row -> one record. A vendor adapter supplies these. */
export type HolderMapper = (
  row: ScrapedRow,
  family: BoundToolholding,
  options?: { warn?: Warn },
) => HolderRecord

/** The collet half of the same contract. */
export type ColletMapper = (
  row: ScrapedRow,
  family: BoundToolholding,
  options?: { warn?: Warn },
) => ColletRecord

/**
 * A vendor adapter's toolholding mappers, both optional.
 *
 * **Partial on purpose.** REGO-FIX publishes holders and collets, MariTool
 * holders only, and Harvey, EMUGE and Destiny Tool neither. A brand absent from
 * `registry.HOLDING_ADAPTERS`, or present with no mapper for the kind, keeps
 * today's behaviour exactly: the scrape ends at rows and a receipt. That is
 * what makes minting records additive rather than a break, and it is the honest
 * state for a vendor whose columns nobody has read yet.
 */
export interface HoldingMappers {
  holder?: HolderMapper
  collet?: ColletMapper
}

/** Either mapper, as the registry stores the one a family binds. */
export type HoldingMapper = HolderMapper | ColletMapper

/**
 * A per-family constant a toolholding mapper cannot proceed without.
 *
 * `family.fact`'s counterpart for a family with no `id` and no `ToolKind`. The
 * two are separate rather than one widened function because the subject of the
 * message differs: a cutting-tool family is named by its vendor-local id and a
 * toolholding family by the catalog name a human reads.
 *
 * Refusing rather than defaulting, for the reason `family.fact` states: every
 * default is a claim the family never made, and a missing `taper` becoming
 * `''` ships a holder that fits no spindle and raises nothing.
 */
export function holdingFact<T>(family: BoundToolholding, key: string, value: T | undefined): T {
  if (value === undefined) {
    throw new ScraperConfigError(
      family.catalogName,
      `a ${family.kind} family must state ${key} as a fact`,
    )
  }
  return value
}

/**
 * A value the vendor left blank on one part, refused as an incomplete part.
 *
 * The toolholding counterpart of `columns.required`, and it throws the same
 * type for the same reason: this is the one refusal `registry.toHolding` skips
 * past, because a single part with an unpublished cell must not end a family's
 * conversion. See `errors.IncompletePartError` for why the others must not be
 * skipped alike.
 */
export function published<T extends string | number>(
  value: T | null | undefined,
  what: string,
  label: string,
): T {
  if (value === null || value === undefined || value === '') {
    throw new IncompletePartError(what, `publishes no ${label}`)
  }
  return value
}

/**
 * Round a converted value to six decimals.
 *
 * **This removes error rather than adding precision.** 9.525 mm is exactly
 * 0.375 in, but `9.525 / 25.4` is `0.37500000000000006` in binary floating
 * point, and that is the number that would land in a catalog and in a
 * prefix-matched size string. Six places is far coarser than the ~1e-14 the
 * error reaches at these magnitudes and far finer than the four decimals a
 * vendor prints, so nothing anybody stated is lost.
 */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/**
 * `value`, stated in `from`, as a number in `to` — a no-op when they agree.
 *
 * The one conversion every toolholding mapper makes, so that the rounding above
 * is applied in one place rather than wherever somebody remembers to.
 */
export function asUnit(value: number, from: UnitSystem, to: UnitSystem): number {
  return from === to ? value : round6(convertLength(value, from, to))
}

/** `value`, stated in `unit`, as millimetres. */
export function millimeters(value: number, unit: UnitSystem): number
export function millimeters(value: number | null, unit: UnitSystem): number | null
export function millimeters(value: number | null, unit: UnitSystem): number | null {
  return value === null ? null : asUnit(value, unit, 'millimeters')
}

/**
 * One dimension in `unit`, converted from the other system where that is all
 * the vendor published.
 *
 * **The fallback is load-bearing, not defensive.** Kennametal's `D1` is a unit
 * pair on the BT30 hydraulic chucks and metric-only on the HSK63A HP line — an
 * *inch* family with no `D1_in` column at all. A bare suffixed read is correct
 * on the first and yields null on the second, producing a holder with no bore:
 * it matches no tool, raises nothing, and looks like an empty result rather
 * than a bug.
 *
 * The grammar is `measure.fractionValue`'s, which is the package's one reader
 * for a machinist's number and refuses a range rather than summing it.
 */
export function dim(row: ScrapedRow, label: string, unit: UnitSystem): number | null {
  const native = fractionValue(row[dimensionalColumn(label, unit)] ?? '')
  if (native !== null) return native

  const other: UnitSystem = unit === 'millimeters' ? 'inches' : 'millimeters'
  const fallback = fractionValue(row[dimensionalColumn(label, other)] ?? '')
  if (fallback === null) return null
  return round6(convertLength(fallback, other, unit))
}

/** Half a unit in the last decimal place a cell actually printed. */
function halfUlp(raw: string): number {
  const fraction = raw.includes('.') ? raw.slice(raw.indexOf('.') + 1) : ''
  return 0.5 * 10 ** -fraction.length
}

/**
 * How far a collet's *designation* may sit from its measured capacity, as a
 * fraction of that capacity.
 *
 * {@link ColletRecord.nominal} is the size the vendor **designates** the collet
 * by; {@link ColletRecord.clampMin}/{@link ColletRecord.clampMax} is what it
 * measures. They are not two readings of one number, and on a sealed collet
 * they are routinely different: Kennametal's `40ERSS1000` is designated 1 inch
 * and clamps 0.9938, `40ERSS0500` is designated 1/2 and clamps 0.4943. Both
 * unit columns agree on both figures — 25.4 against 25.243 mm, 12.7 against
 * 12.556 — so this is the vendor stating an undersized capacity for a collet it
 * names by the fraction, not a cell in the wrong column.
 *
 * **Relative rather than absolute, because the gap scales with the collet.**
 * Across the 443-part collet corpus fourteen rows sit outside their own band.
 * The widest is `40ERSS0812` at 0.193 mm, which is 0.94 % of its 20.4 mm
 * capacity; the widest by fraction is `40ERSS0500` at 1.14 %. The error this
 * must still refuse is a cell in the wrong unit system, which is 96 % out — the
 * shape `16ERSS0312` has, where `D1`'s metric cell holds the inch value. This
 * sits 4.4x above the first and 19x below the second. A row that lands in
 * between is a finding to investigate rather than a number to widen.
 */
export const NOMINAL_SLACK = 0.05

/**
 * Report where a vendor's own millimetre and inch cells disagree.
 *
 * **Vendors really do publish contradictory pairs.** Kennametal's `16ERSS0312`
 * states `D1`'s metric cell as `0.3125` — the inch value sitting in the metric
 * column, a factor of 25.4 out — and `25ER130M` publishes `CCCN` as both
 * 12.0 mm and 0.437 in, which is 11.1 mm. Both are in the source HTML.
 *
 * **This reports; it does not gate.** Two disagreeing cells cannot say which
 * one is wrong, so refusing the family would trade a knowable warning for an
 * unusable pipeline, and correcting a cell here would make this package a place
 * tool data is authored by hand. What protects the output instead is that
 * {@link dim} reads the family's *native* column and never the other one, plus
 * {@link checkCollet}'s native-unit test that a nominal size falls inside its
 * own published capacity. Every disagreement found so far sits in the column
 * {@link dim} ignores; escalate this to a gate if one ever lands in a native
 * column.
 *
 * **The tolerance is the vendor's own rounding, not a percentage.** A relative
 * tolerance cannot tell rounding from error at small sizes: `16ER010M`
 * publishes 0.5 mm as `0.02` in, correct to the two decimals it states and
 * 1.6 % off as a ratio. Half a unit in each column's last printed place is
 * exactly the slack the printed precision allows, and it is nowhere near the
 * 7.6 mm a value in the wrong column produces.
 *
 * Returns whether it warned, so a caller can count.
 */
export function checkUnitAgreement(
  row: ScrapedRow,
  label: string,
  what: string,
  warn: Warn = consoleWarn,
): boolean {
  const rawMm = (row[label + UNIT_SUFFIX.millimeters] ?? '').trim()
  const rawIn = (row[label + UNIT_SUFFIX.inches] ?? '').trim()
  const mm = fractionValue(rawMm)
  const inch = fractionValue(rawIn)
  if (mm === null || inch === null) return false

  const slack = halfUlp(rawIn) * convertLength(1, 'inches', 'millimeters') + halfUlp(rawMm)
  const asMm = convertLength(inch, 'inches', 'millimeters')
  if (Math.abs(mm - asMm) <= slack) return false

  warn(
    `  WARNING: ${what}: ${label} disagrees across unit systems — ` +
      `${mm} mm vs ${inch} in (= ${asMm} mm); the native column is used`,
  )
  return true
}

/**
 * One cell as a {@link ContactMode}, refusing a word this package cannot read.
 *
 * A `VendorResponseError` and not an incomplete part: a *blank* contact is the
 * caller's `published` call, and a contact the vendor states in a word nobody
 * has mapped is the vocabulary having moved.
 */
export function contactMode(value: string, what: string): ContactMode {
  if ((CONTACT_MODES as readonly string[]).includes(value)) return value as ContactMode
  throw new VendorResponseError(
    what,
    `contact is ${JSON.stringify(value)} — it must be one of ` + `${CONTACT_MODES.join(', ')}`,
  )
}

/** One cell as a {@link ClampingMode}, on the same terms as {@link contactMode}. */
export function clampingMode(value: string, what: string): ClampingMode {
  if ((CLAMPING_MODES as readonly string[]).includes(value)) return value as ClampingMode
  throw new VendorResponseError(
    what,
    `clamping is ${JSON.stringify(value)} — it must be one of ` + `${CLAMPING_MODES.join(', ')}`,
  )
}

/**
 * One cell as a {@link UnitSystem}, on the same terms as {@link contactMode}.
 *
 * For the vendor that states the unit per row rather than per family: REGO-FIX
 * publishes `PG 25 Ø 6.0 mm` and `PG 25 Ø 1/4"` in one product group, so its
 * collet scrape writes the system it read off each designation into a column.
 */
export function unitSystem(value: string, what: string): UnitSystem {
  if (Object.hasOwn(UNIT_SUFFIX, value)) return value as UnitSystem
  throw new VendorResponseError(
    what,
    `unit is ${JSON.stringify(value)} — it must be one of ` +
      `${Object.keys(UNIT_SUFFIX).sort().join(', ')}`,
  )
}

/** How a record names itself in a warning or a refusal. */
function subject(fields: { catalogNumber: string; materialNumber: string }): string {
  return `${fields.catalogNumber} (${fields.materialNumber})`
}

/**
 * Vendor HTML is a system boundary, so this validates rather than guarding
 * against a caller mistake.
 *
 * The `clamping` discriminant and the fields it implies must agree. **That is
 * what turns Kennametal's missing-bore case into a failed conversion instead of
 * a holder that quietly fits nothing** — a bore-clamping holder with no bore is
 * the exact shape of that bug, and it raises nothing anywhere else.
 */
export function checkHolder(record: HolderRecord): void {
  const what = subject(record)
  const bore = BORE_CLAMPINGS.includes(record.clamping)

  if (bore) {
    if (record.bore === null) {
      throw new IncompletePartError(
        what,
        `publishes no bore, and a ${record.clamping}-clamping holder grips a shank directly`,
      )
    }
    if (record.colletSeries !== null) {
      throw new VendorResponseError(
        what,
        `is ${record.clamping}-clamping and also names collet series ` +
          `${JSON.stringify(record.colletSeries)} — a holder grips one way or the other`,
      )
    }
  } else {
    if (record.colletSeries === null) {
      throw new IncompletePartError(what, 'is collet-clamping and names no collet series')
    }
    if (record.bore !== null) {
      throw new VendorResponseError(
        what,
        `is collet-clamping and also publishes a bore of ${record.bore} — ` +
          `a holder grips one way or the other`,
      )
    }
  }

  // Optional is fine; *malformed* is refused. A consumer renders this as a
  // download button, and a truncated or redirected link is the one failure that
  // looks like a working feature until somebody clicks it. Widened from the
  // reference implementation's `.stp`-only test because MariTool publishes both
  // spellings.
  const url = record.cadModelUrl
  if (url !== null && !/^https:\/\/.+\.ste?p$/i.test(url)) {
    throw new VendorResponseError(
      what,
      `CAD model URL is not an https .stp or .step: ${JSON.stringify(url)}`,
    )
  }

  // The three states of {@link cadModel} reduced to the one pair that cannot be
  // true: a URL nothing looked for. `unspecified` with a null URL is the
  // un-swept case and `vendor-stated` with a null URL is the vendor publishing
  // none, and both are answers a consumer needs — only a link that arrived
  // without a lookup says the record was assembled two different ways.
  if (url !== null && record.cadModelSource === UNSPECIFIED) {
    throw new ScraperConfigError(
      what,
      `carries a CAD model URL and calls its source ${UNSPECIFIED}`,
    )
  }
}

/**
 * The same boundary rule for a collet.
 *
 * A collet with no capacity would match every shank or none depending on which
 * way a comparison read a null, which is why {@link ColletRecord.clampMin} and
 * {@link ColletRecord.clampMax} are not nullable and the mapper refuses the row
 * before it gets here.
 */
export function checkCollet(record: ColletRecord): void {
  const what = subject(record)

  // Equality is a sealed coolant-through collet clamping one exact size — real,
  // and not a bug. Only an inverted range is impossible.
  if (record.clampMin > record.clampMax) {
    throw new VendorResponseError(
      what,
      `capacity is inverted: ${record.clampMin} > ${record.clampMax}`,
    )
  }

  // In the native unit, which is the gate with teeth: these are the values a
  // consumer compares, and the contradictory cells this catalog knows about all
  // sit in the column `dim` ignores.
  //
  // The slack is {@link NOMINAL_SLACK}, because a designation is not a
  // measurement — see that constant for the fourteen rows it exists for and the
  // margin either side of it. Unit-free, so it needs no conversion.
  if (
    record.nominal !== null &&
    (record.nominal < record.clampMin * (1 - NOMINAL_SLACK) ||
      record.nominal > record.clampMax * (1 + NOMINAL_SLACK))
  ) {
    throw new VendorResponseError(
      what,
      `nominal ${record.nominal} is outside its own capacity ` +
        `${record.clampMin}-${record.clampMax}`,
    )
  }

  // A tap's square across flats is inscribed in its shank, so it is smaller
  // than the bore that takes it — true on all 96 rows of both Kennametal tap
  // families. A square at or past the clamping diameter is the inch cell in the
  // metric column or two labels swapped, which is the failure `dim`'s native
  // read cannot see and `checkUnitAgreement` only reports.
  if (record.squareSize !== null && record.squareSize >= record.clampMax) {
    throw new VendorResponseError(
      what,
      `square size ${record.squareSize} is not smaller than the ` +
        `${record.clampMax} it clamps — a square is inscribed in the shank`,
    )
  }
}

/**
 * The nullable holder fields a mapper may leave out — and must then declare in
 * {@link HolderRecord.unpublished}.
 *
 * They stay **required on the type** so a consumer reading a record never
 * handles `undefined`; only the construction is optional, which is the shape
 * `records.toolRecord` already has. Leaving one out was free until this
 * contract, and the prose here said why that was a risk without doing anything
 * about it — *writing `usableLength: null` five times in an adapter is how a
 * null becomes a default nobody notices.* The declaration is the check that
 * prose was asking for.
 */
export type OptionalHolderField =
  | 'colletSeries'
  | 'bore'
  | 'usableLength'
  | 'clampingLength'
  | 'adjustmentRange'
  | 'bodyDiameter'
  | 'lockNutDiameter'
  | 'cadModelUrl'
  | 'cadDxfUrl'

/** Every {@link OptionalHolderField}, for the same reason {@link CLAMPING_MODES} is a list. */
export const OPTIONAL_HOLDER_FIELDS: readonly OptionalHolderField[] = [
  'colletSeries',
  'bore',
  'usableLength',
  'clampingLength',
  'adjustmentRange',
  'bodyDiameter',
  'lockNutDiameter',
  'cadModelUrl',
  'cadDxfUrl',
]

/**
 * Refuse a mapper whose declaration and whose supplied fields disagree.
 *
 * A `ScraperConfigError` and not a `VendorResponseError`, because both states
 * it refuses are this package's fault rather than the vendor's: an adapter that
 * omitted a field without saying the vendor publishes no column for it, or one
 * that said so and then supplied a value anyway. Neither is a row that can be
 * skipped past — the claim is constant down a whole table, so the first part
 * through carries the same fault as the last.
 *
 * Supplying `null` for a declared field is redundant rather than wrong and is
 * allowed: it is the same claim twice, where a *value* is the opposite claim.
 */
function checkUnpublished(
  what: string,
  declared: readonly string[],
  optional: readonly string[],
  fields: Readonly<Record<string, unknown>>,
): void {
  const stated = new Set(declared)

  for (const name of stated) {
    if (!optional.includes(name)) {
      throw new ScraperConfigError(
        what,
        `declares ${name} unpublished, which is not one of ${optional.join(', ')}`,
      )
    }
    const value = fields[name]
    if (value !== undefined && value !== null) {
      throw new ScraperConfigError(
        what,
        `declares the vendor publishes no ${name} and supplied ${JSON.stringify(value)}`,
      )
    }
  }

  for (const name of optional) {
    if (fields[name] === undefined && !stated.has(name)) {
      throw new ScraperConfigError(
        what,
        `left ${name} out without declaring that the vendor publishes no column ` +
          `for it — a null nobody declared is a null nobody can read`,
      )
    }
  }
}

/** What a mapper supplies to build a holder; the rest is derived or minted. */
type HolderFields = Omit<
  HolderRecord,
  'kind' | 'guid' | 'vendor' | 'productLink' | 'boreMm' | 'gaugeLengthMm' | OptionalHolderField
> &
  Partial<Pick<HolderRecord, OptionalHolderField>>

/**
 * Build a {@link HolderRecord}: mint its guid, derive its millimetre twins, and
 * refuse the states that cannot be true.
 *
 * `guid`, `vendor` and `productLink` are not inputs at all — every adapter
 * minting them would be three copies of `recordGuid(brand, materialNumber)` to
 * drift, on the value that is the join key for every downstream consumer. The
 * nullable dimensions stay **required on the type** so a consumer reading a
 * record never handles `undefined`; only the construction is optional, which is
 * the shape `records.toolRecord` already has.
 *
 * The result is frozen: a record is an interchange value, and a mapper that
 * mutated one would be reaching back across the seam this type exists to draw.
 */
export function holderRecord(fields: HolderFields): HolderRecord {
  checkUnpublished(
    `the ${fields.brand} holder mapper`,
    fields.unpublished,
    OPTIONAL_HOLDER_FIELDS,
    fields,
  )

  // `Object.freeze` below is shallow, and every record of a family shares this
  // one array — an adapter's module constant. Frozen in place rather than
  // copied: a copy per record is an allocation per part for a value that is the
  // same list every time, and the array a mapper declared is not one anything
  // should be editing afterwards either.
  Object.freeze(fields.unpublished)

  const record: HolderRecord = Object.freeze({
    ...fields,
    kind: 'holder' as const,
    guid: recordGuid(fields.brand, fields.materialNumber),
    vendor: BRANDS[fields.brand].vendor,
    productLink: productLink(fields.brand, fields.materialNumber),
    colletSeries: fields.colletSeries ?? null,
    bore: fields.bore ?? null,
    boreMm: millimeters(fields.bore ?? null, fields.unit),
    gaugeLengthMm: millimeters(fields.gaugeLength, fields.unit),
    usableLength: fields.usableLength ?? null,
    clampingLength: fields.clampingLength ?? null,
    adjustmentRange: fields.adjustmentRange ?? null,
    bodyDiameter: fields.bodyDiameter ?? null,
    lockNutDiameter: fields.lockNutDiameter ?? null,
    cadModelUrl: fields.cadModelUrl ?? null,
    cadDxfUrl: fields.cadDxfUrl ?? null,
  })

  checkHolder(record)
  return record
}

/** The same, for a collet. */
export type OptionalColletField =
  | 'nominal'
  | 'bodyDiameter'
  | 'functionalLength'
  | 'overallLength'
  | 'clampingLength'
  | 'tapRange'
  | 'squareSize'

/** Every {@link OptionalColletField}, for the same reason {@link CLAMPING_MODES} is a list. */
export const OPTIONAL_COLLET_FIELDS: readonly OptionalColletField[] = [
  'nominal',
  'bodyDiameter',
  'functionalLength',
  'overallLength',
  'clampingLength',
  'tapRange',
  'squareSize',
]

/** What a mapper supplies to build a collet. */
type ColletFields = Omit<
  ColletRecord,
  | 'kind'
  | 'guid'
  | 'vendor'
  | 'productLink'
  | 'clampMinMm'
  | 'clampMaxMm'
  | 'clampingLengthMm'
  | OptionalColletField
> &
  Partial<Pick<ColletRecord, OptionalColletField>>

/** Build a {@link ColletRecord}, on the same terms as {@link holderRecord}. */
export function colletRecord(fields: ColletFields): ColletRecord {
  checkUnpublished(
    `the ${fields.brand} collet mapper`,
    fields.unpublished,
    OPTIONAL_COLLET_FIELDS,
    fields,
  )

  // `Object.freeze` below is shallow, and every record of a family shares this
  // one array — an adapter's module constant. Frozen in place rather than
  // copied: a copy per record is an allocation per part for a value that is the
  // same list every time, and the array a mapper declared is not one anything
  // should be editing afterwards either.
  Object.freeze(fields.unpublished)

  const record: ColletRecord = Object.freeze({
    ...fields,
    kind: 'collet' as const,
    guid: recordGuid(fields.brand, fields.materialNumber),
    vendor: BRANDS[fields.brand].vendor,
    productLink: productLink(fields.brand, fields.materialNumber),
    nominal: fields.nominal ?? null,
    clampMinMm: millimeters(fields.clampMin, fields.unit),
    clampMaxMm: millimeters(fields.clampMax, fields.unit),
    bodyDiameter: fields.bodyDiameter ?? null,
    functionalLength: fields.functionalLength ?? null,
    overallLength: fields.overallLength ?? null,
    clampingLength: fields.clampingLength ?? null,
    clampingLengthMm: millimeters(fields.clampingLength ?? null, fields.unit),
    tapRange: fields.tapRange ?? null,
    squareSize: fields.squareSize ?? null,
  })

  checkCollet(record)
  return record
}
