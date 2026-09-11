import React, { ReactNode } from 'react'
import { cn } from '../common'
import { CaretRightIcon } from '@phosphor-icons/react'
import { useTable } from './table-context'

interface GroupHeaderProps {
  groupIndex: number
  rowIndex?: number
  children: ReactNode
  className?: string
  inHeader?: boolean
}

export const GroupHeader = ({
  groupIndex,
  children,
  rowIndex,
  inHeader: _inHeader = false,
  className,
}: GroupHeaderProps) => {
  const { columns, select, setCollapsedGroups, collapsedGroups, density } = useTable()
  const isCollapsed = collapsedGroups.findIndex((item) => item === groupIndex) !== -1

  const handleToggleGroup = () => {
    setCollapsedGroups((current) => {
      const foundIndex = current.findIndex((item) => item === groupIndex)

      if (foundIndex !== -1) {
        return current.filter((item) => item !== groupIndex)
      } else {
        return [...current, groupIndex]
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggleGroup}
      tabIndex={-1}
      data-row-index={rowIndex}
      className={cn(
        `w-full ${density === 'roomy' ? 'h-11' : 'h-8'} pt-1.5 bg-white dark:bg-zinc-900 flex flex-row items-center border-b border-gray-100 dark:border-zinc-800 gap-2 px-2 text-xs font-medium text-gray dark:text-zinc-100 truncate`,
        // {
        //   'border-t border-t-gray-50': !isPreviousCollapsed && !inHeader,
        // },
        className,
      )}
      style={{
        gridColumn: `span ${columns + (select ? 1 : 0)}`,
      }}
    >
      <CaretRightIcon
        weight="bold"
        className={cn(
          'pointer-events-none fill-current text-gray dark:text-zinc-100 size-3 -rotate-90',
          { 'rotate-90': isCollapsed },
        )}
      />
      <span>{children}</span>
    </button>
  )
}
