/**
 * EMUGE-FRANKEN rows -> {@link ToolRecord}.
 *
 * The CSV a scrape writes holds the vendor's own value strings — `1 1/2 "`,
 * `3 mm`, `140 deg`, `4` — rather than parsed numbers, because the file is the
 * receipt and EMUGE's fractional inches and stated units are part of what it
 * published. So this module is where a cell becomes a number, through
 * `value.ts`. The closest precedent is Harvey Tool's, not Kennametal's, whose
 * columns are already decimals.
 *
 * ## What EMUGE publishes that nobody else here does
 *
 * - **Both identity columns.** The 18-digit SAP material number and the catalog
 *   article code, per part, so there is no `conventions.IDENTITY_DEVIATIONS`
 *   entry — the first vendor since Kennametal that needs none.
 * - **A point angle, per drill.** Kennametal's drill families assume theirs; the
 *   detail record states it, so `SIG` is a mapped column here and no fact. On
 *   all but one part: 2,669 of 2,670 drill variants state one, and part
 *   `000000000010727800` publishes a single classification feature and no
 *   dimensional properties at all — so its row carries no `SIG` **key**, not
 *   an empty one. That is why `records.RECORD_GEOMETRY.drill` lists `SIG`
 *   under `sometimes`, and why {@link angle} reads the row rather than `cell`.
 * - **A per-part ISO 513 index.** `applicationMaterials` returns the vendor's
 *   own P/M/K/N/S/H rating for each part, which fills `materialGroups` as
 *   `vendor-stated`.
 * - **A description for every part.** The grouped product's `productListInfo`
 *   is one sentence of the vendor's own prose per product line, so every kind
 *   here fills `description` from `conventions.DESCRIPTION_COLUMN` — including
 *   the tap, where Kennametal has to fall back to the thread designation
 *   because it publishes no such text. EMUGE's designation is on the CSV as
 *   `dimensionFeatureValue` and its thread is on the record as `TP`.
 *
 * ## What it does not publish
 *
 * **No flute count on a drill or a tap.** Not on the grouped product, the
 * variant listing, the per-part detail or any facet. A drill's comes from the
 * family's `flutes` fact — all seventeen drill groups state
 * `Specification: Twist drill` — and a tap's is simply absent, which is why
 * `records.RECORD_GEOMETRY.tap` lists `NOF` under `sometimes`. EMUGE's own tap
 * families run 2, 3 and 4 flutes across a size range, so no per-family constant
 * could be true of every row, and 0 is not a substitute for a number nobody
 * stated.
 *
 * **No CAD a scrape can reach.** The STEP, DXF and DIN 4000 documents are
 * published behind a login — `anonymousAccess: false`, with both URL fields
 * null — so neither `conventions.CAD_COLUMN` nor `CAD_DXF_COLUMN` is written.
 * See `docs/EMUGE_FRANKEN_COMMERCE_API.md`.
 */

import { columnReaders } from '../../columns.js'
import { DESCRIPTION_COLUMN, type UnitSystem } from '../../conventions.js'
import { VendorResponseError } from '../../errors.js'
import { fact, familyBrand, type BoundFamily, type RecordMappers } from '../../family.js'
import { BRANDS } from '../../identity.js'
import {
  ISO_MATERIAL_GROUPS,
  toolRecord,
  UNSPECIFIED,
  type ColumnMap,
  type GeometryName,
  type ToolRecord,
} from '../../records.js'
import { consoleWarn, type MapperOptions, type ScrapedRow, type Warn } from '../../scrape.js'
import {
  APPLICATION_MATERIALS_COLUMN,
  CATALOG_NUMBER_COLUMN,
  MATERIAL_NUMBER_COLUMN,
} from './scrape.js'
import { measureIn, parseMeasure, wholeCount } from './value.js'

/** The cutting-material property, spelled the same way in all three categories. */
export const SUBSTRATE_COLUMN = 'Cutting material'

