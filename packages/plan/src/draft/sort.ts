/*
  Where a carried group can land among the groups. The app lists the groups it shows, in tree
  order, each at its depth, and says which gap the group is in and how deep it wants to go; the
  pointer, the rows and the pixels are the app's. The place that comes to is said back as the
  tree's own drop — after a group, before one, inside one, or first among the setups — so the rules
  of what can land where stay the plan's.
*/

/**
 * Where it would land (MAP48): on a group's row, before it, inside it or after it — the top, middle
 * and bottom of the row — or at the top of the tree, first or last among the setups, with no group
 * named.
 */
export type DropAt =
  { id: string; zone: 'before' | 'inside' | 'after' } | { zone: 'first' | 'last' }

/**
 * A group as the app's list shows it: where it sits, and how many levels of groups it holds. A
 * carried group's own groups are left out of the list; they go where it goes.
 */
export interface FlatGroup {
  id: string
  parentId: string | null
  depth: number
  /** Levels of groups below it, which go where it goes: 0 for one with none inside. */
  height: number
}

/** Where the carried group would land: its depth, the group it would be in, and the drop. */
export interface Projection {
  depth: number
  parentId: string | null
  /** The tree's drop for that place; null where it would land where it already is. */
  at: DropAt | null
}

/** What `projectGroup` is given besides the list. */
export interface ProjectGroupOptions {
  /** The carried group. */
  activeId: string
  /** The gap of the list without it: 0 before the first group, 1 after it, and so on. */
  gap: number
  /** The depth it is dragged to; the place may allow another. */
  wantedDepth: number
  /** The deepest a group can be (`MAX_DEPTH`). */
  maxDepth: number
}

/**
 * Where a carried group would land in the gap `gap`, at the depth nearest `wantedDepth` the place
 * allows: no deeper than one below the group before it, no shallower than the one after it — and
 * no deeper than `maxDepth` with the groups it carries.
 */
export const projectGroup = (
  items: ReadonlyArray<FlatGroup>,
  { activeId, gap, wantedDepth, maxDepth }: ProjectGroupOptions,
): Projection | null => {
  const active = items.find((item) => item.id === activeId)
  if (!active) {
    return null
  }
  const rest = items.filter((item) => item.id !== activeId)
  const index = Math.max(0, Math.min(gap, rest.length))
  const moved = [...rest.slice(0, index), active, ...rest.slice(index)]
  const depth = depthAllowed(moved, index, wantedDepth, maxDepth)
  const parentId = parentAt(moved, index, depth)
  const unmoved = moved.every((item, at) => item.id === items[at]?.id)
  if (unmoved && depth === active.depth) {
    return { depth, parentId, at: null }
  }
  return { depth, parentId, at: dropAtFor(moved, index, depth, parentId) }
}

/**
 * The depth nearest `wanted` the carried group, at `index` of the list, can take: no deeper than
 * one below the group before it, nor than `maxDepth` with the groups it carries; no shallower than
 * the group after it.
 */
const depthAllowed = (
  moved: ReadonlyArray<FlatGroup>,
  index: number,
  wanted: number,
  maxDepth: number,
): number => {
  // The carried group is at `index`, as `projectGroup` placed it.
  const active = moved[index]!
  const previous = moved[index - 1]
  const next = moved[index + 1]
  const deepest = Math.min(previous ? previous.depth + 1 : 0, maxDepth - active.height)
  const shallowest = Math.min(next ? next.depth : 0, deepest)
  return Math.max(shallowest, Math.min(wanted, deepest))
}

/**
 * The group the place at `index` of the list, at `depth`, is in: the group before it where it is
 * one deeper, else the parent of the nearest group above at that depth — none at the top.
 */
const parentAt = (moved: ReadonlyArray<FlatGroup>, index: number, depth: number): string | null => {
  const previous = moved[index - 1]
  if (depth === 0 || !previous) {
    return null
  }
  if (depth > previous.depth) {
    return previous.id
  }
  // The nearest group above at this depth shares its parent.
  const above = moved
    .slice(0, index)
    .reverse()
    .find((item) => item.depth === depth)
  return above?.parentId ?? null
}

/**
 * The place at `index` of the list, at `depth` in `parentId`, as the tree's drop: after the group
 * before it in that parent, else before the one after it, else inside the parent — which is the end
 * of it — else first among the setups.
 */
const dropAtFor = (
  moved: ReadonlyArray<FlatGroup>,
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
  return parentId ? { id: parentId, zone: 'inside' } : { zone: 'first' }
}
