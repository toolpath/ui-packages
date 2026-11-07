import { tagKey } from '../faces/coverage'
import type { PlanDirection } from '../results/plan'
import { groupRef, GONE, MAX_DEPTH, type Refused, TOO_DEEP } from './refusals'

/*
  A part's plan as the person editing it has expressed it — their constraints, and nothing more.
  Two kinds of preference, each stated to Toolpath only once it has been expressed:

  1. Which setups, in what order: the ways the part is held, machined in this sequence.
  2. A feature from another direction: "machine this surface from there". A surface is extracted once
     for each direction that reaches it, so this assigns that direction's reading of it into a
     group facing that way.

  Groups nest, as in the prototype. A setup is a top-level group: one way the part is held, 3 axis
  or indexed (3+1 / 3+2). Inside it, a group either follows it — a grouping of its work, cut from
  its direction — or, inside an indexed setup, is an orientation: cut from a tilt of its own. Each
  direction the plan is cut from is a frame: a setup's own, and each orientation's.

  Toolpath takes frames, not holds: it is sent one 3-axis setup per frame, in tree order.
  `holdsFor` groups them back under their setups, so an indexed setup reads as one hold.

  The draft starts empty: with nothing stated, Toolpath plans the part as it would. What Toolpath
  planned is shown from its plan, never copied in here as something the person chose.
*/

/** A group: a grouping of work, the features assigned in it, and the groups inside it. */
export interface DraftGroup {
  id: string
  name: string
  /**
   * Features assigned here — machined from this group's direction, whatever else Toolpath decides.
   * Tags (hex), each of that direction's reading of its surface. Only ever what someone assigned.
   */
  features: Array<string>
  groups: Array<DraftGroup>
  /** Set only on an orientation: the tilt it is cut from, inside an indexed setup. */
  direction?: PlanDirection
}

/** How a setup holds the part: indexed about one rotary axis, or two. Absent, it is 3 axis. */
export type SetupProcess = '3+1' | '3+2'

/** A top-level group: one way the part is held, facing its direction (Setup Z). */
export interface DraftSetup extends DraftGroup {
  direction: PlanDirection
  process?: SetupProcess
}

/** The person's constraints: the setups and the faces done — what the plan's own edits change. */
export interface Constraints {
  setups: Array<DraftSetup>
  /**
   * Faces already at their final surface, which no setup needs to reach: indices into the part
   * report's regions, sorted. Sent to Toolpath with the plan as `doneRegions`.
   */
  done: Array<number>
  /**
   * The kernel version of the part report the done faces were marked on: their indices are its
   * numbering. Null with none marked.
   */
  doneKernel: string | null
}

/** As many setups as the Engine takes in a stated plan, and the longest name worth keeping. */
export const MAX_SETUPS = 64
export const MAX_NAME = 100
// Defined in `refusals`, beside the refusal that names it.
export { MAX_DEPTH }
const MAX_FEATURES = 5000

/** The refusal of a direction a frame faces already: Toolpath takes each direction once. */
const alreadyCut = (frame: { id: string; name: string }): Refused => ({
  refused: { kind: 'directionTaken', group: groupRef(frame) },
})

/** Two directions are the same only bit for bit: Toolpath compares its direction tokens exactly. */
export const sameDirection = (a: PlanDirection, b: PlanDirection): boolean =>
  a.x === b.x && a.y === b.y && a.z === b.z

export const isIndexed = (setup: Pick<DraftSetup, 'process'>): boolean =>
  setup.process === '3+1' || setup.process === '3+2'

/* ---------- The tree ---------- */

/** A group where it sits: its setup, its parent, its depth, and the frame it is cut in. */
export interface PlacedGroup {
  group: DraftGroup
  setup: DraftSetup
  parent: DraftGroup | null
  /** 0 for a setup. */
  depth: number
  /** The direction it is cut from: its own as a setup or orientation, else its parent's. */
  direction: PlanDirection
  /** The group whose direction that is — itself for a setup or orientation. */
  frameId: string
  /** Whether it is an orientation: a tilt of its own, inside an indexed setup. */
  orientation: boolean
}

/**
 * Every group in tree order — each setup, then what is inside it depth first — with where it sits.
 * An orientation counts only inside an indexed setup; elsewhere a group's own direction is
 * inert and it follows its parent.
 */
export const placedGroups = (setups: ReadonlyArray<DraftSetup>): Array<PlacedGroup> => {
  const placed: Array<PlacedGroup> = []
  const walk = (
    group: DraftGroup,
    setup: DraftSetup,
    parent: PlacedGroup | null,
    depth: number,
  ) => {
    const here = placedAt(group, setup, parent, depth)
    placed.push(here)
    for (const child of group.groups ?? []) {
      walk(child, setup, here, depth + 1)
    }
  }
  for (const setup of setups) {
    walk(setup, setup, null, 0)
  }
  return placed
}

/**
 * Where one group sits: in its setup, `depth` below it, under its placed parent (null for a
 * setup).
 */
const placedAt = (
  group: DraftGroup,
  setup: DraftSetup,
  parent: PlacedGroup | null,
  depth: number,
): PlacedGroup => {
  const orientation = parent !== null && isIndexed(setup) && group.direction !== undefined
  return {
    group,
    setup,
    parent: parent?.group ?? null,
    depth,
    direction:
      parent === null ? setup.direction : orientation ? group.direction! : parent.direction,
    frameId: parent === null || orientation ? group.id : parent.frameId,
    orientation,
  }
}

export const findPlaced = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
): PlacedGroup | undefined => placedGroups(setups).find((placed) => placed.group.id === id)

/**
 * A frame: one direction the plan is cut from, and every feature assigned in it or its followers.
 */
export interface Frame {
  /** The group that faces it: a setup, or an orientation. */
  id: string
  name: string
  /** The setup it is held in — its hold. */
  holdId: string
  direction: PlanDirection
  features: Array<string>
}

/** The plan's frames, in tree order: each setup's direction, then its orientations'. */
export const framesOf = (setups: ReadonlyArray<DraftSetup>): Array<Frame> => {
  const placed = placedGroups(setups)
  return placed
    .filter((each) => each.frameId === each.group.id)
    .map((frame) => ({
      id: frame.group.id,
      name: frame.group.name,
      holdId: frame.setup.id,
      direction: frame.direction,
      features: [
        ...new Set(
          placed
            .filter((each) => each.frameId === frame.group.id)
            .flatMap((each) => each.group.features),
        ),
      ],
    }))
}

/** How deep the groups run below this one, counting itself: 1 for a group with none in it. */
export const heightOf = (group: DraftGroup): number =>
  1 + Math.max(0, ...(group.groups ?? []).map(heightOf))

/** Every group's id inside this one, itself included. */
const idsIn = (group: DraftGroup): Array<string> => [
  group.id,
  ...(group.groups ?? []).flatMap(idsIn),
]

/** The draft with one group, wherever it is, changed. */
const updateGroup = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  change: (group: DraftGroup) => DraftGroup,
): Array<DraftSetup> => {
  const visit = (group: DraftGroup): DraftGroup => {
    const next = group.id === id ? change(group) : group
    const children = (next.groups ?? []).map(visit)
    return children.some((child, index) => child !== next.groups[index])
      ? { ...next, groups: children }
      : next
  }
  return setups.map((setup) => visit(setup) as DraftSetup)
}

/** The draft with a group, and everything in it, taken out — leaving any group as it is. */
const pruneGroup = (setups: ReadonlyArray<DraftSetup>, id: string): Array<DraftSetup> => {
  const prune = (group: DraftGroup): DraftGroup =>
    group.groups.some((child) => child.id === id)
      ? { ...group, groups: group.groups.filter((child) => child.id !== id).map(prune) }
      : { ...group, groups: group.groups.map(prune) }
  return setups.filter((setup) => setup.id !== id).map((setup) => prune(setup) as DraftSetup)
}

