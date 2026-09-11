/**
 * What a feature demands of a tool, in millimetres.
 *
 * ## The seam that keeps the part schema out of this package
 *
 * Reading these numbers off a Toolpath datasheet needs the Engine's part
 * schema; *checking a tool against them* needs only tool vocabulary. Those two
 * halves used to sit in one file, and splitting them at exactly this type is
 * what lets the checking travel: every field below is tool language, and no
 * part feature, machining direction or datasheet appears in it.
 *
 * So the adapter — feature to demand — stays with whoever holds the report, and
 * fitting comes here. A consumer with no Toolpath report at all can still state
 * a demand by hand and ask whether a tool meets it.
 *
 * ## Every field is optional, and that is the contract
 *
 * The kernel states different measurements for different feature kinds, and **a
 * demand nobody stated must not silently become a demand of zero**. What is not
 * stated is not checked, and not claimed: that is the difference between a shop
 * trusting a tool list and a shop checking every row of it by hand.
 */

import type { ReachCurve } from './reach.js'

export interface FeatureDemand {
  /** The feature this came from, so a result can say which selection excluded a tool. */
  readonly featureTag: string
  /** The widest cutter that still reaches the tightest corner. */
  readonly maxToolDiameter?: number
  /** Stated separately for a hole: the widest drill, and the widest endmill. */
  readonly maxDrillDiameter?: number
  readonly maxEndmillDiameter?: number
  /** A hole's bore. Nothing wider than this goes in it. */
  readonly holeDiameter?: number
  /** How deep the cut reaches, which the flutes have to cover. */
  readonly depth?: number
  /**
   * How far below the top of the part the feature bottoms out, in millimetres.
   *
   * Depth is the feature; this is the *reach* — what the whole stack has to
   * clear before it cuts anything.
   */
  readonly reachBelowTop?: number
  /** The floor fillet: a corner radius larger than this cannot finish the floor. */
  readonly floorRadius?: number
  /**
   * How tall the material stands, by distance out from the cut — what a holder
   * and a shank are swept against. A demand without it is simply not checked
   * for collisions.
   */
  readonly reachCurve?: ReachCurve
}
