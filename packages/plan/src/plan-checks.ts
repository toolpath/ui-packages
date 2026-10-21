import type { PlanDirection } from './engine-plan'
import { framesOf, placedFolders, sameDirection, statementOf, type Constraints } from './plan-draft'
import { directionAnalysis, type DirectionsKnown } from './direction-analysis'

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

/**
 * What would stop Toolpath taking the plan as the person has stated it, and what is worth knowing
 * before sending it: the rules its stated plan is held to (tp-kernel's `UserSetupPlan`), checked
 * here where they can be, so the answer comes before the round trip rather than after it.
 */
/** What the checks read of a draft: its setups, and the kernel whose tags its pins name. */
export interface CheckedDraft extends Pick<Constraints, 'setups'> {
  /** The kernel whose tags the pins name; null until something is pinned. */
  kernelVersion: string | null
}

export const planChecks = (draft: CheckedDraft, context: CheckContext): Array<PlanCheck> => {
  const checks: Array<PlanCheck> = []
  const statement = statementOf(draft.setups)
  if (!statement) {
    return checks
  }
  // Toolpath is told frames — each direction a setup of its own — so the checks are of frames.
  const stated = framesOf(draft.setups)
  for (const setup of stated) {
    const name = setup.name
    const analysis = directionAnalysis(setup.direction, context.directions)
    if (analysis !== 'analyzed') {
      // A plan may be sent while a direction is analyzed: only its features are late. The analysis
      // is the part's (`pending` is part-wide), so a direction whose request failed reads as
      // analyzing until the job ends; Toolpath refuses such a plan and the page explains it.
      checks.push({
        tone: analysis === 'analyzing' ? 'warning' : 'blocking',
        text: {
          undetected: `${name} faces a direction the part was not analyzed from. Delete it and add it again.`,
          analyzing: `Toolpath is analyzing ${name}’s direction. Its features arrive when it is done.`,
          unanalyzed: `Toolpath has not analyzed ${name}’s direction. Open ${name} and analyze it.`,
        }[analysis],
      })
    }
    for (const tag of setup.features) {
      const feature = context.feature(tag)
      if (context.directions.analyzed && !feature) {
        checks.push({
          tone: 'blocking',
          text: `A feature pinned in ${name} is not one of this part’s. Unpin it.`,
        })
      }
    }
  }
  // A pin in a folder cut from another way than its feature — a folder moved, or made to follow
  // again — is one Toolpath refuses: a feature is machined from its own direction.
  for (const placed of placedFolders(draft.setups)) {
    for (const tag of placed.folder.features) {
      const feature = context.feature(tag)
      if (feature?.direction && !sameDirection(feature.direction, placed.direction)) {
        checks.push({
          tone: 'blocking',
          text: `${feature.label} is cut from another direction than ${placed.folder.name}. Move it to a folder facing its way, or unpin it.`,
        })
      }
    }
  }
  const pinned = stated.some((setup) => setup.features.length > 0)
  if (
    pinned &&
    draft.kernelVersion &&
    context.kernelVersion &&
    draft.kernelVersion !== context.kernelVersion
  ) {
    checks.push({
      tone: 'warning',
      text: 'Toolpath has been updated since these features were pinned. If they are refused, pin them again.',
    })
  }
  return checks
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
): Array<ConfirmCheck> => {
  const checks: Array<ConfirmCheck> = own.filter((check) => check.tone !== 'info')
  if (context.changed) {
    checks.push({ tone: 'info', text: 'Constraints changed since these results.' })
  }
  const { notMachined } = context
  if (notMachined !== null) {
    checks.push(
      notMachined > 0
        ? {
            tone: 'warning',
            text: `${notMachined} feature${notMachined === 1 ? '' : 's'} nothing machines.`,
            show: { kind: 'notMachined' },
          }
        : { tone: 'ok', text: 'Every face that needs machining is machined.' },
    )
  }
  // What a setup was meant to machine and no pass cuts, apart from what a pass roughs but none
  // finishes: the two are said apart (Plan mode UI MP-22). Each Show opens the first of Toolpath's
  // setups with such a feature, in the Results view.
  const notFinishedOf = (setup: (typeof context.setups)[number]) =>
    setup.notMachined.filter((tag) => setup.notFinished.includes(tag))
  const cutByNoneOf = (setup: (typeof context.setups)[number]) =>
    setup.notMachined.filter((tag) => !setup.notFinished.includes(tag))
  const count = context.setups.reduce((sum, setup) => sum + cutByNoneOf(setup).length, 0)
  const roughCount = context.setups.reduce((sum, setup) => sum + notFinishedOf(setup).length, 0)
  const firstWith = (left: (setup: (typeof context.setups)[number]) => Array<string>) =>
    context.setups.find((setup) => left(setup).length > 0)!
  if (roughCount > 0) {
    checks.push({
      tone: 'warning',
      text: `${roughCount} feature${roughCount === 1 ? '' : 's'} not finished: Toolpath roughs ${roughCount === 1 ? 'it' : 'them'}, but no pass finishes ${roughCount === 1 ? 'it' : 'them'}.`,
      show: { kind: 'setup', idx: firstWith(notFinishedOf).idx },
    })
  }
  if (count > 0) {
    checks.push({
      tone: 'warning',
      text: `${count} feature${count === 1 ? '' : 's'} can’t be cut as planned.`,
      show: { kind: 'setup', idx: firstWith(cutByNoneOf).idx },
    })
  } else if (roughCount === 0 && context.setups.length > 0) {
    // With no plan yet there is no setup to vouch for.
    checks.push({ tone: 'ok', text: 'Every setup can cut what is in it.' })
  }
  // A folder with nothing pinned is a normal constraint that Toolpath fills: empty is what its plan
  // leaves empty, a folder it left out or planned a setup with no feature in.
  const empty = context.folders.filter((folder) => !folder.machined)
  if (empty[0]) {
    checks.push({
      tone: 'warning',
      text: `${empty.length} folder${empty.length === 1 ? ' has nothing in it' : 's have nothing in them'}.`,
      show: { kind: 'folder', setupId: empty[0].id },
    })
  }
  return checks
}

/** Every line passed: the move goes straight on without asking. */
export const allClear = (checks: ReadonlyArray<ConfirmCheck>): boolean =>
  checks.every((check) => check.tone === 'ok')