/**
 * The draft with a group, and everything in it, taken out. A setup goes from the top; a group it
 * leaves holding only one group gives way to it (`liftLoneGroup`).
 */
export const removeGroup = (setups: ReadonlyArray<DraftSetup>, id: string): Array<DraftSetup> =>
  removeGroups(setups, [id])

/**
 * The draft with several groups, and everything in them, taken out together — then each group
 * they leave holding only one group gives way to it. All go before any gives way, so a group
 * taken out with its pair's parent can't be left standing in that parent's place.
 */
export const removeGroups = (
  setups: ReadonlyArray<DraftSetup>,
  ids: ReadonlyArray<string>,
): Array<DraftSetup> => {
  const parents = [...new Set(ids.flatMap((id) => findPlaced(setups, id)?.parent?.id ?? []))]
  const pruned = ids.reduce((all, id) => pruneGroup(all, id), [...setups])
  return parents.reduce((all, parentId) => liftLoneGroup(all, parentId), pruned)
}

/** A group as one that follows: without a direction or a hold. */
const following = (group: DraftGroup): DraftGroup => {
  const { direction: _d, process: _p, ...rest } = group as DraftSetup
  return rest
}

/** The tilts of the orientations anywhere inside a group, below it. */
const tiltsBelow = (group: DraftGroup): Array<PlanDirection> =>
  group.groups.flatMap((child) => [
    ...(child.direction ? [child.direction] : []),
    ...tiltsBelow(child),
  ])

/**
 * What a group holding a single group becomes, once that group comes up into its place; null
 * for one that holds anything else. See `liftLoneGroup`.
 */
const liftedFrom = (here: DraftGroup, top: boolean): DraftGroup | null => {
  if (here.groups.length !== 1 || here.features.length > 0) {
    return null
  }
  const [only] = here.groups as [DraftGroup]
  // What comes up is cut from the way it was: its own tilt, or its place's.
  const { direction: ownTilt, ...kept } = only
  if (top) {
    return liftedToTop(here as DraftSetup, kept, ownTilt)
  }
  // Inside a setup: it keeps its own tilt, else takes its place's.
  const tilt = ownTilt ?? here.direction
  return { ...kept, ...(tilt ? { direction: tilt } : {}) }
}

/** A setup's lone group, its own tilt aside, come up to be the setup in its place. */
const liftedToTop = (
  setup: DraftSetup,
  kept: DraftGroup,
  ownTilt: PlanDirection | undefined,
): DraftSetup => {
  if (ownTilt) {
    // A tilt come up to the top: a setup facing it, indexed to the tilts it holds, if any.
    const tilts = tiltsBelow(kept)
    return {
      ...kept,
      direction: ownTilt,
      ...(tilts.length > 0 ? { process: indexedFor(ownTilt, tilts) } : {}),
    } as DraftSetup
  }
  // Its hold stays only while there is a tilt left in it to turn to.
  return {
    ...kept,
    direction: setup.direction,
    ...(setup.process && tiltsBelow(kept).length > 0 ? { process: setup.process } : {}),
  } as DraftSetup
}

/**
 * No edit leaves a group holding a single group: the group an edit leaves that way — one taken
 * out of a pair, say — gives way to the group in it, which comes up into its place. That group
 * keeps its name, its assignments and its groups. It is cut as it was: where it followed, from the
 * way its place was cut — a setup's direction, and its hold while a tilt is left in it to reach, or
 * a tilt — and where it was a tilt of its own, from that tilt; a tilt come up to the top is a setup
 * facing it, indexed only to reach the tilts inside it, as a tilt moved to the top is (FLD23).
 *
 * Only the group named: a draft saved holding one elsewhere is left as it is, rather than
 * restructured by an edit to something else. Its place's own count is unchanged, so nothing above
 * it needs another look.
 */
export const liftLoneGroup = (setups: ReadonlyArray<DraftSetup>, id: string): Array<DraftSetup> => {
  const placed = findPlaced(setups, id)
  const next = placed ? liftedFrom(placed.group, placed.depth === 0) : null
  if (!placed || !next) {
    return [...setups]
  }
  if (!placed.parent) {
    return setups.map((setup) => (setup.id === id ? (next as DraftSetup) : setup))
  }
  return replaceChild(setups, placed.parent.id, id, next)
}

/** The draft with one group inside a parent swapped for another. */
const replaceChild = (
  setups: ReadonlyArray<DraftSetup>,
  parentId: string,
  childId: string,
  next: DraftGroup,
): Array<DraftSetup> =>
  updateGroup(setups, parentId, (group) => ({
    ...group,
    groups: group.groups.map((child) => (child.id === childId ? next : child)),
  }))

/** Every group's name in the draft. */
const namesIn = (setups: ReadonlyArray<DraftSetup>): Array<string> =>
  placedGroups(setups).map((placed) => placed.group.name)

/** A word as a RegExp matches it: each character taken as itself. */
const escaped = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A new group's name: "<word> N", one past the highest N any group is called so (FLD1). The word
 * is "Group" unless given: an app names its groups in its own word (`PlanRules.nameGroup`).
 */
export const nextGroupName = (
  names: ReadonlyArray<{ name: string }> | ReadonlyArray<string>,
  word = 'Group',
): string => {
  const numbered = new RegExp(`^${escaped(word)} (\\d+)$`)
  const highest = Math.max(
    0,
    ...names.map((each) =>
      Number(numbered.exec(typeof each === 'string' ? each : each.name)?.[1] ?? 0),
    ),
  )
  return `${word} ${highest + 1}`
}

/** How a new group is named, from every group's name now: "Group N" unless an app says. */
export type NameGroup = (taken: ReadonlyArray<string>) => string

/** What `addGroup` adds: the new group, where. */
export interface AddGroupOptions {
  /** The group the new one goes in. */
  parentId: string
  /** The new group's id. */
  id: string
  /** The id for the group the work moves into, where the parent is split. */
  workId?: string
  nameGroup?: NameGroup
}

/**
 * A group inside another, at the end, following it in everything (FLD6) — or the draft unchanged
 * where it would sit deeper than a group may (FLD7). A group holding no groups yet is split first:
 * what it holds moves into a group of its own, named as it is, and the new group goes beside that —
 * so no group holds features and groups both, and none holds a single group.
 */
export const addGroup = (
  setups: ReadonlyArray<DraftSetup>,
  { parentId, id, workId = `${id}:work`, nameGroup = nextGroupName }: AddGroupOptions,
): Array<DraftSetup> => {
  const parent = findPlaced(setups, parentId)
  if (!parent || parent.depth >= MAX_DEPTH) {
    return [...setups]
  }
  const name = nameGroup(namesIn(setups))
  const added: DraftGroup = { id, name, features: [], groups: [] }
  const split = parent.group.groups.length === 0
  return updateGroup(setups, parentId, (group) =>
    split
      ? {
          ...group,
          features: [],
          groups: [{ id: workId, name: group.name, features: group.features, groups: [] }, added],
        }
      : { ...group, groups: [...group.groups, added] },
  )
}

export const renameGroup = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  name: string,
): Array<DraftSetup> =>
  updateGroup(setups, id, (group) => ({
    ...group,
    name: name.trim().slice(0, MAX_NAME) || group.name,
  }))

/** What changing the plan did, or why it could not be done. */
export type Edited = Array<DraftSetup> | Refused

/**
 * Hold a setup 3 axis, 3+1 or 3+2. Back to 3 axis is refused while it holds orientations: they
 * are tilts only an indexed setup reaches.
 */
