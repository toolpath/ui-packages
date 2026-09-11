import React, { memo, useEffect } from 'react'
import { Row as BaseRow, Cell } from '@table-library/react-table-library/table'
import { RowProps } from '@table-library/react-table-library/types/table'
import { cn } from '../common'
import { useRow } from './row-context'
import { RowDisabledProvider } from './row-disabled-context'
import { useTable } from './table-context'

export const Row = memo(
  ({
    children,
    onClick,
    disabled = false,
    ...props
  }: Omit<RowProps<any>, 'item'> & { disabled?: boolean }) => {
    const { item, isSelected, setIsHovered, isHovered, index, isDirectlySelected } = useRow()
    const { select, multiselect, setCursor, onBeforeSelectionChange, density } = useTable()

    const handleClick = (event: React.MouseEvent) => {
      // Check if selection change is allowed before updating cursor
      if (onBeforeSelectionChange) {
        const allowed = onBeforeSelectionChange(item, index)
        if (allowed === false) {
          // Prevent the default selection behavior from the library
          // Note: The library may pass a non-standard event, so check methods exist
          if (typeof event?.stopPropagation === 'function') {
            event.stopPropagation()
          }
          if (typeof event?.preventDefault === 'function') {
            event.preventDefault()
          }
          return
        }
      }

      // Set cursor to the clicked row's index
      setCursor(index)
      // Call any existing onClick handler
      if (onClick) {
        onClick(event)
      }
    }

    const handleMouseEnter = () => {
      setIsHovered(true)
    }

    const handleMouseLeave = () => {
      // Immediately reset hover state
      setIsHovered(false)
    }

    // Cleanup effect to ensure hover state is reset on unmount
    // This handles cases where onMouseLeave doesn't fire when moving quickly
    // or when rows are unmounted in virtualized tables
    useEffect(() => {
      return () => {
        setIsHovered(false)
      }
    }, [setIsHovered])

    return (
      <RowDisabledProvider value={disabled}>
        <BaseRow
          item={item}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          data-row-index={index}
          data-disabled={disabled || undefined}
          {...props}
        >
          {(select || multiselect) && (
            <Cell className="border-b border-gray-50 dark:border-zinc-800 stiff">
              <div
                className={cn(
                  'flex flex-row-reverse items-center w-full',
                  density === 'roomy' ? 'h-11' : 'h-8',
                  {
                    'bg-gray-50 dark:bg-zinc-800': isSelected || isHovered,
                    'text-gray-300 dark:text-zinc-500': disabled,
                  },
                )}
              >
                {isDirectlySelected && (
                  <div className="flex flex-row-reverse items-center h-7 text-xs font-medium">
                    <div className="w-1 h-full bg-info rounded-sm" />
                  </div>
                )}
              </div>
            </Cell>
          )}
          {children}
        </BaseRow>
      </RowDisabledProvider>
    )
  },
)
