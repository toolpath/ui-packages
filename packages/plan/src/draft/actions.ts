import { blockedByChecks, type CheckContext } from '../check/checks'
import { tagKey } from '../faces/coverage'
import type { PlanDirection, TrimmedFeature } from '../results/plan'
import { markDoneEdit, takeBackDone, unmarkDoneEdit, type DoneAs } from './done'
import {
  chooseReading,
  toggleAssignment,
  assignEdit,
  unmarkAssigned,
  withAssignment,
} from './assign'
import {
  addGroup,
  addSetup,
  currentFor,
  findPlaced,
  groupsFromPlan,
  frameFacing,
  isIndexed,
  MAX_SETUPS,
  moveFeature,
  moveGroup,
  moveWithin,
  parseDirections,
  assignedGroupByTag,
  assignedIn,
  assignmentsWhere,
  placedGroups,
  planFromResults,
  removeFromPlan,
  renameGroup,
  sameDirection,
  setSetupProcess,
  setOrientation,
  unassignFeature,
  type Constraints,
  type DraftSetup,
  type Edited,
  type Landing,
  type AssignedFeature,
  type PlannedSetup,
  type PlanRules,
  type SetupProcess,
} from './constraints'
import {
  assignRegionsEdit,
  editFeatureEdit,
  openRegionsEdit,
  keptToRegionRules,
  withTrimmedAsOwn,
  customFeaturesOf,
  unassignCustomEdit,
  adoptEdit,
  ignoreRegionsEdit,
  type FeatureRef,
} from './custom'
import { groupRef, GONE, MAX_DEPTH, type Refusal, type Refused, TOO_DEEP } from './refusals'

/*
  Every edit a person can make to a plan, as one closed list (`DraftAction`), carried out by one
  function (`applyDraftAction`), with one question a page asks before it offers any (`actionsFor`):
  what can be done here? A click on the part, a row dropped in the tree and a button all make the
  same edit through `applyDraftAction`, with the plan the app's own helpers (`assignEdit`,
  `toggleAssignment`, `chooseReading`, `markDoneEdit`, …) make for that click.

  An action carries everything it needs, ids for anything it makes included, so applying it to the
  same draft gives the same plan. Nothing here throws on typed input. An action that can't be made
  answers `{ refused }`, a `Refusal` the app words for the person; one that changes nothing answers
  the draft as it was.
*/

/**
 * One edit to a plan's constraints: its setups, groups, assignments and done faces. Every id an
 * action names for something it makes must be new to the draft, even where the edit ends up not
 * needing it; ids from `crypto.randomUUID()` are. `direction` on a feature is the direction that
 * reading of it was read from, as the part's features name it: the package can't check it.
 */