export const setSetupProcess = (
  setups: ReadonlyArray<DraftSetup>,
  setupId: string,
  process: SetupProcess | undefined,
): Edited => {
  if (
    process === undefined &&
    placedGroups(setups).some((placed) => placed.setup.id === setupId && placed.orientation)
  ) {
    return { refused: { kind: 'hasOrientations' } }
  }
  return setups.map((setup) => {
    if (setup.id !== setupId) {
      return setup
    }
    const { process: _was, ...rest } = setup
    return process ? { ...rest, process } : rest
  })
}

/**
 * Make a group an orientation facing a direction of its own, or — with none — follow its parent
 * again. A direction another frame already faces is refused: Toolpath takes each direction once.
 */
export const setOrientation = (
  setups: ReadonlyArray<DraftSetup>,
  groupId: string,
  direction: PlanDirection | null,
): Edited => {
  const placed = findPlaced(setups, groupId)
  if (!placed || placed.depth === 0) {
    return { refused: { kind: 'orientationOutsideSetup' } }
  }
  if (direction && !isIndexed(placed.setup)) {
    return { refused: { kind: 'orientationNeedsAxes' } }
  }
  const taken = direction
    ? framesOf(setups).find(
        (frame) => frame.id !== groupId && sameDirection(frame.direction, direction),
      )
    : undefined
  if (taken) {
    return alreadyCut(taken)
  }
  return updateGroup(setups, groupId, (group) =>
    direction ? { ...following(group), direction } : following(group),
  )
}

/* ---------- Setups ---------- */

/**
 * Setups as stored before groups nested, read as a tree: every group with a list of groups. A
 * draft stored before groups were named so holds them under `folders`; it reads the same.
 * Everything that reads a stored draft goes through this.
 */
export const withGroups = (setups: ReadonlyArray<DraftSetup>): Array<DraftSetup> => {
  const fill = (stored: StoredGroup): DraftGroup => {
    const { folders, ...group } = stored
    return {
      ...group,
      features: group.features ?? [],
      groups: (group.groups ?? folders ?? []).map(fill),
    }
  }
  return setups.map((setup) => fill(setup) as DraftSetup)
}

/** A group as a stored draft may hold it: its groups under `folders`, the name they once had. */
type StoredGroup = DraftGroup & { folders?: Array<StoredGroup> }

export const isDirection = (value: unknown): value is PlanDirection => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { x, y, z } = value as Record<string, unknown>
  return [x, y, z].every((n) => typeof n === 'number' && Number.isFinite(n))
}

export const copyDirection = ({ x, y, z }: PlanDirection): PlanDirection => ({ x, y, z })

/**
 * Why a draft's setups as sent to be saved can't be read (`parseDraftSetups`), as a kind for the
 * app to word:
 *
 * - `noSetups`: not a list of setups.
 * - `tooManySetups`: more than `max` setups.
 * - `setupDirection`: a setup with no direction.
 * - `setupProcess`: a setup held other than 3 axis, 3+1 or 3+2.
 * - `groupId`: a group with no name, or no id of its own.
 * - `tooDeep`: a group more than `max` below its setup.
 * - `groupDirection`: a group's direction that is not three numbers.
 * - `notFeatureTags`: a group's features that are not feature tags.
 * - `featuresAndGroups`: a group holding features and groups both.
 * - `assignedTwice`: a feature assigned in more than one group.
 * - `directionTwice`: a direction that is a frame more than once.
 */
export type DraftInvalid =
  | { kind: 'noSetups' }
  | { kind: 'tooManySetups'; max: number }
  | { kind: 'setupDirection' }
  | { kind: 'setupProcess' }
  | { kind: 'groupId' }
  | { kind: 'tooDeep'; max: number }
  | { kind: 'groupDirection' }
  | { kind: 'notFeatureTags' }
  | { kind: 'featuresAndGroups' }
  | { kind: 'assignedTwice' }
  | { kind: 'directionTwice' }

/** A draft that can't be read, and why. */
interface Invalid {
  invalid: DraftInvalid
}

const invalid = (why: DraftInvalid): Invalid => ({ invalid: why })

const isInvalid = (value: unknown): value is Invalid =>
  typeof value === 'object' && value !== null && 'invalid' in value

/**
 * A draft's setups as sent to be saved, checked — or why not. Groups at most six below their
 * setup, every tag assigned once, and each direction a frame once, as Toolpath requires. Anything
 * else stored with a group — the stamps drafts once carried — is dropped without a word.
 */
export const parseDraftSetups = (
  value: unknown,
  /** How a group stored with no name is named. */
  nameGroup: NameGroup = nextGroupName,
): Array<DraftSetup> | { invalid: DraftInvalid } => {
  if (!Array.isArray(value)) {
    return invalid({ kind: 'noSetups' })
  }
  if (value.length > MAX_SETUPS) {
    return invalid({ kind: 'tooManySetups', max: MAX_SETUPS })
  }
  const seen: Seen = { ids: new Set(), tags: new Set(), names: [], nameGroup }
  const setups = parseEach(value, (entry) => parseSetup(entry, seen))
  if (isInvalid(setups)) {
    return setups
  }
  if (anyDirectionTwice(setups)) {
    return invalid({ kind: 'directionTwice' })
  }
  return setups
}

/** What reading a draft has met so far: the ids and tags taken, and the names given, in order. */
interface Seen {
  ids: Set<string>
  tags: Set<string>
  names: Array<string>
  nameGroup: NameGroup
}

/** Each entry read in turn — or the first reason one can't be. */
const parseEach = <T>(
  entries: ReadonlyArray<unknown>,
  parse: (entry: unknown) => T | Invalid,
): Array<T> | Invalid => {
  const parsed: Array<T> = []
  for (const entry of entries) {
    const each = parse(entry)
    if (isInvalid(each)) {
      return each
    }
    parsed.push(each)
  }
  return parsed
}

/** A setup as stored: a group facing a direction, held 3 axis, 3+1 or 3+2 — or why not. */
const parseSetup = (entry: unknown, seen: Seen): DraftSetup | Invalid => {
  const { direction, process } = (entry ?? {}) as Record<string, unknown>
  if (!isDirection(direction)) {
    return invalid({ kind: 'setupDirection' })
  }
  if (process !== undefined && process !== '3+1' && process !== '3+2') {
    return invalid({ kind: 'setupProcess' })
  }
  const parsed = parseGroup(entry, 0, seen)
  if (isInvalid(parsed)) {
    return parsed
  }
  return {
    ...parsed,
    direction: copyDirection(direction),
    ...(process ? { process } : {}),
  }
}

/**
 * A group as stored, `depth` below its setup, and the groups inside it — or why not. Takes its
 * id and tags; unnamed, it is named as a new group is (`nameGroup`), past those inside it and
 * before it. A draft stored before groups were named so holds them under `folders`; it reads the
 * same.
 */
const parseGroup = (entry: unknown, depth: number, seen: Seen): DraftGroup | Invalid => {
  const stored = (entry ?? {}) as Record<string, unknown>
  const { id, name, direction, features } = stored
  const groups = stored.groups ?? stored.folders
  if (typeof id !== 'string' || !id || seen.ids.has(id) || typeof name !== 'string') {
    return invalid({ kind: 'groupId' })
  }
  if (depth > MAX_DEPTH) {
    return invalid({ kind: 'tooDeep', max: MAX_DEPTH })
  }
  if (direction !== undefined && !isDirection(direction)) {
    return invalid({ kind: 'groupDirection' })
  }
  const own = claimFeatures(features, groups, seen)
  if (isInvalid(own)) {
    return own
  }
  seen.ids.add(id)
  const children = parseEach(Array.isArray(groups) ? groups : [], (child) =>
    parseGroup(child, depth + 1, seen),
  )
  if (isInvalid(children)) {
    return children
  }
  const group: DraftGroup = {
    id,
    name: name.trim().slice(0, MAX_NAME) || seen.nameGroup(seen.names),
    features: own,
    groups: children,
    ...(direction ? { direction: copyDirection(direction) } : {}),
  }
  seen.names.push(group.name)
  return group
}

