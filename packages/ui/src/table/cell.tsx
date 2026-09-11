import React, { memo, useState } from 'react'
import { Cell as BaseCell } from '@table-library/react-table-library/table'
import { CellTree } from '@table-library/react-table-library/tree'
import { CellProps as BaseCellProps } from '@table-library/react-table-library/types/table'
import { cn } from '../common'
import { CellConsumer, CellProvider } from './cell-context'
import { useRow } from './row-context'
import { useRowDisabled } from './row-disabled-context'
import { useTable } from './table-context'

const Divider = () => {
  const { isSelected, isHovered } = useRow()
  return (
    <div className="absolute top-0 right-0 w-1 h-full py-1 shrink-0">
      <div
        className={cn('w-1 h-full border-r border-gray-50 dark:border-zinc-800', {
          'border-gray-100 dark:border-zinc-800': isSelected || isHovered,
        })}
      ></div>
    </div>
  )
}

export interface CellProps extends BaseCellProps {
  divider?: boolean
  tree?: boolean
}

export const Cell = memo(function Cell({
  children,
  className,
  divider = true,
  tree = false,
  ...props
}: CellProps) {
  const { columns, select, editingCell, density } = useTable()
  const { isSelected: isRowSelected, isHovered: isRowHovered, item, index: rowIndex } = useRow()
  const isRowDisabled = useRowDisabled()
  const [isHovered, setIsHovered] = useState(false)
  const isLastColumn = props.index === columns
  const cellIndex = props.index - (select ? 1 : 0)
  const nextCellIsEditing =
    editingCell !== null &&
    editingCell[0] === rowIndex &&
    editingCell[1] === item.id &&
    editingCell[2] === cellIndex + 1
  const Wrapper = tree ? CellTree : BaseCell

  return (
    <Wrapper
      item={tree ? item : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="border-b border-gray-50 dark:border-zinc-800 relative"
      {...props}
    >
      <CellProvider isHovered={isHovered} index={cellIndex}>
        <CellConsumer>
          {({ isEditing }) => {
            return (
              <>
                <div
                  className={cn(
                    'flex flex-row items-center text-xs font-medium px-1.5 flex-1',
                    density === 'roomy' ? 'h-11' : 'h-8',
                    {
                      'bg-gray-50 dark:bg-zinc-800': isRowSelected || isRowHovered,
                      'text-gray-300 dark:text-zinc-500': isRowDisabled,
                    },
                    className,
                  )}
                >
                  {children}
                </div>
                {divider && !isLastColumn && !isEditing && !nextCellIsEditing && <Divider />}
              </>
            )
          }}
        </CellConsumer>
      </CellProvider>
    </Wrapper>
  )
})
