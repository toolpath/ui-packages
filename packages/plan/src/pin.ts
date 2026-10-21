import {
  COVERAGE_KINDS,
  COVERAGE_LABELS,
  facesByRegion,
  type Coverage,
  type CoverageKind,
} from './coverage'
import {
  currentFor,
  ignoredAsSaved,
  pinFrom,
  pinInto,
  pinnedIn,
  pinsWhere,
  restoreFeature,
  unpinFeature,
  type DraftSetup,
  type Constraints,
  type PinnedFeature,
  type PlanRules,
} from './plan-draft'
import type { PlanDirection } from './engine-plan'
import { unignoreEdit, unignoredNote } from './ignore'
import { listsTag, rowsOf, type PlanSetupView } from './plan-view'

/*
  What pinning and unpinning do to the plan, apart from the page that wires them. Every way to pin
  — a click on the part, a drop in the tree, the Not machined list, the Feature section, a pick
  among a click's readings, Auto plan — makes the same edit: a pinned feature is machined, so its
  faces are no longer ignored (`unignorePinned`), in the same step as the pin. Ignoring a pinned
  feature's faces is Ignore's edit, and the ignore wins there (`ignoreEdit`).
*/

/** What a pin needs to know of the part. */
export type PinContext = PlanRules

/** Whether every one of `inner`'s regions is among `outer`'s. */
const coversAll = (outer: ReadonlyArray<number>, inner: ReadonlyArray<number>): boolean => {
  const has = new Set(outer)
  return inner.length > 0 && inner.every((region) => has.has(region))
}

/**
 * The person's pins a new pin of `tag` replaces: each one, in any folder, whose every face it covers
 * — another direction's reading of those faces, or a smaller feature inside it. One it only overlaps
 * stays.
 */
export const replacedBy = (
  setups: ReadonlyArray<DraftSetup>,
  tag: string,
  regionsOf: (tag: string) => ReadonlyArray<number>,
): Array<PinnedFeature> => {
  const regions = regionsOf(tag)
  return pinsWhere(setups, (other) => other !== tag && coversAll(regions, regionsOf(other)))
}

/**
 * The plan with every face of `tags` no longer ignored, and those that were, ascending: what every
 * way of pinning ends with, as a pinned feature is machined whole.
 */
export const unignorePinned = (
  plan: Constraints,
  tags: ReadonlyArray<string>,
  context: PinContext,
): { intent: Constraints; unignored: Array<number> } => {
  const ignored = new Set(currentFor(plan.done, plan.doneKernel, context.kernel))
  const unignored = [...new Set(tags.flatMap((tag) => context.regionsOf(tag)))]
    .filter((region) => ignored.has(region))
    .sort((a, b) => a - b)
  return {
    intent: unignored.length > 0 ? unignoreEdit(plan, unignored, context) : plan,
    unignored,
  }
}

/** What a pin did: the plan after it, where it went, the pins it replaced and the faces it un-ignored. */
export interface PinEdit {
  intent: Constraints
  setupId: string
  /** A setup was added for it, facing its way. */
  added: boolean
  /** It was pinned there already, and is now unpinned. */
  unpinned: boolean
  replaced: Array<string>
  unignored: Array<number>
}

/**
 * Pin a feature into a folder, or into the one facing its direction (adding one where none does), or
 * — pinned there already — unpin it. A new pin replaces the person's pins whose every face it
 * covers. One edit.
 */
export const pinEdit = (
  plan: Constraints,
  tag: string,
  /** `newId` is for the folder a pin into a parent makes, or the setup a pin from a direction adds. */
  at: { folderId: string; newId?: string } | { direction: PlanDirection; newId: string },
  context: PinContext,
): PinEdit | { refused: string } => {
  const result =
    'folderId' in at
      ? pinInto(plan.setups, at.folderId, tag, at.newId)
      : pinFrom(plan.setups, at.direction, tag, at.newId)
  if ('refused' in result) {
    return result
  }
  const { setupId, added, unpinned } = result
  if (unpinned) {
    return {
      intent: { ...plan, setups: result.setups },
      setupId,
      added,
      unpinned,
      replaced: [],
      unignored: [],
    }
  }
  return { ...withPin(plan, tag, result.setups, context), setupId, added, unpinned }
}

/**
 * The plan once `tag` is pinned where `pinned` (the setups with the pin made) has it: the person's
 * pins it covers unpinned, and its faces no longer ignored (`unignorePinned`). What every way of
 * pinning one feature ends with — `pinEdit`, and a row dropped in a folder.
 */
