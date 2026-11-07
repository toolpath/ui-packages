import type { PlanDirection } from '../results/plan'
import { framesOf, type DraftSetup } from './constraints'

/*
  What the draft tells Toolpath on Apply: the request's `setupPlan`.
*/

/**
 * The plan as Toolpath's `setupPlan` takes it: setups in order, each one direction and its
 * assignments.
 */
export interface Statement {
  setups: Array<{ orientations: Array<{ direction: PlanDirection; features: Array<string> }> }>
}

/**
 * What the draft tells Toolpath: every frame, in tree order, each a 3-axis setup of its own with
 * its assignments — a floor Toolpath appends to. Null with no frames: Toolpath plans the part
 * itself. Setup `i` of the statement is frame `i`.
 */
export const statementOf = (setups: ReadonlyArray<DraftSetup>): Statement | null => {
  const frames = framesOf(setups)
  if (frames.length === 0) {
    return null
  }
  return {
    setups: frames.map((frame) => ({
      orientations: [{ direction: frame.direction, features: frame.features }],
    })),
  }
}
