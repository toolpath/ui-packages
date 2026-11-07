import {
  doneAsSaved,
  assignmentsWhere,
  unassignFeature,
  withDone,
  withoutDone,
  type Constraints,
  type AssignedFeature,
  type PlanRules,
} from './constraints'

/*
  What marking done does to the plan, apart from the page that wires it. A done region needs no
  machining — it is at its final surface already — which is a fact about the part's geometry, from
  no direction and of no feature. The region — the kernel's, what `doneRegions` carries — is the
  unit: a click marks done the regions the app reads from it — a region, a CAD face's or a feature's
  — and the regions are what is kept (`done`) and sent to Toolpath. Features never name what is
  done: the regions are. The mark wins over an assignment, one way: an assignment whose every region
  is done is unassigned — plainly, nothing kept out — while an assignment with a region left stays,
  Toolpath machining it whole and keeping its done regions out of its issues (Engine API 1.19). The
  other way, assigning wins: a feature assigned has its regions unmarked with it (`withAssignment`
  in `assign`). Unmarking never re-assigns.
*/

/**
 * Mark done faces. An assignment — in any group — whose every face is done with them is
 * unassigned: the marking done wins. A plain unassign: the feature is open, its faces done.
 */
export const markDoneEdit = (
  plan: Constraints,
  regions: ReadonlyArray<number>,
  context: Pick<PlanRules, 'kernel' | 'regionsOf'>,
): { intent: Constraints; unassigned: Array<AssignedFeature> } => {
  const marked = withDone(plan, regions, context.kernel)
  const done = new Set(marked.done)
  const these = new Set(regions)
  // Assigns with a face among those done now, and none left: covered by marking these done.
  const unassigned = assignmentsWhere(plan.setups, (tag) => {
    const faces = context.regionsOf(tag)
    return faces.some((face) => these.has(face)) && faces.every((face) => done.has(face))
  })
  return {
    intent: {
      setups: unassigned.reduce(
        (all, assignment) => unassignFeature(all, assignment.setupId, assignment.tag),
        [...plan.setups],
      ),
      ...marked,
    },
    unassigned,
  }
}

/** Stop marking done faces. */
export const unmarkDoneEdit = (
  plan: Constraints,
  regions: ReadonlyArray<number>,
  context: Pick<PlanRules, 'kernel'>,
): Constraints => ({ setups: [...plan.setups], ...withoutDone(plan, regions, context.kernel) })

/**
 * What a Mark done click took, as the app reads it: the feature it means, if any, and its regions.
 * `chooseDoneReading` names it to put those regions back.
 */
export interface DoneAs {
  tag: string | null
  regions: ReadonlyArray<number>
}

/** The plan with a click's regions done as `saved` had them, and nothing else changed. */
export const takeBackDone = (
  plan: Constraints,
  saved: Constraints,
  regions: ReadonlyArray<number>,
  context: Pick<PlanRules, 'kernel'>,
): Constraints => ({
  setups: [...plan.setups],
  ...doneAsSaved(plan, saved, regions, context.kernel),
})
