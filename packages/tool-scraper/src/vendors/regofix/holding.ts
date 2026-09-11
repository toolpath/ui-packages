/**
 * REGO-FIX's toolholding column vocabulary, and nothing else.
 *
 * Two things about this vendor decide the shape of what is below, and both are
 * the reverse of Kennametal's:
 *
 * - **`contact` is a column, not a family fact.** REGO-FIX publishes plain and
 *   dual-contact powRgrip in one product group — `BT 30 / PG 25 x 080 H` and
 *   `BT+ 30 / PG 25 x 080 H` are two rows of one table — so `scrape.holderRow`
 *   resolves it from the vendor's own `form_name` and writes
 *   `conventions.CONTACT_COLUMN`. `families/regofix.ts` deliberately declares no
 *   `contact` fact, and reading one here would silently mask a scrape that lost
 *   the column.
 * - **`unit` is a column on a collet.** Every one of the twelve PG groups holds
 *   metric and fractional-inch collets side by side, so there is no
 *   family-level answer to declare, and none of the collet families declares
 *   one.
 *
 * ## What a powRgrip holder does not publish
 *
 * No `D1`. A powRgrip holder clamps through a PG collet, and a collet-clamping
 * holder that also carried a bore would be claiming two ways of gripping one
 * tool — `scrape.holderRow` says so, and `holding.checkHolder` refuses it.
 *
 * No `L2`, `L9`, `V` or `D11` either: the DIN 4000 documents publish `A2`, `B1`
 * and `B2`, whose meaning is not stated anywhere this package has been able to
 * check, and they stay behind `conventions.DIN_PREFIX` rather than being guessed
 * at. `B3`, the projection length, *is* pinned and understood — it is the
 * `x 050` of the designation — and it is still not on the record, under
 * `records.ToolRecord`'s standing rule that a field arrives when something
 * displays it.
 */

import {
  COLLET_DESIGNATION_COLUMN,
  COLLET_SERIES_COLUMN,
  CONTACT_COLUMN,
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
  unitSystem,
  type ColletRecord,
  type HolderRecord,
  type HoldingMappers,
  type OptionalColletField,
  type OptionalHolderField,
} from '../../holding.js'
import { consoleWarn, type ScrapedRow, type Warn } from '../../scrape.js'

/** The identity columns this vendor adopted from Kennametal, being second. */
const MATERIAL_NUMBER = 'Material Number'
const CATALOG_NUMBER = 'ISO Catalog Number'

/**
 * The column `scrape.colletRow` writes the system it read off a designation to.
 *
 * REGO-FIX's own, and not a convention: it is the only vendor here that states
 * a unit per row, so there is no second writer for the name to be shared with.
 */
const UNIT_COLUMN = 'unit'

/** How a part names itself in a warning or a refusal. */
function subject(row: ScrapedRow): string {
  return `${row[CATALOG_NUMBER] ?? ''} (${row[MATERIAL_NUMBER] ?? ''})`
}

/**
 * What REGO-FIX's holder documents publish no column for.
 *
 * A powRgrip holder is collet-clamping and nothing else in this catalog, so the
 * DIN 4000 document states a PG series where another vendor's table states a
 * bore — `bore` is absent because there is no such column to read, and
 * `holding.checkHolder` separately refuses a bore on a collet holder, which is
 * the same fact arriving from the other side.
 *
 * The vendor publishes a technical drawing per part and no DXF, and no L2, L9,
 * V or D11 anywhere a scrape can reach.
 */
const HOLDER_UNPUBLISHED: readonly OptionalHolderField[] = [
  'bore',
  'usableLength',
  'clampingLength',
  'adjustmentRange',
  'lockNutDiameter',
  'cadDxfUrl',
]

/**
 * What REGO-FIX's collet documents publish no column for.
 *
 * Six, and the prose this replaces said seven: `holding.ColletRecord`'s factory
 * called these "the seven REGO-FIX publishes none of" while the mapper below has
 * read `nominal` out of `D1` since it was written. A comment could not notice
 * that; this is checked against what the mapper supplies.
 */