export type DraftAction =
  /**
   * A group inside another, at the end (`addGroup`). `id` is the new group's; `workId` is for the
   * group the parent's own work moves into, where the parent held no groups yet.
   */
  | { kind: 'addGroup'; parentId: string; id: string; workId: string }
  | { kind: 'renameGroup'; id: string; name: string }
  /**
   * What Delete removes: groups — setups too — with all they hold, and assigned features, each
   * taken out of the group named (`setupId`). With every setup named, it is Remove all: Toolpath
   * plans the part as it would. Groups gone already are passed over.
   */
  | { kind: 'remove'; groups: ReadonlyArray<string>; features?: ReadonlyArray<AssignedFeature> }
  /** A group dropped somewhere in the tree (`moveGroup`). */
  | { kind: 'moveGroup'; id: string; to: Landing }
  /** A group moved `by` whole places up (negative) or down among the groups beside it. */
  | { kind: 'moveWithin'; id: string; by: number }
  /** A setup facing a direction no setup or orientation faces yet, last. */
  | { kind: 'addSetup'; direction: PlanDirection; id: string }
  /** Hold a setup 3+1 or 3+2, or 3 axis (`null`). */
  | { kind: 'setProcess'; setupId: string; process: SetupProcess | null }
  /** Make a group an orientation facing `direction`, or follow its parent again (`null`). */
  | { kind: 'setOrientation'; groupId: string; direction: PlanDirection | null }
  /**
   * A click on the part in an open group (`toggleAssignment`), or an assignment into a group named
   * (`assignEdit`): the feature assigned there — or, assigned there already, taken out.
   */
  | { kind: 'assignInto'; tag: string; direction: PlanDirection; groupId: string }
  /**
   * Machine a feature from its direction (`assignEdit`): assigned in the group facing that way, or
   * in a new setup facing it — or, assigned in that direction's groups already, let go. `newId` is
   * that setup's.
   */
  | { kind: 'assignFrom'; tag: string; direction: PlanDirection; newId: string }
  /**
   * A feature's row dropped on a group (`moveFeature`): assigned there, or in the first group in
   * it cut from its direction, as any assignment is (`withAssignment`).
   */
  | { kind: 'moveFeature'; tag: string; direction: PlanDirection; groupId: string }
  /**
   * A pick among the features a click in a group read (`chooseReading`): `reading` meant instead
   * of `tag`, which a left click assigned (`target: 'assign'`) or left in the group (`'add'`), or
   * a right click took out (`'takeOut'`), in `groupId`. Where the click's edit no longer stands —
   * Undo, Discard — it is made again first, in the same step. Needs the plan as saved. A group
   * gone since — Undo — changes nothing.
   */
  | {
      kind: 'chooseAssignReading'
      tag: string
      target: 'assign' | 'add' | 'takeOut'
      reading: string
      groupId: string
    }
  /**
   * A pick among the features a Mark done click read: `tag` done instead of what the click took
   * (`click`, an `DoneAs`), whose faces go back as saved where its edit still
   * stands. The click's own feature, its edit standing, changes nothing. Needs the plan as saved.
   */
  | { kind: 'chooseDoneReading'; tag: string; click: DoneAs }
  /**
   * Start from Toolpath's plan, on a plan with no groups: groups facing each of its setups
   * (`groupsFromPlan`), and with `assignments` every feature assigned where it was planned
   * (`planFromResults`), trimmed ones too, its faces no longer done. With `checks`, nothing the
   * checklist would block is stated: such a feature is left open and such a group left out, for
   * Toolpath to plan. New groups' ids are `idSeed`, `-` and a count: no `:`, which an app may use to
   * join an id with other keys.
   */
  | {
      kind: 'fromPlan'
      planned: ReadonlyArray<PlannedSetup>
      assignments: boolean
      idSeed: string
      /**
       * Features the plan cut as stated by region: no features of the part's, so on a part with a
       * `preparationId` each is assigned as one of its group's own, its regions and type as the plan
       * cut them (`withTrimmedAsOwn`); on one without, by its tag.
       */
      trimmed?: ReadonlyArray<TrimmedCut>
      /**
       * What the checklist reads of the part (`planChecks`). Optional only so earlier callers keep
       * compiling: left out, what the checklist would block is stated as planned.
       */
      checks?: CheckContext
    }
  /**
   * Pins of features the plan cut, a draft held from before, made their groups' own as `fromPlan`
   * makes them; their faces no longer done. Changes nothing on a part with no `preparationId`.
   */
  | { kind: 'trimmedAsOwn'; trimmed: ReadonlyArray<TrimmedCut> }
  /** Let an assigned feature go: Toolpath decides again where it is machined. */
  | { kind: 'unassign'; tag: string }
  /** Mark done faces: region indices, in the kernel `PlanRules` names. */
  | { kind: 'markDone'; regions: ReadonlyArray<number> }
  | { kind: 'unmarkDone'; regions: ReadonlyArray<number> }
  /**
   * Regions assigned to a group as one feature of its own; `share` keeps
   * them in other frames' features too (Keep Both), else they leave them (Take Over).
   */
  | { kind: 'assignRegions'; groupId: string; regions: ReadonlyArray<number>; share: boolean }
  /**
   * A feature's regions replaced, as one of the group's own; none lets it go. With `into`, another
   * group of its frame, the edited feature moves there (D-18).
   */
  | {
      kind: 'editFeature'
      groupId: string
      feature: FeatureRef
      regions: ReadonlyArray<number>
      into?: string
    }
  /** One of a group's own features let go. */
  | { kind: 'unassignCustom'; groupId: string; index: number }
  /** Regions open: in no feature, not done, for Toolpath to decide; with `groupId`, out of that group's only. */
  | { kind: 'openRegions'; regions: ReadonlyArray<number>; groupId?: string }
  /**
   * Adopt's Confirm, one step: features read from the group's direction
   * pinned there, others taken out of it; `share` keeps pinned regions in other frames' features
   * too (Keep Both), else they leave them (Take Over).
   */
  | {
      kind: 'adopt'
      groupId: string
      pin: ReadonlyArray<string>
      takeOut: ReadonlyArray<FeatureRef>
      share: boolean
    }
  /** The tray's Ignore Confirm, one step: regions ignored, others no longer. */
  | { kind: 'ignoreRegions'; ignore: ReadonlyArray<number>; unignore: ReadonlyArray<number> }
  /**
   * Whether Toolpath may add setups after the stated ones: in any direction (`null`), or in none
   * (`[]`).
   */
  | { kind: 'setAdditionalDirections'; directions: ReadonlyArray<PlanDirection> | null }

export type DraftActionKind = DraftAction['kind']

/** A feature a plan cut, as far as a draft states it. */
type TrimmedCut = Pick<TrimmedFeature, 'featureTag' | 'featureType' | 'regionIdxs'>

/** Every kind of action, in the order `actionsFor` lists them. */
export const DRAFT_ACTION_KINDS: ReadonlyArray<DraftActionKind> = [
  'addGroup',
  'renameGroup',
  'remove',
  'moveGroup',
  'moveWithin',
  'addSetup',
  'setProcess',
  'setOrientation',
  'assignInto',
  'assignFrom',
  'moveFeature',
  'unassign',
  'markDone',
  'unmarkDone',
  'chooseAssignReading',
  'chooseDoneReading',
  'fromPlan',
  'assignRegions',
  'editFeature',
  'unassignCustom',
  'openRegions',
  'adopt',
  'ignoreRegions',
  'trimmedAsOwn',
  'setAdditionalDirections',
]

