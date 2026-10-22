import type { PlanDirection } from './engine-plan'
import {
  framesOf,
  placedFolders,
  sameDirection,
  statementOf,
  type Constraints,
  type Frame,
} from './plan-draft'
import {
  directionAnalysis,
  type DirectionAnalysis,
  type DirectionsKnown,
} from './direction-analysis'

/** One thing worth saying about the plan before it is sent. `blocking` stops it being sent. */
export interface PlanCheck {
  tone: 'blocking' | 'warning' | 'info'
  text: string
}

/** What the checks know of the part: its analysis, and the kernel Toolpath last planned with. */
export interface CheckContext {
  /** The part's directions: analyzed, detected, and being analyzed. `analyzed` is null before its model has been read. */
  directions: DirectionsKnown
  /**
   * A feature's type, label and the direction it is cut from, by tag — or null for a tag the part's
   * model does not have.
   */
  feature: (tag: string) => { type: string; label: string; direction?: PlanDirection } | null
  /** The kernel Toolpath's plan was made by, whose tags the pins have to be. */
  kernelVersion: string | null
}

/** What the checks read of a draft: its setups, and the kernel whose tags its pins name. */
export interface CheckedDraft extends Pick<Constraints, 'setups'> {
  /** The kernel whose tags the pins name; null until something is pinned. */
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

/** A frame's checks: its direction's analysis, then each pin that is not one of the part's features. */
const frameChecks = (frame: Frame, context: CheckContext): Array<PlanCheck> => [
  ...analysisChecks(frame.name, directionAnalysis(frame.direction, context.directions)),
  // One check for each pin of a feature the part does not have.
  ...Array.from(
    { length: frame.features.filter((tag) => isUnknownFeature(tag, context)).length },
    (): PlanCheck => ({
      tone: 'blocking',
      text: `A feature pinned in ${frame.name} is not one of this part’s. Unpin it.`,
    }),
  ),
]

/** What a frame not yet analyzed from its direction is told, by why. */
const NOT_ANALYZED: Record<Exclude<DirectionAnalysis, 'analyzed'>, (name: string) => string> = {
  undetected: (name) =>
    `${name} faces a direction the part was not analyzed from. Delete it and add it again.`,
  analyzing: (name) =>
    `Toolpath is analyzing ${name}’s direction. Its features arrive when it is done.`,
  unanalyzed: (name) =>
    `Toolpath has not analyzed ${name}’s direction. Open ${name} and analyze it.`,
}

/**
 * A plan may be sent while a direction is analyzed: only its features are late. The analysis is the
 * part's (`pending` is part-wide), so a direction whose request failed reads as analyzing until the
 * job ends; Toolpath refuses such a plan and the page explains it.
 */
const analysisChecks = (name: string, analysis: DirectionAnalysis): Array<PlanCheck> => {
  if (analysis === 'analyzed') {
    return []
  }
  return [
    {
      tone: analysis === 'analyzing' ? 'warning' : 'blocking',
      text: NOT_ANALYZED[analysis](name),
    },
  ]
}

/** Whether a pinned tag is not one of the part's features, once its model has been read. */
const isUnknownFeature = (tag: string, context: CheckContext): boolean => {
  const feature = context.feature(tag)
  return Boolean(context.directions.analyzed) && !feature
}

/**
 * A pin in a folder cut from another way than its feature — a folder moved, or made to follow
 * again — is one Toolpath refuses: a feature is machined from its own direction.
 */
const otherWayChecks = (setups: CheckedDraft['setups'], context: CheckContext): Array<PlanCheck> =>
  placedFolders(setups).flatMap((placed) =>
    placed.folder.features.flatMap((tag): Array<PlanCheck> => {
      const feature = context.feature(tag)
      if (!feature?.direction || sameDirection(feature.direction, placed.direction)) {
        return []
      }
      return [
        {
          tone: 'blocking',
          text: `${feature.label} is cut from another direction than ${placed.folder.name}. Move it to a folder facing its way, or unpin it.`,
        },
      ]
    }),
  )

/** Pins named in a kernel other than the one Toolpath last planned with may be refused. */
const kernelChecks = (
  draft: CheckedDraft,
  stated: ReadonlyArray<Frame>,
  context: CheckContext,
): Array<PlanCheck> => {
  const pinned = stated.some((frame) => frame.features.length > 0)
  const kernelMoved =
    draft.kernelVersion && context.kernelVersion && draft.kernelVersion !== context.kernelVersion
  if (!pinned || !kernelMoved) {
    return []
  }
  return [
    {
      tone: 'warning',
      text: 'Toolpath has been updated since these features were pinned. If they are refused, pin them again.',
    },
  ]
}

/** A tag as the kernel prints it (`FeatureTag(0af3…)`), padded or not, compared as a number. */
const sameTag = (a: string, b: string): boolean =>
  a.replace(/^0+/, '').toLowerCase() === b.replace(/^0+/, '').toLowerCase()

/**
 * One of Toolpath's refusal clauses in the person's own terms: its setup by the folder's name — setup
 * `n` of the statement, counted from zero, is the draft's `n`th frame — and its features by their
 * labels.
 */
export const describeClause = (
  clause: string,
  draft: Pick<Constraints, 'setups'>,
  label: (tag: string) => string | null,
  tags: ReadonlyArray<string>,
): string =>
  clause
    .replace(/\bsetup (\d+)(, orientation \d+)?/, (whole, index: string) => {
      const setup = framesOf(draft.setups)[Number(index)]
      return setup ? setup.name : whole
    })
    .replace(/FeatureTag\(([0-9a-fA-F]+)\)/g, (whole, hex: string) => {
      const tag = tags.find((candidate) => sameTag(candidate, hex))
      return (tag && label(tag)) ?? whole
    })
    // Toolpath offers every feature a plan states that it measured: one it did not is a kind it
    // cannot measure, or one whose measurement failed — not something a reshuffle of folders fixes.
    .replace(
      / is not among the features offered$/,
      ' could not be measured, so Toolpath cannot plan it — unpin it, or pin its faces as another feature',
    )

/**
 * Where a check's Show goes: the Not machined list, a folder and a feature in it, or one of
 * Toolpath's setups in the Results view.
 */
export type ShowTarget =
  | { kind: 'notMachined' }
  | { kind: 'folder'; setupId: string; tag?: string }
  | { kind: 'setup'; idx: number }

/** One line of the confirm checklist. `ok` says a check passed; the rest are as {@link PlanCheck}. */
export interface ConfirmCheck {
  tone: PlanCheck['tone'] | 'ok'
  text: string
  show?: ShowTarget
}

/** What the confirm checklist looks at, beside the plan's own checks. */
export interface ConfirmContext {
  /** The constraints as applied changed since Toolpath's results: the results are of an earlier version. */
  changed: boolean
  /** How many features nothing in Toolpath's plan machines: null before known. */
  notMachined: number | null
  /**
   * Each of the person's folders that Toolpath plans a setup from, and whether the plan machines
   * something in it, or in a folder inside it. Empty unless the results are of the current constraints.
   */
  folders: ReadonlyArray<{ id: string; name: string; machined: boolean }>
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
  ...own.filter((check) => check.tone !== 'info'),
  ...changedChecks(context.changed),
  ...notMachinedChecks(context.notMachined),
  ...setupChecks(context.setups),
  ...emptyFolderChecks(context.folders),
]

/** One of Toolpath's setups, as the confirm checklist reads it. */
type ResultSetup = ConfirmContext['setups'][number]

/** `count` features, in words: `1 feature`, `2 features`. */
const featuresCounted = (count: number): string => `${count} feature${count === 1 ? '' : 's'}`

const changedChecks = (changed: boolean): Array<ConfirmCheck> =>
  changed ? [{ tone: 'info', text: 'Constraints changed since these results.' }] : []

/** How many features nothing machines, where that is known. */
const notMachinedChecks = (notMachined: number | null): Array<ConfirmCheck> => {
  if (notMachined === null) {
    return []
  }
  if (notMachined > 0) {
    return [
      {
        tone: 'warning',
        text: `${featuresCounted(notMachined)} nothing machines.`,
        show: { kind: 'notMachined' },
      },
    ]
  }
  return [{ tone: 'ok', text: 'Every face that needs machining is machined.' }]
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
      tone: 'warning',
      text: `${featuresCounted(count)} can’t be cut as planned.`,
      show: { kind: 'setup', idx: firstWith(setups, cutByNoneOf).idx },
    })
  } else if (roughCount === 0 && setups.length > 0) {
    // With no plan yet there is no setup to vouch for.
    checks.push({ tone: 'ok', text: 'Every setup can cut what is in it.' })
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
const notFinishedCheck = (count: number, first: ResultSetup): ConfirmCheck => {
  const them = count === 1 ? 'it' : 'them'
  return {
    tone: 'warning',
    text: `${featuresCounted(count)} not finished: Toolpath roughs ${them}, but no pass finishes ${them}.`,
    show: { kind: 'setup', idx: first.idx },
  }
}

/**
 * A folder with nothing pinned is a normal constraint that Toolpath fills: empty is what its plan
 * leaves empty, a folder it left out or planned a setup with no feature in.
 */
const emptyFolderChecks = (folders: ConfirmContext['folders']): Array<ConfirmCheck> => {
  const empty = folders.filter((folder) => !folder.machined)
  if (!empty[0]) {
    return []
  }
  return [
    {
      tone: 'warning',
      text: `${empty.length} folder${empty.length === 1 ? ' has nothing in it' : 's have nothing in them'}.`,
      show: { kind: 'folder', setupId: empty[0].id },
    },
  ]
}

/** Every line passed: the move goes straight on without asking. */
export const allClear = (checks: ReadonlyArray<ConfirmCheck>): boolean =>
  checks.every((check) => check.tone === 'ok')
