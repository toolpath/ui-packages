import {
  classifyFaces,
  groupFaces,
  planFeaturesOf,
  planTags,
  tagSet,
  type Coverage,
  type CoverageFeature,
  type FaceGroup,
  type PlanFeature,
} from '../faces/coverage'
import type { DirectionsKnown } from '../check/directions'
import type { EnginePlan, PlanDirection } from '../results/plan'
import {
  allClear,
  changedSinceResults,
  confirmChecks,
  planChecks,
  type CheckContext,
  type CheckedDraft,
  type ConfirmCheck,
  type ConfirmContext,
  type PlanCheck,
} from '../check/checks'
import {
  currentFor,
  findPlaced,
  framesOf,
  assignmentOf,
  assignTargetOf,
  type Constraints,
  type PlacedGroup,
} from '../draft/constraints'
import {
  allGroups,
  draftView,
  groupPath,
  listsTag,
  planCounts,
  sharedFaces,
  shownFaces,
  type SharedFace,
  type ShownFace,
} from './view'
import type { PlanPart, PlanSetupView } from '../results/plan-view'
import { machines, resultsView, setupOf, type ResultsSetupView } from '../results/view'

/*
  The plan's details in one call: what an app shows of the person's constraints and of Toolpath's
  plan, what it looks up, and how each face of the part shows — from the same inputs, each worked
  out once. Built from the functions of `@toolpath/plan/parts`, which an app that shows the plan
  another way uses itself.
*/

/**
 * The part's analysis, as `planDetails` reads it: its faces, and the features that include them.
 */
export interface PartAnalysis {
  regions: ReadonlyArray<{ idx: number; area: number }>
  features: ReadonlyArray<CoverageFeature & { machiningDirection?: PlanDirection }>
  /** The kernel that read the part: faces done under another kernel's numbering are let go. */
  kernelVersion: string | null
  /** The directions the part's report and its pending request say a group can face. */
  directions: DirectionsKnown
}

/** The constraints as saved, and whether they changed since Toolpath's plan was made. */
export interface AppliedConstraints extends Constraints {
  changed: boolean
}

/** What `planDetails` knows of the part: how its rows read, and each feature its checks name. */
export interface PlanDetailsPart extends PlanPart {
  feature: CheckContext['feature']
}

/**
 * Everything `planDetails` is made from. Toolpath's data alone: the app's own choices stay its own.
 */
export interface PlanDetailsInputs {
  /**
   * The constraints as held now, with edits not applied, and the kernel its assignments name; null
   * before they are read.
   */
  draft: (Constraints & Pick<CheckedDraft, 'kernelVersion'>) | null
  /** The constraints as saved; null before they are read. */
  saved: AppliedConstraints | null
  /** Toolpath's plan; null before one is read. */
  plan: EnginePlan | null
  part: PlanDetailsPart
  /** Null before the part's analysis is read: no face is classified, and no direction is known. */
  analysis: PartAnalysis | null
  /** Whether `plan` is of `saved`: only then are its setups named by the groups they are from. */
  planIsOfSaved: boolean
  /**
   * The regions the part's stock body leaves at their final surface, read from the plan's stock
   * envelope: at shape in the results. None for any other stock.
   */
  materialFree?: ReadonlyArray<number>
}

/** The person's constraints, as the tree and the Constraints view show them. */
export interface PlanDetailsConstraints {
  setups: ReadonlyArray<PlanSetupView>
  /** Every group of the tree, in tree order. */
  groups: ReadonlyArray<PlanSetupView>
  /** Every feature assigned, by tag (lower case). */
  assigned: ReadonlySet<string>
  /**
   * Every feature the constraints can name (`planFeaturesOf`): the report's, and a trimmed one only
   * where it is assigned. None before the analysis is read.
   */
  features: ReadonlyArray<PlanFeature>
  /** Each face assigned, done or open; null before the analysis is read. */
  coverage: Coverage | null
  /** The faces done, numbered by the analysis' kernel. */
  done: ReadonlyArray<number>
  /** Features assigned, faces done, and features left open. */
  counts: { assigned: number; done: number; open: number }
  /** What would stop Toolpath taking the constraints, and what is worth knowing first. */
  checks: ReadonlyArray<PlanCheck>
}

