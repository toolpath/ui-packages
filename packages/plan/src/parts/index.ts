/**
 * `@toolpath/plan/parts` — the functions `planDetails` is built from, for an app that shows the plan
 * another way: the tree of the constraints (`draftView`) and of Toolpath's plan (`resultsView`),
 * what each face is (`classifyFaces`, `groupFaces`), the checks before Apply and before a part moves
 * on, the counts, the paint, and the lookups of a folder, a pin and a setup.
 */
export {
  classifyFaces,
  type ConstraintsCoverage,
  groupFaces,
  planTags,
  type ResultsCoverage,
  tagSet,
} from '../coverage'
export {
  allClear,
  changedSinceResults,
  type CheckContext,
  type CheckedDraft,
  confirmChecks,
  type ConfirmContext,
  planChecks,
} from '../plan-checks'
export { currentFor, findPlaced, framesOf, pinnedIn, pinOf, pinTargetOf } from '../plan-draft'
export {
  allFolders,
  draftView,
  folderPath,
  listsTag,
  planCounts,
  planHatch,
  planPaint,
} from '../plan-view'
export { machines, resultsView, type ResultsView, setupOf } from '../results-view'
