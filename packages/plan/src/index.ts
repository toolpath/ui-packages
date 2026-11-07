/**
 * `@toolpath/plan` — plan mode for Toolpath, with no React, no DOM and no database. A plan goes
 * from a draft, through its checks, to Toolpath's results, and each step is a group:
 *
 * - `draft/`: the constraints a person asks for — setups and the groups inside them, the features
 *   assigned to each, and the faces done (`constraints`). Every edit is a function from one draft
 *   to the next, or a refusal with its reason; `actions` lists them all as one closed list, and
 *   `session` holds a page's edits until Apply: Undo, Redo, Discard and the history. `statement`
 *   turns the constraints into Toolpath's `setupPlan`.
 * - `check/`: what would stop Toolpath taking the constraints, what is worth knowing before the part
 *   moves on, and where Toolpath's analysis of each direction stands.
 * - `results/`: what Toolpath planned from them (`plan`) — setups, each with its direction and its
 *   actions, and what it could not reach — in the kernel's shape (`plan-view`), as a tree
 *   (`view`), and why a feature is left (`leftovers`).
 * - `faces/`: what a draft and a plan leave of each face: done, assigned, open, machined or not
 *   machined.
 * - `details/`: the plan's details in one call (`planDetails`): its constraints, Toolpath's plan, its
 *   lookups, how each face shows and where a feature is (`state`). The functions it is built from
 *   are `@toolpath/plan/parts`.
 * An app keeps its own fields beside the constraints: `applyDraftAction` takes any draft that holds
 * them, and hands its other fields back unchanged.
 */
export {
  areaOf,
  type Coverage,
  COVERAGE_KINDS,
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
} from './faces/coverage'
export * from './check/directions'
export * from './draft/actions'
export * from './results/plan'
export * from './draft/sort'
export { type DoneAs, markDoneEdit, takeBackDone, unmarkDoneEdit } from './draft/done'
export * from './results/leftovers'
export * from './draft/assign'
export {
  type ConfirmCheck,
  type DescribedClause,
  describeClause,
  type PlanCheck,
  type ShowTarget,
} from './check/checks'
export {
  addGroup,
  type AddGroupOptions,
  addSetup,
  type Constraints,
  copyDirection,
  type DraftGroup,
  type DraftSetup,
  type DraftInvalid,
  type Edited,
  groupsFromPlan,
  type Frame,
  frameFacing,
  heightOf,
  type Hold,
  holdsFor,
  doneAs,
  doneAsSaved,
  indexedFor,
  isDirection,
  isIndexed,
  type Landing,
  liftLoneGroup,
  MAX_DEPTH,
  MAX_NAME,
  MAX_SETUPS,
  moveFeature,
  type MoveFeatureOptions,
  moveGroup,
  type MoveGroupOptions,
  moveSetup,
  moveWithin,
  type NameGroup,
  nextGroupName,
  parseDraftSetups,
  assignFrom,
  type AssignFromOptions,
  assignedGroupByTag,
  assignInto,
  type AssignIntoOptions,
  type Assigned,
  type AssignedFeature,
  assignmentsWhere,
  type PlacedGroup,
  placedGroups,
  planFromResults,
  type PlannedSetup,
  type PlanRules,
  removeGroup,
  removeGroups,
  renameGroup,
  restoreFeature,
  sameDirection,
  setSetupProcess,
  setOrientation,
  type SetupProcess,
  unassignFeature,
  withGroups,
  withDone,
  withoutDone,
} from './draft/constraints'
export { type GroupRef, type Refusal, type Refused } from './draft/refusals'
export { type Statement, statementOf } from './draft/statement'
export * from './details/details'
export * from './draft/session'
export {
  type FaceDirection,
  featureSections,
  type FeatureSectionView,
  featureTypeLabel,
  featureTypePlural,
  isHoleType,
  type PlanHighlight,
  type RefusalClause,
  refusalClauses,
  rowsOf,
  type SharedFace,
  type ShownFace,
} from './details/view'
export * from './details/state'
export {
  type FeatureBore,
  type PlanFeatureRow,
  type PlannedSetupView,
  type PlanOrientationView,
  type PlanPart,
  type PlanSetupView,
  planView,
} from './results/plan-view'
export { type ResultsFeatureRow, type ResultsSetupView, type UnmachinedMark } from './results/view'
export * from './draft/compare'
