/**
 * Destiny Tool's families.
 *
 * One today, and the vendor's whole catalog is one Firestore collection rather
 * than a set of family pages — so there is no `familyCode` here to name a scrape
 * target with. `vendors/destinytool/scrape.ts` fetches the collection and narrows
 * to `type == 'End Mill'` after decoding, because `documents.list` supports no
 * server-side filter.
 *
 * The 3,898 End Mills are 4,309 products minus 411 the package has no `ToolKind`
 * for — Chamfer Mill, Thread Mill, Dovetail, Corner Rounder, Spot Drill, Drill
 * Mill, Countersink, Chamfer End Mill. Those are deferred rather than dropped.
 */

import type { FamilyDefinition } from '../family.js'

export const FAMILIES = {
  'destinytool_end_mills_inch.csv': {
    id: 'end-mills-inch',
    brand: 'destinytool',
    kind: 'endmill',
    rows: 3898,
    // `SFDM` maps to the **same** label as `DC` on purpose: Destiny Tool
    // publishes no structured shank column at all, and `endmillRecord`
    // reads a shank diameter out of the description's own "SHK" text when
    // the tool is necked, falling back to that shared column — i.e. to DC —
    // otherwise. Two more per-record derivations the map cannot express are
    // in `vendors/destinytool/records.ts`, with the evidence beside them.
    columns: {
      DC: 'cutDia',
      SFDM: 'cutDia',
      OAL: 'oal',
      LCF: 'loc',
      RE: 'rad',
    },
    facts: {
      unit: {
        value: 'inches',
        source: 'vendor-stated',
        cite: "Destiny Tool product API (Firestore project studio-6030841929-4a1a2, collection 'products'), full scrape 2026-08-19 — every dimension on every one of the 3,898 End Mill documents is a US-customary fractional-inch string; no metric row exists",
      },
      bmc: {
        value: 'carbide',
        source: 'assumed',
        note: "'material' is blank on 1,223 of 3,898 End Mills (31.4%); 'Carbide' (one row spells it 'CARBIDE') is the only non-blank value across the whole collection, and solid-carbide is standard for this class of vendor",
        checked: '2026-08-19',
        by: 'JG',
      },
      coolantThrough: {
        value: false,
        source: 'assumed',
        note: 'no coolant field published anywhere in the Firestore document schema',
        checked: '2026-08-19',
        by: 'JG',
      },
    },
  },
} as const satisfies Record<string, FamilyDefinition>
