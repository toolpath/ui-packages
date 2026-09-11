/**
 * Kennametal's and WIDIA's toolholding column vocabulary, and nothing else.
 *
 * The counterpart of `records.ts` for a holder and a collet: every decision
 * about *what a record is* lives in `holding.ts`, and what lives here is which
 * of this vendor's columns answers each question. That is the same line
 * `vendors/kennametal/records.ts` draws for cutting tools.
 *
 * ## What this platform states as a fact rather than a column
 *
 * Almost everything. `taper`, `contact`, `clamping` and `style` are per-family
 * constants here, declared in `families/kennametal.ts` with a citation each,
 * because Kennametal sells one interface and one clamping mode per family — its
 * dual-contact BT30 is a separate line (BTKV\*) with its own family code. The two
 * vendors whose holders vary row by row are the ones whose mappers read a column
 * instead.
 *
 * **`unit` is the exception, and it moved.** A holder family routinely sells
 * metric and inch bores from one table, and the vendor says which a part is in
 * the part's own catalog number rather than in any column — see {@link rowUnit}.
 * A collet family does not do this, so `collet` below still reads the fact.
 *
 * ## Two published columns this deliberately does not carry
 *
 * - **`L1FC`**, the BTKV30 line's "Gage Length Face Contact", 0.998 mm shorter
 *   than `L1` on every row. It is not a second measurement of one thing: it is
 *   the gage length *in a face-contact spindle*, so which of the two is true is
 *   a fact about the machine rather than about the holder. Carrying both would
 *   put two numbers named "gage" on one record with nothing to say which one
 *   stickout arithmetic should use. `contact` records that the holder has the
 *   geometry; `gaugeLength` stays `L1`. Promote it the day something reads a
 *   spindle's contact mode, and change `gaugeLength` with it rather than
 *   showing both.
 * - **Torque figures, actuation-screw drive size, weight and `D21`.** Published,
 *   and dropped under `records.ToolRecord`'s standing rule: add a field when
 *   something displays it, not before.
 */

import {
  COLLET_DESIGNATION_COLUMN,
  COLLET_SERIES_COLUMN,
  dimensionalColumn,
  type UnitSystem,
} from '../../conventions.js'
import { familyBrand, type BoundToolholding } from '../../family.js'
import {
  cadModel,
  checkUnitAgreement,
  clampingMode,
  colletRecord,
  contactMode,
  dim,
  holderRecord,
  holdingFact,
  published,
  type ColletRecord,
  type HolderRecord,
  type HoldingMappers,
  type OptionalColletField,
  type OptionalHolderField,
} from '../../holding.js'
import { consoleWarn, type ScrapedRow, type Warn } from '../../scrape.js'
import { CATALOG_NUMBER, MATERIAL_NUMBER } from './records.js'

/**
 * The dimensional labels whose two unit columns are worth cross-checking.
 *
 * Every dimension either record carries, and no more: a label nothing reads
 * cannot produce a wrong number, so warning about it is noise. `holding.dim`
 * reads the native column and never the other one, which is what makes this a
 * report rather than a gate.
 */
const HOLDER_LABELS = ['D1', 'L1', 'L2', 'L9', 'V', 'D2', 'D11'] as const
const COLLET_LABELS = ['CCCN', 'CCCX', 'D1', 'BDX', 'LF', 'L', 'L9', 'S10'] as const

/**
 * The square drive a tap collet's bore carries, across flats.
 *
 * Kennametal's own label, and it is what tells a tap collet from a round one —
 * see {@link colletCapacity}. Local to this adapter rather than in
 * `conventions.ts` for the reason that module states: a column two vendors
 * write is neutral, and this one is published by Kennametal's tap families and
 * by nothing else in the catalog.
 */
const SQUARE_LABEL = 'S10'

/** The vendor's own designation of the taps a tap collet is for. */
const TAP_RANGE_LABEL = 'Tap Range'

/** How a part names itself in a warning or a refusal. */
function subject(row: ScrapedRow): string {
  return `${row[CATALOG_NUMBER] ?? ''} (${row[MATERIAL_NUMBER] ?? ''})`
}

