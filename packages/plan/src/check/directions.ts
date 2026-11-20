import type { PlanDirection } from '../results/plan'
import { sameDirection } from '../draft/constraints'

/**
 * Where Toolpath's analysis of a direction a group faces stands: its features are in; they are on
 * their way — asked for, or detected and being analyzed; it detected the direction and can be asked
 * to analyze it; or it never detected it, nor was asked for it, so nothing can be planned from it.
 */
export type DirectionAnalysis = 'analyzed' | 'analyzing' | 'unanalyzed' | 'undetected'

/** What the part's report and its pending request say of its directions. */
export interface DirectionsKnown {
  /** The directions analyzed — the report's candidates — or null before the report is read. */
  analyzed: ReadonlyArray<PlanDirection> | null
  /** Every direction Toolpath detected, or null from a report that does not say. */
  discovered: ReadonlyArray<PlanDirection> | null
  /**
   * Toolpath is analyzing directions added to the part. Without `asked`, every direction it detected
   * and has not analyzed reads as on its way while it is.
   */
  pending: boolean
  /**
   * The directions asked for and not settled yet, exactly as sent: any unit vector, detected or
   * not. Given, only these are on their way: another detected direction stays `unanalyzed` while
   * they are analyzed.
   */
  asked?: ReadonlyArray<PlanDirection>
}

export const directionAnalysis = (
  direction: PlanDirection,
  { analyzed, discovered, pending, asked }: DirectionsKnown,
): DirectionAnalysis =>
  // Nothing is known before the report is read: nothing to say about it either.
  !analyzed || analyzed.some((each) => sameDirection(each, direction))
    ? 'analyzed'
    : asked?.some((each) => sameDirection(each, direction))
      ? 'analyzing'
      : !discovered?.some((each) => sameDirection(each, direction))
        ? 'undetected'
        : pending && !asked
          ? 'analyzing'
          : 'unanalyzed'