/** An assigned feature's tag as stored: lower-case hex. */
const FEATURE_TAG = /^[0-9a-f]{1,16}$/

/**
 * A group's assigned features, each once — or why not: not feature tags, beside groups, or
 * assigned in another group already. Marks them taken in `seen`.
 */
const claimFeatures = (features: unknown, groups: unknown, seen: Seen): Array<string> | Invalid => {
  const assigned = features ?? []
  if (!isTagList(assigned)) {
    return invalid({ kind: 'notFeatureTags' })
  }
  const own = [...new Set(assigned)]
  if (own.length > 0 && Array.isArray(groups) && groups.length > 0) {
    return invalid({ kind: 'featuresAndGroups' })
  }
  if (own.some((tag) => seen.tags.has(tag))) {
    return invalid({ kind: 'assignedTwice' })
  }
  own.forEach((tag) => seen.tags.add(tag))
  return own
}

/** Whether a value is a list of feature tags, no longer than a group may assign. */
const isTagList = (value: unknown): value is Array<string> =>
  Array.isArray(value) &&
  value.length <= MAX_FEATURES &&
  value.every((tag) => typeof tag === 'string' && FEATURE_TAG.test(tag))

/** Whether two of the setups' frames face the same direction. */
const anyDirectionTwice = (setups: ReadonlyArray<DraftSetup>): boolean => {
  const frames = framesOf(setups)
  return frames.some(
    (frame, index) =>
      frames.findIndex((other) => sameDirection(other.direction, frame.direction)) !== index,
  )
}

/** A setup facing a direction no frame faces yet, added last — or the draft unchanged. */
export const addSetup = (
  setups: ReadonlyArray<DraftSetup>,
  direction: PlanDirection,
  id: string,
  nameGroup: NameGroup = nextGroupName,
): Array<DraftSetup> =>
  framesOf(setups).some((frame) => sameDirection(frame.direction, direction)) ||
  setups.length >= MAX_SETUPS
    ? [...setups]
    : [
        ...setups,
        {
          id,
          name: nameGroup(namesIn(setups)),
          direction,
          features: [],
          groups: [],
        },
      ]

/** A setup of Toolpath's plan, as `groupsFromPlan` and `planFromResults` read it. */
export interface PlannedSetup {
  orientations: ReadonlyArray<{
    direction: PlanDirection
    /** The features planned from it, where the plan was served with its orientations. */
    features?: ReadonlyArray<{ tag: string }>
  }>
  /** Every feature the setup takes, each once, marked where no pass cuts it. */
  rows?: ReadonlyArray<{ tag: string; mark?: string | false }>
}

/**
 * Toolpath's plan stated as groups: one setup per planned setup, facing its first direction, in
 * its order, named as New group names them; a setup Toolpath turned to further directions is held
 * to reach them (`indexedFor`), each a tilt group inside it — beside a group following the setup
 * where there is only the one, or where the setup's own features need a group, so none holds a
 * single group and none holds features and groups both. With `assignments`, every feature is
 * assigned into the group facing the orientation it was planned from — once, in the first that
 * lists it; a row no orientation lists goes with the setup's first direction; a feature nothing
 * machines stays open. Directions a setup made already faces are passed over, and so is anything
 * past `MAX_SETUPS`.
 */
const statedFrom = (
  planned: ReadonlyArray<PlannedSetup>,
  newId: () => string,
  assignments: boolean,
  nameGroup: NameGroup,
): Array<DraftSetup> => {
  const stating: Stating = { setups: [], newId, nameGroup, assignments, assigned: new Set() }
  for (const setup of planned) {
    const stated = stateSetup(stating, setup)
    if (stated) {
      // Pushed whole: the next setup is checked against this one's frames, and named past it.
      stating.setups.push(stated)
    }
  }
  return stating.setups
}

/** What stating Toolpath's plan carries from setup to setup. */
interface Stating {
  /** The setups stated so far. */
  setups: Array<DraftSetup>
  newId: () => string
  nameGroup: NameGroup
  /** Whether features are assigned where they were planned. */
  assignments: boolean
  /** The features assigned so far, by lower-case tag. */
  assigned: Set<string>
}

/** The orientation that lists a feature first, and the tag as it spells it. */
interface Claim {
  tag: string
  direction: PlanDirection
}

/**
 * One planned setup stated: a setup facing its first direction, holding its work — or null, where a
 * setup faces that way already or there are setups enough. Assigns the features it takes.
 */
const stateSetup = (stating: Stating, setup: PlannedSetup): DraftSetup | null => {
  const [first, ...rest] = setup.orientations.map((orientation) => orientation.direction)
  if (!first || frameFacing(stating.setups, first) || stating.setups.length >= MAX_SETUPS) {
    return null
  }
  const tilts = tiltsToState(stating.setups, first, rest)
  const passedOver = rest.filter((tilt) => !tilts.some((each) => sameDirection(each, tilt)))
  const claimed = claimsOf(setup)
  const notMachined = notMachinedIn(setup)
  const take = (tags: ReadonlyArray<string>) => takeAssignments(stating, notMachined, tags)
  // Each tilt's features, then the frame's: its own orientation's, any tilt's passed over, and the
  // rows no orientation lists. No feature is both a tilt's and the frame's, so the order does not
  // matter here; only an assignment an earlier setup took (`stating.assigned`) can hold one
  // already.
  const tilted = tilts.map((tilt) => [tilt, take(claimedFrom(claimed, tilt))] as const)
  const own = take([
    ...[first, ...passedOver].flatMap((direction) => claimedFrom(claimed, direction)),
    ...unlistedRows(setup, claimed),
  ])
  return statedFrame(stating, first, own, tilted)
}

/**
 * A setup's further directions that get a tilt group: each once, none its own or faced already.
 */
const tiltsToState = (
  setups: ReadonlyArray<DraftSetup>,
  first: PlanDirection,
  rest: ReadonlyArray<PlanDirection>,
): Array<PlanDirection> =>
  rest.filter(
    (tilt, index) =>
      !frameFacing(setups, tilt) &&
      !sameDirection(tilt, first) &&
      rest.findIndex((each) => sameDirection(each, tilt)) === index,
  )

/** The features a planned setup marks as cut by no pass, by lower-case tag. */
const notMachinedIn = (setup: PlannedSetup): Set<string> =>
  new Set(
    (setup.rows ?? [])
      .filter((row) => row.mark === 'notMachined')
      .map((row) => row.tag.toLowerCase()),
  )

/**
 * The features to assign among `tags`, in order: machined, and not assigned yet — by an earlier
 * setup, a tilt taken before, or earlier in `tags`. Each is added to `stating.assigned`. None
 * without assignments.
 */
const takeAssignments = (
  stating: Stating,
  notMachined: ReadonlySet<string>,
  tags: ReadonlyArray<string>,
): Array<string> => {
  if (!stating.assignments) {
    return []
  }
  const taken: Array<string> = []
  for (const tag of tags) {
    const key = tag.toLowerCase()
    if (!notMachined.has(key) && !stating.assigned.has(key)) {
      stating.assigned.add(key)
      taken.push(tag)
    }
  }
  return taken
}

/**
 * Each feature a planned setup lists, by lower-case tag: claimed by the first orientation listing
 * it.
 */