/**
 * The coating property, which is **not** spelled the same way.
 *
 * `coating` on a milling part and `Coating` on a drill or a tap, in the same
 * API, on the same day. Both are read and the first non-empty one wins, because
 * relabelling one onto the other in the CSV would be this adapter deciding what
 * the vendor meant — see `scrape.ts`.
 */
export const COATING_COLUMNS = ['coating', 'Coating'] as const

/**
 * Whether a part is through-coolant, by the vendor's own word for it.
 *
 * Three columns and three vocabularies, one per category, each a closed facet
 * this package read off the vendor's own index on 2026-09-01 — so a value
 * absent from here is a vocabulary that changed rather than a part that is
 * odd, and {@link coolantThrough} refuses it by naming the table to add to.
 *
 * ## The facet does not cover the whole of milling
 *
 * The values below account for 6,862 milling variants, 2,670 drilling and
 * 11,566 tapping. Drilling and tapping are the whole category — the same two
 * numbers `docs/EMUGE_FRANKEN_COMMERCE_API.md` §4 gives — and milling is
 * **159 short** of `FF01`'s 7,021, which is also `families/emuge.ts`'s two row
 * counts added up. So 159 milling variants carry no `internal coolant supply`
 * value at all.
 *
 * That is a gap in the vendor's index rather than a vocabulary that moved, and
 * it is why {@link coolantThrough} separates the two cases: an unrecognised
 * *value* still refuses, and a column nobody filled warns and records `false`.
 * They were one case until 2026-09-01, and because `registry.toRecords` maps
 * its rows, a single such part threw and took the whole family's conversion
 * with it — 159 unindexed variants for two dead end mill CSVs.
 */
export const COOLANT_COLUMNS: Readonly<Record<string, Readonly<Record<string, boolean>>>> = {
  // `HYB_AMM_KMIZU`, milling.
  'internal coolant supply': {
    'ICA - Axial hole': true,
    'ICR - Radial hole': true,
    'ICRA - Radial & Axial holes': true,
    'Without internal cooling': false,
  },
  // `HYB_TAM_IKZ`, drilling. Note that "external coolant supply" is a real
  // statement rather than a blank: it is how EMUGE says a drill has no through
  // hole, and 164 of its 2,670 drill variants are it.
  'Coolant supply': {
    'internal coolant supply': true,
    'external coolant supply': false,
  },
  // `HYB_BAM_IKZ`, tapping.
  'coolant supply': {
    'IKZ - Axial hole': true,
    'IKZN - Radial hole': true,
    Without: false,
  },
}

/**
 * The vendor's cutting materials, onto the package's own vocabulary.
 *
 * `FamilyFacts.bmc` names a material class — `carbide`, `hss`, `diamond` — and
 * EMUGE's index names an alloy and a production route: HSS, HSSE and HSSE-PM
 * are three grades of high-speed steel and all three are `hss`. `PCD` is
 * `diamond`, which is the call `families/kennametal.ts` already made for its
 * PCD drills: the word names the cutting material rather than the body it is
 * brazed to.
 *
 * `cbn` and `ceramic` keep the vendor's own name, lowercased, because the
 * package's three words have no counterpart for either and inventing one would
 * be worse than recording what is standard. Closed, and it throws on anything
 * else — the seven values below are the whole of the vendor's `HYB_AAM_MAT`
 * facet across all three categories (2026-09-01).
 */
export const SUBSTRATES: Readonly<Record<string, string>> = {
  carbide: 'carbide',
  HSS: 'hss',
  HSSE: 'hss',
  'HSSE-PM': 'hss',
  PCD: 'diamond',
  CBN: 'cbn',
  ceramic: 'ceramic',
}

