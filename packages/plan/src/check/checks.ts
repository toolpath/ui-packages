import type { PlanDirection } from '../results/plan'
import {
  framesOf,
  placedGroups,
  sameDirection,
  type Constraints,
  type Frame,
} from '../draft/constraints'
import { statementOf } from '../draft/statement'
import { groupRef, type GroupRef } from '../draft/refusals'
import { directionAnalysis, type DirectionAnalysis, type DirectionsKnown } from './directions'

/**
 * One thing worth saying about the plan before it is sent, as a `kind` and its facts: the app says
 * it in its own words. `blocking` stops the plan being sent.
 *
 * - `unknownFeature`: a feature assigned in `group` is not one of the part's.
 * - `notAnalyzed`: `group` faces a direction the part was not analyzed from (`undetected`), is
 *   being analyzed from (`analyzing`), or can still be analyzed from (`unanalyzed`).
 * - `otherWay`: `feature` is cut from another direction than `group` faces.
 * - `kernelMoved`: Toolpath was updated since the features were assigned, so it may refuse them.
 */
export type PlanCheck =
  | { kind: 'unknownFeature'; severity: 'blocking'; group: GroupRef; tag: string }
  | {
      kind: 'notAnalyzed'
      severity: 'blocking' | 'warning'
      group: GroupRef
      analysis: Exclude<DirectionAnalysis, 'analyzed'>
    }
  | {
      kind: 'otherWay'
      severity: 'blocking'
      group: GroupRef
      feature: { tag: string; label: string }
    }
  | { kind: 'kernelMoved'; severity: 'warning' }

/** What the checks know of the part: its analysis, and the kernel Toolpath last planned with. */
export interface CheckContext {
  /**
   * The part's directions: analyzed, detected, and being analyzed. `analyzed` is null before its
   * model has been read.
   */
  directions: DirectionsKnown
  /**
   * A feature's type, label and the direction it is cut from, by tag — or null for a tag the part's
   * model does not have.
   */
  feature: (tag: string) => { type: string; label: string; direction?: PlanDirection } | null
  /** The kernel Toolpath's plan was made by, whose tags the assignments have to be. */
  kernelVersion: string | null
}

/** What the checks read of a draft: its setups, and the kernel whose tags its assignments name. */
export interface CheckedDraft extends Pick<Constraints, 'setups'> {
  /** The kernel whose tags the assignments name; null until something is assigned. */
  kernelVersion: string | null
}

/**
 * What would stop Toolpath taking the plan as the person has stated it, and what is worth knowing
 * before sending it: the rules its stated plan is held to (tp-kernel's `UserSetupPlan`), checked
 * here where they can be, so the answer comes before the round trip rather than after it.
 */
export const planChecks = (draft: CheckedDraft, context: CheckContext): Array<PlanCheck> => {
  if (!statementOf(draft.setups)) {
    return []
  }
  // Toolpath is told frames — each direction a setup of its own — so the checks are of frames.
  const stated = framesOf(draft.setups)
  return [
    ...stated.flatMap((frame) => frameChecks(frame, context)),
    ...otherWayChecks(draft.setups, context),
    ...kernelChecks(draft, stated, context),
  ]
}

/**
 * A frame's checks: its direction's analysis, then each assignment that is not one of the part's
 * features.
 */
const frameChecks = (frame: Frame, context: CheckContext): Array<PlanCheck> => {
  const group = groupRef(frame)
  return [
    ...analysisChecks(group, directionAnalysis(frame.direction, context.directions)),
    // One check for each assignment of a feature the part does not have.
    ...frame.features
      .filter((tag) => isUnknownFeature(tag, context))
      .map((tag): PlanCheck => ({ kind: 'unknownFeature', severity: 'blocking', group, tag })),
  ]
}

/**
 * A plan may be sent while a direction is analyzed: only its features are late. The analysis is the
 * part's (`pending` is part-wide), so a direction whose request failed reads as analyzing until the
 * job ends; Toolpath refuses such a plan and the page explains it.
 */
const analysisChecks = (group: GroupRef, analysis: DirectionAnalysis): Array<PlanCheck> => {
  if (analysis === 'analyzed') {
    return []
  }
  return [
    {
      kind: 'notAnalyzed',
      severity: analysis === 'analyzing' ? 'warning' : 'blocking',
      group,
      analysis,
    },
  ]
}

/** Whether an assigned tag is not one of the part's features, once its model has been read. */
const isUnknownFeature = (tag: string, context: CheckContext): boolean => {
  const feature = context.feature(tag)
  return Boolean(context.directions.analyzed) && !feature
}

/**
 * An assignment in a group cut from another way than its feature — a group moved, or made to
 * follow again — is one Toolpath refuses: a feature is machined from its own direction.
 */
