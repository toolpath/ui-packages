import { PART_ROW } from './plan-view'

/*
  The plan tree's folders as one list, the way dnd-kit's tree example flattens a tree: every folder
  shown, in tree order, each at its depth. A carried folder lands in the gap between two rows that
  the pointer is in, and how far it is dragged sideways is how deep it goes; the place that comes
  to is said back as the tree's own drop — after a folder, before one, inside one, or first among
  the setups — so the rules of what can land where stay the plan's.
*/

/**
 * Where it would land (MAP48): on a folder's row, before it, inside it or after it — the top, middle
 * and bottom of the row — or on the part's row, first or last among the setups.
 */
export type DropAt =
  | { id: string; zone: 'before' | 'inside' | 'after' }
  | { id: typeof PART_ROW; zone: 'first' | 'last' }

/** A folder as the list shows it: where it sits, and how many levels of folders it holds. */
export interface FlatFolder {
  id: string
  parentId: string | null
  depth: number
  /** Levels of folders below it, which go where it goes: 0 for one with none inside. */
  height: number
}

interface FolderLike {
  id: string
  parentId: string | null
  depth: number
  folders: ReadonlyArray<FolderLike>
}

const heightOf = (folder: FolderLike): number =>
  folder.folders.length === 0 ? 0 : 1 + Math.max(...folder.folders.map(heightOf))

/**
 * The folders shown, in tree order: a folder's own inside it only while it is open. The carried
 * folder's are left out — they travel with it — so the list is what it can be dropped among.
 */
export const flattenFolders = (
  setups: ReadonlyArray<FolderLike>,
  isOpen: (id: string) => boolean,
  carriedId: string | null = null,
): Array<FlatFolder> => {
  const walk = (folder: FolderLike): Array<FlatFolder> => [
    { id: folder.id, parentId: folder.parentId, depth: folder.depth, height: heightOf(folder) },
    ...(folder.id !== carriedId && isOpen(folder.id) ? folder.folders.flatMap(walk) : []),
  ]
  return setups.flatMap(walk)
}

/** Where the carried folder would land: its depth, the folder it would be in, and the drop. */
export interface Projection {
  depth: number
  parentId: string | null
  /** The tree's drop for that place; null where it would land where it already is. */
  at: DropAt | null
}

/**
 * Where a carried folder would land in the gap `gap` of the list without it — 0 before the first
 * folder, 1 after it, and so on — dragged `offsetX` sideways. Its depth is its own plus a level for
 * every `indent` dragged right, kept to what the place allows: no deeper than one below the folder
 * before it, no shallower than the one after it — and no deeper than the plan allows with the
 * folders it carries.
 */
export const projectFolder = (
  items: ReadonlyArray<FlatFolder>,
  activeId: string,
  gap: number,
  offsetX: number,
  indent: number,
  maxDepth: number,
): Projection | null => {
  const active = items.find((item) => item.id === activeId)
  if (!active) {
    return null
  }
  const rest = items.filter((item) => item.id !== activeId)
  const index = Math.max(0, Math.min(gap, rest.length))
  const moved = [...rest.slice(0, index), active, ...rest.slice(index)]
  const wanted = active.depth + Math.round(offsetX / indent)
  const depth = depthAllowed(moved, index, wanted, maxDepth)
  const parentId = parentAt(moved, index, depth)
  const unmoved = moved.every((item, at) => item.id === items[at]?.id)
  if (unmoved && depth === active.depth) {
    return { depth, parentId, at: null }
  }
  return { depth, parentId, at: dropAtFor(moved, index, depth, parentId) }
}

/**
 * The depth nearest `wanted` the carried folder, at `index` of the list, can take: no deeper than
 * one below the folder before it, nor than `maxDepth` with the folders it carries; no shallower than
 * the folder after it.
 */
const depthAllowed = (
  moved: ReadonlyArray<FlatFolder>,
  index: number,
  wanted: number,
  maxDepth: number,
): number => {
  // The carried folder is at `index`, as `projectFolder` placed it.
  const active = moved[index]!
  const previous = moved[index - 1]
  const next = moved[index + 1]
  const deepest = Math.min(previous ? previous.depth + 1 : 0, maxDepth - active.height)
  const shallowest = Math.min(next ? next.depth : 0, deepest)
  return Math.max(shallowest, Math.min(wanted, deepest))
}

/**
 * The folder the place at `index` of the list, at `depth`, is in: the folder before it where it is
 * one deeper, else the parent of the nearest folder above at that depth — none at the top.
 */
const parentAt = (
  moved: ReadonlyArray<FlatFolder>,
  index: number,
  depth: number,
): string | null => {
  const previous = moved[index - 1]
  if (depth === 0 || !previous) {
    return null
  }
  if (depth > previous.depth) {
    return previous.id
  }
  // The nearest folder above at this depth shares its parent.
  const above = moved
    .slice(0, index)
    .reverse()
    .find((item) => item.depth === depth)
  return above?.parentId ?? null
}

/** The gap a point is in: how many of the folders' rows, without the carried one, it is below. */
export const gapAt = (
  centres: ReadonlyArray<{ id: string; centreY: number }>,
  activeId: string,
  y: number,
): number => centres.filter((row) => row.id !== activeId && row.centreY < y).length

/**
 * The place at `index` of the list, at `depth` in `parentId`, as the tree's drop: after the folder
 * before it in that parent, else before the one after it, else inside the parent — which is the end
 * of it — else first among the setups.
 */
const dropAtFor = (
  moved: ReadonlyArray<FlatFolder>,
  index: number,
  depth: number,
  parentId: string | null,
): DropAt => {
  for (const item of moved.slice(0, index).reverse()) {
    if (item.depth < depth) {
      break
    }
    if (item.depth === depth) {
      return { id: item.id, zone: 'after' }
    }
  }
  for (const item of moved.slice(index + 1)) {
    if (item.depth < depth) {
      break
    }
    if (item.depth === depth) {
      return { id: item.id, zone: 'before' }
    }
  }
  return parentId ? { id: parentId, zone: 'inside' } : { id: PART_ROW, zone: 'first' }
}
