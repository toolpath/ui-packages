/**
 * MariTool's toolholding column vocabulary, and nothing else.
 *
 * The vendor at the far end of the range this package covers: where Kennametal
 * states a holder's taper, contact, clamping mode, style and unit as five
 * per-family constants, MariTool states every one of them per part.
 * `families/maritool.ts` declares **no facts at all** for exactly that reason —
 * each CSV is one spindle taper holding three clamping styles, the HSK file
 * holds nine sizes, and `Gage Length` is metric on some parts and imperial on
 * others inside one category page. So this mapper reads columns where the
 * Kennametal one reads facts, and the record shape is the same either way.
 *
 * ## The record's unit comes from the gage length
 *
 * `scrape.holderRow` promotes `Gage Length` into the `conventions.GAGE_COLUMNS`
 * pair with **exactly one cell filled**, and which one is filled is the only
 * statement about unit system this vendor makes per part. That is what
 * {@link HOLDING_MAPPERS} reads, and a row with both cells filled is refused
 * rather than resolved: it would mean the scraper had changed shape, and
 * picking one would hide that.
 *
 * ## `Shank Size` is the bore, and a bare cell is inches
 *
 * MariTool publishes no `D1`. Its shrink-fit and hydraulic holders state the
 * shank they take under the vendor's own `Shank Size` label, which
 * `scrape.holderRow` carries verbatim and unsuffixed — the adapter deliberately
 * does not promote it, because a promoted column carries a unit suffix and
 * these families declare no unit for one to be taken from.
 *
 * The cell takes three shapes across the 293 non-collet holders in the catalog,
 * and {@link parseShankSize} reads all three: `.500`, `10mm`, and
 * `.1181 (3mm)` — a decimal inch with the vendor's own metric annotation beside
 * it. **A cell that names no unit is inches**, which is a claim about this
 * vendor and worth the evidence: every bare value published is a fractional
 * inch size (`.125`, `.1875`, `.250`, `.3125`, `.375`, `.4375`, `.500`, `.625`,
 * `.750`, `1.0`, `1.25`, `1.5`), and the annotated form proves the reading —
 * `.1181` is 3 mm in inches, to four places. One part in the catalog states a
 * bare inch shank on a holder gaged in millimetres (`HSK40E-SF.125-45`), which
 * is converted rather than warned about: the record's unit is itself promoted
 * off another cell here, so the two disagreeing is this vendor's shape rather
 * than a fault.
 *
 * ## Two published columns this does not carry
 *
 * - **`Nose Diameter`**, on 200-odd parts. It measures the holder's nose and
 *   `bodyDiameter` is `D2`, the body — promoting one into a field named for the
 *   other is precisely the collision `conventions` warns about at length. It
 *   also mixes `.870` with `.870 inches` in one column, which is a second
 *   reason to leave it as the receipt of what the vendor said.
 * - **`Collet Grip Range`.** `scrape.holderRow` says why: it is the ER series'
 *   range restated on the holder's page, a pure function of `Collet Size`, and
 *   a real capacity comes from a collet family joined on `CST`.
 */

import {
  CAD_DXF_COLUMN,
  COLLET_SERIES_COLUMN,
  CONTACT_COLUMN,
  DESCRIPTION_COLUMN,
  GAGE_COLUMNS,
  type UnitSystem,
} from '../../conventions.js'
import { IncompletePartError, VendorResponseError } from '../../errors.js'
import { familyBrand, type BoundToolholding } from '../../family.js'
import {
  asUnit,
  cadModel,
  clampingMode,
  contactMode,
  holderRecord,
  published,
  type HolderRecord,
  type HoldingMappers,
  type OptionalHolderField,
} from '../../holding.js'
import { fractionValue } from '../../measure.js'
import type { ScrapedRow } from '../../scrape.js'
import { CLAMPING_COLUMN, MATERIAL_COLUMN, STYLE_COLUMN, TAPER_COLUMN } from './scrape.js'

/** MariTool's own label for the cell {@link parseShankSize} reads a bore from. */
export const SHANK_SIZE_LABEL = 'Shank Size'

/**
 * MariTool's own label for the lock-nut diameter — `D11`, on five parts.
 *
 * Carried where `Nose Diameter` is not, because this one names exactly what the
 * record's field names: the outside diameter of the collet nut, which is what
 * decides whether a holder clears a fixture.
 */
export const COLLET_NUT_DIAMETER_LABEL = 'Collet Nut Outside Diameter'

/**
 * A `Shank Size` cell: a decimal, an optional unit, an optional annotation.
 *
 * The annotation is captured only so it can be dropped — it is the vendor's own
 * conversion of the same dimension (`.1181 (3mm)`), not a second measurement,
 * and reading it would put two sizes on one holder.
 *
 * `inches` leads the unit alternation because a regex alternation is ordered and
 * `in` would otherwise match the first two letters of `inches` and leave `ches`
 * unmatched — the same trap `parseGageLength` documents.
 */
const SHANK_SIZE = /^(?<value>\d*\.?\d+)\s*(?<unit>mm|inches|inch|in)?\s*(?:\([^)]*\))?$/i