/**
 * The column each EMUGE-FRANKEN category states its product line in, keyed by
 * the vendor's own category code.
 *
 * **One column per category, and each is a facet that partitions its category
 * exactly.** Checked against the vendor's own index on 2026-09-01, at group
 * level rather than by summing counts:
 *
 * | Category | Facet                | Values | Groups it covers | Groups in two values |
 * | -------- | -------------------- | ------ | ---------------- | -------------------- |
 * | `FF01`   | `AMM_PROG_LINIE`     | 15     | 554 of 554       | 2                    |
 * | `FB01`   | `HYB_BAM_SB_GT`      | 4      | 17 of 17         | 0                    |
 * | `FG01`   | `HYB_BAM_SB_GT`      | 17     | 414 of 414       | 0                    |
 *
 * That is what makes a product line here a **read and not an arbitration**.
 * EMUGE's marketing publishes 43 overlapping product-family pages — a tap is
 * simultaneously "Rekord B-Z Taps", "Enorm Z Taps" and "Left Hand Taps" — and
 * choosing between those would be this package inventing a rule the vendor
 * never stated. The facets above are the vendor's own partition of the same
 * catalog, so there is nothing to choose.
 *
 * **The two milling groups that fall in two values cost nothing**, because the
 * milling column is read per part: `H300024` and `H300025` each hold both
 * `FRANKEN TiNox-Cut` and `FRANKEN TiNox-Cut VAR` variants, and the per-part
 * detail record states which is which. A rule that tagged a whole group would
 * have had to pick.
 *
 * **No request is added for any of this.** `Geometry` is on the grouped product
 * and `product line` on the per-part detail, so `scrape.ts` already writes both
 * into every row — see its three-call note.
 */
export const PRODUCT_LINE_COLUMNS: Readonly<Record<string, string>> = {
  FF01: 'product line',
  FB01: 'Geometry',
  FG01: 'Geometry',
  FG02: 'Geometry',
}

/**
 * A category's product-line codes onto the vendor's own name for each.
 *
 * **Both sides are EMUGE's.** The key is the value its `HYB_BAM_SB_GT` facet
 * publishes and the name is the title of the vendor's own product-family
 * article page for it, read on 2026-09-01 and cited per entry. Nothing here is
 * this package's wording, which is the whole condition on a table like this —
 * the same rule {@link SUBSTRATES} keeps, one level less strict because that
 * one maps onto a vocabulary this package owns and this one does not.
 *
 * **A category whose facet already names the line has no entry.** `FF01`'s
 * values are `FRANKEN TOP-Cut`, `FRANKEN Hard-Cut`, `FRANKEN Alu-Cut` — the
 * vendor's marketing names already — so milling passes through verbatim and
 * appears nowhere below. Drilling and tapping index by a geometry code
 * (`MULTI`, `Z`, `VA`) that matches nothing EMUGE sells under that name, which
 * is the only reason this table exists.
 *
 * **A code with no article page keeps the code**, and that is a gap in the
 * vendor's marketing rather than a hole here: `SPEED`, `FK`, `GAL`, `GG` and
 * `TILEG` are real lines with no `/a/` page on the US storefront, so the
 * honest answer is the vendor's own code until one appears.
 *
 * **`FG02` has no entry at all, on purpose.** Cold-forming taps index by the
 * same eight geometry codes `FG01` uses — `AL`, `GAL`, `H`, `MULTI`, `SPEED`,
 * `STEEL`, `VA`, `Z` — and mean different products by them: a `Z`-geometry
 * former is InnoForm, not the `Rekord B-Z Taps` the `FG01` table would name it.
 * Borrowing that table would put a cutting tap's product line on a forming tap,
 * which is the one error this category split exists to make impossible. So the
 * codes pass through verbatim, which is what the paragraph above already says a
 * code with no article page does, and naming them from the vendor's own
 * cold-forming pages is the follow-up.
 */