/** Toolpath's plan, as the Results view shows it. */
export interface PlanDetailsResults {
  setups: ReadonlyArray<ResultsSetupView>
  /** Groups no setup was planned from. */
  leftOut: ReadonlyArray<{ groupId: string; name: string }>
  /** Every feature the plan's actions cut, by tag (lower case); none before the plan is read. */
  machined: ReadonlySet<string>
  /**
   * Every feature the plan's tags can name (`planFeaturesOf`): the report's, then each the plan
   * trimmed. None before the analysis is read.
   */
  features: ReadonlyArray<PlanFeature>
  /**
   * Each face at shape in stock, done, machined or not machined; null before the plan and the
   * analysis are read.
   */
  coverage: Coverage | null
  /**
   * The faces done as saved, numbered by the analysis' kernel: the ones the plan is made from.
   */
  done: ReadonlyArray<number>
  /** The faces nothing machines, gathered under the features that would machine them. */
  notMachined: ReadonlyArray<FaceGroup>
  /** Features machined, faces at shape in stock, faces done, and features not machined. */
  counts: { machined: number; atShape: number; done: number; notMachined: number }
  /** Setups, and the directions they are machined from. */
  planCounts: { setups: number; orientations: number }
  /** The constraints changed since these results. */
  changed: boolean
  /** The checklist before the part moves on, and whether every line of it passed. */
  confirm: ReadonlyArray<ConfirmCheck>
  allClear: boolean
}

/** What `planDetails` looks up: in the constraints held now, or in Toolpath's plan. */
export interface PlanDetailsFind {
  group: (id: string) => PlacedGroup | undefined
  /** A group's name with the groups it is in: `Group 1 › Side`. Empty for no group. */
  path: (id: string) => string
  /** The group a feature is assigned in, and the tag as the assignment spells it. */
  assignmentOf: (tag: string) => { groupId: string; tag: string } | null
  /** The group an assignment from this direction goes in; null where assigning adds a setup. */
  assignTarget: (direction: PlanDirection) => string | null
  /** The setup of Toolpath's plan that machines a feature. */
  resultSetup: (tag: string) => ResultsSetupView | null
  /** Whether a group (by id) or a setup of Toolpath's plan (by index) holds a feature. */
  holds: (group: string | number, tag: string) => boolean
}

/** Which faces to show: which tab, and which group is open. The app gives each kind its colour. */
export interface FacesView {
  tab: 'constraints' | 'results'
  /** The open group's id; null with no group open. */
  openId: string | null
  /** Direction colours on: every group shows. Off, only the open group. */
  everyGroup?: boolean
  /** List what nothing machines. Off where the app shows something else there. */
  uncovered?: boolean
}

export interface PlanDetails {
  constraints: PlanDetailsConstraints
  results: PlanDetailsResults
  find: PlanDetailsFind
  faces: (shown: FacesView) => { faces: Array<ShownFace>; shared: Array<SharedFace> }
}

const NO_FACES: Coverage['faces'] = {
  assigned: [],
  atShape: [],
  done: [],
  open: [],
  machined: [],
  notMachined: [],
}

/** Before the analysis is read nothing is known of the directions, and nothing is said of them. */
const NO_DIRECTIONS: DirectionsKnown = { analyzed: null, discovered: null, pending: false }

/** A value worked out the first time it is asked for, and kept. */
const once = <T>(work: () => T): (() => T) => {
  let kept: { value: T } | null = null
  return () => (kept ??= { value: work() }).value
}

/**
 * The plan's details from its inputs. Each part is worked out only when it is read, and only once:
 * call it again when an input changes.
 */
export const planDetails = (inputs: PlanDetailsInputs): PlanDetails => {
  const constraints = constraintsOf(inputs)
  const results = resultsOf(inputs, constraints)
  return {
    constraints,
    results,
    find: findOf(inputs, constraints, results),
    faces: (shown) => facesOf(shown, shown.tab === 'results' ? results : constraints),
  }
}

const constraintsOf = ({
  draft,
  plan,
  part,
  analysis,
}: PlanDetailsInputs): PlanDetailsConstraints => {
  const kernel = analysis?.kernelVersion ?? null
  const setups = once(() => (draft ? draftView(draft, part, plan) : []))
  const groups = once(() => allGroups(setups()))
  const assigned = once(() =>
    tagSet(framesOf(draft?.setups ?? []).flatMap((frame) => frame.features)),
  )
  const done = once(() => (draft ? currentFor(draft.done, draft.doneKernel, kernel) : []))
  // A trimmed feature is the constraints' only where it is assigned.
  const features = once(() => (analysis ? planFeaturesOf(analysis.features, plan, assigned()) : []))
  const coverage = once(() =>
    analysis && draft
      ? classifyFaces({
          regions: analysis.regions,
          features: features(),
          assigned: assigned(),
          done: done(),
        })
      : null,
  )
  const counts = once(() => ({
    assigned: assigned().size,
    done: coverage()?.faces.done.length ?? 0,
    open: groupFaces(coverage()?.faces.open ?? [], features()).length,
  }))
  const checks = once(() =>
    draft
      ? planChecks(draft, {
          directions: analysis?.directions ?? NO_DIRECTIONS,
          feature: part.feature,
          kernelVersion: plan?.kernelVersion ?? null,
        })
      : [],
  )
  return {
    get setups() {
      return setups()
    },
    get groups() {
      return groups()
    },
    get assigned() {
      return assigned()
    },
    get features() {
      return features()
    },
    get coverage() {
      return coverage()
    },
    get done() {
      return done()
    },
    get counts() {
      return counts()
    },
    get checks() {
      return checks()
    },
  }
}

