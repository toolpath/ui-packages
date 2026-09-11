/**
 * What Harvey's own column labels mean, and which of them carry a unit.
 *
 * 50 distinct header shapes across the 52 product pages collapse to the table
 * below, because the variance is in *spelling* rather than in vocabulary:
 * `CUTTER DIA.` and `CUTTER DIAMETER` are the same column, and the keyseat
 * families call the length of cut `CUTTER WIDTH`.
 *
 * **This module does not map a label to a canonical ISO name.** That mapping is
 * per family and lives in `families/harvey.ts`, where it belongs: a family
 * declares which of *its* labels is `LCF`, and the core appends the unit suffix.
 * What is left over — is this label one this package has seen, and does its
 * column carry a length — is the same on every page, and is here.
 *
 * ## An unknown label is a hard failure
 *
 * A label nothing here recognises stops the scrape naming the family. The
 * alternative is a column that reaches the CSV under whatever Harvey renamed it
 * to, silently no longer matching the family's column map, and a family whose
 * `DC` is quietly absent from every record. The cost of the strict rule is that
 * a vendor's copy edit breaks a scrape; the cost of the loose one is that it
 * does not.
 */

import { ScraperConfigError } from '../../errors.js'

/**
 * What a column holds, which is only ever asked so that a length gets a `_mm` /
 * `_in` suffix and a tooth count does not.
 *
 * `code` is for a column whose values are not numbers at all — the keyseat
 * `TYPE`, whose `I`/`II`/`III` nobody at Harvey has yet explained.
 */
export type LabelKind = 'dimension' | 'count' | 'angle' | 'code'

/**
 * Every geometry top label the 52 product pages publish, and what it holds.
 *
 * Written out rather than pattern-matched. A regex over "anything containing
 * DIA" would have swallowed `RADIAL DOC` and `NECK DIA.` into the same rule and
 * quietly given one of them the other's meaning, and the whole point of the
 * strict check below is that a label this package has not seen gets looked at
 * by a person.
 */
export const LABELS: Readonly<Record<string, LabelKind>> = {
  // Mapped to canonical names by each family's own column map.
  'CUTTER DIA.': 'dimension',
  'CUTTER DIAMETER': 'dimension',
  LOC: 'dimension',
  'LENGTH OF CUT': 'dimension',
  'CUTTER WIDTH': 'dimension',
  'SHANK DIA.': 'dimension',
  'SHANK DIAMETER': 'dimension',
  OAL: 'dimension',
  'OVERALL LENGTH': 'dimension',
  'CORNER RADIUS': 'dimension',
  RADIUS: 'dimension',
  'NECK DIA.': 'dimension',
  'NECK LENGTH': 'dimension',
  'OVERALL REACH': 'dimension',
  FLUTES: 'count',

  // Kept verbatim and mapped to nothing. Each is either a measurement this
  // package has no canonical name for, or one whose meaning Harvey has not
  // stated — see `docs/HARVEY_PRODUCT_TABLE.md` §5.1 and §6.
  'RADIAL DOC*': 'dimension',
  'Radial DOC*': 'dimension',
  'Radial DOC**': 'dimension',
  'Interference Depth At Wall Angle*': 'dimension',
  'RIGHT HAND TEETH': 'count',
  'LEFT HAND TEETH': 'count',
  'ANGLE PER SIDE': 'angle',
  'EFFECTIVE WALL ANGLE*': 'angle',
  'EFF WALL ANGLE': 'angle',
  TYPE: 'code',
}

/** The top label of the column holding the add-to-cart control. Dropped. */
export const CART_LABEL = 'Add to Cart'

/** The top label of the column stating a row's flute count, where there is one. */
export const FLUTES_LABEL = 'FLUTES'

/** The sub-label a coating group uses when the row states the flute count. */
export const TOOL_NUMBER_LABEL = 'TOOL #'

/** The sub-label ending every coating group. */
export const PRICE_LABEL = 'PRICE'

/** `2 FL`, `4FL`, `5 FL` — a per-part flute count in a group's sub-label. */
const FLUTE_LABEL = /^(\d+)\s*FL$/i

/**
 * The eight coating names Harvey publishes across the whole catalog.
 *
 * A closed list, checked, because the coating is *synthesised* from a column's
 * position rather than lifted from a cell — nothing in a row says which coating
 * a tool number belongs to. A ninth coating is Harvey extending its catalog and
 * is worth a person looking; a coating group whose header stopped being a
 * coating is the grid having shifted, and that is the failure this catches.
 */
export const COATINGS: readonly string[] = [
  'UNCOATED',
  'AlTiN COATED',
  'AMORPHOUS DIAMOND COATED',
  'AlTiN NANO COATED',
  'Ti NANO COATED',
  'TiB2 COATED',
  'BALL END UNCOATED',
  'AlTiN NANO BALL END COATED',
]

/** The flute count a group sub-label states, or null where it states none. */
export function flutesInLabel(sub: string): number | null {
  const match = FLUTE_LABEL.exec(sub)
  return match ? Number.parseInt(match[1]!, 10) : null
}

/**
 * What the column under `label` holds, refusing a label nothing here knows.
 *
 * `family` is in the message because that is the one thing the person reading
 * the failure needs and cannot work out from the label: 52 pages publish these
 * labels, and only one of them changed.
 */
export function labelKind(family: string, label: string): LabelKind {
  const kind = LABELS[label]
  if (kind === undefined) {
    throw new ScraperConfigError(
      family,
      `publishes a column headed ${JSON.stringify(label)}, which this adapter ` +
        `does not know — add it to vendors/harvey/lexicon.ts with what it ` +
        `holds, and to the family's column map if it is a canonical field`,
    )
  }
  return kind
}

/** Whether the column under `label` gets a `_mm` / `_in` suffix. */
export function isDimensional(family: string, label: string): boolean {
  return labelKind(family, label) === 'dimension'
}

/** Refuse a coating group header that is not one of the eight. */
export function checkCoating(family: string, coating: string): string {
  if (!COATINGS.includes(coating)) {
    throw new ScraperConfigError(
      family,
      `has a tool-number group headed ${JSON.stringify(coating)}, which is not ` +
        `one of the coatings this adapter knows (${COATINGS.join(', ')})`,
    )
  }
  return coating
}
