import { tagKey } from './coverage'
import type { PlanDirection } from './engine-plan'

/*
  A part's plan as the person editing it has expressed it — their constraints, and nothing more.
  Two kinds of preference, each stated to Toolpath only once it has been expressed:

  1. Which setups, in what order: the ways the part is held, machined in this sequence.
  2. A feature from another direction: "machine this surface from there". A surface is extracted once
     for each direction that reaches it, so this pins that direction's reading of it into a folder
     facing that way.

  Folders nest, as in the prototype. A setup is a top-level folder: one way the part is held, 3 axis
  or indexed (3+1 / 3+2). Inside it, a folder either follows it — a grouping of its work, cut from its
  direction — or, inside an indexed setup, is a tool orientation: cut from a tilt of its own. Each
  direction the plan is cut from is a frame: a setup's own, and each tool orientation's.

  Toolpath takes frames, not holds: it is sent one 3-axis setup per frame, in tree order.
  `holdsFor` groups them back under their setups, so an indexed setup reads as one hold.

  The draft starts empty: with nothing stated, Toolpath plans the part as it would. What Toolpath
  planned is shown from its plan, never copied in here as something the person chose.
*/

/** A folder: a grouping of work, the features pinned in it, and the folders inside it. */
export interface DraftFolder {
  id: string
  name: string
  /**
   * Features pinned here — machined from this folder's direction, whatever else Toolpath decides.
   * Tags (hex), each of that direction's reading of its surface. Only ever what someone pinned.
   */
  features: Array<string>
  folders: Array<DraftFolder>
  /** Set only on a tool orientation: the tilt it is cut from, inside an indexed setup. */
  direction?: PlanDirection
}

/** How a setup holds the part: indexed about one rotary axis, or two. Absent, it is 3 axis. */
export type SetupProcess = '3+1' | '3+2'

/** A top-level folder: one way the part is held, facing its direction (Setup Z). */
export interface DraftSetup extends DraftFolder {
  direction: PlanDirection
  process?: SetupProcess
}

/** The person's constraints: the setups and the faces ignored — what the plan's own edits change. */
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
/** How deep a folder may sit below its setup (FLD7). */
export const MAX_DEPTH = 6
const MAX_FEATURES = 5000

/** Two directions are the same only bit for bit: Toolpath compares its direction tokens exactly. */
export const sameDirection = (a: PlanDirection, b: PlanDirection): boolean =>
  a.x === b.x && a.y === b.y && a.z === b.z

export const isIndexed = (setup: Pick<DraftSetup, 'process'>): boolean =>
  setup.process === '3+1' || setup.process === '3+2'

/* ---------- The tree ---------- */

/** A folder where it sits: its setup, its parent, its depth, and the frame it is cut in. */
export interface PlacedFolder {
  folder: DraftFolder
  setup: DraftSetup
  parent: DraftFolder | null
  /** 0 for a setup. */
  depth: number
  /** The direction it is cut from: its own as a setup or tool orientation, else its parent's. */
  direction: PlanDirection
  /** The folder whose direction that is — itself for a setup or tool orientation. */
  frameId: string
  /** Whether it is a tool orientation: a tilt of its own, inside an indexed setup. */
  toolOrientation: boolean
}

/**
 * Every folder in tree order — each setup, then what is inside it depth first — with where it sits.
 * A tool orientation counts only inside an indexed setup; elsewhere a folder's own direction is
 * inert and it follows its parent.
 */
export const placedFolders = (setups: ReadonlyArray<DraftSetup>): Array<PlacedFolder> => {
  const placed: Array<PlacedFolder> = []
  const walk = (
    folder: DraftFolder,
    setup: DraftSetup,
    parent: PlacedFolder | null,
    depth: number,
  ) => {
    const toolOrientation = parent !== null && isIndexed(setup) && folder.direction !== undefined
    const here: PlacedFolder = {
      folder,
      setup,
      parent: parent?.folder ?? null,
      depth,
      direction:
        parent === null ? setup.direction : toolOrientation ? folder.direction! : parent.direction,
      frameId: parent === null || toolOrientation ? folder.id : parent.frameId,
      toolOrientation,
    }
    placed.push(here)
    for (const child of folder.folders ?? []) {
      walk(child, setup, here, depth + 1)
    }
  }
  for (const setup of setups) {
    walk(setup, setup, null, 0)
  }
  return placed
}

export const findPlaced = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
): PlacedFolder | undefined => placedFolders(setups).find((placed) => placed.folder.id === id)

/** A frame: one direction the plan is cut from, and every feature pinned in it or its followers. */
export interface Frame {
  /** The folder that faces it: a setup, or a tool orientation. */
  id: string
  name: string
  /** The setup it is held in — its hold. */
  holdId: string
  direction: PlanDirection
  features: Array<string>
}

/** The plan's frames, in tree order: each setup's direction, then its tool orientations'. */
export const framesOf = (setups: ReadonlyArray<DraftSetup>): Array<Frame> => {
  const placed = placedFolders(setups)
  return placed
    .filter((each) => each.frameId === each.folder.id)
    .map((frame) => ({
      id: frame.folder.id,
      name: frame.folder.name,
      holdId: frame.setup.id,
      direction: frame.direction,
      features: [
        ...new Set(
          placed
            .filter((each) => each.frameId === frame.folder.id)
            .flatMap((each) => each.folder.features),
        ),
      ],
    }))
}

