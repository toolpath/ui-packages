import type { PlanDirection } from './engine-plan'
import { sameDirection } from './plan-draft'

/**
 * Where Toolpath's analysis of a direction a folder faces stands: its features are in; they are on
 * their way; it detected the direction and can be asked to analyze it; or it never detected it, and
 * nothing can be planned from it.
 */
export type DirectionAnalysis = 'analyzed' | 'analyzing' | 'unanalyzed' | 'undetected'

/** What the part's report and its pending request say of its directions. */
export interface DirectionsKnown {
  /** The directions analyzed — the report's candidates — or null before the report is read. */
  analyzed: ReadonlyArray<PlanDirection> | null
  /** Every direction Toolpath detected, or null from a report that does not say. */
  discovered: ReadonlyArray<PlanDirection> | null
  /** Toolpath is analyzing directions added to the part. */
  pending: boolean
}

export const directionAnalysis = (
  direction: PlanDirection,
  { analyzed, discovered, pending }: DirectionsKnown,
): DirectionAnalysis =>
  // Nothing is known before the report is read: nothing to say about it either.
  !analyzed || analyzed.some((each) => sameDirection(each, direction))
    ? 'analyzed'
    : !discovered?.some((each) => sameDirection(each, direction))
      ? 'undetected'
      : pending
        ? 'analyzing'
        : 'unanalyzed'