export const PRODUCT_LINES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // `/us/en/multi-drill/a/MultiDRILL`, `/us/en/steeldrill/a/SteelDrill`,
  // `/us/en/inox/a/Inox`, and
  // `/us/en/ef-va---carbide-drills---stainless-steel-titanium-alloys`.
  //
  // `STEEL` has two article pages — "SteelDrill" and "EF / CARBIDE DRILLS" —
  // that resolve to the identical 8 groups. `SteelDrill` is the one the
  // vendor's own part names use (`SteelDrill SD102-5xD-HA`), which is the
  // tiebreak: a part that calls itself one of the two is evidence and a
  // preference between two pages is not.
  FB01: {
    MULTI: 'MultiDRILL',
    STEEL: 'SteelDrill',
    INOX: 'Inox',
    VA: 'EF-VA / CARBIDE DRILLS',
  },
  // One article page each, all under `/us/en/<slug>/a/<name>`: multitap,
  // va-taps, ti-taps, ni-taps, aero-taps, rekord-b-z-taps, a-h-taps, al-taps,
  // a-gjv-taps, a-hcut-taps, steel-taps.
  //
  // `FK`, `GAL`, `GG`, `SPEED` and `TILEG` are absent on purpose — see above.
  FG01: {
    MULTI: 'MultiTAP™',
    VA: 'VA Taps',
    TI: 'TI-Taps',
    NI: 'Ni Taps',
    AERO: 'AERO Taps',
    Z: 'Rekord B-Z Taps',
    H: 'A-H Taps',
    AL: 'Al Taps',
    GJV: 'A-GJV Taps',
    HCUT: 'A-HCUT Taps',
    STEEL: 'Steel Taps',
  },
}

/**
 * The product line this row states, or null where the vendor states none.
 *
 * Three answers and they are different things. A family whose category has no
 * entry in {@link PRODUCT_LINE_COLUMNS} is a category this adapter has not
 * looked at, and it answers null rather than guessing at which of the row's
 * columns is the line. A column the vendor left empty is null too — the same
 * silence `angle` treats as an omission rather than a fault. A *value* is
 * mapped through {@link PRODUCT_LINES} where its category has a table and
 * passed through verbatim where it does not, which is the milling case.
 *
 * It does not throw on an unknown code, and that is the difference between
 * this and `substrate`: a cutting material this package cannot map would put a
 * wrong word in `ToolRecord.substrate`, where an unmapped product-line code is
 * the vendor's own code and readable as one. A new EMUGE geometry showing up
 * as `SPEED` is a name to improve, not a record to refuse.
 */
export function productLine(row: ScrapedRow, family: BoundFamily): string | null {
  const column = PRODUCT_LINE_COLUMNS[family.familyCode ?? '']
  if (column === undefined) return null

  const stated = (row[column] ?? '').trim()
  if (stated === '') return null

  return PRODUCT_LINES[family.familyCode ?? '']?.[stated] ?? stated
}

/**
 * The flute count EMUGE publishes where it has none: 64 end mill variants, on
 * 2026-09-01. A sentinel and not a number, so it is refused rather than read.
 */
export const NO_FLUTE_COUNT = 999

/**
 * The three column readers, over this vendor's grammar.
 *
 * `measureIn` is the only EMUGE-specific half; everything either side of it —
 * an unmapped column answering undefined, a required field refusing the row —
 * is `columns.columnReaders`, shared with Harvey Tool's mapper.
 */
const { cell, required, optional } = columnReaders(measureIn)

/**
 * An angle in degrees — the drill's point angle — or null where the vendor
 * left the cell empty.
 *
 * Read through {@link parseMeasure} rather than {@link measureIn}, which
 * refuses degrees on purpose: a length column stating an angle is a property
 * that has moved. Here degrees are what the column is for.
 *
 * **An empty cell and an unreadable one are different answers**, the same
 * split {@link coolantThrough} makes one level down. EMUGE fills this column
 * on 2,669 of its 2,670 drill variants and leaves it blank on one, so a blank
 * is the vendor publishing nothing and the row is still a part somebody can
 * order — `records.RECORD_GEOMETRY.drill` lists `SIG` under `sometimes` for
 * it. A cell holding a *value* this cannot read is the other case: a length
 * where an angle belongs is the property having moved, a range has no single
 * reading, and either one is refused rather than dropped quietly.
 *
 * A column the family maps to nothing refuses too, and is a third thing again
 * — this adapter's drill family maps `point angle`, so its absence is that map
 * having changed rather than anything the vendor did. **That is a fact about
 * the map and not about a row**, which is why it is asked of `columns` and not
 * inferred from a missing cell: a part publishing no dimensional properties
 * has no such key either, and reading the two as one refused every drill in
 * the family over one incomplete part.
 * `records.REQUIRED_GEOMETRY` cannot catch it: `SIG` is not listed under its
 * `drill` entry, because Kennametal's drills supply theirs as a fact and map
 * no column at all.
 */
