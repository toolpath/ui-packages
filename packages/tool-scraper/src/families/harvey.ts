/**
 * Harvey Tool's families — one per product page, 52 of them.
 *
 * A family here is a product page, because that is the unit Harvey publishes:
 * one page carries one product line's whole variant table, and its
 * `productCode` — `HT-Harvey-EndMill-008` — is the vendor's own name for it.
 * That code is the `familyCode`; the CSV name and the family id are derived
 * from it, so nothing here invents a label.
 *
 * ## Where the scrape target lives, and why it is not in the definition
 *
 * A Harvey scrape needs a product-page **path**, and `FamilyDefinition` has no
 * key for one — `familyCode` is the vendor's code and a path is not that.
 * Harvey's slugs are also not derivable from the code: three of the 52 say
 * `end-mills-` where the rest say `miniature-end-mills-`, and the separators
 * change from `---` to `-` partway through the catalog.
 *
 * So {@link PRODUCT_PAGES} is a second table beside the first, keyed by the same
 * CSV name, and `tests/harvey-families.test.ts` holds the two to the same keys.
 * The alternative — widening the shared `FamilyDefinition` with a key one vendor
 * uses — would put a Harvey fact in the type every family in the catalog is
 * written against.
 *
 * ## `rows` is Harvey's count, not this adapter's
 *
 * Every count below was read on 2026-08-29 by summing the `T` entries of each
 * table row's own add-to-cart payload (`atc.j`) across all 80 tables — Harvey's
 * independent statement of what is orderable, not a number this adapter
 * produced. That is what makes `receipts.checkRows` worth running, and it is the
 * same list `vendors/harvey/scrape.ts` checks the matrix explosion against on
 * every row.
 *
 * It is still a script's count rather than a person's. The payload lists 12,799
 * entries across 5,033 HTML rows; **26 of them are not parts.** Two families
 * carry the marketing string `25x Diameter!` / `30x Diameter!` in a tool-number
 * column, with no product link and no CAD model, and Harvey's own payload lists
 * those as if they were orderable. The adapter drops them and warns, so the two
 * counts below are the payload's minus that vendor fault: 12,773 real parts.
 *
 * ## `NOF` maps a column the adapter synthesises
 *
 * Half these tables state the flute count in a column of their own and half
 * state it in a coating group's sub-header, so `vendors/harvey/scrape.ts`
 * writes one `FLUTES` column either way and every family maps `NOF` to it. The
 * two exceptions are the deburring families, which publish right- and left-hand
 * tooth counts and no flute count at all — `NOF` is absent there because the
 * vendor states none, not because the mapping was forgotten.
 *
 * ## Every family is `endmill`
 *
 * Including the twelve keyseat-cutter families. `records.ToolKind` has three
 * values — `drill`, `tap`, `endmill` — and a keyseat cutter is a side-cutting
 * milling tool with a cutting diameter, a width of cut, a shank and an overall
 * length, so it maps onto the endmill contract exactly. Adding a fourth kind for
 * it would be a cross-package contract change, and nothing downstream is asking
 * for one yet.
 */

import type { UnitSystem } from '../conventions.js'
import type { FamilyDefinition } from '../family.js'
import type { Fact } from '../provenance.js'

/**
 * The unit fact the 47 imperial families share.
 *
 * One object rather than 47 copies of the same sentence. The citation is still
 * re-checkable with one request against any of them: open the page, read the
 * `D1` sub-header.
 */
const INCHES: Fact<UnitSystem> = {
  value: 'inches',
  source: 'vendor-stated',
  cite:
    'every imperial Harvey product page publishes its dimensions as US-customary ' +
    'decimals and fractions, with the D1/L1/L2 sub-headers carrying inch ' +
    'tolerances (all 47 read 2026-08-29)',
}

/** The unit fact the 5 metric families share. */
const MILLIMETERS: Fact<UnitSystem> = {
  value: 'millimeters',
  source: 'vendor-stated',
  cite:
    "each of these pages titles itself '- Metric' and publishes its D1 tolerance " +
    'in mm (e.g. D1 +.000 mm / -.020 mm), and its dimension cells carry a ' +
    'trailing mm (all 5 read 2026-08-29)',
}

