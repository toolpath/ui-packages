/**
 * The interchange dictionary: what a geometry code measures, and whether the
 * number under it converts.
 *
 * Most of these are ISO 13399's own codes with the standard's meanings — the
 * machine-tool industry's interchange vocabulary, which is also why they appear
 * in Fusion's tool JSON. Three are Autodesk's names for measurements ISO codes
 * differently, and {@link GeometryField.iso} records the standard's counterpart
 * rather than quietly renaming them: a consumer recognises the name the scraper
 * emitted, and a reader can still find the standard's.
 *
 * ## Why the dictionary carries a unit kind and not a label
 *
 * The unit kind is the part that changes behaviour: it is what decides whether
 * a stated number converts with {@link UnitSystem} or is the same number in
 * both systems. A flute count and a point angle do not convert, an L/D ratio
 * does not convert, and a length does — and a consumer that converts the wrong
 * one prints a 60-degree drill point as 2.36.
 *
 * Human-facing labels and descriptions are presentational: which words a detail
 * page puts beside `SFDM` is that page's decision and changes with its
 * audience. {@link GeometryField.definition} is not one of those — it is the
 * phrase a diagnostic quotes back at whoever mapped a column to the wrong code,
 * which is why the scraper already carries it.
 *
 * ## An unknown code is not given a meaning
 *
 * {@link geometryField} answers `null` rather than inventing an entry, and
 * {@link isLengthField} answers `false`. A consumer shows an unrecognised code
 * as the vendor's own and does not convert it — the alternative is guessing a
 * unit for a column nobody has checked, and a guessed conversion is a wrong
 * number that looks right.
 */

import { convertLength, type UnitSystem } from './units.js'

/**
 * What kind of quantity a code states.
 *
 * `mm` is the only one that moves with a unit system. `deg` and `count` are the
 * same number in both; `ratio` is dimensionless by construction, and an `LD` of
 * 4 is 4 whichever sheet it came off.
 */
export type GeometryUnit = 'mm' | 'deg' | 'count' | 'ratio'

export interface GeometryField {
  readonly unit: GeometryUnit
  /**
   * What the field measures, phrased so it can be quoted back at whoever
   * mapped a column to the wrong one.
   */
  readonly definition: string
  /**
   * The ISO 13399 code for this measurement, or `null` where the standard's
   * counterpart has not been pinned. Equal to the key itself on every field
   * that *is* the standard's code.
   */
  readonly iso: string | null
}

/**
 * The codes this domain knows, keyed by the name the scraper emits.
 *
 * **This vocabulary is the scraper's, not this package's invention.** Renaming
 * a field here would put a translation table between two vocabularies, and a
 * translation table is where an `SFDM` becomes a `DC` in one direction and
 * nobody notices.
 */
export const GEOMETRY_FIELDS = {
  DC: { unit: 'mm', definition: 'cutting diameter', iso: 'DC' },
  SFDM: { unit: 'mm', definition: 'shank diameter — what the holder grips', iso: 'DMM' },
  OAL: { unit: 'mm', definition: 'overall length, tip to the end of the shank', iso: 'OAL' },
  LCF: { unit: 'mm', definition: 'flute length — the length of the cutting edge', iso: 'LCF' },
  RE: { unit: 'mm', definition: 'corner radius; 0 on a square-end tool', iso: 'RE' },
  /**
   * **`unit: 'mm'` is not the whole truth, and a caller converting a `TP` off
   * an inch tap should know it.** A metric tap's pitch is a length; an inch
   * tap's is conventionally threads-per-inch, which is a *reciprocal*, and
   * converting one as a length gives a number that looks like a pitch and is
   * wrong by a factor of its own value. No consumer in this tree converts it —
   * the scraper reads it from a single column already in the tool's own system,
   * and the catalog drops the code on ingest for exactly this reason — so the
   * hazard is recorded rather than resolved. Resolving it means either
   * confirming the inch convention against a real tap table or giving the
   * dictionary a unit kind for "not decidable from the code alone".
   */
  TP: { unit: 'mm', definition: 'thread pitch, in the tool’s own unit system', iso: 'TP' },
  NOF: { unit: 'count', definition: 'number of flutes', iso: 'NOF' },
  SIG: { unit: 'deg', definition: 'point angle, degrees included', iso: 'SIG' },
  /**
   * ISO 13399's clamping length minimum: the shank a manufacturer wants held.
   *
   * No vendor scraped so far publishes it, and the day one does this is where
   * it lands — read in preference to any rule of thumb about how much shank a
   * shop keeps clamped.
   */
  LSCN: {
    unit: 'mm',
    definition: 'least of the shank the manufacturer wants clamped',
    iso: 'LSCN',
  },
  /**
   * Not a vendor's column: how far the tool is set out of the holder.
   *
   * The number the drawing draws and the details table prints, and the one
   * quantity that was computed in four unconnected places and disagreed by a
   * factor of two on an ordinary tool. It is derived, and its provenance says
   * so.
   */
  LBH: {
    unit: 'mm',
    definition: 'length below holder — how far the tool is set out of the holder nose',
    iso: null,
  },
  /** Length below holder over cutting diameter — the "×D" a shop reads reach in. */
  LD: {
    unit: 'ratio',
    definition: 'length below holder over cutting diameter — the ×D a shop reads reach in',
    iso: null,
  },
  'shoulder-length': {
    unit: 'mm',
    definition: 'usable length below the full shank',
    iso: null,
  },
  'shoulder-diameter': {
    unit: 'mm',
    definition: 'diameter at the shoulder — the neck, where necked',
    iso: null,
  },
} as const satisfies Readonly<Record<string, GeometryField>>

/** A code {@link GEOMETRY_FIELDS} knows. */
export type GeometryCode = keyof typeof GEOMETRY_FIELDS

/**
 * A tool's stated geometry: code to value, lengths in millimetres and angles in
 * degrees whatever system the vendor published in.
 *
 * Keyed by `string` and not by {@link GeometryCode}, because a vendor states
 * columns this dictionary has not pinned yet and dropping them on ingest would
 * lose data that is still the vendor's. `undefined` is admitted so that a
 * record with a narrower `Record<string, number>` geometry satisfies this by
 * structure, with no adapter.
 */
export type Geometry = Readonly<Record<string, number | undefined>>

/** What a code measures, or `null` where this dictionary has not pinned it. */
export const geometryField = (code: string): GeometryField | null =>
  Object.hasOwn(GEOMETRY_FIELDS, code) ? GEOMETRY_FIELDS[code as GeometryCode] : null

/**
 * Whether a value under this code is a length, and so moves with a unit system.
 *
 * The single question the dictionary's unit kind exists to answer. `false` for
 * an unknown code, which is the same refusal {@link geometryField} makes: a
 * code nobody has classified is not converted, because a guessed conversion is
 * worse than an unconverted number a reader can still recognise.
 */
export const isLengthField = (code: string): boolean => geometryField(code)?.unit === 'mm'

/**
 * `value`, stated under `code`, converted between systems — or unchanged where
 * the code does not state a length.
 *
 * The conversion and the decision whether to convert in one call, so a caller
 * cannot get the second one right and the first one wrong.
 */
export const convertGeometry = (
  code: string,
  value: number,
  from: UnitSystem,
  to: UnitSystem,
): number => (isLengthField(code) ? convertLength(value, from, to) : value)
