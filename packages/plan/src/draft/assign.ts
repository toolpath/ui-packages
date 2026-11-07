import {
  currentFor,
  doneAsSaved,
  assignFrom,
  assignInto,
  assignedIn,
  assignmentsWhere,
  restoreFeature,
  unassignFeature,
  type DraftSetup,
  type Constraints,
  type AssignedFeature,
  type PlanRules,
} from './constraints'
import type { PlanDirection } from '../results/plan'
import { unmarkDoneEdit } from './done'
import type { Refused } from './refusals'
import { coversAll } from '../faces/coverage'

/*
  What assigning and unassigning do to the plan, apart from the page that wires them. Every way to
  assign — a click on the part, a drop in the tree, the Not machined list, the Feature section, a
  pick among a click's readings, Auto plan — makes the same edit: an assigned feature is machined,
  so its faces are no longer done (`unmarkAssigned`), in the same step as the assignment. Marking
  done an assigned feature's faces is Mark done's edit, and the mark wins there (`markDoneEdit`).
*/

/** What an assignment needs to know of the part. */
export type AssignContext = PlanRules

/**
 * The person's assignments a new assignment of `tag` replaces: each one, in any group, whose every
 * face it covers — another direction's reading of those faces, or a smaller feature inside it. One
 * it only overlaps stays.
 */
export const replacedBy = (
  setups: ReadonlyArray<DraftSetup>,
  tag: string,
  regionsOf: (tag: string) => ReadonlyArray<number>,
): Array<AssignedFeature> => {
  const regions = regionsOf(tag)
  return assignmentsWhere(setups, (other) => other !== tag && coversAll(regions, regionsOf(other)))
}

/**
 * The plan with every face of `tags` no longer done, and those that were, ascending: what every
 * way of assigning ends with, as an assigned feature is machined whole.
 */
export const unmarkAssigned = (
  plan: Constraints,
  tags: ReadonlyArray<string>,
  context: AssignContext,
): { intent: Constraints; unmarked: Array<number> } => {
  const done = new Set(currentFor(plan.done, plan.doneKernel, context.kernel))
  const unmarked = [...new Set(tags.flatMap((tag) => context.regionsOf(tag)))]
    .filter((region) => done.has(region))
    .sort((a, b) => a - b)
  return {
    intent: unmarked.length > 0 ? unmarkDoneEdit(plan, unmarked, context) : plan,
    unmarked,
  }
}

/**
 * What an assignment did: the plan after it, where it went, the assignments it replaced and the
 * faces it unmarked.
 */
export interface AssignEdit {
  intent: Constraints
  setupId: string
  /** A setup was added for it, facing its way. */
  added: boolean
  /** It was assigned there already, and is now unassigned. */
  unassigned: boolean
  replaced: Array<string>
  unmarked: Array<number>
}

/**
 * Assign a feature into a group, or into the one facing its direction (adding one where none
 * does), or — assigned there already — unassign it. A new assignment replaces the person's
 * assignments whose every face it covers. One edit.
 */
export const assignEdit = (
  plan: Constraints,
  tag: string,
  /**
   * `newId` is for the group an assignment into a parent makes, or the setup an assignment from a
   * direction adds.
   */
  at: { groupId: string; newId?: string } | { direction: PlanDirection; newId: string },
  context: AssignContext,
): AssignEdit | Refused => {
  const result =
    'groupId' in at
      ? assignInto(plan.setups, { ...at, tag, nameGroup: context.nameGroup })
      : assignFrom(plan.setups, { ...at, tag, nameGroup: context.nameGroup })
  if ('refused' in result) {
    return result
  }
  const { setupId, added, unassigned } = result
  if (unassigned) {
    return {
      intent: { ...plan, setups: result.setups },
      setupId,
      added,
      unassigned,
      replaced: [],
      unmarked: [],
    }
  }
  return { ...withAssignment(plan, tag, result.setups, context), setupId, added, unassigned }
}

/**
 * The plan once `tag` is assigned where `assigned` (the setups with the assignment made) has it:
 * the person's assignments it covers unassigned, and its faces no longer done (`unmarkAssigned`).
 * What every way of assigning one feature ends with — `assignEdit`, and a row dropped in a group.
 */
export const withAssignment = (
  plan: Constraints,
  tag: string,
  assigned: ReadonlyArray<DraftSetup>,
  context: AssignContext,
): { intent: Constraints; replaced: Array<string>; unmarked: Array<number> } => {
  const replaced = replacedBy(plan.setups, tag, context.regionsOf)
  const setups = replaced.reduce(
    (all, each) => unassignFeature(all, each.setupId, each.tag),
    [...assigned],
  )
  return {
    ...unmarkAssigned({ ...plan, setups }, [tag], context),
    replaced: replaced.map((each) => each.tag),
  }
}

/**
 * What a click does to its feature: a left click assigns it in the group, or — in it already —
 * leaves it there (`add`: a pick among its readings adds another); a right click takes it out,
 * unassigned.
 */
type AssignTarget = 'assign' | 'add' | 'takeOut'

/** What a click made of a feature: assigned in the group, left in it, or taken out. */
export interface AssignChange {
  tag: string
  target: AssignTarget
}