/**
 * The `M` Kennametal writes into a catalog number after a metric size.
 *
 * `CVKV50HPVTT06M350` is a 6 **mm** bore on a 350 mm projection; `BT30ER11060M`
 * is an ER11 at 60 mm; `CV40ZTTHT050275` is a 0.500 in bore at 2.75 in and
 * carries no `M` at all. So the marker is a digit run followed by `M`, and it
 * sits mid-number as often as it sits at the end.
 */
const METRIC_MARKER = /\dM/

/**
 * Which system a holder row is designated in, from the vendor's own catalog
 * number.
 *
 * **Per row, and this is the one vendor fact that can be.** `HoldingIdentity.unit`
 * has always been per record; what was per *family* was Kennametal's answer to
 * it, and `families/kennametal.ts` recorded that `100017036` publishes seven
 * metric bores and six fractional ones under one code — split by hand into two
 * CSVs, with the note that a third such family should end the splitting and make
 * this a per-record fact. The holder walk found far more than a third: **21 of the
 * 158 families** under the six spindle interfaces mix the two systems in one
 * table, and no title, category or column tells them apart.
 *
 * The catalog number does, and it is a **vendor statement** rather than a
 * measurement heuristic. Across the 1,192 holder rows in scope, 858 publish a
 * `D1` pair that settles the question on its own — an inch bore is an exact 64th,
 * a metric one a whole or half millimetre — and this agrees with **all 858**, with
 * no disagreement anywhere (JG 2026-09-09). It then decides the 131 rows a `D1`
 * cannot settle — mostly inch parts published in millimetres only, where the one
 * column is the conversion: `HSK63ASFTT050276` is 12.7 mm, which is a half inch
 * — and the 203 rows that publish no `D1` at all, which are the collet chucks,
 * gripping through a collet rather than on a bore. There the number still
 * answers, because `BT30ER16060M` is a 60 mm projection.
 *
 * The family's `unit` fact stays, and stays required: it is what a family with no
 * dimensional catalog number at all still declares, and what says which system
 * the family is *catalogued* in when somebody reads the config rather than a row.
 */
function rowUnit(row: ScrapedRow, family: BoundToolholding): UnitSystem {
  const catalogNumber = row[CATALOG_NUMBER]
  if (catalogNumber === undefined || catalogNumber === '') {
    return holdingFact(family, 'unit', family.unit)
  }
  return METRIC_MARKER.test(catalogNumber) ? 'millimeters' : 'inches'
}

/** One Kennametal or WIDIA holder row -> one {@link HolderRecord}. */
function holder(
  row: ScrapedRow,
  family: BoundToolholding,
  options: { warn?: Warn } = {},
): HolderRecord {
  const warn = options.warn ?? consoleWarn
  const what = subject(row)
  const unit = rowUnit(row, family)

  for (const label of HOLDER_LABELS) checkUnitAgreement(row, label, what, warn)

  // Kennametal publishes no description column for toolholding, and `''` is the
  // honest answer where a vendor publishes none — `records.ToolRecord.description`
  // states the rule and the reason: a description that restates the catalog
  // number puts one string in two fields.
  return holderRecord({
    brand: familyBrand(family),
    materialNumber: published(row[MATERIAL_NUMBER], what, 'material number'),
    catalogNumber: published(row[CATALOG_NUMBER], what, 'catalog number'),
    description: '',
    unit,
    taper: holdingFact(family, 'taper', family.taper),
    contact: contactMode(holdingFact(family, 'contact', family.contact), what),
    clamping: clampingMode(holdingFact(family, 'clamping', family.clamping), what),
    style: holdingFact(family, 'style', family.style),
    colletSeries: row[COLLET_SERIES_COLUMN] || null,
    bore: dim(row, 'D1', unit),
    gaugeLength: published(dim(row, 'L1', unit), what, 'L1 gage length'),
    usableLength: dim(row, 'L2', unit),
    clampingLength: dim(row, 'L9', unit),
    adjustmentRange: dim(row, 'V', unit),
    bodyDiameter: dim(row, 'D2', unit),
    lockNutDiameter: dim(row, 'D11', unit),
    // Whether the models were looked up at all is `holding.cadModel`'s answer
    // and not this adapter's: Kennametal publishes no CAD link on a family page,
    // so `conventions.CAD_COLUMN` arrives only from the separate `cad` pass and
    // an un-swept family is blank for a reason that is not the vendor's.
    ...cadModel(row),
    unpublished: HOLDER_UNPUBLISHED,
  })
}

