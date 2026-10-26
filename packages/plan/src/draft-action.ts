import type { PlanDirection } from './engine-plan'
import { ignoreEdit, takeBackIgnore, unignoreEdit, type IgnoredAs } from './ignore'
import { chooseReading, folderClick, pinEdit, unignorePinned, withPin } from './pin'
import {
  addFolder,
  addSetup,
  currentFor,
  findPlaced,
  foldersFromPlan,
  frameFacing,
  isIndexed,
  MAX_SETUPS,
  moveFeature,
  moveFolder,
  moveWithin,
  pinnedIn,
  pinsWhere,
  placedFolders,
  planFromResults,
  removeFolders,
  renameFolder,
  sameDirection,
  setSetupProcess,
  setToolOrientation,
  unpinFeature,
  type Constraints,
  type DraftSetup,
  type Edited,
  type Landing,
  type PinnedFeature,
  type PlannedSetup,
  type PlanRules,
  type SetupProcess,
} from './plan-draft'
import { GONE, MAX_DEPTH, TOO_DEEP } from './refusals'

/*
  Every edit a person can make to a plan, as one closed list (`DraftAction`), carried out by one
  function (`applyDraftAction`), with one question a page asks before it offers any (`actionsFor`):
  what can be done here? A click on the part, a row dropped in the tree and a button all make the
  same edit through `applyDraftAction`, with the plan the app's own helpers (`pinEdit`,
  `folderClick`, `chooseReading`, `ignoreEdit`, …) make for that click.

  An action carries everything it needs, ids for anything it makes included, so applying it to the
  same draft gives the same plan. Nothing here throws on typed input. An action that can't be made
  answers `{ refused }`, the reason in words to show the person; one that changes nothing answers
  the draft as it was.
*/

/**
 * One edit to a plan's constraints: its setups, folders, pins and ignored faces. Every id an action
 * names for something it makes must be new to the draft, even where the edit ends up not needing it;
 * ids from `crypto.randomUUID()` are.
 * `direction` on a feature is the direction that reading of it was read from, as the part's
 * features name it: the package can't check it.
 */