function angle(
  row: ScrapedRow,
  columns: ColumnMap,
  unit: UnitSystem,
  what: string,
  warn: Warn,
): number | null {
  // `cell` cannot be used here. It answers `undefined` for two different
  // things — the family mapping no `SIG` column, and *this row* carrying no
  // such key — and those are the regression and the vendor's silence
  // respectively. Asking the map directly separates them: `column` is null
  // only when the map has nothing, so an absent key is left to be read off the
  // row like any other blank.
  const column = columns.column('SIG', unit)
  if (column === null) {
    throw new VendorResponseError(
      what,
      `is a drill whose family maps no point angle column — EMUGE states one ` +
        `per part and this adapter reads it, so a map without it is a regression`,
    )
  }

  const raw = row[column]
  if (raw === undefined || raw.trim() === '') {
    warn(`  WARNING: ${what}: the vendor publishes no point angle — omitted`)
    return null
  }

  const { value, stated } = parseMeasure(raw)
  if (value === null || stated === 'inches' || stated === 'millimeters') {
    throw new VendorResponseError(
      what,
      `states a point angle of ${JSON.stringify(raw)}, which is not an angle — ` +
        `an empty cell is the vendor's silence and is omitted, but a value ` +
        `this cannot read is a property that has moved`,
    )
  }
  return value
}

/** The vendor's own coating string, `''` where neither spelling carries one. */
function coating(row: ScrapedRow): string {
  for (const column of COATING_COLUMNS) {
    const value = row[column]
    if (value !== undefined && value !== '') return value
  }
  return ''
}

/** The cutting material, refused rather than guessed when it is a new word. */
function substrate(row: ScrapedRow, what: string): string {
  const stated = row[SUBSTRATE_COLUMN] ?? ''
  const mapped = SUBSTRATES[stated]
  if (mapped === undefined) {
    throw new VendorResponseError(
      what,
      `cutting material ${JSON.stringify(stated)} is not one of ` +
        `${Object.keys(SUBSTRATES).sort().join(', ')} — add it to SUBSTRATES`,
    )
  }
  return mapped
}

/**
 * Whether the part takes coolant through it, in whichever word its category
 * uses.
 *
 * **A word the category's vocabulary does not have refuses the row**, because
 * that is EMUGE's own closed facet having changed under this package, and
 * guessing what a new value means is how a scraper becomes a place tool data is
 * authored by hand.
 *
 * **A category whose column nobody filled warns and answers `false`**, which is
 * a different thing: the vendor rated this part for nothing rather than for
 * something new. 159 milling variants are in that position — see
 * {@link COOLANT_COLUMNS}. `false` is not a claim that the tool has no through
 * hole so much as the absence of the vendor's claim that it has one, and it is
 * the only answer available: `ToolRecord.coolantThrough` is a boolean with no
 * third state, and `true` would be the fabrication.
 */
function coolantThrough(row: ScrapedRow, what: string, warn: Warn): boolean {
  for (const [column, vocabulary] of Object.entries(COOLANT_COLUMNS)) {
    const stated = row[column]
    if (stated === undefined || stated === '') continue
    const value = vocabulary[stated]
    if (value === undefined) {
      throw new VendorResponseError(
        what,
        `${column} is ${JSON.stringify(stated)}, which is not one of ` +
          `${Object.keys(vocabulary).sort().join(', ')} — add it to COOLANT_COLUMNS`,
      )
    }
    return value
  }
  warn(
    `  WARNING: ${what}: none of ${Object.keys(COOLANT_COLUMNS).join(', ')} is ` +
      `filled — the vendor's index rates it for no coolant supply, recorded as false`,
  )
  return false
}

