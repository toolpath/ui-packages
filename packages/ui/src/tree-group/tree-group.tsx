import React, { createContext, HTMLAttributes, ReactNode, Ref, useContext, useId } from 'react'
import { CaretRightIcon } from '@phosphor-icons/react'
import { cn } from '../common'
import { IconButton, IconButtonProps } from '../icon-button'
import { Tooltip } from '../tooltip'

/*
  A group of rows under a header that folds them away, for lists that lay their own rows out (a
  CSS grid, editable cells) rather than through `Table`. Presentation only: the application holds
  whether the group is expanded, and leaves its rows out of any keyboard model while it is not.
  The guide lines are `Table`'s tree connectors, drawn the full height of a row.
*/

interface TreeGroupContextValue {
  label: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  itemsId: string
}

const TreeGroupContext = createContext<TreeGroupContextValue | null>(null)

const useTreeGroup = (part: string): TreeGroupContextValue => {
  const context = useContext(TreeGroupContext)
  if (!context) {
    throw new Error(`TreeGroup.${part} must be rendered inside a TreeGroup`)
  }
  return context
}

export interface TreeGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** What the group is called: the toggle's and the items' accessible names. */
  label: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}

/**
 * The group: its header, then its items, with a rule closing it off from what follows. It draws no
 * rule above itself: what comes before it, a row or another group, already ends in one.
 */
const TreeGroupRoot = ({
  label,
  expanded,
  onExpandedChange,
  children,
  className,
  ...props
}: TreeGroupProps) => {
  const itemsId = useId()
  return (
    <TreeGroupContext.Provider value={{ label, expanded, onExpandedChange, itemsId }}>
      <div
        data-expanded={expanded || undefined}
        {...props}
        className={cn('border-b border-gray-200 last:border-b-0 dark:border-zinc-700', className)}
      >
        {children}
      </div>
    </TreeGroupContext.Provider>
  )
}

export interface TreeGroupHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}

/** The group's own row, set apart from its items: a quiet ground and bolder text. */
const TreeGroupHeader = ({ children, className, ...props }: TreeGroupHeaderProps) => (
  <div {...props} className={cn('bg-gray-50 font-semibold dark:bg-zinc-800/60', className)}>
    {children}
  </div>
)

export interface TreeGroupToggleProps extends Omit<
  IconButtonProps,
  'children' | 'onClick' | 'aria-expanded' | 'aria-controls' | 'disabled'
> {
  /**
   * Why the group can't be folded or unfolded now. The caret stays focusable but does nothing,
   * says it is unavailable (`aria-disabled`), and gives this reason as its description and as a
   * tooltip on hover and focus.
   */
  disabledReason?: string
}

/**
 * The caret that folds the group: right while it is collapsed, down while it is expanded. A 24px
 * target by default (`size="lg"`).
 */
const TreeGroupToggle = ({
  className,
  size = 'lg',
  variant = 'muted',
  disabledReason,
  ...props
}: TreeGroupToggleProps) => {
  const { label, expanded, onExpandedChange, itemsId } = useTreeGroup('Toggle')
  const reasonId = useId()
  const toggle = (
    <IconButton
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
      {...props}
      size={size}
      variant={variant}
      aria-expanded={expanded}
      // Only while the items are there to point at: collapsed, they are not rendered.
      aria-controls={expanded ? itemsId : undefined}
      aria-disabled={disabledReason ? true : undefined}
      aria-describedby={disabledReason ? reasonId : props['aria-describedby']}
      onClick={() => {
        if (!disabledReason) {
          onExpandedChange(!expanded)
        }
      }}
      className={cn(
        { 'cursor-not-allowed opacity-50 hover:bg-transparent active:scale-100': disabledReason },
        className,
      )}
    >
      <CaretRightIcon
        weight="bold"
        aria-hidden
        className={cn('transition-transform duration-150', { 'rotate-90': expanded })}
      />
    </IconButton>
  )
  return disabledReason ? (
    <>
      <Tooltip tip={disabledReason}>{toggle}</Tooltip>
      <span id={reasonId} className="sr-only">
        {disabledReason}
      </span>
    </>
  ) : (
    toggle
  )
}

export interface TreeGroupItemsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'id' | 'aria-label'
> {
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}

/** The group's rows, a `role="group"` named by its label, rendered only while it is expanded. */
const TreeGroupItems = ({ children, ...props }: TreeGroupItemsProps) => {
  const { label, expanded, itemsId } = useTreeGroup('Items')
  return expanded ? (
    <div {...props} role="group" id={itemsId} aria-label={label}>
      {children}
    </div>
  ) : null
}

export interface TreeGuideProps {
  /** The last item of its group: the guide stops at its branch rather than running on. */
  last?: boolean
  /** How far down the row the branch meets the item, as a CSS length. */
  branchAt?: string
  className?: string
}

/**
 * The tree's guide down one item's row: a line the full height of the row, and a branch across to
 * the item; the last item's line ends at its branch. It stretches to its row in a flex row; in a
 * grid or block row, place it yourself (`absolute inset-y-0 left-4`, say, in a positioned row).
 */
export const TreeGuide = ({ last = false, branchAt = '0.75rem', className }: TreeGuideProps) => (
  <span
    aria-hidden
    data-last={last || undefined}
    className={cn('relative block w-3 self-stretch', className)}
  >
    <span
      className="absolute left-[5px] top-0 border-l border-gray-200 dark:border-zinc-700"
      // Past the row's own bottom border, so the line runs unbroken into the next row.
      style={last ? { height: branchAt } : { bottom: '-1px' }}
    />
    <span
      className="absolute left-[5px] right-0 border-t border-gray-200 dark:border-zinc-700"
      style={{ top: branchAt }}
    />
  </span>
)

export const TreeGroup = Object.assign(TreeGroupRoot, {
  Header: TreeGroupHeader,
  Toggle: TreeGroupToggle,
  Items: TreeGroupItems,
})
