import {
  classifyFaces,
  groupFaces,
  planFeaturesOf,
  planTags,
  tagSet,
  type Coverage,
  type CoverageFeature,
  type FaceGroup,
} from './coverage'
import type { DirectionsKnown } from './direction-analysis'
import type { EnginePlan, PlanDirection } from './engine-plan'
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
} from './plan-checks'
import {
  currentFor,
  findPlaced,
  framesOf,
  pinOf,
  pinTargetOf,
  type Constraints,
  type PlacedFolder,
} from './plan-draft'
import {
  allFolders,
  draftView,
  folderPath,
  listsTag,
  planCounts,
  planHatch,
  planPaint,
  type FaceHatch,
  type FacePaint,
  type PlanOrientationView,
  type PlanPart,
  type PlanSetupView,
} from './plan-view'
import { machines, resultsView, setupOf, type ResultsSetupView } from './results-view'

/*
  The Plan page in one call: what it shows of the person's constraints, of Toolpath's plan, what it
  looks up, and how it paints the part — from the same inputs, each worked out once. Built from the
  functions of `@toolpath/plan/parts`, which an app with a page of another shape uses itself.
*/

/** The part's analysis, as the page reads it: its faces, and the features that include them. */
export interface PartAnalysis {
  regions: ReadonlyArray<{ idx: number; area: number }>
  features: ReadonlyArray<CoverageFeature & { machiningDirection?: PlanDirection }>
  /** The kernel that read the part: faces ignored under another kernel's numbering are let go. */
  kernelVersion: string | null
  /** The directions the part's report and its pending request say a folder can face. */
  directions: DirectionsKnown
}

/** The constraints as applied, and whether they changed since Toolpath's plan was made. */
export interface AppliedConstraints extends Constraints {
  changed: boolean
}

/** What the page knows of the part: how its rows read, and each feature its checks name. */
export interface PlanPagePart extends PlanPart {
  feature: CheckContext['feature']
}

/** Everything the page is made from. Toolpath's data alone: the app's own choices stay its own. */
export interface PlanPageInputs {
  /**
   * The constraints as held now, with edits not applied, and the kernel its pins name; null before
   * they are read.
   */
  draft: (Constraints & Pick<CheckedDraft, 'kernelVersion'>) | null
  /** The constraints as applied; null before they are read. */
  saved: AppliedConstraints | null
  /** Toolpath's plan; null before one is read. */
  plan: EnginePlan | null
  part: PlanPagePart
  /** Null before the part's analysis is read: no face is classified, and no direction is known. */
  analysis: PartAnalysis | null
  /** Whether `plan` is of `saved`: only then are its setups named by the folders they are from. */
  planIsOfSaved: boolean
}

/** The person's constraints, as the tree and the Constraints view show them. */
export interface ConstraintsPage {
  setups: ReadonlyArray<PlanSetupView>
  /** Every folder of the tree, in tree order. */
  folders: ReadonlyArray<PlanSetupView>
  /** Each face pinned, ignored or open; null before the analysis is read. */
  coverage: Coverage | null
  /** The faces ignored, numbered by the analysis' kernel. */
  ignored: ReadonlyArray<number>
  /** Features pinned, faces ignored, and features left open. */
  counts: { pinned: number; ignored: number; open: number }
  /** What would stop Toolpath taking the constraints, and what is worth knowing first. */
  checks: ReadonlyArray<PlanCheck>
}

/** Toolpath's plan, as the Results view shows it. */
export interface ResultsPage {
  setups: ReadonlyArray<ResultsSetupView>
  /** Folders no setup was planned from. */
  leftOut: ReadonlyArray<{ folderId: string; name: string }>
  /** Each face ignored, machined or not machined; null before the plan and the analysis are read. */
  coverage: Coverage | null
  /** The faces ignored as applied, numbered by the analysis' kernel: the ones the plan is made from. */
  ignored: ReadonlyArray<number>
  /** The faces nothing machines, gathered under the features that would machine them. */
  notMachined: ReadonlyArray<FaceGroup>
  /** Features machined, faces ignored, and features not machined. */
  counts: { machined: number; ignored: number; notMachined: number }
  /** Setups, and the directions they are machined from. */
  planCounts: { setups: number; orientations: number }
  /** The constraints changed since these results. */
  changed: boolean
  /** The checklist before the part moves on, and whether every line of it passed. */
  confirm: ReadonlyArray<ConfirmCheck>
  allClear: boolean
}

/** What the page looks up: in the constraints held now, or in Toolpath's plan. */
export interface PlanPageFind {
  folder: (id: string) => PlacedFolder | undefined
  /** A folder's name with the folders it is in: `Folder 1 › Side`. Empty for no folder. */
  path: (id: string) => string
  /** The folder a feature is pinned in, and the tag as the pin spells it. */
  pinOf: (tag: string) => { folderId: string; tag: string } | null
  /** The folder a pin from this direction goes in; null where pinning adds a setup. */
  pinTarget: (direction: PlanDirection) => string | null
  /** The setup of Toolpath's plan that machines a feature. */
  resultSetup: (tag: string) => ResultsSetupView | null
  /** Whether a folder (by id) or a setup of Toolpath's plan (by index) holds a feature. */
  holds: (folder: string | number, tag: string) => boolean
}

/** What to paint: which view, which folder is open, and the app's colour for each direction. */
export interface PaintView {
  tab: 'constraints' | 'results'
  /** A folder's id, or `PART_ROW` with none open. */
  openId: string
  colorOf: (orientation: PlanOrientationView) => number
  /** Direction colours on: every folder paints. Off, only the open folder. */
  everyFolder?: boolean
  /** Paint what nothing machines. Off where the app paints something else there. */
  uncovered?: boolean
}