/**
 * The workpiece-material groups, and how they were arrived at.
 *
 * Three states, and the column carries two of them: a cell the vendor's index
 * filled, and an empty one meaning it rates this part for nothing. The third —
 * **we have no evidence** — is the row whose per-part detail request answered
 * nothing, which `scrape.ts` warns about and leaves the key off entirely.
 *
 * That last distinction lives only in the in-memory scrape: `node/csv.parseCsv`
 * fills `''` under every header column, so a CSV round-trip flattens an absent
 * key into an empty one. Which is why the missing detail is warned about when
 * it happens rather than inferred from the file afterwards.
 *
 * Reordered onto {@link ISO_MATERIAL_GROUPS} rather than passed through in the
 * vendor's order — a consumer that renders a facet from one order and a tool's
 * own list from another has no way to notice the two disagree.
 */
function materialGroups(
  row: ScrapedRow,
): Pick<ToolRecord, 'materialGroups' | 'materialGroupsSource'> {
  const cellText = row[APPLICATION_MATERIALS_COLUMN]
  if (cellText === undefined) {
    return { materialGroups: null, materialGroupsSource: UNSPECIFIED }
  }
  const stated = new Set(cellText.split(/\s+/).filter((code) => code !== ''))
  return {
    materialGroups: ISO_MATERIAL_GROUPS.filter((group) => stated.has(group)),
    materialGroupsSource: 'vendor-stated',
  }
}

/** Everything a record of any kind here shares. */
function common(
  row: ScrapedRow,
  family: BoundFamily,
  what: string,
  warn: Warn,
): Pick<
  ToolRecord,
  | 'brand'
  | 'vendor'
  | 'materialNumber'
  | 'catalogNumber'
  | 'description'
  | 'substrate'
  | 'coating'
  | 'coolantThrough'
  | 'materialGroups'
  | 'materialGroupsSource'
  | 'productLine'
> {
  return {
    brand: familyBrand(family),
    vendor: BRANDS[familyBrand(family)].vendor,
    materialNumber: what,
    catalogNumber: row[CATALOG_NUMBER_COLUMN] ?? '',
    description: row[DESCRIPTION_COLUMN] ?? '',
    productLine: productLine(row, family),
    substrate: substrate(row, what),
    coating: coating(row),
    coolantThrough: coolantThrough(row, what, warn),
    ...materialGroups(row),
  }
}

/** The material number a record is minted from, refusing a row without one. */
function partNumber(row: ScrapedRow, family: BoundFamily): string {
  const what = row[MATERIAL_NUMBER_COLUMN] ?? ''
  if (what === '') {
    throw new VendorResponseError(family.id, `has a row with no ${MATERIAL_NUMBER_COLUMN}`)
  }
  return what
}

/**
 * A solid end mill, in the family's declared unit.
 *
 * The two shoulder fields fall back the way every end mill mapper here does: a
 * family with no neck column is a plain tool whose usable length below the
 * shank is its flute length and whose shoulder is its cutting diameter. EMUGE
 * publishes `neck length l₃` and `neck diameter Ød₃` on the necked lines and
 * neither on the plain ones, in the same family, so the fallback is per row
 * rather than per family.
 *
 * A missing `radius r₁` is a square end and 0 is the right answer — the reason
 * `RE` is optional on the end mill contract.
 */
export function endmillRecord(
  row: ScrapedRow,
  family: BoundFamily,
  columns: ColumnMap,
  options: MapperOptions = {},
): ToolRecord {
  const warn = options.warn ?? consoleWarn
  const opts: MapperOptions = { warn }
  const unit = fact(family, 'unit', family.unit)
  const what = partNumber(row, family)
  const dc = required(row, columns, 'DC', unit, what, opts)
  const fluteLength = required(row, columns, 'LCF', unit, what, opts)

  const geometry: Partial<Record<GeometryName, number>> = {
    DC: dc,
    RE: optional(row, columns, 'RE', unit, what, opts) ?? 0,
    SFDM: required(row, columns, 'SFDM', unit, what, opts),
    OAL: required(row, columns, 'OAL', unit, what, opts),
    LCF: fluteLength,
    'shoulder-length': optional(row, columns, 'shoulder-length', unit, what, opts) ?? fluteLength,
    'shoulder-diameter': optional(row, columns, 'shoulder-diameter', unit, what, opts) ?? dc,
  }

  const raw = cell(row, columns, 'NOF', unit)
  const nof = raw === undefined ? null : wholeCount(raw)
  if (nof === NO_FLUTE_COUNT) {
    warn(`  WARNING: ${what}: the vendor's flute count is ${NO_FLUTE_COUNT} — omitted`)
  } else if (nof !== null) {
    geometry.NOF = nof
  }

  return toolRecord({ ...common(row, family, what, warn), kind: 'endmill', unit, geometry })
}