export const withPin = (
  plan: Constraints,
  tag: string,
  pinned: ReadonlyArray<DraftSetup>,
  context: PinContext,
): { intent: Constraints; replaced: Array<string>; unignored: Array<number> } => {
  const replaced = replacedBy(plan.setups, tag, context.regionsOf)
  const setups = replaced.reduce(
    (all, each) => unpinFeature(all, each.setupId, each.tag),
    [...pinned],
  )
  return {
    ...unignorePinned({ ...plan, setups }, [tag], context),
    replaced: replaced.map((each) => each.tag),
  }
}

/** What a click does to its feature: pin it in the folder, or take it out — unpinned. */
type PinTarget = 'pin' | 'takeOut'

/** What a click made of a feature since the plan was saved: pinned in the folder, or taken out. */
export interface PinChange {
  tag: string
  target: PinTarget
}

/** The plan with a feature pinned nowhere: open, left to Toolpath. */
const letGo = (plan: Constraints, tag: string): Constraints => {
  const was = pinnedIn(plan.setups, tag)
  return was ? { ...plan, setups: unpinFeature(plan.setups, was, tag) } : plan
}

/**
 * The plan with one line taken back: the feature as `saved` had it, and — where it is pinned since,
 * or moved — the pins that pin replaced, and its faces ignored as `saved` had them. Every other
 * edit stands.
 */
export const takeBack = (
  plan: Constraints,
  saved: Constraints,
  tag: string,
  context: PinContext,
): Constraints => {
  const home = pinnedIn(plan.setups, tag)
  const pinnedSince = home !== null && home !== pinnedIn(saved.setups, tag)
  const replaced = pinnedSince ? replacedBy(saved.setups, tag, context.regionsOf) : []
  const tags = [...new Set([tag, ...replaced.map((each) => each.tag)])]
  return {
    ...plan,
    setups: tags.reduce((all, each) => restoreFeature(all, saved.setups, each), [...plan.setups]),
    ...(pinnedSince ? ignoredAsSaved(plan, saved, context.regionsOf(tag), context.kernel) : {}),
  }
}

/**
 * What a click on the part in the open folder does, and what the status line says of it: a feature
 * pinned in the folder is taken out — unpinned, left to Toolpath; any other is pinned there. (A
 * click on the folder's tree row is the page's: it edits nothing, and only shows the feature.)
 */
export const folderClick = (
  plan: Constraints,
  feature: {
    tag: string
    label: string
    direction: PlanDirection
    /** Pinned in the folder. */
    inFolder: boolean
  },
  folder: { id: string; name: string },
  context: PinContext,
): { intent: Constraints; note: string } => {
  if (feature.inFolder) {
    return {
      intent: { ...plan, setups: unpinFeature(plan.setups, folder.id, feature.tag) },
      note: `${feature.label} taken out of ${folder.name}.`,
    }
  }
  const pinned = pinHere(plan, feature.tag, folder.id, context)
  return {
    intent: pinned.intent,
    note: `${feature.label} pinned to ${folder.name}.${unignoredNote(pinned.unignored)}`,
  }
}

/**
 * Pin a feature in a folder, by `pinEdit` — which never refuses a folder named — kept pinned there:
 * the plan, and the faces the pin un-ignored.
 */
const pinHere = (
  plan: Constraints,
  tag: string,
  folderId: string,
  context: PinContext,
): { intent: Constraints; unignored: Array<number> } => {
  if (pinnedIn(plan.setups, tag) === folderId) {
    return { intent: plan, unignored: [] }
  }
  const pinned = pinEdit(plan, tag, { folderId }, context)
  return 'refused' in pinned ? { intent: plan, unignored: [] } : pinned
}

/**
 * A line's choice among the features its click read. On a pin: itself, or another pinned in its
 * place. On a feature taken out: it stays out, and at most one other is pinned instead — choosing
 * again, or choosing to take it out, lets the one before go. A feature that goes leaves the folder as
 * a click takes it out: unpinned, never put back where it was before. Answers the plan, and the
 * lines whose choice is made — a pin swapped away keeps its choice unmade, so undo brings it back
 * to be made.
 */