/** The plan with a feature assigned nowhere: open, left to Toolpath. */
const letGo = (plan: Constraints, tag: string): Constraints => {
  const was = assignedIn(plan.setups, tag)
  return was ? { ...plan, setups: unassignFeature(plan.setups, was, tag) } : plan
}

/**
 * The plan with one line taken back: the feature as `saved` had it, and — where it is assigned
 * since, or moved — the assignments that assignment replaced, and its faces done as `saved` had
 * them. Every other edit stands.
 */
export const takeBack = (
  plan: Constraints,
  saved: Constraints,
  tag: string,
  context: AssignContext,
): Constraints => {
  const home = assignedIn(plan.setups, tag)
  const assignedSince = home !== null && home !== assignedIn(saved.setups, tag)
  const replaced = assignedSince ? replacedBy(saved.setups, tag, context.regionsOf) : []
  const tags = [...new Set([tag, ...replaced.map((each) => each.tag)])]
  return {
    ...plan,
    setups: tags.reduce((all, each) => restoreFeature(all, saved.setups, each), [...plan.setups]),
    ...(assignedSince ? doneAsSaved(plan, saved, context.regionsOf(tag), context.kernel) : {}),
  }
}

/**
 * Turn a feature's assignment to a group on or off: a feature assigned in the group is taken out —
 * unassigned, left to Toolpath; any other is assigned there, and `unmarked` names the regions the
 * assignment stopped marking done. An app calls it for a click on the part while a group is open,
 * and words the status line itself.
 */
export const toggleAssignment = (
  plan: Constraints,
  feature: {
    tag: string
    direction: PlanDirection
    /** Assigned in the group. */
    inGroup: boolean
  },
  group: { id: string },
  context: AssignContext,
): { intent: Constraints; unmarked: Array<number> } => {
  if (feature.inGroup) {
    return {
      intent: { ...plan, setups: unassignFeature(plan.setups, group.id, feature.tag) },
      unmarked: [],
    }
  }
  const assigned = assignHere(plan, feature.tag, group.id, context)
  return { intent: assigned.intent, unmarked: assigned.unmarked }
}

/**
 * Assign a feature in a group, by `assignEdit` — which never refuses a group named — kept
 * assigned there: the plan, and the faces the assignment unmarked.
 */
const assignHere = (
  plan: Constraints,
  tag: string,
  groupId: string,
  context: AssignContext,
): { intent: Constraints; unmarked: Array<number> } => {
  if (assignedIn(plan.setups, tag) === groupId) {
    return { intent: plan, unmarked: [] }
  }
  const assigned = assignEdit(plan, tag, { groupId }, context)
  return 'refused' in assigned ? { intent: plan, unmarked: [] } : assigned
}

/**
 * A line's choice among the features its click read. On an assignment: itself, or another assigned
 * in its place. On a feature left in the group (`add`): itself, or another assigned there too — as
 * any assignment, replacing the assignments it covers. On a feature taken out: itself, or another
 * taken out in its place, the line's assigned back. Answers the plan, and the lines whose choice is
 * made — an assignment swapped away keeps its choice unmade, so undo brings it back to be made.
 */
export const chooseReading = (
  plan: Constraints,
  saved: Constraints,
  line: AssignChange,
  reading: string,
  group: { id: string; direction: PlanDirection },
  context: AssignContext,
): { intent: Constraints; chosen: Array<string> } => {
  if (reading === line.tag) {
    return { intent: plan, chosen: [reading] }
  }
  const choose = CHOSEN_FOR[line.target]
  return { intent: choose({ plan, saved, line, reading, group, context }), chosen: [reading] }
}

/** A line's choice among its click's readings, another than its own, with all it is given. */
interface ReadingChoice {
  plan: Constraints
  saved: Constraints
  line: AssignChange
  reading: string
  group: { id: string; direction: PlanDirection }
  context: AssignContext
}

/**
 * On an assignment: what the assignment took put back, it leaves, and the one chosen is assigned in
 * its place.
 */
const chosenForAssign = ({ plan, saved, line, reading, group, context }: ReadingChoice) => {
  const left = letGo(takeBack(plan, saved, line.tag, context), line.tag)
  return assignHere(left, reading, group.id, context).intent
}

/** On a feature left in the group: the one chosen assigned there too. */
const chosenForAdd = ({ plan, reading, group, context }: ReadingChoice) =>
  assignHere(plan, reading, group.id, context).intent

/** On a feature taken out: it goes back in the group, and the one chosen is taken out instead. */
const chosenForTakeOut = ({ plan, line, reading, group, context }: ReadingChoice) => {
  const back = assignHere(plan, line.tag, group.id, context).intent
  return assignedIn(back.setups, reading) === group.id
    ? { ...back, setups: unassignFeature(back.setups, group.id, reading) }
    : back
}

/** What a choice does, by what the click did to the line's feature. */
const CHOSEN_FOR: { readonly [K in AssignTarget]: (choice: ReadingChoice) => Constraints } = {
  assign: chosenForAssign,
  add: chosenForAdd,
  takeOut: chosenForTakeOut,
}
