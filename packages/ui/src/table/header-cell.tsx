import React, { cloneElement, isValidElement } from 'react'
import type { HTMLAttributes, MouseEvent, ReactElement, ReactNode } from 'react'
import { HeaderCell as BaseHeaderCell, TableNode } from '@table-library/react-table-library/table'
import { HeaderCellSortProps } from '@table-library/react-table-library/types/sort'
import { cn } from '../common'
import { useTableSort } from './sort-context'
import { useTable } from './table-context'

const Divider = () => (
  <div className="absolute top-0 right-0 w-1 h-full py-1 shrink-0">
    <div className="w-1 h-full border-r border-gray-100 dark:border-zinc-800"></div>
  </div>
)

const SortIcon = ({ flipped = false }: { flipped?: boolean }) => (
  <div className="pr-2 text-center flex flex-row-reverse shrink-0">
    <svg
      className={cn('pointer-events-none fill-current text-gray dark:text-zinc-100 size-2', {
        'rotate-180': flipped,
      })}
      viewBox="0 0 5 3"
    >
      <path d="M0 2.5L2.5 0L5 2.5H0Z" />
    </svg>
  </div>
)

export interface HeaderCellProps extends Omit<HeaderCellSortProps, 'sortKey'> {
  sort?: boolean
  sortFn?: (array: Array<TableNode>) => Array<TableNode>
  width?: string | number
  sortKey?: string
  divider?: boolean
}

export interface HeaderCellInteractiveProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
}

export interface HeaderCellContentProps extends HTMLAttributes<HTMLSpanElement> {
  accessory?: ReactNode
  children: ReactNode
}

export const HeaderCellContent = ({
  accessory,
  children,
  className,
  style,
  ...props
}: HeaderCellContentProps) => {
  return (
    <span
      className={cn('gap-1', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minWidth: 0,
        width: '100%',
        textAlign: 'left',
        ...style,
      }}
      {...props}
    >
      <span
        style={{
          display: 'block',
          flex: '0 1 auto',
          minWidth: 0,
          overflow: 'hidden',
          textAlign: 'left',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
      {accessory}
    </span>
  )
}

export const HeaderCellInteractive = ({
  children,
  className,
  onClick,
  onMouseDown,
  style,
  ...props
}: HeaderCellInteractiveProps) => {
  const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    onClick?.(event)
  }

  const handleMouseDown = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    onMouseDown?.(event)
  }

  return (
    <span
      className={cn('inline-flex shrink-0 items-center', className)}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      style={{ ...style, pointerEvents: 'auto' }}
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * The accessory a `HeaderCellContent` carries, lifted out of the sort control.
 *
 * A control belongs beside the heading, not inside the button that sorts it.
 */
const splitAccessory = (children: ReactNode): { label: ReactNode; accessory: ReactNode } => {
  if (!isValidElement(children) || children.type !== HeaderCellContent) {
    return { label: children, accessory: null }
  }

  const content = children as ReactElement<HeaderCellContentProps>
  if (content.props.accessory == null) {
    return { label: children, accessory: null }
  }

  return {
    label: cloneElement(content, { accessory: null }),
    accessory: content.props.accessory,
  }
}

export const HeaderCell = ({
  children,
  sortKey,
  sortFn,
  resize = { minWidth: 25, resizerWidth: 8 },
  width: _width = '0px',
  divider = true,
  ...props
}: HeaderCellProps) => {
  const { columns, select, isEmpty, density } = useTable()
  const sort = useTableSort()
  const isLastColumn = props.index === columns - (select ? 0 : 1)
  const columnIndex = props.index

  const headerCellClass = 'border-b border-gray-100 dark:border-zinc-800 relative'
  const titleClass = cn(
    'flex flex-row items-center text-xs font-medium px-1.5 select-none',
    density === 'roomy' ? 'h-11' : 'h-8',
  )

  if (isEmpty || (!sortKey && !sortFn) || sort === null || typeof columnIndex !== 'number') {
    return (
      <BaseHeaderCell className={headerCellClass} resize={resize} {...props}>
        <div className={titleClass}>{children}</div>
        {divider && !isLastColumn && <Divider />}
      </BaseHeaderCell>
    )
  }

  const sorted = sort.sortKey === columnIndex
  const { label, accessory } = splitAccessory(children)

  return (
    <BaseHeaderCell className={headerCellClass} resize={resize} {...props}>
      <div className={cn(titleClass, 'min-w-0 w-full justify-start gap-1')}>
        {/*
          The heading is the sort, and the whole cell is its press: the button
          holds only the heading, and its `::after` covers the cell — which is
          the header cell's positioned box — so a click anywhere in it still
          sorts. An accessory is a sibling rather than a child, because a
          button inside a button is invalid HTML and a React hydration error,
          and it is positioned so it stays above that cover and keeps its own
          presses.
        */}
        <button
          type="button"
          onClick={() => sort.toggle(columnIndex)}
          className={cn(
            'flex min-w-0 items-center overflow-hidden text-left whitespace-nowrap cursor-pointer',
            "after:absolute after:inset-0 after:content-['']",
            { 'font-bold': sorted },
          )}
        >
          {label}
        </button>
        {accessory !== null && (
          <span className="relative flex shrink-0 items-center">{accessory}</span>
        )}
        {sorted && (
          <span className="ml-auto flex shrink-0 items-center">
            {sort.reverse ? <SortIcon flipped /> : <SortIcon />}
          </span>
        )}
      </div>
      {divider && !isLastColumn && <Divider />}
    </BaseHeaderCell>
  )
}
