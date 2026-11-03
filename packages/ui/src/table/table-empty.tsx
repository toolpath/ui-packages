import React, { ReactElement, ReactNode, useMemo } from 'react'
import { Header } from '@table-library/react-table-library/table'
import { useTable } from './table-context'

export interface TableEmptyProps {
  header?: ReactElement
  emptyButtonLabel?: ReactNode
  emptyButtonText?: string
  onClickEmptyButton?: () => void
}

export const TableEmpty = ({
  header,
  emptyButtonLabel = 'No items to display',
  emptyButtonText,
  onClickEmptyButton,
}: TableEmptyProps) => {
  const { columns, select } = useTable()

  const showButton = useMemo(() => {
    return Boolean(
      typeof emptyButtonText === 'string' &&
      emptyButtonText !== '' &&
      typeof onClickEmptyButton === 'function',
    )
  }, [emptyButtonText, onClickEmptyButton])

  return (
    <>
      {header && <Header>{header}</Header>}
      <div
        data-testid="table-empty-state"
        className="flex flex-row items-center h-64 w-full min-h-32"
        style={{
          gridColumn: `span ${columns + (select ? 1 : 0)}`,
        }}
      >
        <div className="flex w-full flex-col items-center gap-2.5 text-center text-sm font-medium text-gray-400 dark:text-zinc-200 pb-10">
          <label htmlFor={showButton ? 'empty-table-button' : undefined}>{emptyButtonLabel}</label>
          {showButton && (
            <button
              aria-label={emptyButtonText}
              type="button"
              onClick={onClickEmptyButton}
              className="flex flex-col items-center group rounded outline-none font-medium cursor-pointer select-none transition duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-info/75 text-gray dark:text-zinc-200 focus-visible:bg-gray-100 dark:focus-visible:bg-zinc-800"
              id="empty-table-button"
            >
              <div className="whitespace-nowrap rounded px-3 py-1 font-body text-xs font-medium tracking-normal bg-gray-100 group-hover:bg-gray-200/75 transition duration-200 ease-in-out group-active:scale-95 mx-auto dark:bg-zinc-800 dark:group-hover:bg-zinc-700">
                {emptyButtonText}
              </div>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