export type DraftAction =
  /**
   * A folder inside another, at the end (`addFolder`). `id` is the new folder's; `workId` is for the
   * folder the parent's own work moves into, where the parent held no folders yet.
   */
  | { kind: 'addFolder'; parentId: string; id: string; workId: string }
  | { kind: 'renameFolder'; id: string; name: string }
  /**
   * What Delete removes: folders — setups too — with all they hold, and pinned features, each taken
   * out of the folder named (`setupId`). With every setup named, it is Remove all: Toolpath plans the
   * part as it would. Folders gone already are passed over.
   */
  | { kind: 'remove'; folders: ReadonlyArray<string>; features?: ReadonlyArray<PinnedFeature> }
  /**
   * A folder dropped somewhere in the tree (`moveFolder`). `newId` is for the parent made to hold
   * both, where it is dropped on a folder holding work.
   */
  | { kind: 'moveFolder'; id: string; to: Landing; newId: string }
  /** A folder moved `by` whole places up (negative) or down among the folders beside it. */
  | { kind: 'moveWithin'; id: string; by: number }
  /** A setup facing a direction no setup or tool orientation faces yet, last. */
  | { kind: 'addSetup'; direction: PlanDirection; id: string }
  /** Hold a setup 3+1 or 3+2, or 3 axis (`null`). */
  | { kind: 'setProcess'; setupId: string; process: SetupProcess | null }
  /** Make a folder a tool orientation facing `direction`, or follow its parent again (`null`). */
  | { kind: 'setToolOrientation'; folderId: string; direction: PlanDirection | null }
  /**
   * A click on the part in an open folder (`folderClick`), or a pin into a folder named (`pinEdit`):
   * the feature pinned there — or, pinned there already, taken out. `newId` is for the folder a pin
   * goes in, where the folder named holds folders.
   */
  | { kind: 'pinInto'; tag: string; direction: PlanDirection; folderId: string; newId: string }
  /**
   * Machine a feature from its direction (`pinEdit`): pinned in the folder facing that way, or in a
   * new setup facing it — or, pinned in that direction's folders already, let go. `newId` is that
   * setup's, or the folder's a pin into a parent makes.
   */
  | { kind: 'pinFrom'; tag: string; direction: PlanDirection; newId: string }
  /**
   * A feature's row dropped on a folder (`moveFeature`): pinned there, or in the first folder in it
   * cut from its direction, as any pin is (`withPin`). `newId` is for a folder made to hold it, where
   * it is dropped on a parent.
   */
  | { kind: 'moveFeature'; tag: string; direction: PlanDirection; folderId: string; newId: string }
  /**
   * A pick among the features a click in a folder read (`chooseReading`): `reading` meant instead of
   * `tag`, which a left click pinned (`target: 'pin'`) or left in the folder (`'add'`), or a right
   * click took out (`'takeOut'`), in `folderId`. Where the click's edit no longer stands — Undo,
   * Discard — it is made again first, in the same step. Needs the plan as applied. A folder gone
   * since — Undo — changes nothing.
   */
  | {
      kind: 'choosePinReading'
      tag: string
      target: 'pin' | 'add' | 'takeOut'
      reading: string
      folderId: string
    }
  /**
   * A pick among the features an Ignore click read: `tag` ignored instead of what the click took
   * (`click`, as `ignoreSelection` answers it), whose faces go back as applied where its edit still
   * stands. The click's own feature, its edit standing, changes nothing. Needs the plan as applied.
   */
  | { kind: 'chooseIgnoreReading'; tag: string; click: IgnoredAs }
  /**
   * Start from Toolpath's plan, on a plan with no folders: folders facing each of its setups
   * (`foldersFromPlan`), and with `pins` every feature pinned where it was planned
   * (`planFromResults`), trimmed ones too, its faces no longer ignored. New folders' ids are
   * `idSeed`, `-` and a count: no `:`, which an app may use to join an id with other keys.
   */
  | {
      kind: 'fromPlan'
      planned: ReadonlyArray<PlannedSetup>
      pins: boolean
      idSeed: string
    }
  /** Let a pinned feature go: Toolpath decides again where it is machined. */
  | { kind: 'unpin'; tag: string }
  /** Ignore faces: region indices, in the kernel `PlanRules` names. */
  | { kind: 'ignore'; regions: ReadonlyArray<number> }
  | { kind: 'unignore'; regions: ReadonlyArray<number> }

export type DraftActionKind = DraftAction['kind']

/** Every kind of action, in the order `actionsFor` lists them. */
export const DRAFT_ACTION_KINDS: ReadonlyArray<DraftActionKind> = [
  'addFolder',
  'renameFolder',
  'remove',
  'moveFolder',
  'moveWithin',
  'addSetup',
  'setProcess',
  'setToolOrientation',
  'pinInto',
  'pinFrom',
  'moveFeature',
  'unpin',
  'ignore',
  'unignore',
  'choosePinReading',
  'chooseIgnoreReading',
  'fromPlan',
]

/**
 * What an action did beyond the draft, for the page to say: what Toolpath's own app puts on its
 * status line. Empty lists and `false` where there is nothing to say.
 */
export interface DraftFacts {
  /** A pin's: the person's pins it let go, because it covers every face of each. By tag. */
  replaced: ReadonlyArray<string>
  /**
   * Faces ignored before the action and not after, ascending: what a pin, `fromPlan` with pins and
   * `unignore` give back. A pick among an Ignore click's readings says only what it ignores, so
   * the faces it gives back are not here. Toolpath's own app says these after every kind but Clear
   * (`unignore` of every ignored face), where it says nothing.
   */
  unignored: ReadonlyArray<number>
  /** An ignore's: the pins it let go, each with the folder it was in. */
  unpinned: ReadonlyArray<PinnedFeature>
  /** A pin's: a setup was added for it, facing its way. */
  added: boolean
  /** A pin's: it was pinned there already, and is now let go. */
  letGo: boolean
  /** A pin's: the folder it is pinned in, or was let go from — what its note names. */
  home: string | null
}

/**
 * What an action made of the draft, or why it can't be made. `folderId` is the folder Toolpath's own
 * app opens after it: the one `addFolder`, `addSetup` or `moveFolder` made or moved, or the one a
 * `moveFeature` row lands in. After any other action the open folder stays open. After `remove` the
 * page chooses: Toolpath's own app opens the nearest folder the open one was in, or the part.
 */