/** Solid carbide, stated on every one of the 52 pages. */
const SOLID_CARBIDE: Fact<string> = {
  value: 'carbide',
  source: 'vendor-stated',
  cite:
    "the product page's own description block, which states the tool is CNC " +
    'ground from solid carbide (all 52 checked 2026-08-29)',
}

/**
 * No coolant through, on the 51 families that are not the coolant-through line.
 *
 * Derived rather than assumed: Harvey publishes no coolant column anywhere in
 * these tables, and names its one coolant-through product line in that page's
 * own title. A family whose title does not name it is not one.
 */
const NO_COOLANT_THROUGH: Fact<boolean> = {
  value: false,
  source: 'derived',
  note:
    'Harvey publishes no coolant column in any product table and names its one ' +
    "coolant-through line in that page's own productTitle; this family's title " +
    'does not name it',
}

/**
 * The end profile, as the page's own title states it.
 *
 * `vendors/harvey/records.ts` reads it for exactly one thing: a family with no
 * corner-radius column is a ball nose with `RE = DC / 2` rather than a flat end
 * with `RE = 0`, and nothing in the variant table says which.
 */
function statedProfile(value: string, title: string): Fact<string> {
  return {
    value,
    source: 'vendor-stated',
    cite: `the page's own productTitle, ${JSON.stringify(title)}`,
  }
}