const claimsOf = (setup: PlannedSetup): Map<string, Claim> => {
  const claimed = new Map<string, Claim>()
  const listed = setup.orientations.flatMap((orientation) =>
    (orientation.features ?? []).map(({ tag }) => ({ tag, direction: orientation.direction })),
  )
  for (const claim of listed) {
    if (!claimed.has(claim.tag.toLowerCase())) {
      claimed.set(claim.tag.toLowerCase(), claim)
    }
  }
  return claimed
}

/** The features claimed by the orientation facing this direction, in the order listed. */
const claimedFrom = (
  claimed: ReadonlyMap<string, Claim>,
  direction: PlanDirection,
): Array<string> =>
  [...claimed.values()]
    .filter((claim) => sameDirection(claim.direction, direction))
    .map((claim) => claim.tag)

/** The planned setup's rows that no orientation lists. */
const unlistedRows = (setup: PlannedSetup, claimed: ReadonlyMap<string, Claim>): Array<string> =>
  (setup.rows ?? []).filter((row) => !claimed.has(row.tag.toLowerCase())).map((row) => row.tag)

/**
 * A stated setup facing `direction`, given its work. With no tilts, it holds its own features. Else
 * it is held to reach them (`indexedFor`), each a tilt group inside it — beside a group following
 * it where there is only the one, or where its own features need a group. The setup takes the
 * first id and the first name, then its groups in order.
 */
const statedFrame = (
  stating: Stating,
  direction: PlanDirection,
  own: Array<string>,
  tilted: ReadonlyArray<readonly [PlanDirection, Array<string>]>,
): DraftSetup => {
  const newGroup = groupMaker(stating)
  if (tilted.length === 0) {
    return { ...newGroup(own), direction }
  }
  const frame = newGroup([])
  const followers = tilted.length === 1 || own.length > 0 ? [newGroup(own)] : []
  const tiltGroups = tilted.map(([tilt, features]) => ({
    ...newGroup(features),
    direction: tilt,
  }))
  return {
    ...frame,
    direction,
    process: indexedFor(
      direction,
      tilted.map(([tilt]) => tilt),
    ),
    groups: [...followers, ...tiltGroups],
  }
}

/**
 * New groups for one stated setup, made in turn: each takes a fresh id, and is named past every
 * group stated so far and every one made before it.
 */
const groupMaker = (stating: Stating): ((features: Array<string>) => DraftGroup) => {
  const names = namesIn(stating.setups)
  return (features) => {
    const group: DraftGroup = {
      id: stating.newId(),
      name: stating.nameGroup(names),
      features,
      groups: [],
    }
    names.push(group.name)
    return group
  }
}

/**
 * Groups facing each setup of Toolpath's plan, and nothing else: no assignments (`statedFrom`).
 */
export const groupsFromPlan = (
  planned: ReadonlyArray<PlannedSetup>,
  newId: () => string,
  nameGroup: NameGroup = nextGroupName,
): Array<DraftSetup> => statedFrom(planned, newId, false, nameGroup)

/**
 * Toolpath's plan as constraints: its groups, and every feature assigned where it was planned
 * (`statedFrom`).
 */
export const planFromResults = (
  planned: ReadonlyArray<PlannedSetup>,
  newId: () => string,
  nameGroup: NameGroup = nextGroupName,
): Array<DraftSetup> => statedFrom(planned, newId, true, nameGroup)

/** A setup moved `by` places among the setups, clamped to the ends. */
export const moveSetup = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  by: number,
): Array<DraftSetup> => {
  const from = setups.findIndex((setup) => setup.id === id)
  if (from < 0) {
    return [...setups]
  }
  const to = Math.max(0, Math.min(setups.length - 1, from + by))
  const next = [...setups]
  const [moved] = next.splice(from, 1) as [DraftSetup]
  next.splice(to, 0, moved)
  return next
}

/**
 * A group moved `by` places among the groups beside it — the setups, or its parent's groups —
 * clamped to the ends. Nothing about it changes but its place (FLD22).
 */
export const moveWithin = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  by: number,
): Array<DraftSetup> => {
  const parent = findPlaced(setups, id)?.parent
  if (!parent) {
    return moveSetup(setups, id, by)
  }
  const reorder = (group: DraftGroup): DraftGroup => {
    if (group.id !== parent.id) {
      return { ...group, groups: group.groups.map(reorder) }
    }
    const from = group.groups.findIndex((child) => child.id === id)
    const to = Math.max(0, Math.min(group.groups.length - 1, from + by))
    const groups = [...group.groups]
    const [moved] = groups.splice(from, 1) as [DraftGroup]
    groups.splice(to, 0, moved)
    return { ...group, groups }
  }
  return setups.map((setup) => reorder(setup) as DraftSetup)
}

/**
 * Indexed about one rotary axis or two: 3+1 when every tilt turns Setup Z about one axis square to
 * it — every tilt in one plane through Setup Z — else 3+2. Straight up or down needs no particular
 * axis.
 */
export const indexedFor = (
  setupDirection: PlanDirection,
  tilts: ReadonlyArray<PlanDirection>,
): SetupProcess => {
  const z = setupDirection
  const axes = tilts
    .map((t) => ({ x: z.y * t.z - z.z * t.y, y: z.z * t.x - z.x * t.z, z: z.x * t.y - z.y * t.x }))
    .map((a) => ({ a, length: Math.hypot(a.x, a.y, a.z) }))
    .filter(({ length }) => length > 1e-9)
    .map(({ a, length }) => ({ x: a.x / length, y: a.y / length, z: a.z / length }))
  const [first] = axes
  return !first ||
    axes.every((a) => Math.abs(a.x * first.x + a.y * first.y + a.z * first.z) > 1 - 1e-6)
    ? '3+1'
    : '3+2'
}

/* ---------- Assigns ---------- */

/** What assigning a feature did, or why it could not be done. */
export type Assigned =
  | {
      setups: Array<DraftSetup>
      /** The group it is assigned in, or was let go from. */
      setupId: string
      /** A setup was added for the feature's direction, which no group faced. */
      added: boolean
      /** It was assigned there already, and is now let go. */
      unassigned: boolean
    }
  | Refused

/** The group a feature is assigned in, if any. */
export const assignedIn = (setups: ReadonlyArray<DraftSetup>, tag: string): string | null => {
  const key = tagKey(tag)
  return (
    placedGroups(setups).find((placed) =>
      placed.group.features.some((each) => tagKey(each) === key),
    )?.group.id ?? null
  )
}

/** The group each feature is assigned in, by tag (`tagKey`): the first in tree order. */
export const assignedGroupByTag = (setups: ReadonlyArray<DraftSetup>): Map<string, string> => {
  const homes = new Map<string, string>()
  for (const { group } of placedGroups(setups)) {
    for (const tag of group.features) {
      if (!homes.has(tagKey(tag))) {
        homes.set(tagKey(tag), group.id)
      }
    }
  }
  return homes
}

/** A feature's assign, its tag in any case: the group, and the tag as the assignment spells it. */
export const assignmentOf = (
  setups: ReadonlyArray<DraftSetup>,
  tag: string,
): { groupId: string; tag: string } | null => {
  const key = tag.toLowerCase()
  for (const { group } of placedGroups(setups)) {
    const assignment = group.features.find((each) => each.toLowerCase() === key)
    if (assignment) {
      return { groupId: group.id, tag: assignment }
    }
  }
  return null
}

/** What `assignInto` assigns, and where. */
export interface AssignIntoOptions {
  /** The group the feature is assigned in. */
  groupId: string
  tag: string
  /** The id for the group the assignment goes in, where the group named holds groups. */
  newId?: string
  nameGroup?: NameGroup
}

/**
 * Assign a feature in a group — taking it from wherever else it was assigned — or let it go if it
 * is assigned there already. The caller has checked the group faces the feature's way. A group
 * holds features or groups, never both: into one holding groups, the assignment goes in a group
 * added inside it, following it, which holds just the feature.
 */
