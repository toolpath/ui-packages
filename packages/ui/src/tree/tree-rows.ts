import type { ReactNode } from 'react'

/** One node of a {@link Tree}. */
export interface TreeNode {
  /** Unique across the whole tree. */
  readonly id: string
  readonly label: ReactNode
  readonly children?: readonly TreeNode[]
  /** Greyed, and cannot be selected. It can still be focused, and opened if it has children. */
  readonly disabled?: boolean
  /** Greyed, but selectable as any other: an empty folder, say. */
  readonly muted?: boolean
  /** The row's tooltip. */
  readonly title?: string
}

/** A node as drawn: where it sits among the rows that are showing. */
export interface TreeRow {
  readonly node: TreeNode
  readonly depth: number
  readonly parentId: string | null
  /** 1-based position among its siblings, and how many there are. */
  readonly posInSet: number
  readonly setSize: number
}

const hasChildren = (node: TreeNode): boolean => (node.children?.length ?? 0) > 0

/** The rows showing: the tree flattened through the open nodes, in order. */
export const visibleRows = (
  nodes: readonly TreeNode[],
  expanded: ReadonlySet<string>,
): TreeRow[] => {
  const rows: TreeRow[] = []
  const visit = (level: readonly TreeNode[], depth: number, parentId: string | null) => {
    level.forEach((node, i) => {
      rows.push({ node, depth, parentId, posInSet: i + 1, setSize: level.length })
      if (hasChildren(node) && expanded.has(node.id)) visit(node.children ?? [], depth + 1, node.id)
    })
  }
  visit(nodes, 0, null)
  return rows
}

/** What a key does in the tree. */
export type TreeAction =
  | { readonly type: 'focus'; readonly id: string }
  | { readonly type: 'expand'; readonly id: string }
  | { readonly type: 'collapse'; readonly id: string }
  | { readonly type: 'select'; readonly id: string }
  | null

/**
 * The keyboard, as the WAI-ARIA tree pattern has it: Up and Down move, Home and
 * End go to the ends, Right opens a closed node or steps into an open one,
 * Left closes an open node or steps out to its parent, and Enter and Space
 * select. A branch that is not selectable opens and closes on Enter and Space
 * instead; a disabled node selects nothing.
 */
export const treeKey = (
  rows: readonly TreeRow[],
  focusedId: string | null,
  key: string,
  selectableBranches = true,
): TreeAction => {
  if (rows.length === 0) return null
  const at = Math.max(
    0,
    rows.findIndex((row) => row.node.id === focusedId),
  )
  const row = rows[at] as TreeRow
  const { node } = row
  const branch = hasChildren(node)
  const open = branch && rows[at + 1]?.parentId === node.id
  const focus = (index: number): TreeAction => ({
    type: 'focus',
    id: (rows[index] as TreeRow).node.id,
  })

  switch (key) {
    case 'ArrowDown':
      return focus(Math.min(at + 1, rows.length - 1))
    case 'ArrowUp':
      return focus(Math.max(at - 1, 0))
    case 'Home':
      return focus(0)
    case 'End':
      return focus(rows.length - 1)
    case 'ArrowRight':
      if (!branch) return null
      return open ? focus(at + 1) : { type: 'expand', id: node.id }
    case 'ArrowLeft':
      if (open) return { type: 'collapse', id: node.id }
      return row.parentId === null ? null : { type: 'focus', id: row.parentId }
    case 'Enter':
    case ' ':
      if (branch && !selectableBranches) {
        return { type: open ? 'collapse' : 'expand', id: node.id }
      }
      return node.disabled ? null : { type: 'select', id: node.id }
    default:
      return null
  }
}