export type DraftResult<T extends Constraints> =
  | { draft: T; folderId?: string; facts: DraftFacts }
  | { refused: string }

const NO_FACTS: DraftFacts = Object.freeze({
  replaced: Object.freeze([]),
  unignored: Object.freeze([]),
  unpinned: Object.freeze([]),
  added: false,
  letGo: false,
  home: null,
})

const TOO_MANY = `A plan holds at most ${MAX_SETUPS} setups.`
const OTHER_WAY = 'Rows stay in folders cut from their own direction.'
const TAKEN = 'That id is taken: each folder needs an id of its own.'
const NOT_AN_ACTION = 'That is not a plan action.'
const NEEDS_SAVED = 'This needs the plan as applied.'
const NOT_EMPTY = 'Start from Toolpath’s plan while the plan holds no folders.'

/**
 * Carry out one action on a draft: the draft after it, every other part of it as it was, or why it
 * can't be made. `rules` reads the part: a feature's faces, and the kernel that numbers them.
 *
 * A pin is what pinning is in Toolpath's own app: the person's pins it covers are let go, and its
 * faces are no longer ignored; pinning a feature where it is pinned already lets it go, as a click
 * there does. Ignoring faces lets go of every pin they cover. An unpin of what is pinned nowhere, and
 * a reorder past the end, change nothing. Where the functions in `plan-draft` would quietly change
 * nothing — a folder too deep, a folder gone — this refuses, saying why. `saved`, the plan as
 * applied, is what the two picks among a click's readings put back; `planSession` passes it.
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
  const unignored =
    action.kind === 'chooseIgnoreReading' ? [] : ignoredNoLonger(draft, result.draft, rules)
  return { ...result, facts: { ...NO_FACTS, ...result.facts, unignored } }
}

/** The regions `before` ignores and `after` does not, ascending. */
const ignoredNoLonger = (
  before: Constraints,
  after: Constraints,
  rules: Pick<PlanRules, 'kernel'>,
): Array<number> => {
  const still = new Set(ignoredIn(after, rules))
  return ignoredIn(before, rules)
    .filter((region) => !still.has(region))
    .sort((a, b) => a - b)
}

/** The regions a plan ignores, in the kernel `rules` names. */
const ignoredIn = (plan: Constraints, rules: Pick<PlanRules, 'kernel'>): Array<number> =>
  currentFor(plan.done, plan.doneKernel, rules.kernel)

/** One action's draft, folder and facts — the faces it un-ignored aside — or why it can't be made. */
type Outcome<T extends Constraints> = Done<T> | { refused: string }
type Done<T extends Constraints> = { draft: T; folderId?: string; facts?: Partial<DraftFacts> }

/** What an action is carried out on: the draft, how to read the part, and the plan as applied. */
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

/** Where `pinEdit` pins: a folder named, or the folder facing a direction. */
type PinAt = Parameters<typeof pinEdit>[2]

/** The draft with new constraints, everything else of it as it was. */
const withConstraints = <T extends Constraints>(
  draft: T,
  intent: Constraints,
  more: Omit<Done<T>, 'draft'> = {},
): Done<T> => ({ ...more, draft: { ...draft, ...intent } })

/** The draft with new setups, and the folder to open after it. */
const withSetups = <T extends Constraints>(
  draft: T,
  setups: Array<DraftSetup>,
  folderId?: string,
): Done<T> => withConstraints(draft, { ...draft, setups }, folderId ? { folderId } : {})

/** `withSetups` for an edit `plan-draft` may refuse. */
const withEdited = <T extends Constraints>(
  draft: T,
  edited: Edited,
  folderId?: string,
): Outcome<T> =>
  Array.isArray(edited) ? withSetups(draft, edited, folderId) : { refused: edited.refused }

/** Whether the draft has a setup or folder with this id. */
const holds = (draft: Constraints, id: string): boolean =>
  findPlaced(draft.setups, id) !== undefined

