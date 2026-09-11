import React from 'react'
import { HeaderRow as BaseHeaderRow } from '@table-library/react-table-library/table'
import { HeaderRowProps as BaseHeaderRowProps } from '@table-library/react-table-library/types/table'
import { cn } from '../common'
import { HeaderCell } from './header-cell'
import { useTable } from './table-context'

export interface HeaderRowProps extends BaseHeaderRowProps {
  noOffset?: boolean
  className?: string
}

export const HeaderRow = ({ children, noOffset = false, className, ...props }: HeaderRowProps) => {
  const { select, multiselect } = useTable()

  return (
    <BaseHeaderRow className={cn('!bg-white dark:!bg-zinc-900', className)} {...props}>
      {(select || multiselect) && !noOffset && (
        <HeaderCell
          resize={false}
          divider={false}
          className="stiff border-b border-gray-100 dark:border-zinc-800"
        />
      )}
      {children}
    </BaseHeaderRow>
  )
}