/** How deep the folders run below this one, counting itself: 1 for a folder with none in it. */
export const heightOf = (folder: DraftFolder): number =>
  1 + Math.max(0, ...(folder.folders ?? []).map(heightOf))

/** Every folder's id inside this one, itself included. */
const idsIn = (folder: DraftFolder): Array<string> => [
  folder.id,
  ...(folder.folders ?? []).flatMap(idsIn),
]

/** The draft with one folder, wherever it is, changed. */
const updateFolder = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  change: (folder: DraftFolder) => DraftFolder,
): Array<DraftSetup> => {
  const visit = (folder: DraftFolder): DraftFolder => {
    const next = folder.id === id ? change(folder) : folder
    const children = (next.folders ?? []).map(visit)
    return children.some((child, index) => child !== next.folders[index])
      ? { ...next, folders: children }
      : next
  }
  return setups.map((setup) => visit(setup) as DraftSetup)
}

/** The draft with a folder, and everything in it, taken out — leaving any folder as it is. */
const pruneFolder = (setups: ReadonlyArray<DraftSetup>, id: string): Array<DraftSetup> => {
  const prune = (folder: DraftFolder): DraftFolder =>
    folder.folders.some((child) => child.id === id)
      ? { ...folder, folders: folder.folders.filter((child) => child.id !== id).map(prune) }
      : { ...folder, folders: folder.folders.map(prune) }
  return setups.filter((setup) => setup.id !== id).map((setup) => prune(setup) as DraftSetup)
}

/**
 * The draft with a folder, and everything in it, taken out. A setup goes from the top; a folder it
 * leaves holding only one folder gives way to it (`liftLoneFolder`).
 */
export const removeFolder = (setups: ReadonlyArray<DraftSetup>, id: string): Array<DraftSetup> =>
  removeFolders(setups, [id])

/**
 * The draft with several folders, and everything in them, taken out together — then each folder
 * they leave holding only one folder gives way to it. All go before any gives way, so a folder
 * taken out with its pair's parent can't be left standing in that parent's place.
 */
export const removeFolders = (
  setups: ReadonlyArray<DraftSetup>,
  ids: ReadonlyArray<string>,
): Array<DraftSetup> => {
  const parents = [...new Set(ids.flatMap((id) => findPlaced(setups, id)?.parent?.id ?? []))]
  const pruned = ids.reduce((all, id) => pruneFolder(all, id), [...setups])
  return parents.reduce((all, parentId) => liftLoneFolder(all, parentId), pruned)
}

/** A folder as one that follows: without a direction or a hold. */
const following = (folder: DraftFolder): DraftFolder => {
  const { direction: _d, process: _p, ...rest } = folder as DraftSetup
  return rest
}

/** The tilts of the tool orientations anywhere inside a folder, below it. */
const tiltsBelow = (folder: DraftFolder): Array<PlanDirection> =>
  folder.folders.flatMap((child) => [
    ...(child.direction ? [child.direction] : []),
    ...tiltsBelow(child),
  ])

/**
 * What a folder holding a single folder becomes, once that folder comes up into its place; null
 * for one that holds anything else. See `liftLoneFolder`.
 */
const liftedFrom = (here: DraftFolder, top: boolean): DraftFolder | null => {
  if (here.folders.length !== 1 || here.features.length > 0) {
    return null
  }
  const [only] = here.folders as [DraftFolder]
  // What comes up is cut from the way it was: its own tilt, or its place's.
  const { direction: ownTilt, ...kept } = only
  if (top) {
    const setup = here as DraftSetup
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
  // Inside a setup: it keeps its own tilt, else takes its place's.
  const tilt = ownTilt ?? here.direction
  return { ...kept, ...(tilt ? { direction: tilt } : {}) }
}

/**
 * No edit leaves a folder holding a single folder: the folder an edit leaves that way — one taken
 * out of a pair, say — gives way to the folder in it, which comes up into its place. That folder
 * keeps its name, its pins and its folders. It is cut as it was: where it followed, from the way its place was cut — a setup's direction, and its
 * hold while a tilt is left in it to reach, or a tilt — and where it was a tilt of its own, from
 * that tilt; a tilt come up to the top is a setup facing it, indexed only to reach the tilts inside
 * it, as a tilt moved to the top is (FLD23).
 *
 * Only the folder named: a draft saved holding one elsewhere is left as it is, rather than
 * restructured by an edit to something else. Its place's own count is unchanged, so nothing above
 * it needs another look.
 */
export const liftLoneFolder = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
): Array<DraftSetup> => {
  const placed = findPlaced(setups, id)
  const next = placed ? liftedFrom(placed.folder, placed.depth === 0) : null
  if (!placed || !next) {
    return [...setups]
  }
  if (!placed.parent) {
    return setups.map((setup) => (setup.id === id ? (next as DraftSetup) : setup))
  }
  return updateFolder(setups, placed.parent.id, (folder) => ({
    ...folder,
    folders: folder.folders.map((child) => (child.id === id ? next : child)),
  }))
}

/** Every folder's name in the draft. */
const namesIn = (setups: ReadonlyArray<DraftSetup>): Array<string> =>
  placedFolders(setups).map((placed) => placed.folder.name)

/** A folder's number in its name: `Folder 3`. */
const FOLDER_NUMBER = /^Folder (\d+)$/