export const assignInto = (
  setups: ReadonlyArray<DraftSetup>,
  { groupId, tag, newId = `${groupId}:${tag}`, nameGroup = nextGroupName }: AssignIntoOptions,
): Assigned => {
  const was = assignedIn(setups, tag)
  const unassigned = was ? unassignFeature(setups, was, tag) : [...setups]
  if (was === groupId) {
    return { setups: unassigned, setupId: groupId, added: false, unassigned: true }
  }
  const holdsGroups = (findPlaced(setups, groupId)?.group.groups.length ?? 0) > 0
  const name = nameGroup(namesIn(setups))
  return {
    setups: updateGroup(unassigned, groupId, (group) =>
      holdsGroups
        ? {
            ...group,
            groups: [...group.groups, { id: newId, name, features: [tag], groups: [] }],
          }
        : { ...group, features: [...group.features, tag] },
    ),
    setupId: holdsGroups ? newId : groupId,
    added: false,
    unassigned: false,
  }
}

/**
 * The group an assignment from this direction goes in: the frame facing that way — a setup or an
 * orientation — or, where that holds groups, the first group in it cut from its way that
 * holds none (a group holds features or groups, never both). Where the frame holds groups and
 * none of them is cut from its way, the frame: `assignInto` adds a group in it for the assignment.
 * Null where no frame faces it and assigning adds a setup.
 */
export const assignTargetOf = (
  setups: ReadonlyArray<DraftSetup>,
  direction: PlanDirection,
): string | null => {
  const frame = frameFacing(setups, direction)
  if (!frame) {
    return null
  }
  const placed = placedGroups(setups)
  const leaf = placed.find((each) => each.frameId === frame.id && each.group.groups.length === 0)
  return leaf?.group.id ?? frame.id
}

/** The frame — a setup or an orientation — facing this direction: at most one does. */
export const frameFacing = (setups: ReadonlyArray<DraftSetup>, direction: PlanDirection) =>
  framesOf(setups).find((each) => sameDirection(each.direction, direction))

/** What `assignFrom` assigns, and from which direction. */
export interface AssignFromOptions {
  /** The direction the feature is machined from. */
  direction: PlanDirection
  tag: string
  /** The id for the setup added, or the group `assignInto` adds. */
  newId: string
  nameGroup?: NameGroup
}

/**
 * Machine a feature from this direction: assign it in the group facing that way — a setup or an
 * orientation — or let it go if it is assigned there already. With no group facing that way,
 * a setup is added for it, last; `newId` is that setup's, or the group's `assignInto` adds.
 * Toolpath may refuse an assignment — a profile outside the first setup, for now — and says so once
 * Toolpath plans again.
 */
export const assignFrom = (
  setups: ReadonlyArray<DraftSetup>,
  { direction, tag, newId, nameGroup = nextGroupName }: AssignFromOptions,
): Assigned => {
  const frame = frameFacing(setups, direction)
  if (frame) {
    const was = assignedIn(setups, tag)
    // Assigned in a group of this frame already, it is let go from there.
    const inFrame =
      was !== null && placedGroups(setups).some((p) => p.group.id === was && p.frameId === frame.id)
    const target = inFrame ? was : assignTargetOf(setups, direction)!
    return assignInto(setups, { groupId: target, tag, newId, nameGroup })
  }
  const next = addSetup(setups, direction, newId, nameGroup)
  if (next.length === setups.length) {
    return { refused: { kind: 'tooManySetups', max: MAX_SETUPS } }
  }
  return {
    setups: next.map((setup) => (setup.id === newId ? { ...setup, features: [tag] } : setup)),
    setupId: newId,
    added: true,
    unassigned: false,
  }
}

/** Let an assigned feature go: Toolpath decides again where it is machined. */
export const unassignFeature = (
  setups: ReadonlyArray<DraftSetup>,
  groupId: string,
  tag: string,
): Array<DraftSetup> =>
  updateGroup(setups, groupId, (group) => ({
    ...group,
    features: group.features.filter((feature) => tagKey(feature) !== tagKey(tag)),
  }))

/** A list without `tag`, then with it again at the place `before` had it, if it had it. */
const placedAsBefore = (
  list: ReadonlyArray<string>,
  before: ReadonlyArray<string> | undefined,
  tag: string,
): Array<string> => {
  const without = list.filter((each) => each !== tag)
  const at = before?.indexOf(tag) ?? -1
  if (at >= 0) {
    without.splice(Math.min(at, without.length), 0, tag)
  }
  return without
}

/**
 * A feature put back as `saved` had it: assigned, at its place, in the groups it was assigned in
 * there, and in no other. Every other edit stands; a group `saved` had that is gone since is
 * passed over.
 */
export const restoreFeature = (
  setups: ReadonlyArray<DraftSetup>,
  saved: ReadonlyArray<DraftSetup>,
  tag: string,
): Array<DraftSetup> => {
  const was = new Map(placedGroups(saved).map(({ group }) => [group.id, group]))
  const visit = (group: DraftGroup): DraftGroup => ({
    ...group,
    features: placedAsBefore(group.features, was.get(group.id)?.features, tag),
    groups: group.groups.map(visit),
  })
  return setups.map((setup) => visit(setup) as DraftSetup)
}

/**
 * A list stamped with what it was made against — faces marked done with a kernel's numbering — as
 * it stands `now`: stamped with anything else, it no longer holds, and is let go.
 */
export const currentFor = <T>(
  list: ReadonlyArray<T> | undefined,
  stamp: string | null | undefined,
  now: string | null | undefined,
): Array<T> => (stamp && stamp !== now ? [] : [...(list ?? [])])

/*
  The faces done, as one numbering: `kernel`'s. Every change to them reads what is done
  through `currentFor` first, so faces numbered by another kernel are let go by any change rather
  than carried along as another numbering.
*/

/** Faces done, in order, numbered by `kernel` — none kept with no kernel to number them by. */
export const doneAs = (
  done: ReadonlyArray<number>,
  kernel: string | null,
): Pick<Constraints, 'done' | 'doneKernel'> => ({
  done: [...done].sort((a, b) => a - b),
  doneKernel: done.length > 0 ? kernel : null,
})

/** The faces done with `faces` among them, once each. */
export const withDone = (
  plan: Pick<Constraints, 'done' | 'doneKernel'>,
  faces: ReadonlyArray<number>,
  kernel: string | null,
): Pick<Constraints, 'done' | 'doneKernel'> =>
  doneAs([...new Set([...currentFor(plan.done, plan.doneKernel, kernel), ...faces])], kernel)

/** The faces done with `faces` no longer among them, its kernel let go once none are left. */
export const withoutDone = (
  plan: Pick<Constraints, 'done' | 'doneKernel'>,
  faces: ReadonlyArray<number>,
  kernel: string | null,
): Pick<Constraints, 'done' | 'doneKernel'> => {
  const these = new Set(faces)
  return doneAs(
    currentFor(plan.done, plan.doneKernel, kernel).filter((r) => !these.has(r)),
    kernel,
  )
}

/** The faces done with `faces` back as `saved` had them, and every other as `plan` has it. */
export const doneAsSaved = (
  plan: Pick<Constraints, 'done' | 'doneKernel'>,
  saved: Pick<Constraints, 'done' | 'doneKernel'>,
  faces: ReadonlyArray<number>,
  kernel: string | null,
): Pick<Constraints, 'done' | 'doneKernel'> => {
  const these = new Set(faces)
  return withDone(
    withoutDone(plan, faces, kernel),
    currentFor(saved.done, saved.doneKernel, kernel).filter((r) => these.has(r)),
    kernel,
  )
}

/* ---------- Assigns, and what the plan's rules read ---------- */

