import type { ExplodeAmount } from './explode-amount.js'
import type { PartPick } from '../render/picking.js'
import type { Vec3 } from './types.js'

/** Rendering input only. Apps choose groups, approaches, names, and any planning policy. */
export interface ExplodeGroup {
  /** Unique within this layout. May name anything in the consuming application. */
  readonly id: string
  /** Regions of the supplied source model. Different groups may repeat or overlap them. */
  readonly regionIdxs: readonly number[]
  /** Full translation in millimetres, in the supplied geometry's coordinate frame. */
  readonly offset: Vec3
  readonly color: number
}

export interface ExplodeInput {
  /** Fraction of each group's offset, clamped to [0, 1]. Read each rendered frame. */
  readonly amount: number | ExplodeAmount
  /** Stable layout; changing colors does not replace this array. */
  readonly groups: readonly ExplodeGroup[]
  /** Optional color overrides by group ID; preserves layout buffers when recoloring. */
  readonly colors?: ReadonlyMap<string, number>
  /** Per-group source-region colors, overriding the group color without splitting its identity.
   * Replace maps to update paint. Unknown groups/regions are ignored.
   */
  readonly regionColors?: ReadonlyMap<string, ReadonlyMap<number, number>>
}

/** World coordinates describe the displayed hit; modelPoint names its original location. */
export interface ExplodePick extends PartPick {
  readonly explodeGroupId: string
  readonly modelPoint: readonly [number, number, number]
}