/**
 * A twist drill, in millimetres — the only system EMUGE publishes its drill
 * lengths in.
 *
 * `SIG` is a **mapped column**, which no other drill family in this package
 * manages: the per-part detail record states the point angle outright, so
 * nothing here is derived from a point length or assumed from a product line.
 * It is also the one geometry key this record may not carry — one variant's
 * cell is empty, and {@link angle} says what that costs. `NOF` is the one
 * thing that is a fact, and `nonFerrous` with it — neither has a default
 * anywhere, by design.
 */
export function drillRecord(
  row: ScrapedRow,
  family: BoundFamily,
  columns: ColumnMap,
  options: MapperOptions = {},
): ToolRecord {
  const warn = options.warn ?? consoleWarn
  const opts: MapperOptions = { warn }
  const unit = fact(family, 'unit', family.unit)
  const what = partNumber(row, family)

  const geometry: Partial<Record<GeometryName, number>> = {
    DC: required(row, columns, 'DC', unit, what, opts),
    SFDM: required(row, columns, 'SFDM', unit, what, opts),
    OAL: required(row, columns, 'OAL', unit, what, opts),
    LCF: required(row, columns, 'LCF', unit, what, opts),
    NOF: fact(family, 'flutes', family.flutes),
  }

  const pointAngle = angle(row, columns, unit, what, warn)
  if (pointAngle !== null) geometry.SIG = pointAngle

  return toolRecord({
    ...common(row, family, what, warn),
    kind: 'drill',
    unit,
    nonFerrous: fact(family, 'nonFerrous', family.nonFerrous),
    geometry,
  })
}

/**
 * A tap, in millimetres — including an inch-thread one.
 *
 * That is what the vendor published rather than a conversion this package made:
 * a `#4-40 UNC` tap's major diameter is stated as `2.845 mm` and its shank,
 * overall length and cutting-edge length are millimetres too. So the family
 * declares `unit: millimeters` and there is no per-row thread system to read —
 * the shape Kennametal needs, where one family holds both and `Thread System`
 * is a column the scrape tags on.
 *
 * `DC` is **read, not derived**. Kennametal parses a major diameter out of the
 * thread designation because its tap tables publish no diameter column; EMUGE
 * publishes one, and reading the vendor's own number is always the better of
 * the two. The designation is still on the CSV as `dimensionFeatureValue`, and
 * `thread symbol` and `threads per inch` beside it.
 *
 * `NOF` is absent, and its absence is the vendor's silence — see the module
 * docstring and `records.RECORD_GEOMETRY`.
 */
export function tapRecord(
  row: ScrapedRow,
  family: BoundFamily,
  columns: ColumnMap,
  options: MapperOptions = {},
): ToolRecord {
  const warn = options.warn ?? consoleWarn
  const opts: MapperOptions = { warn }
  const unit = fact(family, 'unit', family.unit)
  const what = partNumber(row, family)

  return toolRecord({
    ...common(row, family, what, warn),
    kind: 'tap',
    unit,
    threadMethod: fact(family, 'threadMethod', family.threadMethod),
    geometry: {
      DC: required(row, columns, 'DC', unit, what, opts),
      TP: required(row, columns, 'TP', unit, what, opts),
      SFDM: required(row, columns, 'SFDM', unit, what, opts),
      OAL: required(row, columns, 'OAL', unit, what, opts),
      LCF: required(row, columns, 'LCF', unit, what, opts),
    },
  })
}

export const RECORD_MAPPERS: RecordMappers = {
  drill: drillRecord,
  tap: tapRecord,
  endmill: endmillRecord,
}