/** An assignment of the person's: the feature, and the group it is assigned in. */
export interface AssignedFeature {
  tag: string
  setupId: string
}

/** The person's assignments that `test` keeps, in every group each is assigned in. */
export const assignmentsWhere = (
  setups: ReadonlyArray<DraftSetup>,
  test: (tag: string) => boolean,
): Array<AssignedFeature> =>
  placedGroups(setups).flatMap(({ group }) =>
    group.features.filter(test).map((tag) => ({ setupId: group.id, tag })),
  )

/** What assigning, and marking done faces, need to know of the part. */
export interface PlanRules {
  regionsOf: (tag: string) => ReadonlyArray<number>
  /** The kernel the part's faces are numbered by. */
  kernel: string | null
  /**
   * Whether Toolpath plans no pass for a feature whatever its tools, by tag in lower case: from its
   * datasheet, `@toolpath/dfm`'s `unplannableFeatureTags`. Toolpath takes an assignment of one and
   * plans nothing for it, so an assignment that adds one is refused and not offered. One assigned
   * already can still be let go or moved. Left out, as before its datasheets are read, every
   * feature can be assigned.
   */
  unplannable?: (tag: string) => boolean
  /** How a new group is named, in the app's word: "Group N" by default (`nextGroupName`). */
  nameGroup?: NameGroup
}

/** A hold: one of the draft's setups, and the Engine setups cut in it. */
export interface Hold {
  key: string
  name: string
  setupIdxs: Array<number>
}

/**
 * Toolpath's setups grouped into the draft's holds: each setup cut from a direction one of the
 * draft's frames faces belongs to that frame's setup's hold. Any other — one Toolpath added past
 * the statement, or one with no direction — is a hold of its own, "Setup N". In the order Toolpath
 * machines them.
 */
export const holdsFor = (
  setups: ReadonlyArray<DraftSetup>,
  planned: ReadonlyArray<{ idx: number; direction?: PlanDirection | null }>,
): Array<Hold> => {
  const frames = framesOf(setups)
  const holds = new Map<string, Hold>()
  for (const setup of planned) {
    const direction = setup.direction
    const frame = direction
      ? frames.find((each) => sameDirection(each.direction, direction))
      : undefined
    const hold = frame ? setups.find((each) => each.id === frame.holdId) : undefined
    const key = hold?.id ?? `setup:${setup.idx}`
    const found = holds.get(key)
    if (found) {
      found.setupIdxs.push(setup.idx)
    } else {
      holds.set(key, { key, name: hold?.name ?? `Setup ${setup.idx + 1}`, setupIdxs: [setup.idx] })
    }
  }
  return [...holds.values()]
}

/* ---------- Moving groups and rows ---------- */

/** Where a moved group lands: among the setups, or inside a group — at a place in its list. */
export interface Landing {
  /** The group it lands in, or null for the top: a setup. */
  parentId: string | null
  /** Its place among what is there once it has left where it was. */
  index: number
}

/** The tilts of the orientations anywhere inside a setup. */
const tiltsIn = (setups: ReadonlyArray<DraftSetup>, setupId: string): Array<PlanDirection> =>
  placedGroups(setups)
    .filter((placed) => placed.setup.id === setupId && placed.orientation)
    .map((placed) => placed.direction)

/** What `moveGroup` moves, and where to. */
export interface MoveGroupOptions {
  /** The group moved. */
  id: string
  /** Where it lands. */
  to: Landing
  /** The id for a parent made to hold both, where it is dropped on a group holding work. */
  newId?: string
  nameGroup?: NameGroup
}

/**
 * Move a group, with everything in it (FLD20–27), or say why not:
 * - Reordered where it is, nothing about it changes.
 * - To the top, an orientation becomes a setup facing its tilt — indexed, if it holds tilts of
 *   its own. A group that follows can't: its direction is a setup already.
 * - Into a group cut from the same way, it follows it, dropping a setup's hold or its own tilt.
 * - Into a group cut from another way, it becomes an orientation keeping its direction, and the
 *   setup it lands in is indexed to turn the part to it: 3+1, or 3+2 where one axis won't reach.
 * Never into itself, below a group in it, deeper than six, or making a direction two frames.
 */
export const moveGroup = (
  setups: ReadonlyArray<DraftSetup>,
  { id, to, newId = `${id}:parent`, nameGroup = nextGroupName }: MoveGroupOptions,
): Edited => {
  // The group it leaves, if that is left holding one group, gives way to it — once this one has
  // landed, so the place it lands is still where it was aimed.
  const left = findPlaced(setups, id)?.parent?.id ?? null
  const moved = placeGroup(setups, id, to, newId, nameGroup)
  return Array.isArray(moved) && left ? liftLoneGroup(moved, left) : moved
}

/** A group moved where it lands, the group it leaves as it was (`moveGroup`), or why not. */
const placeGroup = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  to: Landing,
  newId: string,
  nameGroup: NameGroup,
): Edited => {
  const moved = findPlaced(setups, id)
  if (!moved) {
    return { refused: GONE }
  }
  const move: GroupMove = { setups, moved, to, newId, nameGroup }
  if (to.parentId === parentIdOf(moved)) {
    // FLD22: a reorder changes nothing about the group or where it is.
    return withLanded(move, moved.group)
  }
  if (to.parentId === null) {
    return placeAtTop(move)
  }
  const target = findPlaced(setups, to.parentId)
  if (!target) {
    return { refused: GONE }
  }
  return placeInside(move, target)
}

/**
 * A group on its way: the draft, the group where it sits, where it lands, and the id for a
 * parent.
 */
interface GroupMove {
  setups: ReadonlyArray<DraftSetup>
  moved: PlacedGroup
  to: Landing
  /** The id for a parent made to hold both, where it is dropped on a group holding work. */
  newId: string
  nameGroup: NameGroup
}

/** The id of the group a group sits in, or null for a setup. */
const parentIdOf = (placed: PlacedGroup): string | null => placed.parent?.id ?? null

/** The draft with the moved group taken out, and `group` put where it lands. */
const withLanded = ({ setups, moved, to }: GroupMove, group: DraftGroup): Array<DraftSetup> =>
  putAt(takenOut(setups, moved), group, to)

/** The draft with a group, and everything in it, taken out of where it sits. */
const takenOut = (setups: ReadonlyArray<DraftSetup>, placed: PlacedGroup): Array<DraftSetup> =>
  parentIdOf(placed) === null
    ? setups.filter((setup) => setup.id !== placed.group.id)
    : pruneGroup(setups, placed.group.id)

/** The draft with a group put where it lands: among the setups, or inside a group. */
const putAt = (setups: Array<DraftSetup>, group: DraftGroup, to: Landing): Array<DraftSetup> => {
  if (to.parentId === null) {
    const next = [...setups]
    next.splice(to.index, 0, group as DraftSetup)
    return next
  }
  return updateGroup(setups, to.parentId, (parent) => {
    const children = [...parent.groups]
    children.splice(to.index, 0, group)
    return { ...parent, groups: children }
  })
}

/**
 * A group moved to the top: an orientation becomes a setup facing its tilt, indexed if it holds
 * tilts of its own. A group that follows can't: its direction is a setup already.
 */
const placeAtTop = (move: GroupMove): Edited => {
  const { moved } = move
  if (!moved.orientation) {
    return { refused: { kind: 'directionIsSetup', setup: groupRef(moved.setup) } }
  }
  const { direction: tilt, ...rest } = moved.group
  const setup: DraftSetup = { ...rest, direction: tilt! }
  return indexedForTiltsIn(withLanded(move, setup), setup.id)
}

