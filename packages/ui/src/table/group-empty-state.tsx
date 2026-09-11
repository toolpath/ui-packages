import React, { ReactNode } from 'react'
import { cn } from '../common'
import { getRowHeight } from './table'
import { useTable } from './table-context'

interface GroupEmptyStateProps {
  children: ReactNode
  className?: string
}

export const GroupEmptyState = ({ children, className }: GroupEmptyStateProps) => {
  const { columns, select, density } = useTable()

  return (
    <div
      className={cn(
        'w-full bg-white dark:bg-zinc-950 flex flex-row items-center justify-center px-2 text-xs text-gray-300 dark:text-zinc-200 font-normal border-b border-gray-100 dark:border-zinc-800',
        className,
      )}
      style={{
        gridColumn: `span ${columns + (select ? 1 : 0)}`,
        height: getRowHeight(density) * 2,
      }}
    >
      {children}
    </div>
  )
}
