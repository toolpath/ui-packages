/**
 * Destiny Tool rows -> {@link ToolRecord}.
 *
 * Destiny Tool publishes exactly one identifier (`itemNumber`), no carbide
 * grade, no structured shank column, and dimensions as fractional-inch
 * **strings** rather than decimal columns — the closest precedent in this
 * package is `thread.threadMajorDiameter`'s designation parsing, not any other
 * vendor's dimension reader, all of which already publish decimals.
 *
 * **Three geometry fields are derived from the free-text `description` rather
 * than a column, because no column exists for them**: a shank diameter from a
 * "SHK" annotation, a corner radius from a "RAD" annotation when the vendor's
 * own `rad` cell is blank, and a neck diameter from a "NECK" annotation. The
 * latter two were found scraping the real collection 2026-08-19. All three
 * follow the same shape: real vendor data (a populated column) wins when
 * present, and the description is read only when the column is not — absence
 * is a stated fact, not a gap to fill.
 *
 * **A per-record derivation is not a `Fact`.** These three are arithmetic over
 * a row, so they belong in code with their evidence beside them; a fact is a
 * per-family constant nothing in the table states, and putting one of these
 * there would claim a whole family's provenance for a value that varies row by
 * row.
 */

import type { UnitSystem } from '../../conventions.js'
import { VendorResponseError } from '../../errors.js'
import { fractionValue } from '../../measure.js'
import { fact, familyBrand, type BoundFamily, type RecordMappers } from '../../family.js'
import { BRANDS } from '../../identity.js'
import {
  ISO_MATERIAL_GROUPS,
  toolRecord,
  type ColumnMap,
  type GeometryName,
  type ToolRecord,
} from '../../records.js'
import { consoleWarn, type MapperOptions, type ScrapedRow } from '../../scrape.js'

/**
 * Destiny Tool's one identifier. There is no second catalog number the way
 * Kennametal publishes an ISO number alongside a material number — the item
 * number fills both roles on a record.
 */
export const ITEM_NUMBER = 'itemNumber'

/**
 * `"1/8 SHK"`, `'1/4" SHK'` — a shank diameter, stated only when it differs
 * from the cutting diameter (a necked or reduced-shank tool). Every value
 * observed across the real scrape (2026-08-19, 642 of 3,898 rows) is a simple
 * fraction, optionally quoted; {@link parseFractionInches} also handles the
 * decimal and mixed-number forms `cutDia`/`loc`/`oal`/`rad` use, since a
 * future SKU stating a shank that way is not implausible.
 */