/**
 * What an action did to the plan beyond the draft's own change: effects that comparing two drafts
 * does not show plainly. Empty lists and `false` where there are none.
 */
export interface DraftFacts {
  /**
   * An assignment's: the person's assignments it let go, because it covers every face of each. By
   * tag.
   */
  replaced: ReadonlyArray<string>
  /**
   * Faces done before the action and not after, ascending: what an assignment, `fromPlan` with
   * assignments and `unmarkDone` give back. A pick among a Mark done click's readings says only
   * what it marks done, so the faces it gives back are not here.
   */
  unmarked: ReadonlyArray<number>
  /** Marking done's: the assignments it let go, each with the group it was in. */
  unassigned: ReadonlyArray<AssignedFeature>
  /** An assignment's: a setup was added for it, facing its way. */
  added: boolean
}

/** What an action made of the draft, and what else it did; or why it can't be made. */
export type DraftResult<T extends Constraints> = { draft: T; facts: DraftFacts } | Refused

const NO_FACTS: DraftFacts = Object.freeze({
  replaced: Object.freeze([]),
  unmarked: Object.freeze([]),
  unassigned: Object.freeze([]),
  added: false,
})

const TOO_MANY: Refusal = { kind: 'tooManySetups', max: MAX_SETUPS }
const OTHER_WAY: Refusal = { kind: 'otherWay' }
const TAKEN: Refusal = { kind: 'idTaken' }
const NOT_AN_ACTION: Refusal = { kind: 'notAnAction' }
const NEEDS_SAVED: Refusal = { kind: 'needsSaved' }
const NOT_EMPTY: Refusal = { kind: 'notEmpty' }
const NO_TOOL: Refusal = { kind: 'noTool' }

/**
 * The kinds that assign a feature someone chose: each is refused where it assigns one anew that
 * Toolpath plans no pass for (`PlanRules.unplannable`).
 */
const ASSIGNING: ReadonlySet<DraftActionKind> = new Set([
  'assignInto',
  'assignFrom',
  'moveFeature',
  'chooseAssignReading',
  'adopt',
])

/** Whether `after` assigns a feature `before` does not that Toolpath plans no pass for. */
const assignmentsUnplannable = (
  before: Constraints,
  after: Constraints,
  rules: Pick<PlanRules, 'unplannable'>,
): boolean => {
  const { unplannable } = rules
  if (!unplannable) {
    return false
  }
  const had = assignedGroupByTag(before.setups)
  return [...assignedGroupByTag(after.setups).keys()].some(
    (tag) => !had.has(tag) && unplannable(tag),
  )
}

/**
 * Carry out one action on a draft: the draft after it, every other part of it as it was, or why it
 * can't be made. `rules` reads the part: a feature's faces, and the kernel that numbers them.
 *
 * An assignment is what assigning is in Toolpath's own app: the person's assignments it covers are
 * let go, and its faces are no longer done; assigning a feature where it is assigned already lets
 * it go, as a click there does. Marking done faces lets go of every assignment they cover. An
 * unassign of what is assigned nowhere, and a reorder past the end, change nothing. Where the
 * functions in `constraints` would quietly change nothing — a group too deep, a group gone — this
 * refuses, saying why. `saved`, the plan as saved, is what the two picks among a click's readings
 * put back; `nextSession` passes it.
 */
export const applyDraftAction = <T extends Constraints>(
  draft: T,
  action: DraftAction,
  rules: PlanRules,
  saved?: Constraints,
): DraftResult<T> => {
  if (typeof action !== 'object' || action === null) {
    return { refused: NOT_AN_ACTION }
  }
  const result = carryOut({ draft, rules, saved }, action)
  if ('refused' in result) {
    return result
  }
  if (ASSIGNING.has(action.kind) && assignmentsUnplannable(draft, result.draft, rules)) {
    return { refused: NO_TOOL }
  }
  const unmarked =
    action.kind === 'chooseDoneReading' ? [] : doneNoLonger(draft, result.draft, rules)
  // Every edit, the region ones and main's alike, leaves the draft to the region rules.
  const kept = keptToRegionRules(draft, result.draft, rules.regionsOf) as T
  return {
    draft: withAddedLimit(draft, kept, rules),
    facts: { ...NO_FACTS, ...result.facts, unmarked },
  }
}

/**
 * The draft `after` an edit, with its limit on the directions Toolpath may add setups in. Once it
 * states no setup there is none: with none, Toolpath must add them. Its first setup starts with
 * Toolpath adding none, on a part whose analysis numbers its regions, since only a plan spec can
 * say so; a draft that states setups already keeps what it says.
 */