const otherWayChecks = (setups: CheckedDraft['setups'], context: CheckContext): Array<PlanCheck> =>
  placedGroups(setups).flatMap((placed) =>
    placed.group.features.flatMap((tag): Array<PlanCheck> => {
      const feature = context.feature(tag)
      if (!feature?.direction || sameDirection(feature.direction, placed.direction)) {
        return []
      }
      return [
        {
          kind: 'otherWay',
          severity: 'blocking',
          group: groupRef(placed.group),
          feature: { tag, label: feature.label },
        },
      ]
    }),
  )

/** Assigns named in a kernel other than the one Toolpath last planned with may be refused. */
const kernelChecks = (
  draft: CheckedDraft,
  stated: ReadonlyArray<Frame>,
  context: CheckContext,
): Array<PlanCheck> => {
  const assigned = stated.some((frame) => frame.features.length > 0)
  const kernelMoved =
    draft.kernelVersion && context.kernelVersion && draft.kernelVersion !== context.kernelVersion
  if (!assigned || !kernelMoved) {
    return []
  }
  return [{ kind: 'kernelMoved', severity: 'warning' }]
}

/** A tag as the kernel prints it (`FeatureTag(0af3…)`), padded or not, compared as a number. */
const sameTag = (a: string, b: string): boolean =>
  a.replace(/^0+/, '').toLowerCase() === b.replace(/^0+/, '').toLowerCase()

/**
 * One of Toolpath's refusal clauses with its setup and features named (`describeClause`), as a
 * kind for the app to word:
 *
 * - `clause`: the clause, named.
 * - `notOffered`: a feature the plan states that Toolpath did not offer — `text` is the clause up
 *   to that, naming the feature. Toolpath offers every feature a plan states that it measured: one
 *   it did not is a kind it cannot measure, or one whose measurement failed — not something a
 *   reshuffle of groups fixes.
 */
export type DescribedClause =
  { kind: 'clause'; text: string } | { kind: 'notOffered'; text: string }

/** How Toolpath ends a clause about a stated feature it did not offer. */
const NOT_OFFERED = / is not among the features offered$/

/**
 * One of Toolpath's refusal clauses in the person's own terms: its setup by the group's name —
 * setup `n` of the statement, counted from zero, is the draft's `n`th frame — and its features by
 * their labels.
 */
export const describeClause = (
  clause: string,
  draft: Pick<Constraints, 'setups'>,
  label: (tag: string) => string | null,
  tags: ReadonlyArray<string>,
): DescribedClause => {
  const text = clause
    .replace(/\bsetup (\d+)(, orientation \d+)?/, (whole, index: string) => {
      const setup = framesOf(draft.setups)[Number(index)]
      return setup ? setup.name : whole
    })
    .replace(/FeatureTag\(([0-9a-fA-F]+)\)/g, (whole, hex: string) => {
      const tag = tags.find((candidate) => sameTag(candidate, hex))
      return (tag && label(tag)) ?? whole
    })
  return NOT_OFFERED.test(text)
    ? { kind: 'notOffered', text: text.replace(NOT_OFFERED, '') }
    : { kind: 'clause', text }
}

/**
 * Where a check's Show goes: the Not machined list, a group and a feature in it, or one of
 * Toolpath's setups in the Results view.
 */
export type ShowTarget =
  | { kind: 'notMachined' }
  | { kind: 'group'; setupId: string; tag?: string }
  | { kind: 'setup'; idx: number }

/**
 * One line of the confirm checklist, as a `kind` and its facts: the plan's own checks (as
 * {@link PlanCheck}), then these. `show` is where its Show goes.
 *
 * - `changed`: the constraints changed since these results.
 * - `notMachined`: `count` features nothing machines; `allMachined` says every face that needs
 *   machining is machined.
 * - `notFinished`: a pass roughs `count` features, but none finishes them.
 * - `cannotCut`: `count` features can't be cut as planned; `allCut` says every setup can cut what
 *   is in it.
 * - `emptyGroups`: `count` groups have nothing in them.
 */
export type ConfirmCheck =
  | PlanCheck
  | { kind: 'changed'; severity: 'info' }
  | { kind: 'notMachined'; severity: 'warning'; count: number; show: ShowTarget }
  | { kind: 'allMachined'; severity: 'ok' }
  | { kind: 'notFinished'; severity: 'warning'; count: number; show: ShowTarget }
  | { kind: 'cannotCut'; severity: 'warning'; count: number; show: ShowTarget }
  | { kind: 'allCut'; severity: 'ok' }
  | { kind: 'emptyGroups'; severity: 'warning'; count: number; show: ShowTarget }

/** What the confirm checklist looks at, beside the plan's own checks. */
export interface ConfirmContext {
  /**
   * The constraints as saved changed since Toolpath's results: the results are of an earlier
   * version.
   */
  changed: boolean
  /** How many features nothing in Toolpath's plan machines: null before known. */
  notMachined: number | null
  /**
   * Each of the person's groups that Toolpath plans a setup from, and whether the plan machines
   * something in it, or in a group inside it. Empty unless the results are of the current
   * constraints.
   */
  groups: ReadonlyArray<{ id: string; name: string; machined: boolean }>
  /** Each setup of Toolpath's plan, with what it was meant to machine and no pass in it cuts. */
  setups: ReadonlyArray<{
    /** Its place in the plan: where Show goes. */
    idx: number
    notMachined: Array<string>
    /** Of `notMachined`, what a pass roughs but none finishes. */
    notFinished: Array<string>
  }>
}