const resultsOf = (
  inputs: PlanDetailsInputs,
  constraints: PlanDetailsConstraints,
): PlanDetailsResults => {
  const { plan, saved, part, analysis, planIsOfSaved, materialFree } = inputs
  const kernel = analysis?.kernelVersion ?? null
  const view = once(() => resultsView({ plan, constraints: planIsOfSaved ? saved : null, part }))
  const done = once(() => (saved ? currentFor(saved.done, saved.doneKernel, kernel) : []))
  const machined = once(() => planTags(plan?.setups ?? []))
  const features = once(() => (analysis ? planFeaturesOf(analysis.features, plan) : []))
  const coverage = once(() =>
    analysis && plan
      ? classifyFaces({
          regions: analysis.regions,
          features: features(),
          done: done(),
          machined: machined(),
          materialFree,
        })
      : null,
  )
  const notMachined = once(() => groupFaces(coverage()?.faces.notMachined ?? [], features()))
  const counts = once(() => ({
    machined: groupFaces(coverage()?.faces.machined ?? [], features()).length,
    atShape: coverage()?.faces.atShape.length ?? 0,
    done: coverage()?.faces.done.length ?? 0,
    notMachined: notMachined().length,
  }))
  const counted = once(() => planCounts(view().setups))
  const changed = once(() => changedSinceResults(saved?.changed ?? false, view().setups.length))
  // The groups the plan is made from: the draft can hold groups added since.
  const groups = once(() => (planIsOfSaved && saved ? allGroups(draftView(saved, part, plan)) : []))
  const confirm = once(() =>
    confirmChecks(constraints.checks, {
      changed: changed(),
      notMachined: coverage() ? notMachined().length : null,
      groups: machinedFrames(groups(), view().setups),
      setups: view().setups.map((setup) => ({
        idx: setup.idx,
        notMachined: setup.notMachined.map((row) => row.tag),
        notFinished: setup.notFinished,
      })),
    }),
  )
  return {
    get setups() {
      return view().setups
    },
    get leftOut() {
      return view().leftOut
    },
    get machined() {
      return machined()
    },
    get features() {
      return features()
    },
    get coverage() {
      return coverage()
    },
    get done() {
      return done()
    },
    get notMachined() {
      return notMachined()
    },
    get counts() {
      return counts()
    },
    get planCounts() {
      return counted()
    },
    get changed() {
      return changed()
    },
    get confirm() {
      return confirm()
    },
    get allClear() {
      return allClear(confirm())
    },
  }
}

/** Each frame of the constraints, and whether the plan machines something in it or inside it. */
const machinedFrames = (
  groups: ReadonlyArray<PlanSetupView>,
  setups: ReadonlyArray<ResultsSetupView>,
): ConfirmContext['groups'] => {
  const machinesIn = (group: PlanSetupView): boolean =>
    setups.some((setup) => setup.fromGroup === group.id && setup.rows.length > 0) ||
    group.groups.some(machinesIn)
  return groups
    .filter((group) => group.isFrame)
    .map((group) => ({ id: group.id, name: group.name, machined: machinesIn(group) }))
}

const findOf = (
  { draft }: PlanDetailsInputs,
  constraints: PlanDetailsConstraints,
  results: PlanDetailsResults,
): PlanDetailsFind => {
  const setups = draft?.setups ?? []
  return {
    group: (id) => findPlaced(setups, id),
    path: (id) => groupPath(constraints.setups, id),
    assignmentOf: (tag) => assignmentOf(setups, tag),
    assignTarget: (direction) => assignTargetOf(setups, direction),
    resultSetup: (tag) => setupOf(results.setups, tag),
    holds: (group, tag) =>
      typeof group === 'number'
        ? results.setups.some((setup) => setup.idx === group && machines(setup, tag))
        : constraints.groups.some((each) => each.id === group && listsTag(each, tag)),
  }
}

/** How one tab's faces show, and which other directions share them, from its coverage and groups. */
const facesOf = (
  { openId, everyGroup, uncovered }: FacesView,
  tab: Pick<PlanDetailsConstraints, 'coverage' | 'setups'>,
): ReturnType<PlanDetails['faces']> => {
  const input = { faces: tab.coverage?.faces ?? NO_FACES, setups: tab.setups, openId, everyGroup }
  return { faces: shownFaces({ ...input, uncovered }), shared: sharedFaces(input) }
}