export interface PlanPage {
  constraints: ConstraintsPage
  results: ResultsPage
  find: PlanPageFind
  paint: (view: PaintView) => { faces: Array<FacePaint>; hatches: Array<FaceHatch> }
}

const NO_FACES: Coverage['faces'] = {
  pinned: [],
  ignored: [],
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
 * The Plan page from its inputs. Each part is worked out only when it is read, and only once: make
 * a new page when an input changes.
 */
export const planPage = (inputs: PlanPageInputs): PlanPage => {
  const constraints = constraintsPage(inputs)
  const results = resultsPage(inputs, constraints)
  return {
    constraints,
    results,
    find: pageFind(inputs, constraints, results),
    paint: (view) => paintOf(view, view.tab === 'results' ? results : constraints),
  }
}

const constraintsPage = ({ draft, plan, part, analysis }: PlanPageInputs): ConstraintsPage => {
  const kernel = analysis?.kernelVersion ?? null
  const setups = once(() => (draft ? draftView(draft, part, plan) : []))
  const folders = once(() => allFolders(setups()))
  const pinned = once(() =>
    tagSet(framesOf(draft?.setups ?? []).flatMap((frame) => frame.features)),
  )
  const ignored = once(() => (draft ? currentFor(draft.done, draft.doneKernel, kernel) : []))
  // A trimmed feature is the constraints' only where it is pinned.
  const features = once(() => (analysis ? planFeaturesOf(analysis.features, plan, pinned()) : []))
  const coverage = once(() =>
    analysis && draft
      ? classifyFaces({
          regions: analysis.regions,
          features: features(),
          pinned: pinned(),
          ignored: ignored(),
        })
      : null,
  )
  const counts = once(() => ({
    pinned: pinned().size,
    ignored: coverage()?.faces.ignored.length ?? 0,
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
    get folders() {
      return folders()
    },
    get coverage() {
      return coverage()
    },
    get ignored() {
      return ignored()
    },
    get counts() {
      return counts()
    },
    get checks() {
      return checks()
    },
  }
}

const resultsPage = (inputs: PlanPageInputs, constraints: ConstraintsPage): ResultsPage => {
  const { plan, saved, part, analysis, planIsOfSaved } = inputs
  const kernel = analysis?.kernelVersion ?? null
  const view = once(() => resultsView({ plan, constraints: planIsOfSaved ? saved : null, part }))
  const ignored = once(() => (saved ? currentFor(saved.done, saved.doneKernel, kernel) : []))
  const features = once(() => (analysis ? planFeaturesOf(analysis.features, plan) : []))
  const coverage = once(() =>
    analysis && plan
      ? classifyFaces({
          regions: analysis.regions,
          features: features(),
          ignored: ignored(),
          machined: planTags(plan.setups),
        })
      : null,
  )
  const notMachined = once(() => groupFaces(coverage()?.faces.notMachined ?? [], features()))
  const counts = once(() => ({
    machined: groupFaces(coverage()?.faces.machined ?? [], features()).length,
    ignored: coverage()?.faces.ignored.length ?? 0,
    notMachined: notMachined().length,
  }))
  const counted = once(() => planCounts(view().setups))
  const changed = once(() => changedSinceResults(saved?.changed ?? false, view().setups.length))
  // The folders the plan is made from: the draft can hold folders added since.
  const folders = once(() =>
    planIsOfSaved && saved ? allFolders(draftView(saved, part, plan)) : [],
  )
  const confirm = once(() =>
    confirmChecks(constraints.checks, {
      changed: changed(),
      notMachined: coverage() ? notMachined().length : null,
      folders: machinedFrames(folders(), view().setups),
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
    get coverage() {
      return coverage()
    },
    get ignored() {
      return ignored()
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
  folders: ReadonlyArray<PlanSetupView>,
  setups: ReadonlyArray<ResultsSetupView>,
): ConfirmContext['folders'] => {
  const machinesIn = (folder: PlanSetupView): boolean =>
    setups.some((setup) => setup.fromFolder === folder.id && setup.rows.length > 0) ||
    folder.folders.some(machinesIn)
  return folders
    .filter((folder) => folder.isFrame)
    .map((folder) => ({ id: folder.id, name: folder.name, machined: machinesIn(folder) }))
}

const pageFind = (
  { draft }: PlanPageInputs,
  constraints: ConstraintsPage,
  results: ResultsPage,
): PlanPageFind => {
  const setups = draft?.setups ?? []
  return {
    folder: (id) => findPlaced(setups, id),
    path: (id) => folderPath(constraints.setups, id),
    pinOf: (tag) => pinOf(setups, tag),
    pinTarget: (direction) => pinTargetOf(setups, direction),
    resultSetup: (tag) => setupOf(results.setups, tag),
    holds: (folder, tag) =>
      typeof folder === 'number'
        ? results.setups.some((setup) => setup.idx === folder && machines(setup, tag))
        : constraints.folders.some((each) => each.id === folder && listsTag(each, tag)),
  }
}

/** One view's paint and hatches, from its coverage and its folders. */
const paintOf = (
  { openId, colorOf, everyFolder, uncovered }: PaintView,
  page: Pick<ConstraintsPage, 'coverage' | 'setups'>,
): ReturnType<PlanPage['paint']> => {
  const input = {
    faces: page.coverage?.faces ?? NO_FACES,
    setups: page.setups,
    openId,
    colorOf,
    everyFolder,
  }
  return { faces: planPaint({ ...input, uncovered }), hatches: planHatch(input) }
}