/** Whether any of these ids is in the draft already, or named twice. */
const anyTaken = (draft: Constraints, ...ids: Array<string>): boolean =>
  ids.some((id) => holds(draft, id)) || new Set(ids).size < ids.length

/** A pin as `pinEdit` makes it, with what it did. */
const pinned = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  at: PinAt,
  tag: string,
): Outcome<T> => {
  const pin = pinEdit(draft, tag, at, rules)
  if ('refused' in pin) {
    return pin
  }
  return withConstraints(draft, pin.intent, {
    facts: { replaced: pin.replaced, added: pin.added, letGo: pin.unpinned, home: pin.setupId },
  })
}

/** `addFolder`: a folder inside another — unless the parent is gone or too deep, or an id taken. */
const applyAddFolder = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'addFolder'>,
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
  const setups = addFolder(draft.setups, action.parentId, action.id, action.workId)
  return withSetups(draft, setups, action.id)
}

/** `renameFolder`: a folder renamed, unless it is gone. */
const applyRenameFolder = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'renameFolder'>,
): Outcome<T> => {
  if (!holds(draft, action.id)) {
    return { refused: GONE }
  }
  return withSetups(draft, renameFolder(draft.setups, action.id, action.name))
}

/** `remove`: the pins named let go, then the folders named removed, any gone passed over. */
const applyRemove = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'remove'>,
): Outcome<T> => {
  if (!Array.isArray(action.folders)) {
    return { refused: NOT_AN_ACTION }
  }
  const unpinned = (action.features ?? []).reduce(
    (setups, pin) => unpinFeature(setups, pin.setupId, pin.tag),
    [...draft.setups],
  )
  const folders = action.folders.filter((id) => holds(draft, id))
  return withSetups(draft, removeFolders(unpinned, folders))
}

/** `moveFolder`: a folder dropped in the tree — unless it is gone, or the new id taken. */
const applyMoveFolder = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'moveFolder'>,
): Outcome<T> => {
  if (!holds(draft, action.id)) {
    return { refused: GONE }
  }
  if (anyTaken(draft, action.newId)) {
    return { refused: TAKEN }
  }
  const moved = moveFolder(draft.setups, action.id, action.to, action.newId)
  return withEdited(draft, moved, action.id)
}

/** `moveWithin`: a folder moved a whole number of places among the folders beside it. */
const applyMoveWithin = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'moveWithin'>,
): Outcome<T> => {
  if (!holds(draft, action.id)) {
    return { refused: GONE }
  }
  if (!Number.isInteger(action.by)) {
    return { refused: 'A folder moves a whole number of places.' }
  }
  return withSetups(draft, moveWithin(draft.setups, action.id, action.by))
}

/** `addSetup`: a setup facing a new direction, last — unless the plan is full, or the id taken. */
const applyAddSetup = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'addSetup'>,
): Outcome<T> => {
  const facing = frameFacing(draft.setups, action.direction)
  if (facing) {
    return { refused: `${facing.name} is cut from that direction already.` }
  }
  if (draft.setups.length >= MAX_SETUPS) {
    return { refused: TOO_MANY }
  }
  if (anyTaken(draft, action.id)) {
    return { refused: TAKEN }
  }
  return withSetups(draft, addSetup(draft.setups, action.direction, action.id), action.id)
}

/** `setProcess`: a setup's hold set — unless it is gone, or the id is not a setup's. */
const applySetProcess = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'setProcess'>,
): Outcome<T> => {
  if (!draft.setups.some((setup) => setup.id === action.setupId)) {
    return { refused: holds(draft, action.setupId) ? 'Only a setup has a hold.' : GONE }
  }
  const process = action.process ?? undefined
  return withEdited(draft, setSetupProcess(draft.setups, action.setupId, process))
}

/** `setToolOrientation`: a folder made a tool orientation, or following again. */
const applySetToolOrientation = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'setToolOrientation'>,
): Outcome<T> => {
  if (!holds(draft, action.folderId)) {
    return { refused: GONE }
  }
  return withEdited(draft, setToolOrientation(draft.setups, action.folderId, action.direction))
}