const COLLET_UNPUBLISHED: readonly OptionalColletField[] = [
  'bodyDiameter',
  'functionalLength',
  'overallLength',
  'clampingLength',
  'tapRange',
  'squareSize',
]

/** One powRgrip holder row -> one {@link HolderRecord}. */
function holder(row: ScrapedRow, family: BoundToolholding): HolderRecord {
  const what = subject(row)
  const unit = holdingFact(family, 'unit', family.unit)

  return holderRecord({
    brand: familyBrand(family),
    materialNumber: published(row[MATERIAL_NUMBER], what, 'material number'),
    // The designation REGO-FIX titles the part with — `BT 30 / PG 25 x 080 H`.
    // It is the catalog number and not a description: the vendor publishes no
    // prose about a holder anywhere, so `description` is `''`.
    catalogNumber: published(row[CATALOG_NUMBER], what, 'catalog number'),
    description: '',
    unit,
    taper: holdingFact(family, 'taper', family.taper),
    contact: contactMode(published(row[CONTACT_COLUMN], what, 'contact mode'), what),
    clamping: clampingMode(holdingFact(family, 'clamping', family.clamping), what),
    style: holdingFact(family, 'style', family.style),
    colletSeries: row[COLLET_SERIES_COLUMN] || null,
    gaugeLength: published(dim(row, 'L1', unit), what, 'L1 gage length'),
    bodyDiameter: dim(row, 'D2', unit),
    // The ProductFinder index carries the CDN link on the part itself, so the
    // column is written by the scrape and every row is answered.
    ...cadModel(row),
    unpublished: HOLDER_UNPUBLISHED,
  })
}

/** One PG or PGST collet row -> one {@link ColletRecord}. */
function collet(
  row: ScrapedRow,
  family: BoundToolholding,
  options: { warn?: Warn } = {},
): ColletRecord {
  const warn = options.warn ?? consoleWarn
  const what = subject(row)
  const unit = unitSystem(published(row[UNIT_COLUMN], what, 'unit system'), what)

  // An inch collet carries both columns, because `scrape.colletRow` projects the
  // exact fraction from the designation into millimetres. Cross-checking them is
  // therefore checking this package's own arithmetic as much as the vendor's,
  // which is worth doing once per row and costs nothing when they agree.
  for (const label of ['D1', 'CCCN', 'CCCX']) checkUnitAgreement(row, label, what, warn)

  return colletRecord({
    brand: familyBrand(family),
    materialNumber: published(row[MATERIAL_NUMBER], what, 'material number'),
    catalogNumber: published(row[CATALOG_NUMBER], what, 'catalog number'),
    description: '',
    unit,
    // Written exactly as the vendor designates it, so a `PGST15` collet matches
    // no `PG25` holder. `families/regofix.ts` records why that is the
    // conservative direction and how to resolve it — by asking REGO-FIX, not by
    // widening the string.
    series: published(row[COLLET_DESIGNATION_COLUMN], what, 'collet series'),
    style: holdingFact(family, 'style', family.style),
    nominal: dim(row, 'D1', unit),
    // A powRgrip collet clamps one size to h6 rather than closing over a range,
    // so its capacity is its nominal diameter at both ends — the vendor's own
    // `Clamping range or tolerance` row. A zero-width range is still a range,
    // and `holding.checkCollet` refuses only an inverted one.
    clampMin: published(dim(row, 'CCCN', unit), what, 'CCCN clamping minimum'),
    clampMax: published(dim(row, 'CCCX', unit), what, 'CCCX clamping maximum'),
    unpublished: COLLET_UNPUBLISHED,
  })
}

/** The toolholding half of the adapter contract `registry` looks up by brand. */
export const HOLDING_MAPPERS: HoldingMappers = { holder, collet }