export const FAMILIES = {
  // End Mills - Ball - Reduced Shank
  'harvey_endmill_001.csv': {
    id: 'endmill-001',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-001',
    rows: 28,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'End Mills - Ball - Reduced Shank'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // End Mills - Corner Radius - Reduced Shank
  'harvey_endmill_002.csv': {
    id: 'endmill-002',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-002',
    rows: 44,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      RE: 'CORNER RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Corner Radius', 'End Mills - Corner Radius - Reduced Shank'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // End Mills - Square - Reduced Shank
  'harvey_endmill_003.csv': {
    id: 'endmill-003',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-003',
    rows: 49,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'End Mills - Square - Reduced Shank'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Long Flute
  'harvey_endmill_004.csv': {
    id: 'endmill-004',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-004',
    rows: 389,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Long Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Long Reach, Long Flute
  'harvey_endmill_005.csv': {
    id: 'endmill-005',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-005',
    rows: 95,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Long Reach, Long Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Long Reach, Standard Flute
  'harvey_endmill_006.csv': {
    id: 'endmill-006',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-006',
    rows: 284,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Long Reach, Standard Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Long Reach, Stub Flute
  'harvey_endmill_007.csv': {
    id: 'endmill-007',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-007',
    // 728 tool-number cells, 10 of which are the `30x Diameter!` marketing
    // string sitting in a tool-number column with no product link. See the
    // module note above and `vendors/harvey/scrape.ts`.
    rows: 718,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Long Reach, Stub Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Stub & Standard
  'harvey_endmill_008.csv': {
    id: 'endmill-008',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-008',
    rows: 840,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Stub & Standard'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Tapered Reach (Clearance Cutters)
  'harvey_endmill_009.csv': {
    id: 'endmill-009',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-009',
    rows: 171,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Ball',
        'Miniature End Mills - Ball - Tapered Reach (Clearance Cutters)',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Tapered - Ball
  'harvey_endmill_010.csv': {
    id: 'endmill-010',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-010',
    rows: 178,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Tapered - Ball'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Corner Radius - Long Flute
  'harvey_endmill_011.csv': {
    id: 'endmill-011',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-011',
    rows: 293,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      RE: 'CORNER RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Corner Radius', 'Miniature End Mills - Corner Radius - Long Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Corner Radius - Long Reach, Standard Flute
  'harvey_endmill_012.csv': {
    id: 'endmill-012',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-012',
    rows: 154,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      RE: 'CORNER RADIUS',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Corner Radius',
        'Miniature End Mills - Corner Radius - Long Reach, Standard Flute',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Corner Radius - Long Reach, Stub Flute
  'harvey_endmill_013.csv': {
    id: 'endmill-013',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-013',
    rows: 598,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      RE: 'CORNER RADIUS',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Corner Radius',
        'Miniature End Mills - Corner Radius - Long Reach, Stub Flute',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Corner Radius - Stub & Standard
  'harvey_endmill_014.csv': {
    id: 'endmill-014',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-014',
    rows: 1344,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      RE: 'CORNER RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Corner Radius',
        'Miniature End Mills - Corner Radius - Stub & Standard',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Deburring End Mill
  'harvey_endmill_015.csv': {
    id: 'endmill-015',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-015',
    rows: 18,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Deburring End Mill'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Long Flute
  'harvey_endmill_016.csv': {
    id: 'endmill-016',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-016',
    rows: 734,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Long Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Long Reach, Long Flute
  'harvey_endmill_017.csv': {
    id: 'endmill-017',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-017',
    rows: 194,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Long Reach, Long Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Long Reach, Standard Flute
  'harvey_endmill_018.csv': {
    id: 'endmill-018',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-018',
    rows: 519,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Long Reach, Standard Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Long Reach, Stub Flute
  'harvey_endmill_019.csv': {
    id: 'endmill-019',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-019',
    // 1,042 tool-number cells, 16 of which are the `25x Diameter!` marketing
    // string. Same fault as EndMill-007.
    rows: 1026,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Long Reach, Stub Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Stub & Standard
  'harvey_endmill_020.csv': {
    id: 'endmill-020',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-020',
    rows: 1239,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Stub & Standard'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Tapered Reach (Clearance Cutters)
  'harvey_endmill_021.csv': {
    id: 'endmill-021',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-021',
    rows: 88,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Square',
        'Miniature End Mills - Square - Tapered Reach (Clearance Cutters)',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Tapered - Square
  'harvey_endmill_022.csv': {
    id: 'endmill-022',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-022',
    rows: 371,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Tapered - Square'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Deburring End Mill
  'harvey_endmill_023.csv': {
    id: 'endmill-023',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-023',
    rows: 26,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Deburring End Mill'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Extra Long Length
  'harvey_endmill_025.csv': {
    id: 'endmill-025',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-025',
    rows: 10,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Extra Long Length'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Corner Radius - Extra Long Length
  'harvey_endmill_026.csv': {
    id: 'endmill-026',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-026',
    rows: 12,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      RE: 'CORNER RADIUS',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Corner Radius',
        'Miniature End Mills - Corner Radius - Extra Long Length',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Extra Long Length
  'harvey_endmill_027.csv': {
    id: 'endmill-027',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-027',
    rows: 20,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Extra Long Length'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Router Style
  'harvey_endmill_028.csv': {
    id: 'endmill-028',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-028',
    rows: 36,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Router Style'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Stub & Standard - Metric
  'harvey_endmill_029.csv': {
    id: 'endmill-029',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-029',
    rows: 152,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: MILLIMETERS,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Stub & Standard - Metric'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Ball - Stub & Standard - Metric
  'harvey_endmill_030.csv': {
    id: 'endmill-030',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-030',
    rows: 144,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: MILLIMETERS,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Stub & Standard - Metric'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Stub & Standard - 5 Flute
  'harvey_endmill_031.csv': {
    id: 'endmill-031',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-031',
    rows: 170,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Stub & Standard - 5 Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Coolant Through
  'harvey_endmill_032.csv': {
    id: 'endmill-032',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-032',
    rows: 24,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Coolant Through'),
      coolantThrough: {
        value: true,
        source: 'vendor-stated',
        cite: "the page's own productTitle, 'Miniature End Mills - Square - Coolant Through'",
      },
    },
  },
  // Miniature End Mills - Ball - Stub & Standard - 5 Flute
  'harvey_endmill_033.csv': {
    id: 'endmill-033',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-033',
    rows: 122,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LOC',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Ball', 'Miniature End Mills - Ball - Stub & Standard - 5 Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Corner Radius - Stub & Standard - 5 Flute
  'harvey_endmill_034.csv': {
    id: 'endmill-034',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-034',
    rows: 154,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      RE: 'CORNER RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Corner Radius',
        'Miniature End Mills - Corner Radius - Stub & Standard - 5 Flute',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Tapered - Corner Radius
  'harvey_endmill_035.csv': {
    id: 'endmill-035',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-035',
    rows: 40,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      RE: 'CORNER RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Corner Radius', 'Miniature End Mills - Tapered - Corner Radius'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Long Flute - 5 Flute
  'harvey_endmill_036.csv': {
    id: 'endmill-036',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-036',
    rows: 32,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Long Flute - 5 Flute'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Long Reach, Standard Flute - 5 Flute
  'harvey_endmill_037.csv': {
    id: 'endmill-037',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-037',
    rows: 32,
    columns: {
      DC: 'CUTTER DIAMETER',
      SFDM: 'SHANK DIAMETER',
      OAL: 'OVERALL LENGTH',
      LCF: 'LENGTH OF CUT',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Square',
        'Miniature End Mills - Square - Long Reach, Standard Flute - 5 Flute',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Corner Radius - Stub & Standard - Metric
  'harvey_endmill_038.csv': {
    id: 'endmill-038',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-038',
    rows: 64,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      RE: 'CORNER RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: MILLIMETERS,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Corner Radius',
        'Miniature End Mills - Corner Radius - Stub & Standard - Metric',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Long Flute - Metric
  'harvey_endmill_039.csv': {
    id: 'endmill-039',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-039',
    rows: 44,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      NOF: 'FLUTES',
    },
    facts: {
      unit: MILLIMETERS,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Miniature End Mills - Square - Long Flute - Metric'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Square - Long Reach, Standard Flute - Metric
  'harvey_endmill_041.csv': {
    id: 'endmill-041',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-041',
    rows: 32,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      'shoulder-length': 'OVERALL REACH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: MILLIMETERS,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Square',
        'Miniature End Mills - Square - Long Reach, Standard Flute - Metric',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Miniature End Mills - Corner Radius - Chipbreaker
  'harvey_endmill_042.csv': {
    id: 'endmill-042',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-EndMill-042',
    rows: 24,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'LENGTH OF CUT',
      RE: 'CORNER RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Corner Radius', 'Miniature End Mills - Corner Radius - Chipbreaker'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Corner Radius
  'harvey_keyseat_001.csv': {
    id: 'keyseat-001',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-001',
    rows: 345,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      RE: 'CORNER RADIUS',
      'shoulder-length': 'NECK LENGTH',
      'shoulder-diameter': 'NECK DIA.',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Corner Radius', 'Keyseat Cutters - Corner Radius'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Corner Radius - Reduced Shank
  'harvey_keyseat_002.csv': {
    id: 'keyseat-002',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-002',
    rows: 114,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      RE: 'CORNER RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Corner Radius', 'Keyseat Cutters - Corner Radius - Reduced Shank'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Full Radius
  'harvey_keyseat_003.csv': {
    id: 'keyseat-003',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-003',
    rows: 174,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      RE: 'RADIUS',
      'shoulder-length': 'NECK LENGTH',
      'shoulder-diameter': 'NECK DIA.',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Full Radius', 'Keyseat Cutters - Full Radius'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Full Radius - Reduced Shank
  'harvey_keyseat_004.csv': {
    id: 'keyseat-004',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-004',
    rows: 74,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      RE: 'RADIUS',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Full Radius', 'Keyseat Cutters - Full Radius - Reduced Shank'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Retaining Ring Keyseat Cutters
  'harvey_keyseat_005.csv': {
    id: 'keyseat-005',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-005',
    rows: 26,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      'shoulder-length': 'NECK LENGTH',
      'shoulder-diameter': 'NECK DIA.',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: {
        value: 'Square',
        source: 'assumed',
        note:
          'the title names no profile and the table publishes no radius column; a ' +
          'retaining-ring groove is square-bottomed',
        checked: '2026-08-29',
        by: 'JG',
      },
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Square
  'harvey_keyseat_006.csv': {
    id: 'keyseat-006',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-006',
    rows: 926,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      'shoulder-length': 'NECK LENGTH',
      'shoulder-diameter': 'NECK DIA.',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Keyseat Cutters - Square'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Square - For Hardened Steels
  'harvey_keyseat_007.csv': {
    id: 'keyseat-007',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-007',
    rows: 49,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      'shoulder-length': 'NECK LENGTH',
      'shoulder-diameter': 'NECK DIA.',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Keyseat Cutters - Square - For Hardened Steels'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Square - For Non - Ferrous Materials
  'harvey_keyseat_008.csv': {
    id: 'keyseat-008',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-008',
    rows: 108,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      'shoulder-length': 'NECK LENGTH',
      'shoulder-diameter': 'NECK DIA.',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Keyseat Cutters - Square - For Non - Ferrous Materials'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Square - Reduced Shank
  'harvey_keyseat_009.csv': {
    id: 'keyseat-009',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-009',
    rows: 220,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Keyseat Cutters - Square - Reduced Shank'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Staggered Tooth - Corner Radius
  'harvey_keyseat_010.csv': {
    id: 'keyseat-010',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-010',
    rows: 101,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      RE: 'CORNER RADIUS',
      'shoulder-length': 'NECK LENGTH',
      'shoulder-diameter': 'NECK DIA.',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Corner Radius', 'Keyseat Cutters - Staggered Tooth - Corner Radius'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Staggered Tooth - Square
  'harvey_keyseat_011.csv': {
    id: 'keyseat-011',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-011',
    rows: 88,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      'shoulder-length': 'NECK LENGTH',
      'shoulder-diameter': 'NECK DIA.',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile('Square', 'Keyseat Cutters - Staggered Tooth - Square'),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
  // Keyseat Cutters - Staggered Tooth - Square - Reduced Shank
  'harvey_keyseat_012.csv': {
    id: 'keyseat-012',
    brand: 'harvey',
    kind: 'endmill',
    familyCode: 'HT-Harvey-Keyseat-012',
    rows: 36,
    columns: {
      DC: 'CUTTER DIA.',
      SFDM: 'SHANK DIA.',
      OAL: 'OAL',
      LCF: 'CUTTER WIDTH',
      NOF: 'FLUTES',
    },
    facts: {
      unit: INCHES,
      bmc: SOLID_CARBIDE,
      profile: statedProfile(
        'Square',
        'Keyseat Cutters - Staggered Tooth - Square - Reduced Shank',
      ),
      coolantThrough: NO_COOLANT_THROUGH,
    },
  },
} as const satisfies Record<string, FamilyDefinition>

/**
 * The product page each family is scraped from, keyed by its CSV name.
 *
 * Paths rather than URLs: `vendors/harvey/scrape.ts` owns the host, so a family
 * config cannot put a scrape on a different one.
 */
export const PRODUCT_PAGES: Readonly<Record<string, string>> = {
  'harvey_endmill_001.csv': '/products/end-mills---ball---reduced-shank',
  'harvey_endmill_002.csv': '/products/end-mills---corner-radius---reduced-shank',
  'harvey_endmill_003.csv': '/products/end-mills---square---reduced-shank',
  'harvey_endmill_004.csv': '/products/miniature-end-mills---ball---long-flute',
  'harvey_endmill_005.csv': '/products/miniature-end-mills---ball---long-reach-long-flute',
  'harvey_endmill_006.csv': '/products/miniature-end-mills---ball---long-reach-standard-flute',
  'harvey_endmill_007.csv': '/products/miniature-end-mills---ball---long-reach-stub-flute',
  'harvey_endmill_008.csv': '/products/miniature-end-mills---ball---stub--standard',
  'harvey_endmill_009.csv':
    '/products/miniature-end-mills---ball---tapered-reach-clearance-cutters',
  'harvey_endmill_010.csv': '/products/miniature-end-mills---tapered---ball',
  'harvey_endmill_011.csv': '/products/miniature-end-mills---corner-radius---long-flute',
  'harvey_endmill_012.csv':
    '/products/miniature-end-mills---corner-radius---long-reach-standard-flute',
  'harvey_endmill_013.csv': '/products/miniature-end-mills---corner-radius---long-reach-stub-flute',
  'harvey_endmill_014.csv': '/products/miniature-end-mills---corner-radius---stub--standard',
  'harvey_endmill_015.csv': '/products/miniature-end-mills---square---deburring-end-mill',
  'harvey_endmill_016.csv': '/products/miniature-end-mills---square---long-flute',
  'harvey_endmill_017.csv': '/products/miniature-end-mills---square---long-reach-long-flute',
  'harvey_endmill_018.csv': '/products/miniature-end-mills---square---long-reach-standard-flute',
  'harvey_endmill_019.csv': '/products/miniature-end-mills---square---long-reach-stub-flute',
  'harvey_endmill_020.csv': '/products/miniature-end-mills---square---stub--standard',
  'harvey_endmill_021.csv':
    '/products/miniature-end-mills---square---tapered-reach-clearance-cutters',
  'harvey_endmill_022.csv': '/products/miniature-end-mills---tapered---square',
  'harvey_endmill_023.csv': '/products/miniature-end-mills---ball---deburring-end-mill',
  'harvey_endmill_025.csv': '/products/miniature-end-mills---ball---extra-long-length',
  'harvey_endmill_026.csv': '/products/miniature-end-mills---corner-radius---extra-long-length',
  'harvey_endmill_027.csv': '/products/miniature-end-mills---square---extra-long-length',
  'harvey_endmill_028.csv': '/products/miniature-end-mills---square---router-style',
  'harvey_endmill_029.csv': '/products/miniature-end-mills-square-stub--standard-metric',
  'harvey_endmill_030.csv': '/products/miniature-end-mills-ball-stub--standard-metric',
  'harvey_endmill_031.csv': '/products/miniature-end-mills-square-stub--standard-5-flute',
  'harvey_endmill_032.csv': '/products/miniature-end-mills-square-coolant-through',
  'harvey_endmill_033.csv': '/products/miniature-end-mills-ball-stub--standard-5-flute',
  'harvey_endmill_034.csv': '/products/miniature-end-mills-corner-radius-stub--standard-5-flute',
  'harvey_endmill_035.csv': '/products/miniature-end-mills-tapered-corner-radius',
  'harvey_endmill_036.csv': '/products/miniature-end-mills-square-long-flute-5-flute',
  'harvey_endmill_037.csv':
    '/products/miniature-end-mills-square-long-reach-standard-flute-5-flute',
  'harvey_endmill_038.csv': '/products/miniature-end-mills-corner-radius-stub--standard-metric',
  'harvey_endmill_039.csv': '/products/miniature-end-mills-square-long-flute-metric',
  'harvey_endmill_041.csv': '/products/miniature-end-mills-square-long-reach-standard-flute-metric',
  'harvey_endmill_042.csv': '/products/miniature-end-mills-corner-radius-chipbreaker',
  'harvey_keyseat_001.csv': '/products/keyseat-cutters---corner-radius',
  'harvey_keyseat_002.csv': '/products/keyseat-cutters---corner-radius---reduced-shank',
  'harvey_keyseat_003.csv': '/products/keyseat-cutters---full-radius',
  'harvey_keyseat_004.csv': '/products/keyseat-cutters---full-radius---reduced-shank',
  'harvey_keyseat_005.csv': '/products/keyseat-cutters---retaining-ring-keyseat-cutters',
  'harvey_keyseat_006.csv': '/products/keyseat-cutters---square',
  'harvey_keyseat_007.csv': '/products/keyseat-cutters---square---for-hardened-steels',
  'harvey_keyseat_008.csv': '/products/keyseat-cutters---square---for-non-ferrous-materials',
  'harvey_keyseat_009.csv': '/products/keyseat-cutters---square---reduced-shank',
  'harvey_keyseat_010.csv': '/products/keyseat-cutters---staggered-tooth---corner-radius',
  'harvey_keyseat_011.csv': '/products/keyseat-cutters---staggered-tooth---square',
  'harvey_keyseat_012.csv': '/products/keyseat-cutters---staggered-tooth---square---reduced-shank',
}
