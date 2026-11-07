/**
 * `@toolpath/plan/parts` — the functions `planDetails` is built from, for an app that shows the plan
 * another way: the tree of the constraints (`draftView`) and of Toolpath's plan (`resultsView`),
 * what each face is (`classifyFaces`, `groupFaces`), the checks before Apply and before a part moves
 * on, the counts, how each face shows, and the lookups of a group, an assignment and a setup.
 */
export {
  classifyFaces,
  type ConstraintsCoverage,
  groupFaces,
  planTags,
  type ResultsCoverage,
  tagSet,
} from '../faces/coverage'
export {
  allClear,
  changedSinceResults,
  type CheckContext,
  type CheckedDraft,
  confirmChecks,
  type ConfirmContext,
  planChecks,
} from '../check/checks'
export {
  currentFor,
  findPlaced,
  framesOf,
  assignedIn,
  assignmentOf,
  assignTargetOf,
} from '../draft/constraints'
export {
  allGroups,
  draftView,
  groupPath,
  listsTag,
  planCounts,
  sharedFaces,
  shownFaces,
} from '../details/view'
export { machines, resultsView, type ResultsView, setupOf } from '../results/view'
