import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import { cn } from '../common'
import { treeKey, visibleRows, type TreeNode } from './tree-rows'

export interface TreeProps {
  nodes: readonly TreeNode[]
  /** The ids of the open nodes. Controlled: change it in `onToggle`. */
  expanded: ReadonlySet<string>
  /** A node's chevron was pressed, or Right or Left opened or closed it. */
  onToggle: (id: string, open: boolean) => void
  /** The selected node's id. Controlled: change it in `onSelect`. */
  selected: string | null
  /** A row was clicked, or Enter or Space pressed on it. Never called for a disabled node. */
  onSelect: (node: TreeNode) => void
  /**
   * Whether a node with children can be selected. `true` by default; when
   * `false`, clicking one, or Enter or Space on it, opens and closes it.
   */
  selectableBranches?: boolean
  /** Pixels a level is indented by. */
  indent?: number
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
}

/**
 * A tree of nodes to choose from: chevrons, indentation, the selected row
 * highlighted, disabled and muted rows greyed.
 *
 * Accessible as the WAI-ARIA tree pattern: `role="tree"` with a flat
 * `treeitem` per showing row, carrying `aria-level`, `aria-setsize`,
 * `aria-posinset`, `aria-expanded` on a branch and `aria-selected`. The tree
 * is one tab stop — the focused row, else the selected one, else the first —
 * and the arrows, Home, End, Enter and Space move through it.
 *
 * Which nodes are open and which is selected are the caller's state, so they
 * can be remembered, or opened down to a node chosen elsewhere.
 */
export const Tree = ({
  nodes,
  expanded,
  onToggle,
  selected,
  onSelect,
  selectableBranches = true,
  indent = 12,
  className,
  ...aria
}: TreeProps) => {
  const rows = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded])
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const moved = useRef(false)

  const showing = (id: string | null) => id !== null && rows.some((row) => row.node.id === id)
  const tabId = showing(focusedId)
    ? focusedId
    : showing(selected)
      ? selected
      : (rows[0]?.node.id ?? null)

  // Focus follows a key that moved it, not a render that happened to change the tab stop.
  useEffect(() => {
    if (!moved.current || tabId === null) return
    moved.current = false
    refs.current.get(tabId)?.focus()
  }, [tabId])

  const choose = (node: TreeNode) => {
    const branch = (node.children?.length ?? 0) > 0
    if (branch && !selectableBranches) onToggle(node.id, !expanded.has(node.id))
    else if (!node.disabled) onSelect(node)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = treeKey(rows, tabId, event.key, selectableBranches)
    if (!action) return
    event.preventDefault()
    if (action.type === 'focus') {
      moved.current = true
      setFocusedId(action.id)
    } else if (action.type === 'expand' || action.type === 'collapse') {
      onToggle(action.id, action.type === 'expand')
    } else {
      const node = rows.find((row) => row.node.id === action.id)?.node
      if (node) onSelect(node)
    }
  }

  return (
    <div
      role="tree"
      {...aria}
      onKeyDown={onKeyDown}
      className={cn('py-1 text-xs text-gray-600 dark:text-zinc-100', className)}
    >
      {rows.map(({ node, depth, posInSet, setSize }) => {
        const branch = (node.children?.length ?? 0) > 0
        const open = branch && expanded.has(node.id)
        const isSelected = node.id === selected
        return (
          <div
            key={node.id}
            ref={(element) => {
              if (element) refs.current.set(node.id, element)
              else refs.current.delete(node.id)
            }}
            role="treeitem"
            aria-level={depth + 1}
            aria-setsize={setSize}
            aria-posinset={posInSet}
            aria-expanded={branch ? open : undefined}
            aria-selected={isSelected}
            aria-disabled={node.disabled || undefined}
            tabIndex={node.id === tabId ? 0 : -1}
            title={node.title}
            data-tree-id={node.id}
            className={cn(
              'flex cursor-default items-center gap-1 truncate py-[3px] pr-2 outline-none select-none',
              'focus-visible:ring-1 focus-visible:ring-info focus-visible:ring-inset',
              isSelected
                ? 'bg-info/15 text-gray-900 dark:bg-info/25 dark:text-white'
                : !node.disabled && 'hover:bg-gray-100 dark:hover:bg-zinc-800',
              (node.disabled || node.muted) && 'text-gray-400 dark:text-zinc-500',
            )}
            style={{ paddingLeft: 4 + depth * indent }}
            onClick={() => {
              setFocusedId(node.id)
              choose(node)
            }}
          >
            {branch ? (
              <span
                aria-hidden
                data-tree-toggle
                className="flex size-4 shrink-0 items-center justify-center text-gray-400 dark:text-zinc-400"
                onClick={(event) => {
                  event.stopPropagation()
                  setFocusedId(node.id)
                  onToggle(node.id, !open)
                }}
              >
                <CaretRightIcon
                  weight="bold"
                  className={cn('size-3 transition-transform', open && 'rotate-90')}
                />
              </span>
            ) : (
              <span aria-hidden className="w-4 shrink-0" />
            )}
            <span className="truncate">{node.label}</span>
          </div>
        )
      })}
    </div>
  )
}