/** A new folder's name: "Folder N", one past the highest N any folder is called (FLD1). */
export const nextFolderName = (
  names: ReadonlyArray<{ name: string }> | ReadonlyArray<string>,
): string =>
  `Folder ${
    Math.max(
      0,
      ...names.map((each) =>
        Number(FOLDER_NUMBER.exec(typeof each === 'string' ? each : each.name)?.[1] ?? 0),
      ),
    ) + 1
  }`

/**
 * A folder inside another, at the end, following it in everything (FLD6) — or the draft unchanged
 * where it would sit deeper than a folder may (FLD7). A folder holding no folders yet is split first:
 * what it holds moves into a folder of its own, named as it is, and the new folder goes beside that —
 * so no folder holds features and folders both, and none holds a single folder.
 */
export const addFolder = (
  setups: ReadonlyArray<DraftSetup>,
  parentId: string,
  id: string,
  /** The id for the folder the work moves into, where the parent is split. */
  workId: string = `${id}:work`,
): Array<DraftSetup> => {
  const parent = findPlaced(setups, parentId)
  if (!parent || parent.depth >= MAX_DEPTH) {
    return [...setups]
  }
  const name = nextFolderName(namesIn(setups))
  const added: DraftFolder = { id, name, features: [], folders: [] }
  const split = parent.folder.folders.length === 0
  return updateFolder(setups, parentId, (folder) =>
    split
      ? {
          ...folder,
          features: [],
          folders: [
            { id: workId, name: folder.name, features: folder.features, folders: [] },
            added,
          ],
        }
      : { ...folder, folders: [...folder.folders, added] },
  )
}

export const renameFolder = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  name: string,
): Array<DraftSetup> =>
  updateFolder(setups, id, (folder) => ({
    ...folder,
    name: name.trim().slice(0, MAX_NAME) || folder.name,
  }))

/** What changing the plan did, or why it could not be done. */
export type Edited = Array<DraftSetup> | { refused: string }

/**
 * Hold a setup 3 axis, 3+1 or 3+2. Back to 3 axis is refused while it holds tool orientations: they
 * are tilts only an indexed setup reaches.
 */