const SHANK = /([\d.\-/"]+)\s*SHK/i

/**
 * `".035-.040 RAD"` — a corner-radius *range*, read only as a fallback when
 * the vendor's own `rad` cell is blank. See {@link cornerRadius}.
 */
const RAD_RANGE = /([\d.]+)-([\d.]+)\s*RAD/i

/**
 * `".090 RAD"` — a single corner-radius value, same fallback role.
 *
 * **No word-boundary anchor before the capture group.** A boundary sits
 * between a non-word `.` and a word digit, so `\b[\d.]+` on `.090 RAD` starts
 * matching at the `0` and drops the leading dot — `090` parses as 90, not
 * 0.09, and that silently produced a 90-inch corner radius the first time this
 * ran against the real scrape (2026-08-19). The character class itself already
 * excludes the comma and space that precede every real match, so nothing
 * anchors the start position but the class.
 *
 * `(?<!-)` keeps this from matching the upper bound of a range as if it were a
 * lone value when both patterns are tried against the same string; the caller
 * tries {@link RAD_RANGE} first regardless, so this is a belt-and-suspenders
 * guard rather than the thing doing the exclusion.
 */
const RAD_SINGLE = /(?<!-)([\d.]+)\s*RAD/i

/**
 * `".074 NECK"` — a neck (shoulder) diameter, stated only on necked tools (171
 * of 3,898 rows, 2026-08-19). Always a plain decimal in the scraped data; no
 * fraction or mixed-number form has been observed.
 */
const NECK = /([\d.]+)\s*NECK/i

/**
 * Flute counts at or below this route to the non-ferrous material-group
 * fallback — see {@link materialGroups}.
 */
export const NON_FERROUS_MAX_FLUTES = 3

/**
 * A Destiny Tool dimension string, in inches.
 *
 * Every form seen across the real scrape (2026-08-19): a decimal (`.093`), a
 * bare or quoted whole number (`1`, `1"`), a simple fraction (`3/4`), or a
 * mixed number, quoted or not (`1-1/2`, `1-1/2"`).
 */
export function parseFractionInches(text: string): number {
  const s = text.trim().replace(/"+$/, '')
  if (!s) throw new RangeError(`empty dimension: ${JSON.stringify(text)}`)

  // The trailing quote is the only thing Destiny Tool puts around a dimension
  // that `measure.fractionValue` does not read; the grammar itself is the one
  // every vendor here publishes, and it is read in one place.
  const value = fractionValue(s)
  if (value === null) {
    throw new RangeError(`unrecognized dimension: ${JSON.stringify(text)}`)
  }
  return value
}

/** A dimension the kind requires, parsed as an inch fraction. */
function required(
  row: ScrapedRow,
  columns: ColumnMap,
  canonical: GeometryName,
  unit: UnitSystem,
  what: string,
): number {
  const column = columns.column(canonical, unit)
  const raw = column === null ? undefined : row[column]
  if (raw === undefined || raw.trim() === '') {
    throw new VendorResponseError(
      what,
      `no value for ${canonical} in column ${JSON.stringify(column)}`,
    )
  }
  return parseFractionInches(raw)
}

/**
 * The shank diameter: parsed off a "SHK" annotation when the tool is necked or
 * reduced-shank, or the cutting diameter otherwise.
 *
 * Destiny Tool has no structured shank column at all — unlike Kennametal,
 * where an absent `D` column would be a scrape bug, here a shank equal to the
 * cut diameter is simply never stated in the vendor's own text either (checked
 * over the full scrape, 2026-08-19).
 */
export function shankDiameter(description: string, dc: number): number {
  const match = SHANK.exec(description)
  return match?.[1] ? parseFractionInches(match[1]) : dc
}

/**
 * The corner radius, in priority order.
 *
 * 1. The vendor's own `rad` cell, when populated — real data wins, and this is
 *    trusted outright the way every scraped column in this package is.
 * 2. `DC / 2` on a `Ball` end mill, which Destiny Tool publishes with no
 *    radius column at all for that style (checked 2026-08-19).
 * 3. The description's own "RAD" annotation, for the 123 of 3,898 rows found
 *    2026-08-19 where `endStyle` is `"Corner Radius"` but the `rad` cell is
 *    blank and the text states one anyway. A range like `".035-.040 RAD"`
 *    resolves to its **upper** bound: across the 370 rows that state a range
 *    and also publish a populated `rad` cell, the cell equals the upper bound
 *    352 times (95%) and the lower bound 18 times, so the upper bound is the
 *    better-corroborated guess for the rows where only the range is available.
 *
 *    **Recovered from text, so it is checked rather than trusted outright.**
 *    `V33220R093` states `"0.93 RAD"` where its two siblings (identical
 *    geometry, different coating) both say `".093 RAD"` and the item number's
 *    own `093` suffix agrees with them — a vendor typo missing a leading zero,
 *    found running this against the real scrape. A value that would make the
 *    tool geometrically impossible (2×RE > DC) is not used; the row falls
 *    through to 4 instead, with a warning.
 * 4. `0` — a real square end — when nothing states one (2 of 3,898 rows), or
 *    when 3 recovered a value this package will not ship.
 */
export function cornerRadius(
  description: string,
  endStyle: string,
  what: string,
  dc: number,
  radCell: number | null,
  warn = consoleWarn,
): number {
  if (radCell !== null) return radCell
  if (endStyle === 'Ball') return dc / 2

  const range = RAD_RANGE.exec(description)
  const single = range ? null : RAD_SINGLE.exec(description)
  const recovered = range?.[2] ? Number(range[2]) : single?.[1] ? Number(single[1]) : null

  if (recovered === null) return 0
  if (recovered * 2 > dc) {
    warn(
      `  WARNING: ${what}: description states a corner radius of ` +
        `${recovered}in, which exceeds half the ${dc}in cutting diameter — ` +
        `likely a vendor typo; shipped as a flat end mill instead`,
    )
    return 0
  }
  return recovered
}

/**
 * The neck (shoulder) diameter: parsed off a "NECK" annotation when the tool
 * is necked, or the cutting diameter otherwise — a plain-shank tool below the
 * flutes, the same convention a family with no neck column at all uses.
 * Destiny Tool never publishes a structured neck column; the description
 * states one on 171 of 3,898 rows (2026-08-19) and this reads it rather than
 * defaulting every row to plain-shank.
 */
export function shoulderDiameter(description: string, dc: number): number {
  const match = NECK.exec(description)
  return match?.[1] ? Number(match[1]) : dc
}

/**
 * The ISO workpiece-material groups: the vendor's own `isoMaterialGroups`
 * column when populated, or a fallback keyed on flute count when it is not
 * (blank on 423 of 3,898 rows, 2026-08-19).
 *
 * **The two answers are labelled, not blended.** A populated cell is
 * `vendor-stated` and the flute-count fallback is `derived`, so a consumer that
 * will not route a cut off this package's arithmetic can filter on the source
 * rather than having to know which rows Destiny Tool left blank. Neither is
 * ever `null`: the fallback covers every blank cell, so this vendor always has
 * an answer.
 *
 * The fallback is not a new rule invented for this vendor — it is the split
 * cutting-data presets are routed by downstream (≤3 flutes non-ferrous, >3
 * ferrous), applied here to the material-groups facet instead. Real vendor
 * data wins when present: the full scrape shows 92 ≤3-flute rows whose stated
 * groups are not exactly `['N']` and 168 >3-flute rows whose stated groups
 * include `N`, so this is deliberately a fallback for the blank cells and not
 * a correction of the populated ones.
 *
 * **The populated cell is reordered onto `ISO_MATERIAL_GROUPS`, not passed
 * through in Destiny Tool's own order.** Its `isoMaterialGroups` array comes
 * back as e.g. `['M', 'P', 'S']` — alphabetical-ish, not the ISO 513 sequence
 * every other list agrees on — and a consumer that renders a facet from one
 * array and a tool's own list from another has no way to notice the two
 * disagree.
 */
export function materialGroups(
  row: ScrapedRow,
  flutes: number,
): Pick<ToolRecord, 'materialGroups' | 'materialGroupsSource'> {
  const cell = row['isoMaterialGroups'] ?? ''
  if (cell.trim()) {
    const present = new Set(cell.split(/\s+/).filter(Boolean))
    return {
      materialGroups: ISO_MATERIAL_GROUPS.filter((group) => present.has(group)),
      materialGroupsSource: 'vendor-stated',
    }
  }
  return {
    materialGroups: flutes <= NON_FERROUS_MAX_FLUTES ? ['N'] : ['P', 'M', 'K', 'S', 'H'],
    materialGroupsSource: 'derived',
  }
}

/**
 * A solid end mill, in the family's declared unit.
 *
 * Which is inches on the one family there is — Destiny Tool publishes no metric
 * line — but read from the `unit` fact rather than hardcoded, so the fact stays
 * the single authored copy the way it is for every other vendor here.
 */
export function endmillRecord(
  row: ScrapedRow,
  family: BoundFamily,
  columns: ColumnMap,
  options: MapperOptions = {},
): ToolRecord {
  const unit = fact(family, 'unit', family.unit)
  const what = row[ITEM_NUMBER] ?? ''
  const description = row['description'] ?? ''
  const dc = required(row, columns, 'DC', unit, what)
  const fluteLength = required(row, columns, 'LCF', unit, what)
  const oal = required(row, columns, 'OAL', unit, what)

  const radColumn = columns.column('RE', unit)
  const radRaw = radColumn === null ? undefined : row[radColumn]
  const radCell = radRaw && radRaw.trim() ? parseFractionInches(radRaw) : null

  // Refused rather than allowed through as NaN: `materialGroups` reads it, and
  // `NaN <= 3` is false, so a blank cell would silently classify the tool as
  // ferrous P/M/K/S/H on no evidence. Kennametal's `count()` refuses the same
  // shape for the same reason.
  const flutes = Number.parseInt(row['flutes'] ?? '', 10)
  if (!Number.isInteger(flutes)) {
    throw new VendorResponseError(what, `no integer in column "flutes"`)
  }

  return toolRecord({
    brand: familyBrand(family),
    vendor: BRANDS[familyBrand(family)].vendor,
    materialNumber: what,
    catalogNumber: what,
    description,
    kind: 'endmill',
    unit,
    // `series` is the vendor's own product-line name and the one column here
    // that names one — `Viper`, `Raptor`, `DiamondBack`, and `viper-mini` and
    // `python` in the vendor's own lower case, which stays exactly as
    // published for the reason `records.ToolRecord.productLine` gives. It has
    // been scraped since the adapter was written and read by nothing until
    // now; the description cannot stand in for it, because Raptor calls itself
    // `DVH` there and DiamondBack calls itself `DBACK RGHR`.
    productLine: row['series']?.trim() || null,
    substrate: (row['material'] || fact(family, 'bmc', family.bmc)).toLowerCase(),
    // No carbide grade is published; the coating id is what there is.
    coating: row['coatingId'] ?? '',
    ...materialGroups(row, flutes),
    coolantThrough: fact(family, 'coolantThrough', family.coolantThrough),
    geometry: {
      DC: dc,
      RE: cornerRadius(
        description,
        row['endStyle'] ?? '',
        what,
        dc,
        radCell,
        // `cornerRadius` owns the fallback; defaulting here too would be two
        // layers deciding the same thing.
        options.warn,
      ),
      SFDM: shankDiameter(description, dc),
      OAL: oal,
      LCF: fluteLength,
      'shoulder-length': fluteLength,
      'shoulder-diameter': shoulderDiameter(description, dc),
      NOF: flutes,
    },
  })
}

export const RECORD_MAPPERS: RecordMappers = { endmill: endmillRecord }
