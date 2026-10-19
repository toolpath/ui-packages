import type { FeatureProfile, ReachCurve } from '../model/reach.js'
import type { Units } from '../model/units.js'

export interface ReachChartProps {
  /** The feature's reach curve, whole: the chart trims it past full height itself. */
  curve: ReachCurve
  units: Units
  /**
   * The feature beside its walls: drawn to its own width where known, though
   * the width is not written on the drawing, because the curve is read out
   * from the wall and the feature across is no part of it. Its depth is
   * marked, being on the same scale as the walls' heights; a through feature
   * has no floor.
   */
  feature: FeatureProfile
}