export const setSetupProcess = (
  setups: ReadonlyArray<DraftSetup>,
  setupId: string,
  process: SetupProcess | undefined,
): Edited => {
  if (
    process === undefined &&
    placedFolders(setups).some((placed) => placed.setup.id === setupId && placed.toolOrientation)
  ) {
    return { refused: 'Move or delete its tool orientations first.' }
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
 * Make a folder a tool orientation facing a direction of its own, or — with none — follow its parent
 * again. A direction another frame already faces is refused: Toolpath takes each direction once.
 */
export const setToolOrientation = (
  setups: ReadonlyArray<DraftSetup>,
  folderId: string,
  direction: PlanDirection | null,
): Edited => {
  const placed = findPlaced(setups, folderId)
  if (!placed || placed.depth === 0) {
    return { refused: 'Only a folder inside a setup can be a tool orientation.' }
  }
  if (direction && !isIndexed(placed.setup)) {
    return { refused: 'Only a 3+1 or 3+2 setup has tool orientations.' }
  }
  const taken = direction
    ? framesOf(setups).find(
        (frame) => frame.id !== folderId && sameDirection(frame.direction, direction),
      )
    : undefined
  if (taken) {
    return { refused: `${taken.name} is cut from that direction already.` }
  }
  return updateFolder(setups, folderId, (folder) =>
    direction ? { ...following(folder), direction } : following(folder),
  )
}

/* ---------- Setups ---------- */

/**
 * Setups as stored before folders nested, read as a tree: every folder with a list of folders.
 * Everything that reads a stored draft goes through this.
 */
export const withFolders = (setups: ReadonlyArray<DraftSetup>): Array<DraftSetup> => {
  const fill = (folder: DraftFolder): DraftFolder => ({
    ...folder,
    features: folder.features ?? [],
    folders: (folder.folders ?? []).map(fill),
  })
  return setups.map((setup) => fill(setup) as DraftSetup)
}

export const isDirection = (value: unknown): value is PlanDirection => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { x, y, z } = value as Record<string, unknown>
  return [x, y, z].every((n) => typeof n === 'number' && Number.isFinite(n))
}

export const copyDirection = ({ x, y, z }: PlanDirection): PlanDirection => ({ x, y, z })

/**
 * A draft's setups as sent to be saved, checked — or why not. Folders at most six below their
 * setup, every tag pinned once, and each direction a frame once, as Toolpath requires. Anything
 * else stored with a folder — the stamps drafts once carried — is dropped without a word.
 */
export const parseDraftSetups = (value: unknown): Array<DraftSetup> | string => {
  if (!Array.isArray(value)) {
    return 'The plan has no list of setups.'
  }
  if (value.length > MAX_SETUPS) {
    return `A plan can state at most ${MAX_SETUPS} setups.`
  }
  const ids = new Set<string>()
  const tags = new Set<string>()
  const names: Array<string> = []
  const parse = (entry: unknown, depth: number): DraftFolder | string => {
    const { id, name, direction, features, folders } = (entry ?? {}) as Record<string, unknown>
    if (typeof id !== 'string' || !id || ids.has(id) || typeof name !== 'string') {
      return 'A folder needs an id of its own and a name.'
    }
    if (depth > MAX_DEPTH) {
      return `A folder can sit at most ${MAX_DEPTH} below its setup.`
    }
    if (direction !== undefined && !isDirection(direction)) {
      return 'A folder’s direction is three numbers.'
    }
    const pinned = features ?? []
    if (
      !Array.isArray(pinned) ||
      pinned.length > MAX_FEATURES ||
      !pinned.every((tag) => typeof tag === 'string' && /^[0-9a-f]{1,16}$/.test(tag))
    ) {
      return 'A folder’s features are feature tags.'
    }
    const own = [...new Set(pinned as Array<string>)]
    if (own.length > 0 && Array.isArray(folders) && folders.length > 0) {
      return 'A folder holds features or folders, never both.'
    }
    if (own.some((tag) => tags.has(tag))) {
      return 'A feature can be pinned in one folder only.'
    }
    own.forEach((tag) => tags.add(tag))
    ids.add(id)
    const children: Array<DraftFolder> = []
    for (const child of Array.isArray(folders) ? folders : []) {
      const parsed = parse(child, depth + 1)
      if (typeof parsed === 'string') {
        return parsed
      }
      children.push(parsed)
    }
    const folder: DraftFolder = {
      id,
      name: name.trim().slice(0, MAX_NAME) || nextFolderName(names),
      features: own,
      folders: children,
      ...(direction ? { direction: copyDirection(direction) } : {}),
    }
    names.push(folder.name)
    return folder
  }
  const setups: Array<DraftSetup> = []
  for (const entry of value) {
    const { direction, process } = (entry ?? {}) as Record<string, unknown>
    if (!isDirection(direction)) {
      return 'A setup needs a direction.'
    }
    if (process !== undefined && process !== '3+1' && process !== '3+2') {
      return 'A setup is held 3 axis, 3+1 or 3+2.'
    }
    const parsed = parse(entry, 0)
    if (typeof parsed === 'string') {
      return parsed
    }
    setups.push({
      ...parsed,
      direction: copyDirection(direction),
      ...(process ? { process } : {}),
    })
  }
  const frames = framesOf(setups)
  if (
    frames.some(
      (frame, index) =>
        frames.findIndex((other) => sameDirection(other.direction, frame.direction)) !== index,
    )
  ) {
    return 'Each direction can be a setup only once.'
  }
  return setups
}

/** A setup facing a direction no frame faces yet, added last — or the draft unchanged. */
export const addSetup = (
  setups: ReadonlyArray<DraftSetup>,
  direction: PlanDirection,
  id: string,
): Array<DraftSetup> =>
  framesOf(setups).some((frame) => sameDirection(frame.direction, direction)) ||
  setups.length >= MAX_SETUPS
    ? [...setups]
    : [
        ...setups,
        {
          id,
          name: nextFolderName(namesIn(setups)),
          direction,
          features: [],
          folders: [],
        },
      ]

/** A setup of Toolpath's plan, as `foldersFromPlan` and `planFromResults` read it. */
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
 * Toolpath's plan stated as folders: one setup per planned setup, facing its first direction, in
 * its order, named as New folder names them; a setup Toolpath turned to further directions is held
 * to reach them (`indexedFor`), each a tilt folder inside it — beside a folder following the setup
 * where there is only the one, or where the setup's own features need a folder, so none holds a
 * single folder and none holds features and folders both. With `pins`, every feature is pinned
 * into the folder facing the orientation it was planned from — once, in the first that lists it;
 * a row no orientation lists goes with the setup's first direction; a feature nothing machines
 * stays open. Directions a setup made already faces are passed over, and so is anything past
 * `MAX_SETUPS`.
 */
const statedFrom = (
  planned: ReadonlyArray<PlannedSetup>,
  newId: () => string,
  pins: boolean,
): Array<DraftSetup> => {
  const setups: Array<DraftSetup> = []
  const faced = (direction: PlanDirection) =>
    framesOf(setups).some((frame) => sameDirection(frame.direction, direction))
  const pinned = new Set<string>()
  for (const setup of planned) {
    const [first, ...rest] = setup.orientations.map((orientation) => orientation.direction)
    if (!first || faced(first) || setups.length >= MAX_SETUPS) {
      continue
    }
    const tilts = rest.filter(
      (tilt, index) =>
        !faced(tilt) &&
        !sameDirection(tilt, first) &&
        rest.findIndex((each) => sameDirection(each, tilt)) === index,
    )
    const open = new Set(
      (setup.rows ?? [])
        .filter((row) => row.mark === 'notMachined')
        .map((row) => row.tag.toLowerCase()),
    )
    /** The features to pin among `tags`: not pinned yet, and machined. */
    const take = (tags: ReadonlyArray<string>): Array<string> =>
      pins
        ? tags.filter((tag) => {
            const key = tag.toLowerCase()
            return !open.has(key) && !pinned.has(key) && pinned.add(key) !== undefined
          })
        : []
    // Each feature the setup lists is the first orientation's that lists it.
    const claimed = new Map<string, { tag: string; direction: PlanDirection }>()
    for (const orientation of setup.orientations) {
      for (const { tag } of orientation.features ?? []) {
        if (!claimed.has(tag.toLowerCase())) {
          claimed.set(tag.toLowerCase(), { tag, direction: orientation.direction })
        }
      }
    }
    const listedBy = (direction: PlanDirection) =>
      [...claimed.values()]
        .filter((claim) => sameDirection(claim.direction, direction))
        .map((claim) => claim.tag)
    const folder = (direction?: PlanDirection, features: Array<string> = []): DraftFolder => ({
      id: newId(),
      name: nextFolderName(namesIn(setups)),
      features,
      folders: [],
      ...(direction ? { direction } : {}),
    })
    const frame: DraftSetup = { ...folder(), direction: first }
    setups.push(frame)
    // Each tilt's features, then the frame's: its own orientation's, any tilt's passed over, and
    // the rows no orientation lists.
    const tilted = tilts.map((tilt) => [tilt, take(listedBy(tilt))] as const)
    const own = take([
      ...listedBy(first),
      ...rest.filter((tilt) => !tilts.some((each) => sameDirection(each, tilt))).flatMap(listedBy),
      ...(setup.rows ?? [])
        .filter((row) => !claimed.has(row.tag.toLowerCase()))
        .map((row) => row.tag),
    ])
    if (tilts.length === 0) {
      frame.features = own
      continue
    }
    frame.process = indexedFor(first, tilts)
    if (tilts.length === 1 || own.length > 0) {
      frame.folders.push(folder(undefined, own))
    }
    for (const [tilt, features] of tilted) {
      frame.folders.push(folder(tilt, features))
    }
  }
  return setups
}

/** Folders facing each setup of Toolpath's plan, and nothing else: no pins (`statedFrom`). */
export const foldersFromPlan = (
  planned: ReadonlyArray<PlannedSetup>,
  newId: () => string,
): Array<DraftSetup> => statedFrom(planned, newId, false)

/** Toolpath's plan as constraints: its folders, and every feature pinned where it was planned (`statedFrom`). */
export const planFromResults = (
  planned: ReadonlyArray<PlannedSetup>,
  newId: () => string,
): Array<DraftSetup> => statedFrom(planned, newId, true)

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
 * A folder moved `by` places among the folders beside it — the setups, or its parent's folders —
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
  const reorder = (folder: DraftFolder): DraftFolder => {
    if (folder.id !== parent.id) {
      return { ...folder, folders: folder.folders.map(reorder) }
    }
    const from = folder.folders.findIndex((child) => child.id === id)
    const to = Math.max(0, Math.min(folder.folders.length - 1, from + by))
    const folders = [...folder.folders]
    const [moved] = folders.splice(from, 1) as [DraftFolder]
    folders.splice(to, 0, moved)
    return { ...folder, folders }
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

/* ---------- Pins ---------- */

/** What pinning a feature did, or why it could not be done. */
export type Pinned =
  | {
      setups: Array<DraftSetup>
      /** The folder it is pinned in, or was let go from. */
      setupId: string
      /** A setup was added for the feature's direction, which no folder faced. */
      added: boolean
      /** It was pinned there already, and is now let go. */
      unpinned: boolean
    }
  | { refused: string }

/** The folder a feature is pinned in, if any. */
export const pinnedIn = (setups: ReadonlyArray<DraftSetup>, tag: string): string | null => {
  const key = tagKey(tag)
  return (
    placedFolders(setups).find((placed) =>
      placed.folder.features.some((each) => tagKey(each) === key),
    )?.folder.id ?? null
  )
}

/** The folder each feature is pinned in, by tag (`tagKey`): the first in tree order. */
export const pinHomes = (setups: ReadonlyArray<DraftSetup>): Map<string, string> => {
  const homes = new Map<string, string>()
  for (const { folder } of placedFolders(setups)) {
    for (const tag of folder.features) {
      if (!homes.has(tagKey(tag))) {
        homes.set(tagKey(tag), folder.id)
      }
    }
  }
  return homes
}

/** A feature's pin, its tag in any case: the folder, and the tag as the pin spells it. */
export const pinOf = (
  setups: ReadonlyArray<DraftSetup>,
  tag: string,
): { folderId: string; tag: string } | null => {
  const key = tag.toLowerCase()
  for (const { folder } of placedFolders(setups)) {
    const pin = folder.features.find((each) => each.toLowerCase() === key)
    if (pin) {
      return { folderId: folder.id, tag: pin }
    }
  }
  return null
}

/**
 * Pin a feature in a folder — taking it from wherever else it was pinned — or let it go if it is
 * pinned there already. The caller has checked the folder faces the feature's way. A folder holds
 * features or folders, never both: into one holding folders, the pin goes in a folder added inside
 * it, following it, which holds just the feature.
 */
export const pinInto = (
  setups: ReadonlyArray<DraftSetup>,
  folderId: string,
  tag: string,
  /** The id for the folder the pin goes in, where the folder named holds folders. */
  newId: string = `${folderId}:${tag}`,
): Pinned => {
  const was = pinnedIn(setups, tag)
  const unpinned = was ? unpinFeature(setups, was, tag) : [...setups]
  if (was === folderId) {
    return { setups: unpinned, setupId: folderId, added: false, unpinned: true }
  }
  const holdsFolders = (findPlaced(setups, folderId)?.folder.folders.length ?? 0) > 0
  const name = nextFolderName(namesIn(setups))
  return {
    setups: updateFolder(unpinned, folderId, (folder) =>
      holdsFolders
        ? {
            ...folder,
            folders: [...folder.folders, { id: newId, name, features: [tag], folders: [] }],
          }
        : { ...folder, features: [...folder.features, tag] },
    ),
    setupId: holdsFolders ? newId : folderId,
    added: false,
    unpinned: false,
  }
}

/**
 * The folder a pin from this direction goes in: the frame facing that way — a setup or a tool
 * orientation — or, where that holds folders, the first folder in it cut from its way that holds
 * none (a folder holds features or folders, never both). Where the frame holds folders and none of
 * them is cut from its way, the frame: `pinInto` adds a folder in it for the pin. Null where no
 * frame faces it and pinning adds a setup.
 */
export const pinTargetOf = (
  setups: ReadonlyArray<DraftSetup>,
  direction: PlanDirection,
): string | null => {
  const frame = frameFacing(setups, direction)
  if (!frame) {
    return null
  }
  const placed = placedFolders(setups)
  const leaf = placed.find((each) => each.frameId === frame.id && each.folder.folders.length === 0)
  return leaf?.folder.id ?? frame.id
}

/** The frame — a setup or a tool orientation — facing this direction: at most one does. */
export const frameFacing = (setups: ReadonlyArray<DraftSetup>, direction: PlanDirection) =>
  framesOf(setups).find((each) => sameDirection(each.direction, direction))

/**
 * Machine a feature from this direction: pin it in the folder facing that way — a setup or a tool
 * orientation — or let it go if it is pinned there already. With no folder facing that way, a setup
 * is added for it, last; `newId` is that setup's, or the folder's `pinInto` adds. Toolpath may refuse a pin — a profile outside the first setup, for now — and
 * says so once Toolpath plans again.
 */
export const pinFrom = (
  setups: ReadonlyArray<DraftSetup>,
  direction: PlanDirection,
  tag: string,
  newId: string,
): Pinned => {
  const frame = frameFacing(setups, direction)
  if (frame) {
    const was = pinnedIn(setups, tag)
    // Pinned in a folder of this frame already, it is let go from there.
    const inFrame =
      was !== null &&
      placedFolders(setups).some((p) => p.folder.id === was && p.frameId === frame.id)
    return pinInto(setups, inFrame ? was : pinTargetOf(setups, direction)!, tag, newId)
  }
  const next = addSetup(setups, direction, newId)
  if (next.length === setups.length) {
    return { refused: `A plan holds at most ${MAX_SETUPS} setups.` }
  }
  return {
    setups: next.map((setup) => (setup.id === newId ? { ...setup, features: [tag] } : setup)),
    setupId: newId,
    added: true,
    unpinned: false,
  }
}

/** Let a pinned feature go: Toolpath decides again where it is machined. */
export const unpinFeature = (
  setups: ReadonlyArray<DraftSetup>,
  folderId: string,
  tag: string,
): Array<DraftSetup> =>
  updateFolder(setups, folderId, (folder) => ({
    ...folder,
    features: folder.features.filter((feature) => tagKey(feature) !== tagKey(tag)),
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
 * A feature put back as `saved` had it: pinned, at its place, in the folders it was pinned in there,
 * and in no other. Every other edit stands; a folder `saved` had that is gone since is passed over.
 */
export const restoreFeature = (
  setups: ReadonlyArray<DraftSetup>,
  saved: ReadonlyArray<DraftSetup>,
  tag: string,
): Array<DraftSetup> => {
  const was = new Map(placedFolders(saved).map(({ folder }) => [folder.id, folder]))
  const visit = (folder: DraftFolder): DraftFolder => ({
    ...folder,
    features: placedAsBefore(folder.features, was.get(folder.id)?.features, tag),
    folders: folder.folders.map(visit),
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
  The faces ignored, as one numbering: `kernel`'s. Every change to them reads what is ignored
  through `currentFor` first, so faces numbered by another kernel are let go by any change rather
  than carried along as another numbering.
*/

/** Faces ignored, in order, numbered by `kernel` — none kept with no kernel to number them by. */
export const ignoredAs = (
  done: ReadonlyArray<number>,
  kernel: string | null,
): Pick<Constraints, 'done' | 'doneKernel'> => ({
  done: [...done].sort((a, b) => a - b),
  doneKernel: done.length > 0 ? kernel : null,
})

/** The faces ignored with `faces` among them, once each. */
export const withIgnored = (
  plan: Pick<Constraints, 'done' | 'doneKernel'>,
  faces: ReadonlyArray<number>,
  kernel: string | null,
): Pick<Constraints, 'done' | 'doneKernel'> =>
  ignoredAs([...new Set([...currentFor(plan.done, plan.doneKernel, kernel), ...faces])], kernel)

/** The faces ignored with `faces` no longer among them, its kernel let go once none are left. */
export const withoutIgnored = (
  plan: Pick<Constraints, 'done' | 'doneKernel'>,
  faces: ReadonlyArray<number>,
  kernel: string | null,
): Pick<Constraints, 'done' | 'doneKernel'> => {
  const these = new Set(faces)
  return ignoredAs(
    currentFor(plan.done, plan.doneKernel, kernel).filter((r) => !these.has(r)),
    kernel,
  )
}

/** The faces ignored with `faces` back as `saved` had them, and every other as `plan` has it. */
export const ignoredAsSaved = (
  plan: Pick<Constraints, 'done' | 'doneKernel'>,
  saved: Pick<Constraints, 'done' | 'doneKernel'>,
  faces: ReadonlyArray<number>,
  kernel: string | null,
): Pick<Constraints, 'done' | 'doneKernel'> => {
  const these = new Set(faces)
  return withIgnored(
    withoutIgnored(plan, faces, kernel),
    currentFor(saved.done, saved.doneKernel, kernel).filter((r) => these.has(r)),
    kernel,
  )
}

/* ---------- Pins, and what the plan's rules read ---------- */

/** A pin of the person's: the feature, and the folder it is pinned in. */
export interface PinnedFeature {
  tag: string
  setupId: string
}

/** The person's pins that `test` keeps, in every folder each is pinned in. */
export const pinsWhere = (
  setups: ReadonlyArray<DraftSetup>,
  test: (tag: string) => boolean,
): Array<PinnedFeature> =>
  placedFolders(setups).flatMap(({ folder }) =>
    folder.features.filter(test).map((tag) => ({ setupId: folder.id, tag })),
  )

/** What pinning, and ignoring faces, need to know of the part. */
export interface PlanRules {
  regionsOf: (tag: string) => ReadonlyArray<number>
  /** The kernel the part's faces are numbered by. */
  kernel: string | null
}

/* ---------- What Toolpath is told ---------- */

/** The plan as Toolpath's `setupPlan` takes it: setups in order, each one direction and its pins. */
export interface Statement {
  setups: Array<{ orientations: Array<{ direction: PlanDirection; features: Array<string> }> }>
}

/**
 * What the draft tells Toolpath: every frame, in tree order, each a 3-axis setup of its own with
 * its pins — a floor Toolpath appends to. Null with no frames: Toolpath plans the part itself.
 * Setup `i` of the statement is frame `i`.
 */
export const statementOf = (setups: ReadonlyArray<DraftSetup>): Statement | null => {
  const frames = framesOf(setups)
  if (frames.length === 0) {
    return null
  }
  return {
    setups: frames.map((frame) => ({
      orientations: [{ direction: frame.direction, features: frame.features }],
    })),
  }
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

/* ---------- Moving folders and rows ---------- */

/** Where a moved folder lands: among the setups, or inside a folder — at a place in its list. */
export interface Landing {
  /** The folder it lands in, or null for the top: a setup. */
  parentId: string | null
  /** Its place among what is there once it has left where it was. */
  index: number
}

/** The tilts of the tool orientations anywhere inside a setup. */
const tiltsIn = (setups: ReadonlyArray<DraftSetup>, setupId: string): Array<PlanDirection> =>
  placedFolders(setups)
    .filter((placed) => placed.setup.id === setupId && placed.toolOrientation)
    .map((placed) => placed.direction)

/**
 * Move a folder, with everything in it (FLD20–27), or say why not:
 * - Reordered where it is, nothing about it changes.
 * - To the top, a tool orientation becomes a setup facing its tilt — indexed, if it holds tilts of
 *   its own. A folder that follows can't: its direction is a setup already.
 * - Into a folder cut from the same way, it follows it, dropping a setup's hold or its own tilt.
 * - Into a folder cut from another way, it becomes a tool orientation keeping its direction, and the
 *   setup it lands in is indexed to turn the part to it: 3+1, or 3+2 where one axis won't reach.
 * Never into itself, below a folder in it, deeper than six, or making a direction two frames.
 */
export const moveFolder = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  to: Landing,
  /** The id for a parent made to hold both, where it is dropped on a folder holding work. */
  newId: string = `${id}:parent`,
): Edited => {
  // The folder it leaves, if that is left holding one folder, gives way to it — once this one has
  // landed, so the place it lands is still where it was aimed.
  const left = findPlaced(setups, id)?.parent?.id ?? null
  const moved = placeFolder(setups, id, to, newId)
  return Array.isArray(moved) && left ? liftLoneFolder(moved, left) : moved
}

const placeFolder = (
  setups: ReadonlyArray<DraftSetup>,
  id: string,
  to: Landing,
  newId: string,
): Edited => {
  const moved = findPlaced(setups, id)
  if (!moved) {
    return { refused: 'That folder is gone.' }
  }
  const here = moved.parent?.id ?? null
  // Taken out, then put back where it lands.
  const without = (all: ReadonlyArray<DraftSetup>): Array<DraftSetup> =>
    here === null ? all.filter((setup) => setup.id !== id) : pruneFolder(all, id)
  const put = (all: Array<DraftSetup>, folder: DraftFolder): Array<DraftSetup> => {
    if (to.parentId === null) {
      const next = [...all]
      next.splice(to.index, 0, folder as DraftSetup)
      return next
    }
    return updateFolder(all, to.parentId, (parent) => {
      const children = [...parent.folders]
      children.splice(to.index, 0, folder)
      return { ...parent, folders: children }
    })
  }
  if (to.parentId === here) {
    // FLD22: a reorder changes nothing about the folder or where it is.
    return put(without(setups), moved.folder)
  }
  if (to.parentId === null) {
    if (!moved.toolOrientation) {
      return { refused: `It is cut from ${moved.setup.name}’s direction, a setup already.` }
    }
    const { direction: tilt, ...rest } = moved.folder
    const setup: DraftSetup = { ...rest, direction: tilt! }
    const next = put(without(setups), setup)
    const tilts = tiltsIn(
      next.map((each) => (each.id === id ? { ...each, process: '3+2' as const } : each)),
      id,
    )
    return tilts.length > 0
      ? next.map((each) =>
          each.id === id ? { ...each, process: indexedFor(each.direction, tilts) } : each,
        )
      : next
  }
  const target = findPlaced(setups, to.parentId)
  if (!target) {
    return { refused: 'That folder is gone.' }
  }
  if (idsIn(moved.folder).includes(target.folder.id)) {
    return { refused: 'A folder can’t go inside itself.' }
  }
  if (target.depth + heightOf(moved.folder) > MAX_DEPTH) {
    return { refused: `Folders sit at most ${MAX_DEPTH} below their setup.` }
  }
  const plain = following(moved.folder)
  // Into a folder holding no folders — work, or nothing yet, which would then hold just this one —
  // both are kept, side by side in a parent made for them.
  if (target.folder.folders.length === 0) {
    return wrapBoth(setups, moved, target, newId, without)
  }
  if (sameDirection(moved.direction, target.direction)) {
    // FLD25: cut from the same way, it follows.
    return put(without(setups), plain)
  }
  // FLD26: cut from another way, it becomes a tilt of the setup it lands in.
  const taken = framesOf(without(setups)).find((frame) =>
    sameDirection(frame.direction, moved.direction),
  )
  if (taken) {
    return { refused: `${taken.name} is cut from that direction already.` }
  }
  const landed = put(without(setups), { ...plain, direction: moved.direction })
  const setupId = target.setup.id
  const indexedAll = landed.map((each) =>
    each.id === setupId ? { ...each, process: each.process ?? ('3+1' as const) } : each,
  )
  const tilts = tiltsIn(indexedAll, setupId)
  return indexedAll.map((each) => {
    if (each.id !== setupId) {
      return each
    }
    // An explicit 3+2 stays; otherwise the fewest axes that reach every tilt (FLD27).
    return { ...each, process: each.process === '3+2' ? '3+2' : indexedFor(each.direction, tilts) }
  })
}

/**
 * A folder dropped on one holding work: both are kept, side by side in a new parent that takes the
 * target's place — no folder holds features and folders both. Cut from the same way, the parent
 * groups them; from another, the dropped one is a tilt, and the setup is indexed to reach it: 3+1,
 * or 3+2 where one axis won't (an explicit 3+2 stays). A parent at the top is the setup.
 */
const wrapBoth = (
  setups: ReadonlyArray<DraftSetup>,
  moved: PlacedFolder,
  target: PlacedFolder,
  newId: string,
  without: (all: ReadonlyArray<DraftSetup>) => Array<DraftSetup>,
): Edited => {
  // The parent adds a level above the target: everything in both must still fit.
  if (
    target.depth + 1 + heightOf(moved.folder) > MAX_DEPTH ||
    target.depth + 1 + heightOf(target.folder) - 1 > MAX_DEPTH
  ) {
    return { refused: `Folders sit at most ${MAX_DEPTH} below their setup.` }
  }
  const base = without(setups)
  const sameWay = sameDirection(moved.direction, target.direction)
  if (!sameWay) {
    const taken = framesOf(base).find((frame) => sameDirection(frame.direction, moved.direction))
    if (taken) {
      return { refused: `${taken.name} is cut from that direction already.` }
    }
  }
  const parent: DraftFolder = {
    id: newId,
    // Named past every folder there is, the one being moved included.
    name: nextFolderName(namesIn(setups)),
    features: [],
    folders: [
      following(target.folder),
      sameWay
        ? following(moved.folder)
        : { ...following(moved.folder), direction: moved.direction },
    ],
    // A tilt wrapped keeps its tilt on the parent: the parent now faces it.
    ...(target.toolOrientation ? { direction: target.direction } : {}),
  }
  const top = target.depth === 0
  const placed = top
    ? base.map((setup) =>
        setup.id === target.folder.id
          ? {
              ...parent,
              direction: target.setup.direction,
              ...(target.setup.process ? { process: target.setup.process } : {}),
            }
          : setup,
      )
    : updateFolder(base, target.parent!.id, (folder) => ({
        ...folder,
        folders: folder.folders.map((child) => (child.id === target.folder.id ? parent : child)),
      }))
  if (sameWay) {
    return placed
  }
  const setupId = top ? newId : target.setup.id
  const indexed = placed.map((each) =>
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
 * Move a feature's row into a folder — pinning it there, taking it from wherever else it was pinned
 * — where the folder is cut from the feature's own direction; or say why not. Onto a parent, it
 * goes to the first folder in it cut from that direction that holds no folders; with none, onto a
 * parent cut from that direction itself, into a folder added in it, as `pinInto` adds.
 */
export const moveFeature = (
  setups: ReadonlyArray<DraftSetup>,
  tag: string,
  featureDirection: PlanDirection,
  folderId: string,
  /** The id for a folder made to hold the row, where it is dropped on a parent. */
  newId?: string,
): Edited => {
  const dropped = findPlaced(setups, folderId)
  if (!dropped) {
    return { refused: 'That folder is gone.' }
  }
  const inside = new Set(idsIn(dropped.folder))
  const target =
    dropped.folder.folders.length === 0
      ? dropped
      : (placedFolders(setups).find(
          (each) =>
            inside.has(each.folder.id) &&
            each.folder.folders.length === 0 &&
            sameDirection(each.direction, featureDirection),
        ) ?? (sameDirection(dropped.direction, featureDirection) ? dropped : undefined))
  if (!target) {
    return { refused: `No folder in ${dropped.folder.name} is cut from that direction.` }
  }
  if (!sameDirection(target.direction, featureDirection)) {
    return { refused: 'Rows stay in folders cut from their own direction.' }
  }
  if (target.folder.features.includes(tag)) {
    return [...setups]
  }
  const result = pinInto(setups, target.folder.id, tag, newId)
  return 'setups' in result ? result.setups : { refused: result.refused }
}
