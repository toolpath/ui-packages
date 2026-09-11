/**
 * The one constant between the two measuring systems, and how a family states
 * which it was published in.
 *
 * Three names for two values stood in this tree before this module: the
 * scraper's `'millimeters' | 'inches'`, the catalog's `'metric' | 'inch'`, and
 * a display unit spelled `'mm' | 'in'` — reconciled by a lookup table on
 * ingest. A lookup table between two spellings of one axis is where a metric
 * family quietly becomes an inch one, and nothing was watching it.
 *
 * The scraper's spelling wins because the scraper originates the fact: a vendor
 * publishes a family in one system or the other, and every name downstream is a
 * rename of what it said.
 *
 * ## The unit a number is *stored* in is not on this axis
 *
 * Every length this domain states is in millimetres and every angle in
 * degrees, whatever system the vendor published — that is what lets an inch
 * tool and a metric tool compare at all. {@link UnitSystem} is a fact *about
 * the tool*: which system its vendor's sheet was written in, which is what
 * decides how a number is rounded, stepped and shown. It is never the unit a
 * stored value is in.
 */

/** How a vendor publishes a family: not the unit a number is stored in. */
export type UnitSystem = 'millimeters' | 'inches'

/** Every {@link UnitSystem}, for a control that offers them or a message that lists them. */
export const UNIT_SYSTEMS: readonly UnitSystem[] = ['millimeters', 'inches']

/** Exact by definition: the inch has been 25.4 mm since 1959. */
export const MM_PER_INCH = 25.4

/**
 * The short form, as a machinist writes it beside a number.
 *
 * **This constant is the third vocabulary, made into a map.** `'mm'` and
 * `'in'` are not a second unit axis — they are how {@link UnitSystem} is
 * spelled on a drawing — so they live here as a projection of it rather than
 * as a type of their own that something has to convert onto.
 */
export const UNIT_ABBREVIATION: Readonly<Record<UnitSystem, 'mm' | 'in'>> = {
  millimeters: 'mm',
  inches: 'in',
}

/** `value`, converted from `from` to `to`. A no-op when they agree. */
export const convertLength = (value: number, from: UnitSystem, to: UnitSystem): number => {
  if (from === to) return value
  return to === 'inches' ? value / MM_PER_INCH : value * MM_PER_INCH
}

/**
 * Decimals worth showing at a given size.
 *
 * A thousandth of an inch and a hundredth of a millimetre are about the same
 * distance, and both are near the limit of what a mill holds — so each system
 * gets the precision a machinist actually reads, rather than a fixed number of
 * decimals that is either noise in one or useless in the other.
 *
 * The rounding is domain, not presentation: two consumers that round the same
 * dimension differently print two different numbers for one tool.
 */
export const decimalsFor = (system: UnitSystem): number => (system === 'inches' ? 3 : 2)

/**
 * The same conversion, applied to an area.
 *
 * Areas scale with the *square* of the length conversion: 1 in² is 645.16 mm²,
 * not 25.4. An area put through {@link convertLength} is wrong by a factor of
 * an inch, which is large enough to read as a different pocket and small
 * enough that nobody checks it.
 */
export const convertArea = (value: number, from: UnitSystem, to: UnitSystem): number => {
  if (from === to) return value
  return to === 'inches' ? value / MM_PER_INCH ** 2 : value * MM_PER_INCH ** 2
}

/**
 * A stored length, written the way a machinist reads it in `system`.
 *
 * The value is in millimetres, because every length this domain states is —
 * see the note at the top of this module. What `system` decides is the unit it
 * is *shown* in, the decimals it is rounded to, and the abbreviation beside it,
 * which are three parts of one answer and belong together: two consumers that
 * round the same dimension differently print two different numbers for one tool.
 */
export const formatLength = (value: number, system: UnitSystem): string =>
  `${convertLength(value, 'millimeters', system).toFixed(decimalsFor(system))} ${UNIT_ABBREVIATION[system]}`

/** {@link formatLength} for an area, squared units and all. */
export const formatArea = (value: number, system: UnitSystem): string =>
  `${convertArea(value, 'millimeters', system).toFixed(decimalsFor(system))} ${UNIT_ABBREVIATION[system]}²`