const withAddedLimit = <T extends Constraints>(
  before: Constraints,
  after: T,
  rules: Pick<PlanRules, 'preparationId'>,
): T => {
  if (after.setups.length === 0) {
    return after.additionalDirections ? { ...after, additionalDirections: null } : after
  }
  return before.setups.length === 0 && !after.additionalDirections && rules.preparationId
    ? { ...after, additionalDirections: [] }
    : after
}

/** The regions `before` marks done and `after` does not, ascending. */
const doneNoLonger = (
  before: Constraints,
  after: Constraints,
  rules: Pick<PlanRules, 'kernel'>,
): Array<number> => {
  const still = new Set(doneIn(after, rules))
  return doneIn(before, rules)
    .filter((region) => !still.has(region))
    .sort((a, b) => a - b)
}

/** The regions a plan marks done, in the kernel `rules` names. */
const doneIn = (plan: Constraints, rules: Pick<PlanRules, 'kernel'>): Array<number> =>
  currentFor(plan.done, plan.doneKernel, rules.kernel)

/** One action's draft and facts — the faces it unmarked aside — or why it can't be made. */
type Outcome<T extends Constraints> = Done<T> | Refused
type Done<T extends Constraints> = { draft: T; facts?: Partial<DraftFacts> }

/** What an action is carried out on: the draft, how to read the part, and the plan as saved. */
interface Editing<T extends Constraints> {
  draft: T
  rules: PlanRules
  saved: Constraints | undefined
}

type ActionOf<K extends DraftActionKind> = Extract<DraftAction, { kind: K }>

/** How one kind of action is carried out. */
type CarryOut<K extends DraftActionKind> = <T extends Constraints>(
  editing: Editing<T>,
  action: ActionOf<K>,
) => Outcome<T>

/** Where `assignEdit` assigns: a group named, or the group facing a direction. */
type AssignAt = Parameters<typeof assignEdit>[2]

/** The draft with new constraints, everything else of it as it was. */
const withConstraints = <T extends Constraints>(
  draft: T,
  intent: Constraints,
  more: Omit<Done<T>, 'draft'> = {},
): Done<T> => ({ ...more, draft: { ...draft, ...intent } })

/** The draft with new setups. */
const withSetups = <T extends Constraints>(draft: T, setups: Array<DraftSetup>): Done<T> =>
  withConstraints(draft, { ...draft, setups })

/** `withSetups` for an edit `constraints` may refuse. */
const withEdited = <T extends Constraints>(draft: T, edited: Edited): Outcome<T> =>
  Array.isArray(edited) ? withSetups(draft, edited) : { refused: edited.refused }

/** `withConstraints` for a region edit, which may refuse. */
const withRegionEdit = <T extends Constraints>(
  draft: T,
  edited: Constraints | Refused,
): Outcome<T> => ('refused' in edited ? edited : withConstraints(draft, edited))

/** Whether untyped code's feature is a `FeatureRef`: a tag, or a place among a group's own. */
const isFeatureRef = (value: unknown): value is FeatureRef =>
  typeof value === 'object' &&
  value !== null &&
  ('tag' in value
    ? typeof value.tag === 'string'
    : 'custom' in value && Number.isInteger(value.custom))

/** Whether the draft has a setup or group with this id. */
const holds = (draft: Constraints, id: string): boolean =>
  findPlaced(draft.setups, id) !== undefined

/** Whether any of these ids is in the draft already, or named twice. */
const anyTaken = (draft: Constraints, ...ids: Array<string>): boolean =>
  ids.some((id) => holds(draft, id)) || new Set(ids).size < ids.length

/** An assignment as `assignEdit` makes it, with what it did. */
const assigned = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  at: AssignAt,
  tag: string,
): Outcome<T> => {
  const assignment = assignEdit(draft, tag, at, rules)
  if ('refused' in assignment) {
    return assignment
  }
  return withConstraints(draft, assignment.intent, {
    facts: {
      replaced: assignment.replaced,
      added: assignment.added,
    },
  })
}

/** `addGroup`: a group inside another — unless the parent is gone or too deep, or an id taken. */
const applyAddGroup = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'addGroup'>,
): Outcome<T> => {
  const parent = findPlaced(draft.setups, action.parentId)
  if (!parent) {
    return { refused: GONE }
  }
  if (parent.depth >= MAX_DEPTH) {
    return { refused: TOO_DEEP }
  }
  if (anyTaken(draft, action.id, action.workId)) {
    return { refused: TAKEN }
  }
  const { parentId, id, workId } = action
  const setups = addGroup(draft.setups, { parentId, id, workId, nameGroup: rules.nameGroup })
  return withSetups(draft, setups)
}

/** `renameGroup`: a group renamed, unless it is gone. */
const applyRenameGroup = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'renameGroup'>,
): Outcome<T> => {
  if (!holds(draft, action.id)) {
    return { refused: GONE }
  }
  return withSetups(draft, renameGroup(draft.setups, action.id, action.name))
}

/** `remove`: the assignments named let go, then the groups named removed, any gone passed over. */
const applyRemove = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'remove'>,
): Outcome<T> => {
  if (!Array.isArray(action.groups)) {
    return { refused: NOT_AN_ACTION }
  }
  return withSetups(
    draft,
    removeFromPlan(draft.setups, {
      features: action.features ?? [],
      groups: action.groups.filter((id) => holds(draft, id)),
    }),
  )
}

