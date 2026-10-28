/**
 * `@toolpath/plan` — plan mode for Toolpath, with no React, no DOM and no database. Two layers:
 *
 * - The constraints (`plan-draft`): what a person asks for — setups and the folders inside them,
 *   the features pinned to each, and the faces ignored. Every edit is a function from one draft to
 *   the next, or a refusal with its reason; `draft-action` lists them all as one closed list.
 *   `statementOf` turns the constraints into Toolpath's `setupPlan`.
 * - The plan (`engine-plan`): what Toolpath planned from them — setups, each with its direction and
 *   its actions, and what it could not reach.
 *
 * `coverage` reads what a draft and a plan leave of each face: ignored, pinned, open, machined or
 * not machined.
 * `plan-session` holds a page's edits until Apply: Undo, Redo, Discard and the history.
 * `plan-page` is the Plan page in one call (`planPage`): its constraints, Toolpath's plan, its
 * lookups and its paint. The functions it is built from are `@toolpath/plan/parts`; what a click on
 * the part means is `@toolpath/plan/clicks`.
 * An app keeps its own fields beside the constraints: `applyDraftAction` takes any draft that holds
 * them, and hands its other fields back unchanged.
 */
export {
  areaOf,
  type Coverage,
  COVERAGE_KINDS,
  COVERAGE_LABELS,
  type CoverageFeature,
  type CoverageKind,
  type Face,
  type FaceGroup,
  facesByRegion,
  isFallback,
  type PlanFeature,
  planFeaturesOf,
  tagKey,
  unlistedTrimmedFeatures,
} from './coverage'
export * from './direction-analysis'
export * from './draft-action'
export * from './engine-plan'
export * from './folder-sort'
export {
  type IgnoredAs,
  ignoreEdit,
  regionLabel,
  takeBackIgnore,
  unignoredNote,
  unignoreEdit,
  unpinnedNote,
} from './ignore'
export * from './not-machined'
export * from './pin'
export { type ConfirmCheck, describeClause, type PlanCheck, type ShowTarget } from './plan-checks'
export {
  addFolder,
  addSetup,
  type Constraints,
  copyDirection,
  type DraftFolder,
  type DraftSetup,
  type Edited,
  foldersFromPlan,
  type Frame,
  frameFacing,
  heightOf,
  type Hold,
  holdsFor,
  ignoredAs,
  ignoredAsSaved,
  indexedFor,
  isDirection,
  isIndexed,
  type Landing,
  liftLoneFolder,
  MAX_DEPTH,
  MAX_NAME,
  MAX_SETUPS,
  moveFeature,
  moveFolder,
  moveSetup,
  moveWithin,
  nextFolderName,
  parseDraftSetups,
  pinFrom,
  pinHomes,
  pinInto,
  type Pinned,
  type PinnedFeature,
  pinsWhere,
  type PlacedFolder,
  placedFolders,
  planFromResults,
  type PlannedSetup,
  type PlanRules,
  removeFolder,
  removeFolders,
  renameFolder,
  restoreFeature,
  sameDirection,
  setSetupProcess,
  setToolOrientation,
  type SetupProcess,
  type Statement,
  statementOf,
  unpinFeature,
  withFolders,
  withIgnored,
  withoutIgnored,
} from './plan-draft'
export * from './plan-page'
export * from './plan-session'
export {
  DONE_COLOR,
  type FaceHatch,
  type FacePaint,
  type FeatureBore,
  featureGroups,
  type FeatureGroupView,
  featureTypeLabel,
  featureTypePlural,
  IGNORE,
  isHoleType,
  OTHER_FOLDER_COLOR,
  PART_ROW,
  type PlanFeatureRow,
  type PlanHighlight,
  type PlannedSetupView,
  type PlanOrientationView,
  type PlanPart,
  type PlanSetupView,
  planView,
  refusalClauses,
  rowsOf,
  UNMACHINED_FACE_COLOR,
} from './plan-view'
export { type ResultsFeatureRow, type ResultsSetupView, type UnmachinedMark } from './results-view'
export * from './same-json'