/**
 * Whether the constraints changed since Toolpath's results: only with results to have changed
 * from — a part never planned has none. The Results banner's rule and
 * the checklist's, one place.
 */
export const changedSinceResults = (changed: boolean, setups: number): boolean =>
  changed && setups > 0

/**
 * The checklist a move out of Plan shows: what stops the part moving on, what is worth a look
 * first — each with where to look — and what is fine. The plan's own checks come first.
 */
export const confirmChecks = (
  own: ReadonlyArray<PlanCheck>,
  context: ConfirmContext,
): Array<ConfirmCheck> => [
  ...own,
  ...changedChecks(context.changed),
  ...notMachinedChecks(context.notMachined),
  ...setupChecks(context.setups),
  ...emptyGroupChecks(context.groups),
]

/** One of Toolpath's setups, as the confirm checklist reads it. */
type ResultSetup = ConfirmContext['setups'][number]

const changedChecks = (changed: boolean): Array<ConfirmCheck> =>
  changed ? [{ kind: 'changed', severity: 'info' }] : []

/** How many features nothing machines, where that is known. */
const notMachinedChecks = (notMachined: number | null): Array<ConfirmCheck> => {
  if (notMachined === null) {
    return []
  }
  if (notMachined > 0) {
    return [
      {
        kind: 'notMachined',
        severity: 'warning',
        count: notMachined,
        show: { kind: 'notMachined' },
      },
    ]
  }
  return [{ kind: 'allMachined', severity: 'ok' }]
}

/**
 * What a setup was meant to machine and no pass cuts, apart from what a pass roughs but none
 * finishes: the two are said apart (Plan mode UI MP-22). Each Show opens the first of Toolpath's
 * setups with such a feature, in the Results view.
 */
const setupChecks = (setups: ReadonlyArray<ResultSetup>): Array<ConfirmCheck> => {
  const count = countOf(setups, cutByNoneOf)
  const roughCount = countOf(setups, notFinishedOf)
  const checks: Array<ConfirmCheck> = []
  if (roughCount > 0) {
    checks.push(notFinishedCheck(roughCount, firstWith(setups, notFinishedOf)))
  }
  if (count > 0) {
    checks.push({
      kind: 'cannotCut',
      severity: 'warning',
      count,
      show: { kind: 'setup', idx: firstWith(setups, cutByNoneOf).idx },
    })
  } else if (roughCount === 0 && setups.length > 0) {
    // With no plan yet there is no setup to vouch for.
    checks.push({ kind: 'allCut', severity: 'ok' })
  }
  return checks
}

/** Of what a setup was meant to machine and no pass cuts, what a pass roughs but none finishes. */
const notFinishedOf = (setup: ResultSetup): Array<string> =>
  setup.notMachined.filter((tag) => setup.notFinished.includes(tag))

/** Of what a setup was meant to machine and no pass cuts, what no pass cuts at all. */
const cutByNoneOf = (setup: ResultSetup): Array<string> =>
  setup.notMachined.filter((tag) => !setup.notFinished.includes(tag))

/** How many features `left` finds, over every setup. */
const countOf = (
  setups: ReadonlyArray<ResultSetup>,
  left: (setup: ResultSetup) => Array<string>,
): number => setups.reduce((sum, setup) => sum + left(setup).length, 0)

/** The first setup `left` finds a feature in: only asked where one does. */
const firstWith = (
  setups: ReadonlyArray<ResultSetup>,
  left: (setup: ResultSetup) => Array<string>,
): ResultSetup => setups.find((setup) => left(setup).length > 0)!

/** Features a pass roughs but none finishes, with Show on the first setup holding one. */
const notFinishedCheck = (count: number, first: ResultSetup): ConfirmCheck => ({
  kind: 'notFinished',
  severity: 'warning',
  count,
  show: { kind: 'setup', idx: first.idx },
})

/**
 * A group with nothing assigned is a normal constraint that Toolpath fills: empty is what its plan
 * leaves empty, a group it left out or planned a setup with no feature in.
 */
const emptyGroupChecks = (groups: ConfirmContext['groups']): Array<ConfirmCheck> => {
  const empty = groups.filter((group) => !group.machined)
  if (!empty[0]) {
    return []
  }
  return [
    {
      kind: 'emptyGroups',
      severity: 'warning',
      count: empty.length,
      show: { kind: 'group', setupId: empty[0].id },
    },
  ]
}

/** Every line passed: the move goes straight on without asking. */
export const allClear = (checks: ReadonlyArray<ConfirmCheck>): boolean =>
  checks.every((check) => check.severity === 'ok')