/** `moveGroup`: a group dropped in the tree — unless it is gone. */
const applyMoveGroup = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'moveGroup'>,
): Outcome<T> => {
  if (!holds(draft, action.id)) {
    return { refused: GONE }
  }
  return withEdited(draft, moveGroup(draft.setups, { id: action.id, to: action.to }))
}

/** `moveWithin`: a group moved a whole number of places among the groups beside it. */
const applyMoveWithin = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'moveWithin'>,
): Outcome<T> => {
  if (!holds(draft, action.id)) {
    return { refused: GONE }
  }
  if (!Number.isInteger(action.by)) {
    return { refused: { kind: 'notWholeMove' } }
  }
  return withSetups(draft, moveWithin(draft.setups, action.id, action.by))
}

/** `addSetup`: a setup facing a new direction, last — unless the plan is full, or the id taken. */
const applyAddSetup = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'addSetup'>,
): Outcome<T> => {
  const facing = frameFacing(draft.setups, action.direction)
  if (facing) {
    return { refused: { kind: 'directionTaken', group: groupRef(facing) } }
  }
  if (draft.setups.length >= MAX_SETUPS) {
    return { refused: TOO_MANY }
  }
  if (anyTaken(draft, action.id)) {
    return { refused: TAKEN }
  }
  return withSetups(draft, addSetup(draft.setups, action.direction, action.id, rules.nameGroup))
}

/** `setProcess`: a setup's hold set — unless it is gone, or the id is not a setup's. */
const applySetProcess = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'setProcess'>,
): Outcome<T> => {
  if (!draft.setups.some((setup) => setup.id === action.setupId)) {
    return { refused: holds(draft, action.setupId) ? { kind: 'holdOnlySetup' } : GONE }
  }
  const process = action.process ?? undefined
  return withEdited(draft, setSetupProcess(draft.setups, action.setupId, process))
}

/** `setOrientation`: a group made an orientation, or following again. */
const applySetOrientation = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'setOrientation'>,
): Outcome<T> => {
  if (!holds(draft, action.groupId)) {
    return { refused: GONE }
  }
  return withEdited(draft, setOrientation(draft.setups, action.groupId, action.direction))
}

/**
 * `assignInto`: a feature assigned in a group facing its way, or taken out where assigned there.
 */
const applyAssignInto = <T extends Constraints>(
  editing: Editing<T>,
  action: ActionOf<'assignInto'>,
): Outcome<T> => {
  const { setups } = editing.draft
  const target = findPlaced(setups, action.groupId)
  if (!target) {
    return { refused: GONE }
  }
  // Assigned there already, it is taken out, whichever way the group now faces.
  if (assignedIn(setups, action.tag) === action.groupId) {
    return assigned(editing, { groupId: action.groupId }, action.tag)
  }
  if (!sameDirection(target.direction, action.direction)) {
    return { refused: OTHER_WAY }
  }
  return assigned(editing, { groupId: action.groupId }, action.tag)
}

/** `assignFrom`: a feature assigned from its direction, in a setup added where none faces it. */
const applyAssignFrom = <T extends Constraints>(
  editing: Editing<T>,
  action: ActionOf<'assignFrom'>,
): Outcome<T> => {
  if (anyTaken(editing.draft, action.newId)) {
    return { refused: TAKEN }
  }
  return assigned(editing, { direction: action.direction, newId: action.newId }, action.tag)
}

/** `moveFeature`: a feature's row dropped on a group, and assigned there as any assignment is. */
const applyMoveFeature = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'moveFeature'>,
): Outcome<T> => {
  const { tag, direction, groupId } = action
  const moved = moveFeature(draft.setups, { tag, direction, groupId })
  if (!Array.isArray(moved)) {
    return { refused: moved.refused }
  }
  const assignment = withAssignment(draft, tag, moved, rules)
  return withConstraints(draft, assignment.intent, {
    facts: { replaced: assignment.replaced },
  })
}

/** `unassign`: an assigned feature let go; one assigned nowhere changes nothing. */
const applyUnassign = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'unassign'>,
): Outcome<T> => {
  const home = assignedIn(draft.setups, action.tag)
  if (!home) {
    return { draft }
  }
  return withSetups(draft, unassignFeature(draft.setups, home, action.tag))
}

/** `markDone`: faces done, and every assignment they cover let go. */
const applyMarkDone = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'markDone'>,
): Outcome<T> => {
  if (!Array.isArray(action.regions)) {
    return { refused: NOT_AN_ACTION }
  }
  const done = markDoneEdit(draft, action.regions, rules)
  return withConstraints(draft, done.intent, { facts: { unassigned: done.unassigned } })
}

/** `unmarkDone`: faces no longer done. */
const applyUnmarkDone = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'unmarkDone'>,
): Outcome<T> => {
  if (!Array.isArray(action.regions)) {
    return { refused: NOT_AN_ACTION }
  }
  return withConstraints(draft, unmarkDoneEdit(draft, action.regions, rules))
}