export const chooseReading = (
  plan: Constraints,
  saved: Constraints,
  line: PinChange,
  reading: string,
  /** The features its click read, the line's among them. */
  read: ReadonlyArray<string>,
  folder: { id: string; direction: PlanDirection },
  context: PinContext,
): { intent: Constraints; chosen: Array<string> } => {
  // What it took — the pins it replaced — put back first; then it leaves.
  const leaves = (all: Constraints, tag: string) => letGo(takeBack(all, saved, tag, context), tag)
  if (line.target === 'pin') {
    return {
      intent:
        reading === line.tag
          ? plan
          : pinHere(leaves(plan, line.tag), reading, folder.id, context).intent,
      chosen: [reading],
    }
  }
  // One of them instead of taking it out: any other pinned here since, from this choice, goes.
  const cleared = read
    .filter(
      (each) =>
        each !== line.tag &&
        each !== reading &&
        pinnedIn(plan.setups, each) === folder.id &&
        pinnedIn(saved.setups, each) !== folder.id,
    )
    .reduce(leaves, plan)
  // Putting one back can put back what this line takes out: it stays out.
  const out =
    pinnedIn(cleared.setups, line.tag) === pinnedIn(plan.setups, line.tag)
      ? cleared
      : letGo(cleared, line.tag)
  return {
    intent: reading === line.tag ? out : pinHere(out, reading, folder.id, context).intent,
    chosen: reading === line.tag ? [line.tag] : [reading, line.tag],
  }
}

/** A plan as a Pin features note reads it: every folder of the tree, and who machines each face. */
export interface PlanReading {
  folders: ReadonlyArray<PlanSetupView>
  kindOf: (region: number) => CoverageKind
}

/** A plan as a note reads it, from its folders and who machines each face (`classifyFaces`). */
export const readingOf = (
  folders: ReadonlyArray<PlanSetupView>,
  coverage: Coverage | null,
): PlanReading => {
  const faces = facesByRegion(coverage)
  return { folders, kindOf: (region) => faces.get(region)?.kind ?? 'open' }
}

/**
 * What a choice says of a feature beside its name: how many faces, the way it is cut where that is
 * said, and where it is now (`stateOf`).
 */
export const readingDetail = (faces: number, state: string, way?: string): string =>
  [`${faces} face${faces === 1 ? '' : 's'}`, ...(way ? [way] : []), state].join(' · ')

/** Where a feature is: in the glossary's words, and the folders that names. */
interface FeatureState {
  text: string
  folders: Array<string>
}

/**
 * Where a feature is in a plan, in the glossary's words, from the open folder (`folderId`): Pinned
 * (in a folder, or part of a larger feature pinned there), Ignored, or Open. Read off its faces, so
 * a feature inside another reads as that one's; faces in several folders name the first, and how
 * many more.
 */
export const stateOf = (
  tag: string,
  plan: PlanReading,
  folderId: string,
  regionsOf: (tag: string) => ReadonlyArray<number>,
): FeatureState => {
  const faces = regionsOf(tag)
  const kinds = faces.map(plan.kindOf)
  const kind = COVERAGE_KINDS.find((each) => kinds.includes(each)) ?? 'open'
  const said = (text: string, folders: ReadonlyArray<PlanSetupView> = []): FeatureState => {
    const first = folders[0]
    const where = !first || first.id === folderId ? '' : ` in ${first.name}`
    const more = folders.length > 1 ? ` +${folders.length - 1}` : ''
    return { text: `${text}${where}${more}`, folders: folders.map((folder) => folder.id) }
  }
  if (kind === 'ignored') {
    return said(COVERAGE_LABELS.ignored)
  }
  const own = plan.folders.filter((folder) => listsTag(folder, tag))
  if (own.length > 0) {
    return said(COVERAGE_LABELS.pinned, own)
  }
  const around = plan.folders.flatMap((folder) =>
    rowsOf(folder)
      .filter((row) => coversAll(regionsOf(row.tag), faces))
      .map((row) => ({ folder, row })),
  )
  if (around.length > 0) {
    const folders = [...new Set(around.map((each) => each.folder))]
    const { row } = around[0]!
    // Another way's reading of the same faces is where they were; a larger feature, what they were part of.
    return regionsOf(row.tag).length === faces.length
      ? said(COVERAGE_LABELS.pinned, folders)
      : said(`Part of ${row.label}`, folders)
  }
  const shared = plan.folders.filter((folder) =>
    rowsOf(folder).some((row) => regionsOf(row.tag).some((region) => faces.includes(region))),
  )
  if (shared.length > 0 && kind === 'pinned') {
    return said(COVERAGE_LABELS.pinned, shared)
  }
  return said(COVERAGE_LABELS[kind])
}

/** A feature read from the open folder's direction, as its Pin features read it. */
export interface FolderFeature {
  tag: string
  label: string
}