/** `pinInto`: a feature pinned in a folder facing its way, or taken out where pinned there. */
const applyPinInto = <T extends Constraints>(
  editing: Editing<T>,
  action: ActionOf<'pinInto'>,
): Outcome<T> => {
  const { setups } = editing.draft
  const target = findPlaced(setups, action.folderId)
  if (!target) {
    return { refused: GONE }
  }
  if (anyTaken(editing.draft, action.newId)) {
    return { refused: TAKEN }
  }
  // Pinned there already, it is taken out, whichever way the folder now faces.
  if (pinnedIn(setups, action.tag) === action.folderId) {
    return pinned(editing, { folderId: action.folderId }, action.tag)
  }
  if (!sameDirection(target.direction, action.direction)) {
    return { refused: OTHER_WAY }
  }
  return pinned(editing, { folderId: action.folderId, newId: action.newId }, action.tag)
}

/** `pinFrom`: a feature pinned from its direction, in a setup added where none faces it. */
const applyPinFrom = <T extends Constraints>(
  editing: Editing<T>,
  action: ActionOf<'pinFrom'>,
): Outcome<T> => {
  if (anyTaken(editing.draft, action.newId)) {
    return { refused: TAKEN }
  }
  return pinned(editing, { direction: action.direction, newId: action.newId }, action.tag)
}

/** `moveFeature`: a feature's row dropped on a folder, and pinned there as any pin is. */
const applyMoveFeature = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'moveFeature'>,
): Outcome<T> => {
  if (anyTaken(draft, action.newId)) {
    return { refused: TAKEN }
  }
  const { tag, direction, folderId, newId } = action
  const moved = moveFeature(draft.setups, tag, direction, folderId, newId)
  if (!Array.isArray(moved)) {
    return { refused: moved.refused }
  }
  const pin = withPin(draft, tag, moved, rules)
  return withConstraints(draft, pin.intent, {
    folderId: pinnedIn(moved, tag) ?? folderId,
    facts: { replaced: pin.replaced },
  })
}

/** `unpin`: a pinned feature let go; one pinned nowhere changes nothing. */
const applyUnpin = <T extends Constraints>(
  { draft }: Editing<T>,
  action: ActionOf<'unpin'>,
): Outcome<T> => {
  const home = pinnedIn(draft.setups, action.tag)
  if (!home) {
    return { draft }
  }
  return withSetups(draft, unpinFeature(draft.setups, home, action.tag))
}

/** `ignore`: faces ignored, and every pin they cover let go. */
const applyIgnore = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'ignore'>,
): Outcome<T> => {
  if (!Array.isArray(action.regions)) {
    return { refused: NOT_AN_ACTION }
  }
  const ignored = ignoreEdit(draft, action.regions, rules)
  return withConstraints(draft, ignored.intent, { facts: { unpinned: ignored.unpinned } })
}

/** `unignore`: faces no longer ignored. */
const applyUnignore = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'unignore'>,
): Outcome<T> => {
  if (!Array.isArray(action.regions)) {
    return { refused: NOT_AN_ACTION }
  }
  return withConstraints(draft, unignoreEdit(draft, action.regions, rules))
}

/** `choosePinReading`: a pick among a click's readings, the click made again if taken back. */
const applyChoosePinReading = <T extends Constraints>(
  { draft, rules, saved }: Editing<T>,
  action: ActionOf<'choosePinReading'>,
): Outcome<T> => {
  const placed = findPlaced(draft.setups, action.folderId)
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
    { id: action.folderId, direction: placed.direction },
    rules,
  )
  return withConstraints(draft, chosen.intent)
}

/** The draft with a folder click's edit standing: made again where Undo or Discard took it back. */
const withClickStanding = (
  draft: Constraints,
  action: ActionOf<'choosePinReading'>,
  placed: NonNullable<ReturnType<typeof findPlaced>>,
  rules: PlanRules,
): Constraints => {
  const inFolder = pinnedIn(draft.setups, action.tag) === action.folderId
  // The click's edit stands where a pin is in the folder, or a feature taken out is not; a feature
  // left in the folder made none.
  const standing = action.target === 'add' || inFolder !== (action.target === 'takeOut')
  if (standing) {
    return draft
  }
  // Only the click's note reads the label, and the note is not used here.
  const feature = { tag: action.tag, label: action.tag, direction: placed.direction, inFolder }
  const folder = { id: action.folderId, name: placed.folder.name }
  return folderClick(draft, feature, folder, rules).intent
}