/** `chooseAssignReading`: a pick among a click's readings, the click made again if taken back. */
const applyChooseAssignReading = <T extends Constraints>(
  { draft, rules, saved }: Editing<T>,
  action: ActionOf<'chooseAssignReading'>,
): Outcome<T> => {
  const placed = findPlaced(draft.setups, action.groupId)
  if (!placed) {
    return { draft }
  }
  if (!saved) {
    return { refused: NEEDS_SAVED }
  }
  const clicked = withClickStanding(draft, action, placed, rules)
  const chosen = chooseReading(
    clicked,
    saved,
    { tag: action.tag, target: action.target },
    action.reading,
    { id: action.groupId, direction: placed.direction },
    rules,
  )
  return withConstraints(draft, chosen.intent)
}

/** The draft with a group click's edit standing: made again where Undo or Discard took it back. */
const withClickStanding = (
  draft: Constraints,
  action: ActionOf<'chooseAssignReading'>,
  placed: NonNullable<ReturnType<typeof findPlaced>>,
  rules: PlanRules,
): Constraints => {
  const inGroup = assignedIn(draft.setups, action.tag) === action.groupId
  // The click's edit stands where an assignment is in the group, or a feature taken out is not; a
  // feature left in the group made none.
  const standing = action.target === 'add' || inGroup !== (action.target === 'takeOut')
  if (standing) {
    return draft
  }
  const feature = { tag: action.tag, direction: placed.direction, inGroup }
  return toggleAssignment(draft, feature, { id: action.groupId }, rules).intent
}

/** `chooseDoneReading`: a pick among a Mark done click's readings, its faces back as saved. */
const applyChooseDoneReading = <T extends Constraints>(
  { draft, rules, saved }: Editing<T>,
  action: ActionOf<'chooseDoneReading'>,
): Outcome<T> => {
  if (!saved) {
    return { refused: NEEDS_SAVED }
  }
  const clicked = action.click.regions
  const done = new Set(doneIn(draft, rules))
  // The click's edit stands where every region it marked is done still.
  const stands = clicked.every((region) => done.has(region))
  if (stands && action.tag === action.click.tag) {
    return { draft }
  }
  const back = stands ? takeBackDone(draft, saved, clicked, rules) : draft
  const chosen = markDoneEdit(back, rules.regionsOf(action.tag), rules)
  return withConstraints(draft, chosen.intent, { facts: { unassigned: chosen.unassigned } })
}

/**
 * `fromPlan`: Toolpath's plan as groups, and with `assignments` its features assigned where
 * planned.
 */
const applyFromPlan = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'fromPlan'>,
): Outcome<T> => {
  if (draft.setups.length > 0) {
    return { refused: NOT_EMPTY }
  }
  let count = 0
  const newId = () => `${action.idSeed}-${count++}`
  const from = (action.assignments ? planFromResults : groupsFromPlan)(
    action.planned,
    newId,
    rules.nameGroup,
  )
  if (!action.assignments) {
    return withSetups(draft, action.checks ? sendable(from, action.checks) : from)
  }
  // Checked as it will be stated: the plan's trimmed pins made their groups' own first.
  const own = withTrimmedAsOwn(from, action.trimmed ?? [], rules.preparationId ?? null).setups
  const setups = action.checks ? sendable(own, action.checks) : own
  // Their faces are no longer done, where they are still stated.
  const stillOwn = new Set(customFeaturesOf(setups).flatMap((feature) => feature.regions))
  const stated = { ...draft, setups, done: draft.done.filter((region) => !stillOwn.has(region)) }
  const tags = assignmentsWhere(stated.setups, () => true).map((assignment) => assignment.tag)
  return withConstraints(draft, unmarkAssigned(stated, tags, rules).intent)
}

/** Toolpath's plan without what the checklist would block (`blockedByChecks`), for Toolpath to plan. */
const sendable = (setups: Array<DraftSetup>, checks: CheckContext): Array<DraftSetup> => {
  const blocked = blockedByChecks({ setups, kernelVersion: null }, checks)
  const tags = new Set(blocked.tags.map(tagKey))
  return removeFromPlan(setups, {
    features: assignmentsWhere(setups, (tag) => tags.has(tagKey(tag))),
    groups: blocked.groups,
  })
}

/** The draft with the plan's trimmed pins made their groups' own, their faces no longer done. */
const trimmedAsOwn = (
  draft: Constraints,
  trimmed: ReadonlyArray<TrimmedCut>,
  rules: PlanRules,
): Constraints => {
  const { setups, regions } = withTrimmedAsOwn(draft.setups, trimmed, rules.preparationId ?? null)
  return { ...draft, setups, done: draft.done.filter((region) => !regions.has(region)) }
}