/** One cell as a diameter and the system it is stated in. Null where unreadable. */
export function parseShankSize(cell: string): { value: number; stated: UnitSystem } | null {
  const parsed = SHANK_SIZE.exec(cell.trim())?.groups
  if (parsed === undefined) return null

  const value = fractionValue(parsed['value'] ?? '')
  if (value === null || value <= 0) return null

  const unit = (parsed['unit'] ?? '').toLowerCase()
  return { value, stated: unit === 'mm' ? 'millimeters' : 'inches' }
}

/** How a part names itself in a warning or a refusal. */
function subject(row: ScrapedRow): string {
  return `${row[MATERIAL_COLUMN] ?? ''} (${row[DESCRIPTION_COLUMN] ?? ''})`
}

/** The gage length and, with it, the unit system this record is in. */
function gage(row: ScrapedRow, what: string): { unit: UnitSystem; gaugeLength: number } {
  const inches = fractionValue(row[GAGE_COLUMNS.inches] ?? '')
  const millimeters = fractionValue(row[GAGE_COLUMNS.millimeters] ?? '')

  if (inches !== null && millimeters !== null) {
    throw new VendorResponseError(
      what,
      `publishes a gage length in both unit columns (${inches} in and ` +
        `${millimeters} mm) — the scrape fills exactly one, and which one is ` +
        `filled is the only unit system this vendor states per part`,
    )
  }
  if (inches !== null) return { unit: 'inches', gaugeLength: inches }
  if (millimeters !== null) return { unit: 'millimeters', gaugeLength: millimeters }
  throw new IncompletePartError(what, 'publishes no gage length in either unit column')
}

/** One of MariTool's own unsuffixed diameter cells, in `unit`. */
function diameter(row: ScrapedRow, label: string, unit: UnitSystem, what: string): number | null {
  const cell = (row[label] ?? '').trim()
  if (cell === '') return null

  const measured = parseShankSize(cell)
  if (measured === null) {
    throw new VendorResponseError(
      what,
      `${label} is ${JSON.stringify(cell)}, which is not a diameter this ` +
        `package can read — add its shape to SHANK_SIZE once it is clear what ` +
        `the vendor means by it`,
    )
  }
  return asUnit(measured.value, measured.stated, unit)
}

/**
 * What MariTool's listings publish no column for.
 *
 * A MariTool product listing is a price, a part number and the two or three
 * dimensions a buyer picks by — it is not a DIN 4000 datasheet, and there is no
 * page anywhere on the site carrying L2, L9, V or D2 for these parts. So these
 * four nulls are the vendor's, constant down all 527 rows, and a consumer is
 * right to read them as "MariTool does not say" rather than as "not measured".
 *
 * `bore` and `lockNutDiameter` are **not** here: the listings do publish
 * `Shank Size` and a collet-nut diameter, and the four holders whose shank cell
 * is blank are four blank cells rather than a missing column.
 */
const HOLDER_UNPUBLISHED: readonly OptionalHolderField[] = [
  'usableLength',
  'clampingLength',
  'adjustmentRange',
  'bodyDiameter',
]

/** One MariTool holder row -> one {@link HolderRecord}. */
function holder(row: ScrapedRow, family: BoundToolholding): HolderRecord {
  const what = subject(row)
  const { unit, gaugeLength } = gage(row, what)
  const material = published(row[MATERIAL_COLUMN], what, 'part number')

  return holderRecord({
    brand: familyBrand(family),
    materialNumber: material,
    // MariTool publishes one number per part and no second catalog designation
    // — `conventions.IDENTITY_DEVIATIONS` records why, and inventing one here
    // would put a column in the record the vendor does not publish. The part
    // number is what a human orders by, so it is both.
    catalogNumber: material,
    description: row[DESCRIPTION_COLUMN] ?? '',
    unit,
    // One part in the catalog, `BT40-ER32-60`, publishes no `Taper` cell at all,
    // and `scrape.holderRow` leaves both columns empty rather than inferring one
    // from the part number. It becomes no record and a warning, which is the
    // same call a cutting tool with no overall length gets.
    taper: published(row[TAPER_COLUMN], what, 'taper'),
    contact: contactMode(published(row[CONTACT_COLUMN], what, 'contact mode'), what),
    clamping: clampingMode(published(row[CLAMPING_COLUMN], what, 'clamping mode'), what),
    style: published(row[STYLE_COLUMN], what, 'style'),
    colletSeries: row[COLLET_SERIES_COLUMN] || null,
    bore: diameter(row, SHANK_SIZE_LABEL, unit, what),
    gaugeLength,
    lockNutDiameter: diameter(row, COLLET_NUT_DIAMETER_LABEL, unit, what),
    // Written by the scrape itself rather than by a second pass, so every row is
    // answered and `holding.cadModel` reads `vendor-stated` on all of them.
    ...cadModel(row),
    cadDxfUrl: row[CAD_DXF_COLUMN] || null,
    unpublished: HOLDER_UNPUBLISHED,
  })
}

/**
 * The toolholding half of the adapter contract `registry` looks up by brand.
 *
 * Holders only: MariTool sells collets and this package does not scrape them,
 * so there is no `collet` mapper and `registry.toHolding` refuses a request for
 * one naming what this brand does map. A partial table is the honest state for
 * a kind nobody has read the columns of.
 */
export const HOLDING_MAPPERS: HoldingMappers = { holder }