/** `chooseIgnoreReading`: a pick among an Ignore click's readings, its faces back as applied. */
const applyChooseIgnoreReading = <T extends Constraints>(
  { draft, rules, saved }: Editing<T>,
  action: ActionOf<'chooseIgnoreReading'>,
): Outcome<T> => {
  if (!saved) {
    return { refused: NEEDS_SAVED }
  }
  const clicked = action.click.regions
  const ignored = new Set(ignoredIn(draft, rules))
  // The click's edit stands where every region it ignored is ignored still.
  const stands = clicked.every((region) => ignored.has(region))
  if (stands && action.tag === action.click.tag) {
    return { draft }
  }
  const back = stands ? takeBackIgnore(draft, saved, clicked, rules) : draft
  const chosen = ignoreEdit(back, rules.regionsOf(action.tag), rules)
  return withConstraints(draft, chosen.intent, { facts: { unpinned: chosen.unpinned } })
}

/** `fromPlan`: Toolpath's plan as folders, and with `pins` its features pinned where planned. */
const applyFromPlan = <T extends Constraints>(
  { draft, rules }: Editing<T>,
  action: ActionOf<'fromPlan'>,
): Outcome<T> => {
  if (draft.setups.length > 0) {
    return { refused: NOT_EMPTY }
  }
  let count = 0
  const newId = () => `${action.idSeed}-${count++}`
  if (!action.pins) {
    return withSetups(draft, foldersFromPlan(action.planned, newId))
  }
  const stated = planFromResults(action.planned, newId)
  const tags = pinsWhere(stated, () => true).map((pin) => pin.tag)
  return withConstraints(draft, unignorePinned({ ...draft, setups: stated }, tags, rules).intent)
}

/** How each kind of action is carried out. */
const CARRY_OUT: { readonly [K in DraftActionKind]: CarryOut<K> } = {
  addFolder: applyAddFolder,
  renameFolder: applyRenameFolder,
  remove: applyRemove,
  moveFolder: applyMoveFolder,
  moveWithin: applyMoveWithin,
  addSetup: applyAddSetup,
  setProcess: applySetProcess,
  setToolOrientation: applySetToolOrientation,
  pinInto: applyPinInto,
  pinFrom: applyPinFrom,
  moveFeature: applyMoveFeature,
  unpin: applyUnpin,
  ignore: applyIgnore,
  unignore: applyUnignore,
  choosePinReading: applyChoosePinReading,
  chooseIgnoreReading: applyChooseIgnoreReading,
  fromPlan: applyFromPlan,
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
  /** A setup or a folder, by id. */
  | { folder: string }
  /** One direction's reading of a feature: its tag, and the direction it is read from. */
  | { feature: string; direction: PlanDirection }
  /** Faces picked on the part: region indices, in the kernel `rules` names. */
  | { faces: ReadonlyArray<number> }

/**
 * What can be done to this, as the draft stands: the kinds of action `applyDraftAction` would make
 * here, in `DRAFT_ACTION_KINDS` order. A page offers these and no others. An action named here can
 * still be refused for its details — a drop on one folder or another — and says why when it is.
 * Three kinds follow other controls and are never named here: `choosePinReading` and
 * `chooseIgnoreReading`, offered where a click read more than one feature, and `fromPlan`, offered
 * while the plan holds no folders and Toolpath has planned the part.
 */
export const actionsFor = (
  draft: Constraints,
  target: ActionTarget,
  rules: Pick<PlanRules, 'kernel'>,
): Array<DraftActionKind> => {
  const allowed = new Set(actionsOn(draft, target, rules.kernel))
  return DRAFT_ACTION_KINDS.filter((kind) => allowed.has(kind))
}

/** The kinds of action that can be made on a target, in any order: `actionsFor` orders them. */
const actionsOn = (
  draft: Constraints,
  target: ActionTarget,
  kernel: string | null,
): Array<DraftActionKind> => {
  if ('folder' in target) {
    return folderActions(draft.setups, target.folder)
  }
  if ('feature' in target) {
    return featureActions(draft.setups, target.feature, target.direction)
  }
  if ('faces' in target) {
    return faceActions(draft, target.faces, kernel)
  }
  return partActions(draft.setups)
}

/** `kinds` where `yes`, none where not. */
const when = (yes: boolean, ...kinds: Array<DraftActionKind>): Array<DraftActionKind> =>
  yes ? kinds : []

/** What can be done on the part: add a setup, while there is room; remove them all. */
const partActions = (setups: ReadonlyArray<DraftSetup>): Array<DraftActionKind> => [
  ...when(setups.length < MAX_SETUPS, 'addSetup'),
  ...when(setups.length > 0, 'remove'),
]

/** What can be done to a setup or folder; nothing for one the draft does not hold. */
const folderActions = (setups: ReadonlyArray<DraftSetup>, id: string): Array<DraftActionKind> => {
  const placed = findPlaced(setups, id)
  if (!placed) {
    return []
  }
  const top = placed.depth === 0
  const beside = top ? setups : (placed.parent?.folders ?? [])
  const toolOriented = isIndexed(placed.setup) || placed.toolOrientation
  return [
    'renameFolder',
    'remove',
    ...when(placed.depth < MAX_DEPTH, 'addFolder'),
    ...when(beside.length > 1, 'moveWithin', 'moveFolder'),
    ...when(canMoveAway(setups, placed.folder.id, placed.parent?.id ?? null), 'moveFolder'),
    ...when(top, 'setProcess'),
    ...when(!top && toolOriented, 'setToolOrientation'),
  ]
}

/** Whether a folder can land anywhere but beside where it is: at the top, or inside another. */
const canMoveAway = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  parentId: string | null,
): boolean => {
  const landings = [null, ...placedFolders(setups).map((placed) => placed.folder.id)].filter(
    (landing) => landing !== parentId && landing !== id,
  )
  return landings.some((landing) =>
    Array.isArray(moveFolder(setups, id, { parentId: landing, index: 0 })),
  )
}