/** The draft with a setup indexed to reach the tilts in it, if it holds any; else as it is. */
const indexedForTiltsIn = (setups: Array<DraftSetup>, setupId: string): Array<DraftSetup> => {
  // Read as indexed, so its tilts count as orientations.
  const tilts = tiltsIn(
    setups.map((each) => (each.id === setupId ? { ...each, process: '3+2' as const } : each)),
    setupId,
  )
  if (tilts.length === 0) {
    return setups
  }
  return setups.map((each) =>
    each.id === setupId ? { ...each, process: indexedFor(each.direction, tilts) } : each,
  )
}

/**
 * A group moved inside another, never into itself or deeper than six. Onto one holding no groups,
 * both are kept side by side (`wrapBoth`). Into a group cut from the same way, it follows it
 * (FLD25); from another way, it is a tilt (`placeAsTilt`).
 */
const placeInside = (move: GroupMove, target: PlacedGroup): Edited => {
  const { moved } = move
  if (idsIn(moved.group).includes(target.group.id)) {
    return { refused: { kind: 'intoItself' } }
  }
  if (target.depth + heightOf(moved.group) > MAX_DEPTH) {
    return { refused: TOO_DEEP }
  }
  // Into a group holding no groups — work, or nothing yet, which would then hold just this one —
  // both are kept, side by side in a parent made for them.
  if (target.group.groups.length === 0) {
    return wrapBoth(move, target)
  }
  if (sameDirection(moved.direction, target.direction)) {
    return withLanded(move, following(moved.group))
  }
  return placeAsTilt(move, target)
}

/**
 * FLD26: a group moved into one cut from another way becomes a tilt of the setup it lands in,
 * keeping its direction, and that setup is indexed to reach it — unless another frame faces it.
 */
const placeAsTilt = (move: GroupMove, target: PlacedGroup): Edited => {
  const { setups, moved } = move
  const taken = frameFacing(takenOut(setups, moved), moved.direction)
  if (taken) {
    return alreadyCut(taken)
  }
  const tilt: DraftGroup = { ...following(moved.group), direction: moved.direction }
  return indexedToReach(withLanded(move, tilt), target.setup.id)
}

/**
 * The draft with a setup indexed to reach every tilt in it: an explicit 3+2 stays; otherwise the
 * fewest axes that reach them all (FLD27).
 */
const indexedToReach = (setups: Array<DraftSetup>, setupId: string): Array<DraftSetup> => {
  const indexed = setups.map((each) =>
    each.id === setupId ? { ...each, process: each.process ?? ('3+1' as const) } : each,
  )
  const tilts = tiltsIn(indexed, setupId)
  return indexed.map((each) =>
    each.id === setupId
      ? { ...each, process: each.process === '3+2' ? '3+2' : indexedFor(each.direction, tilts) }
      : each,
  )
}

/**
 * A group dropped on one holding work: both are kept, side by side in a new parent that takes the
 * target's place — no group holds features and groups both. Cut from the same way, the parent
 * groups them; from another, the dropped one is a tilt, and the setup is indexed to reach it: 3+1,
 * or 3+2 where one axis won't (an explicit 3+2 stays). A parent at the top is the setup.
 */
const wrapBoth = (move: GroupMove, target: PlacedGroup): Edited => {
  const { setups, moved, newId } = move
  if (tooDeepWrapped(moved, target)) {
    return { refused: TOO_DEEP }
  }
  const base = takenOut(setups, moved)
  const sameWay = sameDirection(moved.direction, target.direction)
  const taken = sameWay ? undefined : frameFacing(base, moved.direction)
  if (taken) {
    return alreadyCut(taken)
  }
  const placed = inPlaceOf(base, target, parentOfBoth(move, target))
  if (sameWay) {
    return placed
  }
  return indexedToReach(placed, target.depth === 0 ? newId : target.setup.id)
}

/**
 * Whether a parent added above the target leaves anything in either deeper than a group may sit.
 */
const tooDeepWrapped = (moved: PlacedGroup, target: PlacedGroup): boolean =>
  target.depth + 1 + heightOf(moved.group) > MAX_DEPTH ||
  target.depth + 1 + heightOf(target.group) - 1 > MAX_DEPTH

/**
 * The parent made to hold the target and the dropped group, named past every group there is, the
 * one being moved included. A tilt wrapped keeps its tilt on the parent: the parent now faces it.
 */
const parentOfBoth = (
  { setups, moved, newId, nameGroup }: GroupMove,
  target: PlacedGroup,
): DraftGroup => ({
  id: newId,
  name: nameGroup(namesIn(setups)),
  features: [],
  groups: [following(target.group), besideTarget(moved, target)],
  ...(target.orientation ? { direction: target.direction } : {}),
})

/**
 * The dropped group beside the target: following it, or a tilt where it is cut from another way.
 */
const besideTarget = (moved: PlacedGroup, target: PlacedGroup): DraftGroup =>
  sameDirection(moved.direction, target.direction)
    ? following(moved.group)
    : { ...following(moved.group), direction: moved.direction }

/** The draft with `parent` in the target's place; at the top, a setup as the target was held. */
const inPlaceOf = (
  setups: Array<DraftSetup>,
  target: PlacedGroup,
  parent: DraftGroup,
): Array<DraftSetup> => {
  if (target.depth !== 0) {
    return replaceChild(setups, target.parent!.id, target.group.id, parent)
  }
  return setups.map((each) =>
    each.id === target.group.id
      ? {
          ...parent,
          direction: target.setup.direction,
          ...(target.setup.process ? { process: target.setup.process } : {}),
        }
      : each,
  )
}

/** What `moveFeature` moves: a feature's row, and the group it is dropped on. */
export interface MoveFeatureOptions {
  tag: string
  /** The direction the feature is cut from: the group it lands in must be cut from it too. */
  direction: PlanDirection
  /** The group the row is dropped on. */
  groupId: string
  /** The id for a group made to hold the row, where it is dropped on a parent. */
  newId?: string
  nameGroup?: NameGroup
}

/**
 * Move a feature's row into a group — assigning it there, taking it from wherever else it was
 * assigned — where the group is cut from the feature's own direction; or say why not. Onto a
 * parent, it goes to the first group in it cut from that direction that holds no groups; with
 * none, onto a parent cut from that direction itself, into a group added in it, as `assignInto`
 * adds.
 */
export const moveFeature = (
  setups: ReadonlyArray<DraftSetup>,
  { tag, direction, groupId, newId, nameGroup = nextGroupName }: MoveFeatureOptions,
): Edited => {
  const dropped = findPlaced(setups, groupId)
  if (!dropped) {
    return { refused: GONE }
  }
  const target = rowTarget(setups, dropped, direction)
  if (!target) {
    return { refused: { kind: 'noGroupFacing', group: groupRef(dropped.group) } }
  }
  if (!sameDirection(target.direction, direction)) {
    return { refused: { kind: 'otherWay' } }
  }
  if (target.group.features.includes(tag)) {
    return [...setups]
  }
  const result = assignInto(setups, { groupId: target.group.id, tag, newId, nameGroup })
  return 'setups' in result ? result.setups : { refused: result.refused }
}

/**
 * Where a row dropped on a group goes: that group, where it holds no groups; else the first
 * group in it cut from the feature's direction that holds none; else, cut from that direction
 * itself, the group dropped on.
 */
const rowTarget = (
  setups: ReadonlyArray<DraftSetup>,
  dropped: PlacedGroup,
  featureDirection: PlanDirection,
): PlacedGroup | undefined => {
  if (dropped.group.groups.length === 0) {
    return dropped
  }
  const inside = new Set(idsIn(dropped.group))
  const leaf = placedGroups(setups).find(
    (each) =>
      inside.has(each.group.id) &&
      each.group.groups.length === 0 &&
      sameDirection(each.direction, featureDirection),
  )
  return leaf ?? (sameDirection(dropped.direction, featureDirection) ? dropped : undefined)
}