/**
 * A collet's clamping capacity, from whichever pair of columns the family
 * publishes.
 *
 * The ER collet families state `CCCN`/`CCCX` and that is what is read. **The
 * tap families state neither**, and they are not incomplete rows: a square-drive
 * collet holds one exact shank, and `D1` is it — `16ERTC025` publishes 6.477 mm,
 * which is 0.255 in, the ANSI shank of a 1/4-20 tap. So the honest capacity is a
 * zero-width band at `D1`, the same shape a sealed coolant-through collet
 * already carries and `holding.checkCollet` already permits.
 *
 * Keyed on the vendor publishing a **square size** rather than on the family's
 * `style` string: the square is Kennametal saying this part drives a tap, and a
 * style is this package's config. A tap family that started publishing a real
 * band would simply be read from it, which is the right answer either way.
 */
function colletCapacity(
  row: ScrapedRow,
  what: string,
  unit: Parameters<typeof dim>[2],
): { clampMin: number; clampMax: number } {
  const min = dim(row, 'CCCN', unit)
  const max = dim(row, 'CCCX', unit)
  if (min !== null || max !== null || dim(row, SQUARE_LABEL, unit) === null) {
    return {
      clampMin: published(min, what, 'CCCN clamping minimum'),
      clampMax: published(max, what, 'CCCX clamping maximum'),
    }
  }

  const exact = published(dim(row, 'D1', unit), what, 'D1 clamping diameter')
  return { clampMin: exact, clampMax: exact }
}

/**
 * What this platform's holder tables publish no column for.
 *
 * One entry, and it is the 2D profile: a Kennametal holder page offers a STEP
 * model and no DXF, so a `CAD_DXF_URL` column would be a claim about the data
 * and false — the call `conventions.CAD_DXF_COLUMN` records. Everything else a
 * holder can state, these tables state.
 */
const HOLDER_UNPUBLISHED: readonly OptionalHolderField[] = ['cadDxfUrl']

/** The collet tables publish every optional column, so this declares nothing. */
const COLLET_UNPUBLISHED: readonly OptionalColletField[] = []

/** One Kennametal or WIDIA collet row -> one {@link ColletRecord}. */
function collet(
  row: ScrapedRow,
  family: BoundToolholding,
  options: { warn?: Warn } = {},
): ColletRecord {
  const warn = options.warn ?? consoleWarn
  const what = subject(row)
  const unit = holdingFact(family, 'unit', family.unit)

  for (const label of COLLET_LABELS) checkUnitAgreement(row, label, what, warn)

  return colletRecord({
    brand: familyBrand(family),
    materialNumber: published(row[MATERIAL_NUMBER], what, 'material number'),
    catalogNumber: published(row[CATALOG_NUMBER], what, 'catalog number'),
    description: '',
    unit,
    series: published(row[COLLET_DESIGNATION_COLUMN], what, 'collet series'),
    style: holdingFact(family, 'style', family.style),
    nominal: dim(row, 'D1', unit),
    ...colletCapacity(row, what, unit),
    bodyDiameter: dim(row, 'BDX', unit),
    functionalLength: dim(row, 'LF', unit),
    overallLength: dim(row, 'L', unit),
    clampingLength: dim(row, 'L9', unit),
    // Verbatim, in the family's own unit, and never converted: it is two thread
    // designations rather than a dimension. The metric families print it in the
    // metric column and the ANSI ones in the inch column, and a row where the
    // vendor filled neither says nothing rather than the wrong one.
    tapRange: row[dimensionalColumn(TAP_RANGE_LABEL, unit)] || null,
    squareSize: dim(row, SQUARE_LABEL, unit),
    unpublished: COLLET_UNPUBLISHED,
  })
}

/** The toolholding half of the adapter contract `registry` looks up by brand. */
export const HOLDING_MAPPERS: HoldingMappers = { holder, collet }