/** An id no draft holds, for trying a move that makes a folder. */
const PROBE_ID = '\u0000probe'

/** What can be done to one direction's reading of a feature. */
const featureActions = (
  setups: ReadonlyArray<DraftSetup>,
  tag: string,
  direction: PlanDirection,
): Array<DraftActionKind> => {
  const home = pinnedIn(setups, tag)
  const facingIds = placedFolders(setups)
    .filter((each) => each.folder.id !== home && sameDirection(each.direction, direction))
    .map((each) => each.folder.id)
  return [
    ...when(facingIds.length > 0, 'pinInto'),
    ...when(canPinFromItsWay(setups, home, direction), 'pinFrom'),
    ...when(canMoveFeature(setups, tag, direction, facingIds), 'moveFeature'),
    ...when(home !== null, 'unpin'),
  ]
}

/** Whether a pin from its direction lands somewhere new: a setup facing it, or one it would add. */
const canPinFromItsWay = (
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
    placedFolders(setups).some((each) => each.folder.id === home && each.frameId === frame.id)
  return !inFrame
}

/**
 * Whether dropping the row on a folder facing its way would move it somewhere new: a parent sends
 * it to the first folder in it cut from its way. `facingIds` are those folders, its own left out.
 */
const canMoveFeature = (
  setups: ReadonlyArray<DraftSetup>,
  tag: string,
  direction: PlanDirection,
  facingIds: ReadonlyArray<string>,
): boolean => {
  const home = pinnedIn(setups, tag)
  return facingIds.some((folderId) => {
    const moved = moveFeature(setups, tag, direction, folderId, PROBE_ID)
    return Array.isArray(moved) && pinnedIn(moved, tag) !== home
  })
}

/** What can be done to faces picked: ignore any open, unignore any ignored. */
const faceActions = (
  draft: Constraints,
  regions: ReadonlyArray<number>,
  kernel: string | null,
): Array<DraftActionKind> => {
  const ignored = new Set(currentFor(draft.done, draft.doneKernel, kernel))
  const anyOpen = regions.some((region) => !ignored.has(region))
  const anyIgnored = regions.some((region) => ignored.has(region))
  return [...when(anyOpen, 'ignore'), ...when(anyIgnored, 'unignore')]
}
