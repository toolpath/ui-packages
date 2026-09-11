/**
 * How much shank stays in the holder.
 *
 * **This is a cap, not the length below the holder.** It was written straight
 * into `geometry.LBH` at build time until 2026-09-03, which made it one of four
 * unreconciled answers to "how far does this tool stand out" — see the table in
 * `stickout.ts`. `LBH` is the *setup* length and `stickout.ts` owns it; what
 * lives here is {@link clampWanted}, the length of shank a shop keeps clamped,
 * which `stickoutRange` takes as one of three caps on that setup.
 *
 * **ISO 13399 calls it `LSCN`** — clamping length minimum, stated against the
 * shank diameter `DMM`, which is what a multiple of "D" means here: the holder
 * grips the shank, not the cut. Manufacturers publish it per tool, and the five
 * Seco end mills checked want between 4 and 6 diameters clamped against the 3×D
 * rule of thumb — a difference that is most of a tool's reach. So the rule
 * reads the vendor's own number first and falls back to a multiple of the
 * diameter for every tool that publishes none, which is every tool in the
 * scraped catalog today because no adapter carries the column yet.
 *
 *     the clamping cap = OAL − (minimum clamping length × SFDM)
 *
 * **The bury-the-head case is not handled here.** When the subtraction lands at
 * or under the shoulder length, it is `stickoutRange`'s floor and `gripShort`
 * that answer, and they answer for all three caps rather than this one: a tool
 * the rule cannot hold is gripped as short as the grip allows and says so. As a
 * *cap*, the exception was backwards — it raised the ceiling above what the
 * clamping rule allowed.
 */

import type { Geometry } from './geometry.js'

/** What a shop holds: the vendor's number where there is one, else a multiple of the diameter. */
export interface ClampingRule {
  /** Read the manufacturer's `LSCN` where the tool publishes one. On by default. */
  readonly vendorSpec: boolean
  /** Diameters to clamp where it does not — the rule of thumb is 3. Zero for none. */
  readonly perDiameter: number
}

/** What a dataset is built with, and what a page starts at. */
export const DEFAULT_CLAMPING: ClampingRule = { vendorSpec: true, perDiameter: 3 }

/**
 * Two decimals, which is finer than any vendor prints and coarser than the
 * float error of a unit conversion.
 */
const round = (value: number) => Math.round(value * 100) / 100

/**
 * The diameter a clamping length is a multiple **of**: the shank.
 *
 * `LSCN` is stated against `DMM`, and the shank is what the holder grips — a
 * keyseat cutter 22 mm across on a ⌀12 shank is clamped on 12. The cut stands
 * in only where a vendor states no shank.
 */
export const heldDiameter = (geometry: Geometry): number | undefined => geometry.SFDM ?? geometry.DC

/**
 * Where the shank starts, measured from the tip: past the flutes, and past the
 * reduced section under them where a tool has one. A chuck closes on neither.
 */
export const headLength = (geometry: Geometry): number =>
  Math.max(geometry['shoulder-length'] ?? 0, geometry.LCF ?? 0)

/** What this rule asks to keep in the holder, or null where it says nothing. */
export const clampWanted = (
  geometry: Geometry,
  rule: ClampingRule = DEFAULT_CLAMPING,
): number | null => {
  const stated = geometry.LSCN
  if (rule.vendorSpec && stated !== undefined && stated > 0) {
    return round(stated)
  }
  const shank = heldDiameter(geometry)
  if (rule.perDiameter <= 0 || shank === undefined || shank <= 0) {
    return null
  }
  return round(shank * rule.perDiameter)
}

/** How much shank the rule asked for and the tool has not got, or null where it fits. */
export const clampShortfall = (
  geometry: Geometry,
  rule: ClampingRule = DEFAULT_CLAMPING,
): number | null => {
  const wanted = clampWanted(geometry, rule)
  const { OAL } = geometry
  if (wanted === null || OAL === undefined) {
    return null
  }
  const shank = Math.max(0, OAL - headLength(geometry))
  return wanted <= shank ? null : round(wanted - shank)
}