/** How each kind of action is carried out. */
const CARRY_OUT: { readonly [K in DraftActionKind]: CarryOut<K> } = {
  addGroup: applyAddGroup,
  renameGroup: applyRenameGroup,
  remove: applyRemove,
  moveGroup: applyMoveGroup,
  moveWithin: applyMoveWithin,
  addSetup: applyAddSetup,
  setProcess: applySetProcess,
  setOrientation: applySetOrientation,
  assignInto: applyAssignInto,
  assignFrom: applyAssignFrom,
  moveFeature: applyMoveFeature,
  unassign: applyUnassign,
  markDone: applyMarkDone,
  unmarkDone: applyUnmarkDone,
  chooseAssignReading: applyChooseAssignReading,
  chooseDoneReading: applyChooseDoneReading,
  fromPlan: applyFromPlan,
  assignRegions: ({ draft, rules }, action) =>
    Array.isArray(action.regions) && action.regions.length > 0
      ? withRegionEdit(
          draft,
          assignRegionsEdit(
            draft,
            action.groupId,
            action.regions,
            action.share,
            rules.regionsOf,
            rules.preparationId ?? null,
          ),
        )
      : { refused: NOT_AN_ACTION },
  editFeature: ({ draft, rules }, action) =>
    Array.isArray(action.regions) && isFeatureRef(action.feature)
      ? withRegionEdit(
          draft,
          editFeatureEdit(
            draft,
            action.groupId,
            action.feature,
            action.regions,
            rules.regionsOf,
            rules.preparationId ?? null,
            action.into,
          ),
        )
      : { refused: NOT_AN_ACTION },
  unassignCustom: ({ draft }, action) =>
    withRegionEdit(draft, unassignCustomEdit(draft, action.groupId, action.index)),
  openRegions: ({ draft, rules }, action) =>
    Array.isArray(action.regions)
      ? withConstraints(
          draft,
          openRegionsEdit(
            draft,
            action.regions,
            rules.regionsOf,
            rules.preparationId ?? null,
            action.groupId,
          ),
        )
      : { refused: NOT_AN_ACTION },
  adopt: ({ draft, rules }, action) =>
    Array.isArray(action.pin) &&
    Array.isArray(action.takeOut) &&
    action.pin.length + action.takeOut.length > 0 &&
    action.pin.every((tag) => typeof tag === 'string') &&
    action.takeOut.every(isFeatureRef)
      ? withRegionEdit(
          draft,
          adoptEdit(
            draft,
            action.groupId,
            action.pin,
            action.takeOut,
            action.share,
            rules.regionsOf,
            rules.preparationId ?? null,
            rules.directionOf,
          ),
        )
      : { refused: NOT_AN_ACTION },
  ignoreRegions: ({ draft, rules }, action) =>
    Array.isArray(action.ignore) &&
    Array.isArray(action.unignore) &&
    action.ignore.length + action.unignore.length > 0
      ? withConstraints(
          draft,
          ignoreRegionsEdit(
            draft,
            action.ignore,
            action.unignore,
            rules.regionsOf,
            rules.kernel,
            rules.preparationId ?? null,
          ),
        )
      : { refused: NOT_AN_ACTION },
  trimmedAsOwn: ({ draft, rules }, action) =>
    Array.isArray(action.trimmed)
      ? withConstraints(draft, trimmedAsOwn(draft, action.trimmed, rules))
      : { refused: NOT_AN_ACTION },
  setAdditionalDirections: ({ draft }, action) => {
    const directions = parseDirections(action.directions)
    return action.directions === null || directions
      ? withConstraints(draft, { ...draft, additionalDirections: directions })
      : { refused: NOT_AN_ACTION }
  },
}

/** One action carried out by its kind's function — or refused, its kind not on the list. */
const carryOut = <T extends Constraints>(editing: Editing<T>, action: DraftAction): Outcome<T> => {
  // Only untyped code names a kind not on the list.
  if (!Object.hasOwn(CARRY_OUT, action.kind)) {
    return { refused: NOT_AN_ACTION }
  }
  // Each kind's function takes that kind's action; TypeScript can't pair them through the lookup.
  const carry = CARRY_OUT[action.kind] as CarryOut<DraftActionKind>
  return carry(editing, action)
}

/** What a page asks `actionsFor` about: what the person clicked, or picked. */
export type ActionTarget =
  /** The part itself: the tree's top row. */
  | { part: true }
  /** A setup or a group, by id. */
  | { group: string }
  /** One direction's reading of a feature: its tag, and the direction it is read from. */
  | { feature: string; direction: PlanDirection }
  /** Faces picked on the part: region indices, in the kernel `rules` names. */
  | { faces: ReadonlyArray<number> }

/**
 * What can be done to this, as the draft stands: the kinds of action `applyDraftAction` would make
 * here, in `DRAFT_ACTION_KINDS` order. A page offers these and no others. An action named here can
 * still be refused for its details — a drop on one group or another — and says why when it is.
 * Three kinds follow other controls and are never named here: `chooseAssignReading` and
 * `chooseDoneReading`, offered where a click read more than one feature, and `fromPlan`, offered
 * while the plan holds no groups and Toolpath has planned the part.
 */
