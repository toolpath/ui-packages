/**
 * What Mastercam calls each kind of tool, and where this domain's vocabulary
 * runs out.
 *
 * `TlToolMill.MCToolType` is the discriminator the whole format turns on: it
 * decides which subtype table a tool's row goes in, and it is what Mastercam
 * draws the solid from. Everything here is a claim about that integer.
 *
 * ## The codes are read, not looked up
 *
 * Mastercam publishes no table of these. Every code in {@link MC_TOOL_TYPE} was
 * read out of a real library — matched against the tool names beside it and
 * cross-checked against `TlToolType`'s twenty legacy names, which the file also
 * carries. Twelve codes are confirmed that way. The rest of the legacy names
 * exist (`Slot Mill`, `Dove Mill`, `Lollipop Mill`, `CBore`, `Bore`,
 * `Bradpt Drill`, `Block Drill`, `Taper Mill`) and **their integers are not
 * known**, because no tool in the reference used one.
 *
 * Guessing them is the failure this module is written to avoid. A wrong
 * `MCToolType` is not a rejected file — it is a library that loads, and puts
 * the wrong solid in a simulation that a machinist then trusts.
 *
 * ## So an unmapped form does one of two things
 *
 * **Coerced**, where a confirmed code draws the same silhouette. A face mill
 * and a slot mill are flat-bottomed cylinders, which is what `Endmill1 Flat`
 * is; a tapered mill is what `Engrave Tool` is; a center drill is a short stiff
 * point, like `Spot Drill`. The shape is right and the name is a downgrade, so
 * it travels with a note saying so.
 *
 * Mastercam's own `Undefined` code (`0`) is not the fallback: the reference
 * pairs it with a custom profile every time it appears, and this exporter draws
 * no custom profiles, so writing it would mean a tool with no solid at all.
 *
 * **Skipped**, where no confirmed code draws it at all. A dovetail undercuts, a
 * lollipop is a sphere on a stem, a boring bar is single-point, a circle segment
 * has a barrel profile. Writing any of those as a cylinder would put a solid in
 * the machine that is not the tool, and a library short by one tool is better
 * than a library that lies about one. `library.ts` reports which.
 */

import type { ToolForm } from '../../forms.js'
import { MASTERCAM_SEED } from './schema.generated.js'

/**
 * Mastercam's legacy tool-type integers, for the forms a reference library
 * confirmed.
 *
 * `counter sink` shares `12` with `chamfer mill` on the evidence: the reference
 * writes an 82° countersink and a 45° chamfer mill under the same code, with
 * the angle carried in `TaperAngle` and the tip flat in `TipDiameter`.
 */
export const MC_TOOL_TYPE = {
  'flat end mill': 10,
  'ball end mill': 11,
  'bull nose end mill': 19,
  'radius mill': 15,
  'chamfer mill': 12,
  'counter sink': 12,
  'thread mill': 24,
  drill: 3,
  'spot drill': 2,
  reamer: 6,
  'tap right hand': 4,
  'tap left hand': 4,
} as const satisfies Partial<Record<ToolForm, number>>

/**
 * A form with no code of its own, and the confirmed one whose silhouette
 * matches.
 *
 * Every entry here loses the tool's name and keeps its shape. The reason is
 * stated per entry because "near enough" is exactly the judgement that should
 * not be silent.
 */
export const MC_TOOL_TYPE_COERCED: Partial<Record<ToolForm, { to: number; because: string }>> = {
  'face mill': { to: 10, because: 'a face mill is a flat-bottomed cutter, as Endmill1 Flat is' },
  'slot mill': { to: 10, because: 'a slot mill is a flat-bottomed cutter, as Endmill1 Flat is' },
  'counter bore': {
    to: 10,
    because: 'a counter bore cuts on a flat bottom, as Endmill1 Flat does',
  },
  'tapered mill': { to: 21, because: 'Engrave Tool is Mastercam’s tapered mill with a tip flat' },
  'center drill': { to: 2, because: 'a center drill is a short stiff point, as Spot Drill is' },
}

/**
 * Which subtype table a code's row belongs in.
 *
 * Read from the reference: every `TlToolMill` row has exactly one of these, and
 * which one follows from `MCToolType` alone.
 */
export const MC_SUBTYPE: Readonly<Record<number, 'endmill' | 'drill' | 'reamer' | 'threading'>> = {
  2: 'drill',
  3: 'drill',
  4: 'threading',
  6: 'reamer',
  10: 'endmill',
  11: 'endmill',
  12: 'endmill',
  15: 'endmill',
  19: 'endmill',
  21: 'endmill',
  24: 'threading',
}

/** The codes whose operation defaults are a drilling cycle rather than a milling pass. */
export const MC_HOLEMAKING: ReadonlySet<number> = new Set([2, 3, 4, 6])

/**
 * `TlToolEndmill.TlRadiusType`, as the reference uses it.
 *
 * `1` is absent from the reference and is not guessed at here — nothing maps
 * to it.
 */
export const MC_RADIUS_TYPE = {
  none: 0,
  /** A corner radius on an otherwise square end: a bull nose. */
  corner: 2,
  /** A full radius: a ball nose. */
  full: 3,
  /** A corner-rounding cutter, whose radius is the form it cuts. */
  rounder: 4,
} as const

/**
 * The coarse radius class the legacy tool record carries at offset `0x06`.
 *
 * A second, blunter spelling of {@link MC_RADIUS_TYPE} — the blob keeps three
 * states where the column keeps four, and the reference maps them this way.
 */
export const MC_RADIUS_CLASS: Readonly<Record<number, number>> = { 0: 0, 2: 1, 3: 2, 4: 1 }

/**
 * The `TaperAngle` of a tool that is not tapered.
 *
 * Not zero: the reference writes `180.0` on every flat, ball, bull and
 * corner-rounding cutter, and a zero there would describe a needle.
 */
export const MC_NO_TAPER = 180

/**
 * A seed row's guid, found by the name Mastercam gives it.
 *
 * Looked up rather than transcribed. Writing these sixteen-byte values out by
 * hand is exactly how one of them got the byte order wrong once already, and a
 * guid that is subtly wrong points at nothing while looking entirely plausible.
 */
export const seedGuid = (table: string, name: string): string => {
  const row = MASTERCAM_SEED[table]?.find((entry) => entry['Name'] === name)
  const id = row?.['ID']
  if (typeof id !== 'string') {
    throw new Error(`The pinned Mastercam seed has no ${table} row named ${name}`)
  }
  return id
}

/** The grade every tool in a Mastercam-written library belongs to. */
export const MASTERCAM_DEFAULT_GRADE = (): string =>
  seedGuid('TlToolGrade', 'Mastercam Default Grade')

/** Mastercam's own two cutting materials, which are all the format knows. */
export const MASTERCAM_MATERIALS = (): Readonly<Record<'carbide' | 'hss', string>> => ({
  carbide: seedGuid('TlMaterial', 'Carbide'),
  hss: seedGuid('TlMaterial', 'HSS'),
})