export const actionsFor = (
  draft: Constraints,
  target: ActionTarget,
  rules: Pick<PlanRules, 'kernel' | 'unplannable'>,
): Array<DraftActionKind> => {
  const allowed = new Set(actionsOn(draft, target, rules))
  return DRAFT_ACTION_KINDS.filter((kind) => allowed.has(kind))
}

/** The kinds of action that can be made on a target, in any order: `actionsFor` orders them. */
const actionsOn = (
  draft: Constraints,
  target: ActionTarget,
  rules: Pick<PlanRules, 'kernel' | 'unplannable'>,
): Array<DraftActionKind> => {
  if ('group' in target) {
    return groupActions(draft.setups, target.group)
  }
  if ('feature' in target) {
    const kinds = featureActions(draft.setups, target.feature, target.direction)
    // Assigned nowhere, a feature Toolpath plans no pass for can only be left as it is.
    const unassignable =
      rules.unplannable?.(tagKey(target.feature)) === true &&
      assignedIn(draft.setups, target.feature) === null
    return unassignable ? kinds.filter((kind) => !ASSIGNING.has(kind)) : kinds
  }
  if ('faces' in target) {
    return faceActions(draft, target.faces, rules.kernel)
  }
  return partActions(draft.setups)
}

/** `kinds` where `yes`, none where not. */
const when = (yes: boolean, ...kinds: Array<DraftActionKind>): Array<DraftActionKind> =>
  yes ? kinds : []

/**
 * What can be done on the part: add a setup, while there is room; remove them all; say whether
 * Toolpath may add setups.
 */
const partActions = (setups: ReadonlyArray<DraftSetup>): Array<DraftActionKind> => [
  ...when(setups.length < MAX_SETUPS, 'addSetup'),
  // Only a stated setup can stand alone: with none, Toolpath must add them.
  ...when(setups.length > 0, 'remove', 'setAdditionalDirections'),
]

/** What can be done to a setup or group; nothing for one the draft does not hold. */
const groupActions = (setups: ReadonlyArray<DraftSetup>, id: string): Array<DraftActionKind> => {
  const placed = findPlaced(setups, id)
  if (!placed) {
    return []
  }
  const top = placed.depth === 0
  const beside = top ? setups : (placed.parent?.groups ?? [])
  const toolOriented = isIndexed(placed.setup) || placed.orientation
  return [
    'renameGroup',
    'remove',
    ...when(placed.depth < MAX_DEPTH, 'addGroup'),
    ...when(beside.length > 1, 'moveWithin', 'moveGroup'),
    ...when(canMoveAway(setups, placed.group.id, placed.parent?.id ?? null), 'moveGroup'),
    ...when(top, 'setProcess'),
    ...when(!top && toolOriented, 'setOrientation'),
  ]
}

/** Whether a group can land anywhere but beside where it is: at the top, or inside another. */
const canMoveAway = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  parentId: string | null,
): boolean => {
  const landings = [null, ...placedGroups(setups).map((placed) => placed.group.id)].filter(
    (landing) => landing !== parentId && landing !== id,
  )
  return landings.some((landing) =>
    Array.isArray(moveGroup(setups, { id, to: { parentId: landing, index: 0 } })),
  )
}

/** What can be done to one direction's reading of a feature. */
const featureActions = (
  setups: ReadonlyArray<DraftSetup>,
  tag: string,
  direction: PlanDirection,
): Array<DraftActionKind> => {
  const home = assignedIn(setups, tag)
  const facingIds = placedGroups(setups)
    .filter((each) => each.group.id !== home && sameDirection(each.direction, direction))
    .map((each) => each.group.id)
  return [
    ...when(facingIds.length > 0, 'assignInto'),
    ...when(canAssignFromItsWay(setups, home, direction), 'assignFrom'),
    // A row dropped on a group facing its way is assigned there: somewhere new, as its own group
    // is left out.
    ...when(facingIds.length > 0, 'moveFeature'),
    ...when(home !== null, 'unassign'),
  ]
}

/**
 * Whether an assignment from its direction lands somewhere new: a setup facing it, or one it would
 * add.
 */
const canAssignFromItsWay = (
  setups: ReadonlyArray<DraftSetup>,
  home: string | null,
  direction: PlanDirection,
): boolean => {
  const frame = frameFacing(setups, direction)
  if (!frame) {
    return setups.length < MAX_SETUPS
  }
  const inFrame =
    home !== null &&
    placedGroups(setups).some((each) => each.group.id === home && each.frameId === frame.id)
  return !inFrame
}

/** What can be done to faces picked: mark done any open, unmark any done. */
const faceActions = (
  draft: Constraints,
  regions: ReadonlyArray<number>,
  kernel: string | null,
): Array<DraftActionKind> => {
  const done = new Set(currentFor(draft.done, draft.doneKernel, kernel))
  const anyOpen = regions.some((region) => !done.has(region))
  const anyDone = regions.some((region) => done.has(region))
  return [...when(anyOpen, 'markDone'), ...when(anyDone, 'unmarkDone')]
}
